import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { moveLeadToStage as moveLeadThroughHistory } from "@/server/leads/stage-history";
import { getEnv, isAiConfigured, isMediaAiConfigured } from "@/lib/env";
import { chatJson, type ChatMessage } from "@/lib/ai";
import { synthesizeSpeech } from "@/lib/ai/openai-media";
import { publish } from "@/server/events/bus";
import { isWindowOpen } from "@/server/inbox/window";
import { SendError, sendMediaMessage, sendText } from "@/server/inbox/send";
import { AgentAction, degradeAction, resolveKbMedia, resolveStage, type AgentActionType } from "@/server/ai/actions";
import { matchesHandoffIntent } from "@/server/ai/handoff";
import { buildAgentSystemPrompt } from "@/server/ai/prompts";
import { resolveInboundContent } from "@/server/ai/resolve-content";
import { kbImagesByEntry } from "@/server/kb/media";
import { readMediaFile } from "@/server/whatsapp/media";

/**
 * Turno del agente (FR-021..FR-025).
 *
 * Coalesce + lock in-process por conversación: ráfagas de mensajes → UNA
 * respuesta; nunca dos turnos simultáneos; lo que llega durante un turno
 * re-encola exactamente un turno más. Suficiente para el monolito de una
 * instancia (sin colas externas — Constitución II).
 */

type CoalesceEntry = {
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  pending: boolean;
};

const globalForAgent = globalThis as unknown as {
  __agentCoalesce?: Map<string, CoalesceEntry>;
};

function coalesceMap(): Map<string, CoalesceEntry> {
  if (!globalForAgent.__agentCoalesce) {
    globalForAgent.__agentCoalesce = new Map();
  }
  return globalForAgent.__agentCoalesce;
}

/** Punto de entrada con debounce (mensajes entrantes reales). */
export function scheduleAgentTurn(conversationId: string): void {
  const map = coalesceMap();
  const entry = map.get(conversationId) ?? {
    timer: null,
    running: false,
    pending: false,
  };
  map.set(conversationId, entry);

  if (entry.running) {
    entry.pending = true; // se re-encola al terminar el turno actual
    return;
  }
  if (entry.timer) clearTimeout(entry.timer);
  const delay = getEnv().AGENT_COALESCE_MS;
  entry.timer = setTimeout(() => {
    entry.timer = null;
    void executeTurn(conversationId);
  }, delay);
}

async function executeTurn(conversationId: string): Promise<void> {
  const map = coalesceMap();
  const entry = map.get(conversationId);
  if (!entry || entry.running) return;
  entry.running = true;
  try {
    await runAgentTurn(conversationId);
  } catch (err) {
    console.error("[agente] turno falló:", err);
  } finally {
    entry.running = false;
    if (entry.pending) {
      entry.pending = false;
      void executeTurn(conversationId);
    } else {
      map.delete(conversationId);
    }
  }
}

/**
 * Ejecuta UN turno del agente ahora (el Laboratorio lo llama directo, con
 * debounce 0 y sin pasar por el coalesce).
 */
