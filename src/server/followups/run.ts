import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { isWindowOpen } from "@/server/inbox/window";
import { sendText } from "@/server/inbox/send";

/**
 * Barrido de seguimiento automático de leads (re-enganche).
 *
 * Envía UN recordatorio de texto libre a las conversaciones donde el negocio
 * habló último y el cliente no respondió, ANTES de que cierre la ventana de 24h
 * (a las ~20h por defecto). Al estar dentro de la ventana es un mensaje de
 * servicio: gratis y sin plantillas de Meta. Idempotente por `followupStage`.
 *
 * Se dispara desde un cron externo (Coolify) vía POST /api/followups/run.
 */

const DEFAULT_REMINDER =
  "Hola 👋 ¿Sigues interesado? Quedo atento para ayudarte con lo que necesites.";

export type FollowupSummary = {
  reminders: number;
  skipped: number;
  errors: number;
};

export async function runFollowups(
  now: Date = new Date()
): Promise<FollowupSummary> {
  const db = getDb();
  const env = getEnv();
  const summary: FollowupSummary = { reminders: 0, skipped: 0, errors: 0 };

  // Organizaciones con seguimiento activo.
  const profiles = await db
    .select()
    .from(schema.agentProfile)
    .where(eq(schema.agentProfile.followupEnabled, true));

  if (profiles.length === 0) return summary;

  // Umbral de antigüedad: el último mensaje (saliente) debe tener al menos
  // REMINDER_AFTER_H horas.
  const thresholdMs = env.FOLLOWUP_REMINDER_AFTER_H * 60 * 60 * 1000;
  const cutoff = new Date(now.getTime() - thresholdMs);

  for (const profile of profiles) {
    const reminderText =
      profile.followupReminderText?.trim() || DEFAULT_REMINDER;

    // Candidatas: conversación real, sin handoff, IA activa, aún sin
    // recordatorio (stage 0), el negocio habló último (lastMessageAt existe y
    // es posterior al último entrante, o no hay entrante), y con antigüedad
    // suficiente. La ventana abierta se verifica luego (depende de now).
    let candidates;
    try {
      candidates = await db
        .select()
        .from(schema.conversation)
        .where(
          and(
            eq(schema.conversation.organizationId, profile.organizationId),
            eq(schema.conversation.isTest, false),
            isNull(schema.conversation.handoffAt),
            eq(schema.conversation.aiEnabled, true),
            eq(schema.conversation.followupStage, 0),
            sql`${schema.conversation.lastMessageAt} is not null`,
            lte(schema.conversation.lastMessageAt, cutoff),
            or(
              isNull(schema.conversation.lastInboundAt),
              sql`${schema.conversation.lastMessageAt} > ${schema.conversation.lastInboundAt}`
            )
          )
        )
        .limit(env.FOLLOWUP_BATCH_LIMIT);
    } catch (err) {
      summary.errors++;
      console.error(
        `[followups] query de candidatas falló (org ${profile.organizationId}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      continue;
    }

    for (const conv of candidates) {
      // Solo dentro de la ventana de 24h (texto libre gratis). Si ya cerró, se
      // omite para no forzar un envío con costo.
      if (!isWindowOpen(conv.lastInboundAt, now)) {
        summary.skipped++;
        continue;
      }

      try {
        await sendText({
          conversationId: conv.id,
          organizationId: conv.organizationId,
          text: reminderText,
          aiGenerated: true,
        });
        await db
          .update(schema.conversation)
          .set({ followupStage: 1, followupLastAt: now, updatedAt: now })
          .where(eq(schema.conversation.id, conv.id));
        summary.reminders++;
      } catch (err) {
        // No avanza el stage → se reintenta en el próximo barrido.
        summary.errors++;
        console.error(
          `[followups] envío falló (conv ${conv.id}): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  return summary;
}
