import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { graphRequest } from "@/lib/meta/client";
import { getCredentialsByOrg } from "@/server/whatsapp/credentials";

/**
 * Envía el indicador "escribiendo…" + marca como leído el último mensaje
 * entrante de la conversación. Best-effort: si falla, no lanza ni afecta el
 * flujo del agente — solo se pierde el "escribiendo…" y la vida sigue.
 *
 * Respeta isTest (sandbox), handoff y IA apagada: en esos casos no hace nada.
 *
 * Reutiliza el mecanismo de la Graph API que ya existía en
 * `POST /api/bot/typing`: `status:"read"` + `typing_indicator:{type:"text"}`.
 */
export async function markReadAndTyping(input: {
  organizationId: string;
  conversationId: string;
}): Promise<void> {
  try {
    const db = getDb();
    const convs = await db
      .select()
      .from(schema.conversation)
      .where(
        and(
          eq(schema.conversation.organizationId, input.organizationId),
          eq(schema.conversation.id, input.conversationId)
        )
      )
      .limit(1);
    const conv = convs[0];
    if (!conv) return;
    // Guards: sandbox, handoff, IA apagada.
    if (conv.isTest || conv.handoffAt || !conv.aiEnabled) return;

    // Último mensaje entrante con waMessageId (el que se marca leído).
    const msgs = await db
      .select({ waMessageId: schema.message.waMessageId })
      .from(schema.message)
      .where(
        and(
          eq(schema.message.organizationId, input.organizationId),
          eq(schema.message.conversationId, input.conversationId),
          eq(schema.message.direction, "in"),
          isNotNull(schema.message.waMessageId)
        )
      )
      .orderBy(desc(schema.message.createdAt))
      .limit(1);
    const wamid = msgs[0]?.waMessageId;
    if (!wamid) return;

    const creds = await getCredentialsByOrg(input.organizationId);
    if (!creds) return;

    await graphRequest(`${creds.phoneNumberId}/messages`, {
      method: "POST",
      token: creds.token,
      body: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: wamid,
        typing_indicator: { type: "text" },
      },
    });
  } catch {
    // Best-effort: fallo silencioso. El turno del agente continúa.
  }
}
