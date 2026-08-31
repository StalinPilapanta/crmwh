import { describe, expect, it } from "vitest";
import {
  AgentAction,
  degradeAction,
  resolveKbMedia,
} from "@/server/ai/actions";
import { renderKb, type KbEntryImage } from "@/server/ai/prompts";

/**
 * Acción send_media y exposición de imágenes de KB al agente:
 * - schema válido/ inválido
 * - resolución por shortId (exacto e insensible a mayúsculas)
 * - degradación cuando el id no existe
 * - renderKb agrega la línea de imágenes solo si el bloque tiene imágenes
 */

describe("AgentAction send_media (schema)", () => {
  it("acepta send_media con mediaId", () => {
    const parsed = AgentAction.safeParse({
      action: "send_media",
      mediaId: "img_ab12",
      reply: "Aquí la foto 👇",
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza send_media sin mediaId", () => {
    const parsed = AgentAction.safeParse({ action: "send_media" });
    expect(parsed.success).toBe(false);
  });
});

describe("resolveKbMedia", () => {
  const imgs = [
    { shortId: "img_ab12", assetId: "ma_1" },
    { shortId: "img_cd34", assetId: "ma_2" },
  ];

  it("match exacto por shortId", () => {
    expect(resolveKbMedia("img_cd34", imgs)?.assetId).toBe("ma_2");
  });

  it("match insensible a mayúsculas", () => {
    expect(resolveKbMedia("IMG_AB12", imgs)?.assetId).toBe("ma_1");
  });

  it("id inexistente → null", () => {
    expect(resolveKbMedia("img_zzzz", imgs)).toBeNull();
  });
});

describe("degradeAction (send_media)", () => {
  it("con reply → se convierte en reply", () => {
    const out = degradeAction({
      action: "send_media",
      mediaId: "x",
      reply: "Te muestro luego",
    });
    expect(out).toEqual({ action: "reply", text: "Te muestro luego" });
  });

  it("sin reply → none", () => {
    const out = degradeAction({ action: "send_media", mediaId: "x" });
    expect(out).toEqual({ action: "none" });
  });
});

describe("renderKb con imágenes", () => {
  const entries = [
    {
      id: "kb_1",
      organizationId: "org_1",
      kind: "block" as const,
      question: null,
      answer: null,
      content: "Gomitas de Moringa: para niños.",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it("bloque con imágenes agrega la línea de ids", () => {
    const map = new Map<string, KbEntryImage[]>([
      ["kb_1", [{ shortId: "img_ab12" }, { shortId: "img_cd34" }]],
    ]);
    const out = renderKb(entries, map);
    expect(out).toContain("Gomitas de Moringa");
    expect(out).toContain("[imágenes disponibles: img_ab12, img_cd34]");
  });

  it("sin mapa de imágenes → salida como antes (sin línea)", () => {
    const out = renderKb(entries);
    expect(out).toBe("Gomitas de Moringa: para niños.");
    expect(out).not.toContain("imágenes disponibles");
  });
});
