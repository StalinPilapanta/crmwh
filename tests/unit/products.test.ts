import { describe, expect, it } from "vitest";
import { renderProducts, buildAgentSystemPrompt, type PromptProduct } from "@/server/ai/prompts";

/**
 * Catálogo de productos en el prompt del agente:
 * - renderProducts formatea precio, tipo, prompt e imágenes.
 * - buildAgentSystemPrompt incluye el bloque de catálogo y ofrece send_media
 *   cuando hay imágenes de producto.
 */

function baseProfile() {
  return {
    id: "agp_1",
    organizationId: "org_1",
    enabled: true,
    name: "Noe",
    tone: null,
    instructions: null,
    escalationRules: null,
    greeting: null,
    followupEnabled: false,
    followupReminderText: null,
    reengageText: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never;
}

const gomitas: PromptProduct = {
  name: "Gomitas de Moringa",
  priceCents: 2599,
  currency: "USD",
  type: "fisico",
  productPrompt: "Ideal para niños; destaca el sistema inmune.",
  imageShortIds: ["img_ab12"],
};

describe("renderProducts", () => {
  it("incluye nombre, precio, tipo, prompt e imágenes", () => {
    const out = renderProducts([gomitas]);
    expect(out).toContain("Gomitas de Moringa");
    expect(out).toContain("fisico");
    expect(out).toContain("Cómo venderlo:");
    expect(out).toContain("[imágenes disponibles: img_ab12]");
    // precio formateado (contiene el número 25.99 de alguna forma)
    expect(out).toMatch(/25[.,]99/);
  });

  it("producto sin prompt ni imágenes solo muestra la línea base", () => {
    const out = renderProducts([
      { ...gomitas, productPrompt: null, imageShortIds: [] },
    ]);
    expect(out).toContain("Gomitas de Moringa");
    expect(out).not.toContain("Cómo venderlo:");
    expect(out).not.toContain("imágenes disponibles");
  });
});

describe("buildAgentSystemPrompt con productos", () => {
  it("incluye el catálogo de productos activos", () => {
    const prompt = buildAgentSystemPrompt({
      profile: baseProfile(),
      kb: [],
      stages: [{ name: "Nuevo" }],
      products: [gomitas],
    });
    expect(prompt).toContain("CATÁLOGO DE PRODUCTOS ACTIVOS");
    expect(prompt).toContain("Gomitas de Moringa");
  });

  it("ofrece send_media cuando un producto tiene imágenes", () => {
    const prompt = buildAgentSystemPrompt({
      profile: baseProfile(),
      kb: [],
      stages: [{ name: "Nuevo" }],
      products: [gomitas],
    });
    expect(prompt).toContain("send_media");
  });

  it("sin productos no incluye el bloque de catálogo", () => {
    const prompt = buildAgentSystemPrompt({
      profile: baseProfile(),
      kb: [],
      stages: [{ name: "Nuevo" }],
    });
    expect(prompt).not.toContain("CATÁLOGO DE PRODUCTOS ACTIVOS");
  });
});