export async function runAgentTurn(conversationId: string): Promise<void> {
  if (!isAiConfigured()) return;

  const db = getDb();
  const convRows = await db
    .select()
    .from(schema.conversation)
    .where(eq(schema.conversation.id, conversationId))
    .limit(1);
  const conversation = convRows[0];
  if (!conversation) return;
  const organizationId = conversation.organizationId;

  // Condiciones de silencio: handoff activo o IA apagada en la conversación.
  if (conversation.handoffAt || !conversation.aiEnabled) return;

  const profileRows = await db
    .select()
    .from(schema.agentProfile)
    .where(eq(schema.agentProfile.organizationId, organizationId))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) return;
  // El toggle global aplica a conversaciones reales; el Laboratorio evalúa el
  // comportamiento configurado aunque el agente aún no esté encendido.
  if (!conversation.isTest && !profile.enabled) return;

  const history = await db
    .select()
    .from(schema.message)
    .where(eq(schema.message.conversationId, conversationId))
    .orderBy(desc(schema.message.createdAt))
    .limit(20);
  history.reverse();
  const lastInbound = [...history].reverse().find((m) => m.direction === "in");
  if (!lastInbound) return;

  // Ventana cerrada: el agente JAMÁS envía texto libre → handoff 'ventana'.
  if (!conversation.isTest && !isWindowOpen(conversation.lastInboundAt)) {
    await applyHandoff(conversationId, organizationId, "ventana");
    return;
  }

  // Resolver el contenido textual de cada mensaje (texto directo, o
  // transcripción de audio / descripción de imagen vía IA multimedia). Se
  // cargan los media assets referenciados en un solo query y se resuelven en
  // paralelo; los que no producen texto se omiten del prompt.
  const assetIds = history
    .map((m) => m.mediaAssetId)
    .filter((id): id is string => Boolean(id));
  const assetsById = new Map<string, typeof schema.mediaAsset.$inferSelect>();
  if (assetIds.length > 0) {
    const assets = await db
      .select()
      .from(schema.mediaAsset)
      .where(inArray(schema.mediaAsset.id, assetIds));
    for (const a of assets) assetsById.set(a.id, a);
  }

  const resolved = await Promise.all(
    history.map(async (m) => ({
      direction: m.direction,
      text: await resolveInboundContent(
        m,
        m.mediaAssetId ? assetsById.get(m.mediaAssetId) ?? null : null
      ),
    }))
  );

  // Texto resuelto del último mensaje entrante (para el patrón de respaldo).
  const lastInboundText = [...resolved]
    .reverse()
    .find((r) => r.direction === "in")?.text;

  // Patrón de respaldo ANTES del LLM (FR-022).
  if (lastInboundText && matchesHandoffIntent(lastInboundText)) {
    await applyHandoff(conversationId, organizationId, "cliente");
    return;
  }

  // Política de respuesta por voz: en 'mirror' responde en voz solo si el
  // cliente escribió por voz; 'always' siempre; 'off' nunca.
  const voiceReply = getEnv().AGENT_VOICE_REPLY;
  const replyWithVoice =
    isMediaAiConfigured() &&
    (voiceReply === "always" ||
      (voiceReply === "mirror" && lastInbound.type === "audio"));

  // El último mensaje entrante era media (audio/imagen) pero no se pudo
  // resolver a texto (STT/visión falló o no está configurado). Responder con
  // cortesía en vez de dejar al cliente sin contestación.
  if (!lastInboundText && lastInbound.type !== "text") {
    const courtesy =
      lastInbound.type === "audio"
        ? "Disculpa, no pude escuchar bien tu audio. ¿Me lo puedes escribir?"
        : "Disculpa, no pude ver bien la imagen. ¿Me cuentas en qué te ayudo?";
    await deliverReply(conversation, courtesy, replyWithVoice);
    return;
  }

  const kb = await db
    .select()
    .from(schema.kbEntry)
    .where(eq(schema.kbEntry.organizationId, organizationId))
    .orderBy(asc(schema.kbEntry.createdAt));
  const stages = await db
    .select({ id: schema.pipelineStage.id, name: schema.pipelineStage.name })
    .from(schema.pipelineStage)
    .where(eq(schema.pipelineStage.organizationId, organizationId))
    .orderBy(asc(schema.pipelineStage.position));

  // Imágenes de KB de la org (para que el agente pueda enviarlas).
  const kbImages = await kbImagesByEntry(organizationId);
  const kbImagesForPrompt = new Map(
    [...kbImages.entries()].map(([entryId, imgs]) => [
      entryId,
      imgs.map((i) => ({ shortId: i.shortId })),
    ])
  );

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildAgentSystemPrompt({
        profile,
        kb,
        stages,
        kbImages: kbImagesForPrompt,
      }),
    },
    ...resolved
      .filter((m) => m.text)
      .map((m) => ({
        role: m.direction === "in" ? ("user" as const) : ("assistant" as const),
        content: m.text!,
      })),
  ];

  const result = await chatJson(AgentAction, messages);
  if (!result.ok) {
    if (result.error === "not_configured") return;
    // Fallo persistente del proveedor o salida imposible → escalar (FR-022).
    console.error(`[agente] fallo del proveedor (raw): ${result.detail}`);
    await applyHandoff(conversationId, organizationId, "error");
    return;
  }

  let action: AgentActionType = result.data;

  if (action.action === "move_stage") {
    const stage = resolveStage(action.stage, stages);
    if (!stage) {
      action = degradeAction(action);
    } else {
      await moveLeadToStage(organizationId, conversation.contactId, stage.id);
      publish(organizationId, {
        type: "conversation.updated",
        data: { conversation: { id: conversationId } },
      });
      if (action.reply) {
        await deliverReply(conversation, action.reply, replyWithVoice);
      }
      return;
    }
  }

  if (action.action === "send_media") {
    // Aplana las imágenes de la org y resuelve el shortId pedido.
    const allImages = [...kbImages.values()]
      .flat()
      .map((i) => ({ shortId: i.shortId, assetId: i.assetId }));
    const match = resolveKbMedia(action.mediaId, allImages);
    if (!match) {
      // Id inexistente → degradar a reply/none (nunca envía algo fuera de la org).
      action = degradeAction(action);
    } else {
      if (action.reply) {
        await deliverReply(conversation, action.reply, replyWithVoice);
      }
      await deliverImage(conversation, match.assetId);
      return;
    }
  }

  switch (action.action) {
    case "none":
      return;
    case "reply":
      await deliverReply(conversation, action.text, replyWithVoice);
      return;
    case "update_lead": {
      await appendLeadNote(organizationId, conversation.contactId, action.note);
      if (action.reply) await deliverReply(conversation, action.reply, replyWithVoice);
      return;
    }
    case "handoff": {
      if (action.farewell) {
        await deliverReply(conversation, action.farewell, replyWithVoice);
      }
      await applyHandoff(conversationId, organizationId, "modelo");
      return;
    }
  }
}

