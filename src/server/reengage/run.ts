import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { isWindowOpen } from "@/server/inbox/window";
import { sendText } from "@/server/inbox/send";

/**
 * Re-enganche contextual: cuando el agente pidió datos de entrega y el cliente
 * no responde en un rato corto (~45 min por defecto), le envía un mensaje
 * breve para retomar el cierre de la venta.
 *
 * Distinto del seguimiento de 20h (followups), que es genérico y para leads
 * fríos. Este es corto, contextual, y para cerrar "en caliente".
 *
 * Idempotente por `reengageStage`: no repite el mensaje en el mismo ciclo.
 * Solo dentro de la ventana de 24h (sin costo, sin plantilla).
 * Se dispara desde un cron externo (Coolify) cada ~15 min.
 */

const DEFAULT_REENGAGE =
  "¿Seguimos con tu pedido? Cuando quieras me pasas los datos y lo dejamos listo 😊";

export type ReengageSummary = {
  sent: number;
  skipped: number;
  errors: number;
};

export async function runReengage(
  now: Date = new Date()
): Promise<ReengageSummary> {
  const db = getDb();
  const env = getEnv();
  const summary: ReengageSummary = { sent: 0, skipped: 0, errors: 0 };

  // Orgs con seguimiento activo (reutiliza followupEnabled como toggle general).
  const profiles = await db
    .select()
    .from(schema.agentProfile)
    .where(eq(schema.agentProfile.followupEnabled, true));

  if (profiles.length === 0) return summary;

  const thresholdMs = env.REENGAGE_AFTER_MIN * 60 * 1000;
  const cutoff = new Date(now.getTime() - thresholdMs);

  for (const profile of profiles) {
    const text = profile.reengageText?.trim() || DEFAULT_REENGAGE;

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
            eq(schema.conversation.reengageStage, 0),
            // Tiene marca de "esperando datos" y ya pasó el umbral.
            sql`${schema.conversation.awaitingReplyAt} is not null`,
            lte(schema.conversation.awaitingReplyAt, cutoff),
            // Negocio habló último.
            sql`${schema.conversation.lastMessageAt} is not null`,
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
        `[reengage] query falló (org ${profile.organizationId}): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      continue;
    }

    for (const conv of candidates) {
      if (!isWindowOpen(conv.lastInboundAt, now)) {
        summary.skipped++;
        continue;
      }

      try {
        await sendText({
          conversationId: conv.id,
          organizationId: conv.organizationId,
          text,
          aiGenerated: true,
        });
        await db
          .update(schema.conversation)
          .set({ reengageStage: 1, updatedAt: now })
          .where(eq(schema.conversation.id, conv.id));
        summary.sent++;
      } catch (err) {
        summary.errors++;
        console.error(
          `[reengage] envío falló (conv ${conv.id}): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  return summary;
}
