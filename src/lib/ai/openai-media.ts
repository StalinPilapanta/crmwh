import { getEnv, isMediaAiConfigured } from "@/lib/env";

/**
 * Adaptador de IA multimedia (OpenAI) — ÚNICA frontera con OpenAI para STT
 * (Whisper), visión (gpt-4o) y TTS (voz). Igual que el adaptador LLM: la salida
 * externa es impredecible, así que cada función devuelve un resultado tipado y
 * NUNCA lanza — un fallo del proveedor jamás debe tumbar el turno del agente.
 */

export type MediaTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export type SpeechResult =
  | { ok: true; data: Buffer; mimeType: string }
  | { ok: false; error: string };

const STT_TIMEOUT_MS = 60_000;
const VISION_TIMEOUT_MS = 60_000;
const TTS_TIMEOUT_MS = 60_000;

/**
 * Transcribe un audio a texto con Whisper.
 * `POST /v1/audio/transcriptions` (multipart).
 */
export async function transcribeAudio(input: {
  data: Buffer;
  mimeType: string;
}): Promise<MediaTextResult> {
  if (!isMediaAiConfigured()) {
    return { ok: false, error: "not_configured" };
  }
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(input.data)], {
      type: input.mimeType || "application/octet-stream",
    });
    form.append("file", blob, fileNameForMime(input.mimeType, "audio"));
    form.append("model", env.OPENAI_STT_MODEL);
    form.append("language", "es");

    const res = await fetch(`${env.OPENAI_BASE_URL}/v1/audio/transcriptions`, {
      method: "POST",
      headers: {
        // La clave jamás se loguea; solo viaja en este header.
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `STT ${res.status}: ${truncate(text)}` };
    }
    const json = (await res.json()) as { text?: string };
    const text = json.text?.trim();
    if (!text) {
      return { ok: false, error: "STT sin texto" };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Interpreta una imagen y devuelve una descripción breve y accionable en
 * español. `POST /v1/chat/completions` con contenido multimodal (image_url
 * en data-URI base64).
 */
export async function describeImage(input: {
  data: Buffer;
  mimeType: string;
  caption?: string;
}): Promise<MediaTextResult> {
  if (!isMediaAiConfigured()) {
    return { ok: false, error: "not_configured" };
  }
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);
  try {
    const dataUri = `data:${input.mimeType || "image/jpeg"};base64,${input.data.toString("base64")}`;
    const instruction =
      "Eres un asistente que describe imágenes para un agente de ventas por " +
      "WhatsApp. Describe en español, en 1-3 frases, qué se ve en la imagen y " +
      "cualquier dato útil (producto, texto visible, comprobante, etc.). Sé " +
      "conciso y objetivo." +
      (input.caption ? ` El cliente escribió: "${input.caption}".` : "");

    const res = await fetch(`${env.OPENAI_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: dataUri } },
            ],
          },
        ],
        max_tokens: 300,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `visión ${res.status}: ${truncate(text)}` };
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, error: "visión sin contenido" };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sintetiza texto a voz (nota de voz de WhatsApp) con la voz configurada.
 * `POST /v1/audio/speech`, formato opus (ogg) para que WhatsApp lo muestre
 * como nota de voz.
 */
export async function synthesizeSpeech(text: string): Promise<SpeechResult> {
  if (!isMediaAiConfigured()) {
    return { ok: false, error: "not_configured" };
  }
  const trimmed = text?.trim();
  if (!trimmed) {
    return { ok: false, error: "texto vacío para TTS" };
  }
  const env = getEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.OPENAI_BASE_URL}/v1/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_TTS_MODEL,
        voice: env.OPENAI_TTS_VOICE,
        input: trimmed,
        response_format: "opus",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `TTS ${res.status}: ${truncate(errText)}` };
    }
    const arrayBuffer = await res.arrayBuffer();
    const data = Buffer.from(arrayBuffer);
    if (data.length === 0) {
      return { ok: false, error: "TTS sin audio" };
    }
    // WhatsApp reconoce audio/ogg (opus) como nota de voz.
    return { ok: true, data, mimeType: "audio/ogg" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

function fileNameForMime(mimeType: string, fallback: "audio"): string {
  const map: Record<string, string> = {
    "audio/ogg": "audio.ogg",
    "audio/opus": "audio.ogg",
    "audio/mpeg": "audio.mp3",
    "audio/mp4": "audio.m4a",
    "audio/aac": "audio.aac",
    "audio/amr": "audio.amr",
    "audio/wav": "audio.wav",
  };
  return map[mimeType] ?? `${fallback}.ogg`;
}

function truncate(s: string, n = 300): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
