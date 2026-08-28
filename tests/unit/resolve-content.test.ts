import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * resolveInboundContent: convierte un mensaje entrante (texto/audio/imagen) al
 * texto que verá el agente. Claves: reusa la transcripción persistida (no
 * re-llama al proveedor), procesa una vez y persiste, y devuelve null ante
 * fallos sin lanzar.
 */

const mediaConfigured = { value: true };

const { transcribeAudio, describeImage } = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
  describeImage: vi.fn(),
}));

const { ensureAssetAvailable, readMediaFile } = vi.hoisted(() => ({
  ensureAssetAvailable: vi.fn(),
  readMediaFile: vi.fn(),
}));

const updateSet = vi.fn();

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ MEDIA_STT_MAX_BYTES: 16_000_000 }),
  isMediaAiConfigured: () => mediaConfigured.value,
}));

vi.mock("@/lib/ai/openai-media", () => ({ transcribeAudio, describeImage }));

vi.mock("@/server/whatsapp/media", () => ({
  ensureAssetAvailable,
  readMediaFile,
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    update: () => ({
      set: (v: unknown) => {
        updateSet(v);
        return { where: () => Promise.resolve() };
      },
    }),
  }),
  schema: { mediaAsset: { id: "id" } },
}));

function makeMessage(over: Record<string, unknown> = {}) {
  return {
    id: "msg_1",
    organizationId: "org_1",
    type: "text",
    text: null,
    ...over,
  } as never;
}

function makeAsset(over: Record<string, unknown> = {}) {
  return {
    id: "ma_1",
    organizationId: "org_1",
    mimeType: "audio/ogg",
    caption: null,
    transcript: null,
    fetchStatus: "available",
    ...over,
  } as never;
}

beforeEach(() => {
  mediaConfigured.value = true;
  transcribeAudio.mockReset();
  describeImage.mockReset();
  ensureAssetAvailable.mockReset();
  readMediaFile.mockReset();
  updateSet.mockReset();
});

afterEach(() => vi.clearAllMocks());

async function load() {
  return import("@/server/ai/resolve-content");
}

describe("resolveInboundContent", () => {
  it("mensaje de texto → devuelve el texto tal cual", async () => {
    const { resolveInboundContent } = await load();
    const res = await resolveInboundContent(
      makeMessage({ type: "text", text: "hola" }),
      null
    );
    expect(res).toBe("hola");
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("audio con transcript ya persistido → reusa, NO re-llama STT", async () => {
    const { resolveInboundContent } = await load();
    const res = await resolveInboundContent(
      makeMessage({ type: "audio" }),
      makeAsset({ transcript: "quiero dos cajas" })
    );
    expect(res).toBe("[nota de voz] quiero dos cajas");
    expect(ensureAssetAvailable).not.toHaveBeenCalled();
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  it("audio pendiente → transcribe una vez y persiste", async () => {
    ensureAssetAvailable.mockResolvedValue(
      makeAsset({ fetchStatus: "available", mimeType: "audio/ogg" })
    );
    readMediaFile.mockResolvedValue(Buffer.from("audio-bytes"));
    transcribeAudio.mockResolvedValue({ ok: true, text: "hola buenas" });

    const { resolveInboundContent } = await load();
    const res = await resolveInboundContent(
      makeMessage({ type: "audio" }),
      makeAsset()
    );

    expect(res).toBe("[nota de voz] hola buenas");
    expect(transcribeAudio).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: "hola buenas" })
    );
  });

  it("imagen pendiente → describe e incluye caption", async () => {
    ensureAssetAvailable.mockResolvedValue(
      makeAsset({ fetchStatus: "available", mimeType: "image/jpeg" })
    );
    readMediaFile.mockResolvedValue(Buffer.from("img-bytes"));
    describeImage.mockResolvedValue({ ok: true, text: "una caja de gomitas" });

    const { resolveInboundContent } = await load();
    const res = await resolveInboundContent(
      makeMessage({ type: "image" }),
      makeAsset({ mimeType: "image/jpeg", caption: "esto" })
    );

    expect(res).toBe('[imagen] una caja de gomitas (texto: "esto")');
    expect(describeImage).toHaveBeenCalledTimes(1);
  });

  it("STT falla → devuelve null sin lanzar", async () => {
    ensureAssetAvailable.mockResolvedValue(makeAsset({ fetchStatus: "available" }));
    readMediaFile.mockResolvedValue(Buffer.from("x"));
    transcribeAudio.mockResolvedValue({ ok: false, error: "boom" });

    const { resolveInboundContent } = await load();
    const res = await resolveInboundContent(
      makeMessage({ type: "audio" }),
      makeAsset()
    );
    expect(res).toBeNull();
  });

  it("sin IA multimedia configurada → null y no llama al proveedor", async () => {
    mediaConfigured.value = false;
    const { resolveInboundContent } = await load();
    const res = await resolveInboundContent(
      makeMessage({ type: "audio" }),
      makeAsset()
    );
    expect(res).toBeNull();
    expect(ensureAssetAvailable).not.toHaveBeenCalled();
  });

  it("audio excede MEDIA_STT_MAX_BYTES → null sin transcribir", async () => {
    ensureAssetAvailable.mockResolvedValue(makeAsset({ fetchStatus: "available" }));
    readMediaFile.mockResolvedValue(Buffer.alloc(16_000_001));

    const { resolveInboundContent } = await load();
    const res = await resolveInboundContent(
      makeMessage({ type: "audio" }),
      makeAsset()
    );
    expect(res).toBeNull();
    expect(transcribeAudio).not.toHaveBeenCalled();
  });
});
