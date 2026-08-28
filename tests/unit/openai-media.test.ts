import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Adaptador de IA multimedia (OpenAI): STT, visión y TTS.
 * Regla clave: cada función devuelve un resultado tipado y NUNCA lanza,
 * incluso ante errores del proveedor o de red — un hipo de OpenAI jamás
 * debe tumbar el turno del agente.
 */

// Config de entorno mínima para activar el adaptador.
const ENV = {
  OPENAI_API_KEY: "sk-test-key",
  OPENAI_BASE_URL: "https://api.openai.com",
  OPENAI_STT_MODEL: "whisper-1",
  OPENAI_VISION_MODEL: "gpt-4o-mini",
  OPENAI_TTS_MODEL: "tts-1",
  OPENAI_TTS_VOICE: "nova",
};

vi.mock("@/lib/env", () => ({
  getEnv: () => ENV,
  isMediaAiConfigured: () => Boolean(ENV.OPENAI_API_KEY),
}));

const originalFetch = global.fetch;

beforeEach(() => {
  ENV.OPENAI_API_KEY = "sk-test-key";
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

async function load() {
  return import("@/lib/ai/openai-media");
}

describe("transcribeAudio", () => {
  it("transcribe con éxito y devuelve el texto", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "  hola quiero comprar  " }),
    }) as unknown as typeof fetch;

    const { transcribeAudio } = await load();
    const res = await transcribeAudio({
      data: Buffer.from("fake-audio"),
      mimeType: "audio/ogg",
    });

    expect(res).toEqual({ ok: true, text: "hola quiero comprar" });
  });

  it("error del proveedor → resultado ok:false, no lanza", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    }) as unknown as typeof fetch;

    const { transcribeAudio } = await load();
    const res = await transcribeAudio({
      data: Buffer.from("x"),
      mimeType: "audio/ogg",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("STT 429");
  });

  it("excepción de red → resultado ok:false, no lanza", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const { transcribeAudio } = await load();
    const res = await transcribeAudio({
      data: Buffer.from("x"),
      mimeType: "audio/ogg",
    });

    expect(res).toEqual({ ok: false, error: "network down" });
  });

  it("sin API key → not_configured", async () => {
    ENV.OPENAI_API_KEY = "";
    const { transcribeAudio } = await load();
    const res = await transcribeAudio({
      data: Buffer.from("x"),
      mimeType: "audio/ogg",
    });
    expect(res).toEqual({ ok: false, error: "not_configured" });
  });
});

describe("describeImage", () => {
  it("describe con éxito y devuelve el texto", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Una caja de gomitas de moringa." } }],
      }),
    }) as unknown as typeof fetch;

    const { describeImage } = await load();
    const res = await describeImage({
      data: Buffer.from("fake-img"),
      mimeType: "image/jpeg",
      caption: "¿qué es esto?",
    });

    expect(res).toEqual({ ok: true, text: "Una caja de gomitas de moringa." });
  });

  it("error del proveedor → ok:false, no lanza", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    }) as unknown as typeof fetch;

    const { describeImage } = await load();
    const res = await describeImage({
      data: Buffer.from("x"),
      mimeType: "image/png",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("visión 500");
  });
});

describe("synthesizeSpeech", () => {
  it("sintetiza con éxito y devuelve buffer audio/ogg", async () => {
    const fakeAudio = new Uint8Array([1, 2, 3, 4]).buffer;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => fakeAudio,
    }) as unknown as typeof fetch;

    const { synthesizeSpeech } = await load();
    const res = await synthesizeSpeech("hola, gracias por tu compra");

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.mimeType).toBe("audio/ogg");
      expect(res.data.length).toBe(4);
    }
  });

  it("texto vacío → ok:false sin llamar al proveedor", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { synthesizeSpeech } = await load();
    const res = await synthesizeSpeech("   ");

    expect(res.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("error del proveedor → ok:false, no lanza", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    }) as unknown as typeof fetch;

    const { synthesizeSpeech } = await load();
    const res = await synthesizeSpeech("hola");

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("TTS 401");
  });
});
