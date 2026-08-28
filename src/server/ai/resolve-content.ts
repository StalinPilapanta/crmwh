import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv, isMediaAiConfigured } from "@/lib/env";
import { ensureAssetAvailable, readMediaFile } from "@/server/whatsapp/media";
import { describeImage, transcribeAudio } from "@/lib/ai/openai-media";

type Message = typeof schema.message.$inferSelect;
type MediaAsset = typeof schema.mediaAsset.$inferSelect;

/**
 * Resuelve el contenido textual de un mensaje entrante para el prompt del
 * agente. Texto → el propio texto. Audio → transcripción (STT). Imagen →
 * descripción (visión). El resultado se persiste en `media_asset.transcript`
 * para no reprocesar. Devuelve null si no hay contenido procesable (media que
 * falló, sin IA multimedia configurada, o supera el límite de tamaño).
 *
 * NUNCA lanza: cualquier fallo se registra y devuelve null.
 */
export async function resolveInboundContent(
  message: Message,
  asset: MediaAsset | null
): Promise<string | null> {
  // Texto directo (incluye el caso de mensajes de texto normales).
  if (message.text && message.text.trim().length > 0) {
    return message.text;
  }

  // Solo audio e imagen son procesables por ahora.
  if (message.type !== "audio" && message.type !== "image") {
    return null;
  }
  if (!asset) return null;

  // Reusar lo ya procesado (idempotencia / control de costo).
  if (asset.transcript && asset.transcript.trim().length > 0) {
    return prefixed(message.type, asset.transcript, asset.caption);
  }

  // Sin IA multimedia configurada: comportarse como antes (ignorar media).
  if (!isMediaAiConfigured()) return null;

  try {
    // Garantizar que el binario está descargado en disco.
    const ready = await ensureAssetAvailable(message.organizationId, asset.id);
    if (!ready || ready.fetchStatus !== "available") return null;

    const buffer = await readMediaFile(message.organizationId, asset.id);

    if (message.type === "audio") {
      if (buffer.length > getEnv().MEDIA_STT_MAX_BYTES) {
        console.warn(
          `[media] audio ${asset.id} excede MEDIA_STT_MAX_BYTES; se omite`
        );
        return null;
      }
      const result = await transcribeAudio({
        data: buffer,
        mimeType: ready.mimeType ?? "audio/ogg",
      });
      if (!result.ok) {
        console.error(`[media] STT falló para ${asset.id}: ${result.error}`);
        return null;
      }
      await persistTranscript(asset.id, result.text);
      return prefixed("audio", result.text, asset.caption);
    }

    // Imagen.
    const result = await describeImage({
      data: buffer,
      mimeType: ready.mimeType ?? "image/jpeg",
      caption: asset.caption ?? undefined,
    });
    if (!result.ok) {
      console.error(`[media] visión falló para ${asset.id}: ${result.error}`);
      return null;
    }
    await persistTranscript(asset.id, result.text);
    return prefixed("image", result.text, asset.caption);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[media] resolveInboundContent ${asset.id}: ${msg}`);
    return null;
  }
}

/** Etiqueta el contenido resuelto para que el agente sepa el origen. */
function prefixed(
  type: "audio" | "image",
  text: string,
  caption: string | null
): string {
  const cap = caption && caption.trim().length > 0 ? ` (texto: "${caption.trim()}")` : "";
  if (type === "audio") return `[nota de voz] ${text}`;
  return `[imagen] ${text}${cap}`;
}

async function persistTranscript(assetId: string, transcript: string): Promise<void> {
  const db = getDb();
  await db
    .update(schema.mediaAsset)
    .set({ transcript, updatedAt: new Date() })
    .where(eq(schema.mediaAsset.id, assetId));
}