type Conversation = typeof schema.conversation.$inferSelect;

/**
 * Entrega la respuesta: envío real o persistencia sandbox (is_test).
 * Si `voice` es true, sintetiza el texto a nota de voz (TTS) y la envía como
 * audio; si el TTS falla, degrada a texto para no dejar al cliente sin
 * respuesta. El sandbox JAMÁS toca la API real ni OpenAI.
 */
async function deliverReply(
  conversation: Conversation,
  text: string,
  voice = false
): Promise<void> {
  if (conversation.isTest) {
    await persistTestOutbound(conversation, text);
    return;
  }
  if (voice) {
    const speech = await synthesizeSpeech(text);
    if (speech.ok) {
      try {
        await sendMediaMessage({
          conversationId: conversation.id,
          organizationId: conversation.organizationId,
          file: {
            data: speech.data,
            mimeType: speech.mimeType,
            fileName: "respuesta.ogg",
          },
        });
        return;
      } catch (err) {
        if (err instanceof SendError && err.code === "window_closed") {
          await applyHandoff(
            conversation.id,
            conversation.organizationId,
            "ventana"
          );
          return;
        }
        // Otro fallo al enviar audio → degradar a texto abajo.
        console.error(
          `[agente] envío de audio falló, degradando a texto: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    } else {
      console.error(`[agente] TTS falló, degradando a texto: ${speech.error}`);
    }
    // Degradación: continúa a enviar texto.
  }
  try {
    await sendText({
      conversationId: conversation.id,
      organizationId: conversation.organizationId,
      text,
      aiGenerated: true,
    });
  } catch (err) {
    if (err instanceof SendError && err.code === "window_closed") {
      await applyHandoff(conversation.id, conversation.organizationId, "ventana");
      return;
    }
    throw err;
  }
}

/**
 * Envía una imagen del conocimiento (KB) por WhatsApp. Lee el binario del disco
 * y reutiliza sendMediaMessage. El sandbox (is_test) NO toca la API real; un
 * fallo de envío se registra sin tumbar el turno; ventana cerrada → handoff.
 */
async function deliverImage(
  conversation: Conversation,
  assetId: string
): Promise<void> {
  if (conversation.isTest) {
    await persistTestOutbound(conversation, "[imagen del catálogo]");
    return;
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.mediaAsset)
    .where(eq(schema.mediaAsset.id, assetId))
    .limit(1);
  const asset = rows[0];
  if (!asset || asset.organizationId !== conversation.organizationId) {
    console.error(`[agente] imagen ${assetId} no encontrada para la org`);
    return;
  }
  try {
    const data = await readMediaFile(conversation.organizationId, assetId);
    await sendMediaMessage({
      conversationId: conversation.id,
      organizationId: conversation.organizationId,
      file: {
        data,
        mimeType: asset.mimeType ?? "image/jpeg",
        fileName: asset.fileName ?? "imagen.jpg",
      },
    });
  } catch (err) {
    if (err instanceof SendError && err.code === "window_closed") {
      await applyHandoff(conversation.id, conversation.organizationId, "ventana");
      return;
    }
    // No tumbar el turno: la imagen no se envió, ya hubo (o no) un texto.
    console.error(
      `[agente] envío de imagen falló: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/** Mensaje saliente del sandbox: se persiste, JAMÁS toca la API (FR-031). */
async function persistTestOutbound(
  conversation: Conversation,
  text: string
): Promise<void> {
  const db = getDb();
  await db.insert(schema.message).values({
    id: newId("message"),
    organizationId: conversation.organizationId,
    conversationId: conversation.id,
    direction: "out",
    type: "text",
    text,
    status: "sent",
    aiGenerated: true,
    origin: "ai",
  });
  await db
    .update(schema.conversation)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.conversation.id, conversation.id));
}

export async function applyHandoff(
  conversationId: string,
  organizationId: string,
  reason: "cliente" | "modelo" | "error" | "ventana"
): Promise<void> {
  const db = getDb();
  const updated = await db
    .update(schema.conversation)
    .set({ handoffAt: new Date(), handoffReason: reason, updatedAt: new Date() })
    .where(eq(schema.conversation.id, conversationId))
    .returning();
  if (!updated[0]) return;
  publish(organizationId, {
    type: "conversation.updated",
    data: {
      conversation: { id: conversationId, handoffReason: reason },
    },
  });
}

async function moveLeadToStage(
  organizationId: string,
  contactId: string,
  stageId: string
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.lead.id })
    .from(schema.lead)
    .where(
      scoped(
        schema.lead.organizationId,
        organizationId,
        eq(schema.lead.contactId, contactId)
      )
    )
    .limit(1);
  const leadId = rows[0]?.id;
  if (!leadId) return;

  // Por la puerta única: el agente mueve tarjetas igual que el dueño, y su
  // movimiento tiene que quedar en la bitácora o el embudo mentirá sobre
  // quién hizo avanzar cada lead.
  await moveLeadThroughHistory({
    organizationId,
    leadId,
    toStageId: stageId,
    source: "bot",
    extra: { lastActivityAt: new Date() },
    // El agente no clasifica pérdidas: si su etapa destino resultara ser la
    // perdida, la puerta lo rechaza y el lead se queda donde está — mejor eso
    // que un motivo inventado.
  });
}

async function appendLeadNote(
  organizationId: string,
  contactId: string,
  note: string
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.contact.id, notes: schema.contact.notes })
    .from(schema.contact)
    .where(eq(schema.contact.id, contactId))
    .limit(1);
  const contact = rows[0];
  if (!contact) return;
  const stamped = `[IA] ${note}`;
  await db
    .update(schema.contact)
    .set({
      notes: contact.notes ? `${contact.notes}\n${stamped}` : stamped,
      updatedAt: new Date(),
    })
    .where(eq(schema.contact.id, contact.id));
}
