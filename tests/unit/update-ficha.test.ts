import { describe, expect, it } from "vitest";
import { AgentAction } from "@/server/ai/actions";
import { buildAgentSystemPrompt } from "@/server/ai/prompts";

/**
 * Acción update_ficha (schema) y exposición de provincias en el prompt.
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
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never;
}

describe("AgentAction update_ficha (schema)", () => {
  it("acepta campos parciales", () => {
    const p = AgentAction.safeParse({
      action: "update_ficha",
      fields: { name: "Ana", provincia: "Pichincha", ciudad: "Quito" },
      reply: "¡Gracias Ana!",
    });
    expect(p.success).toBe(true);
  });

  it("acepta un solo campo", () => {
    const p = AgentAction.safeParse({
      action: "update_ficha",
      fields: { direccion: "Calle X #123" },
    });
    expect(p.success).toBe(true);
  });

  it("rechaza fields vacío", () => {
    const p = AgentAction.safeParse({ action: "update_ficha", fields: {} });
    expect(p.success).toBe(false);
  });

  it("rechaza sin fields", () => {
    const p = AgentAction.safeParse({ action: "update_ficha" });
    expect(p.success).toBe(false);
  });
});

describe("prompt con provincias", () => {
  it("lista las provincias válidas cuando hay país con catálogo", () => {
    const prompt = buildAgentSystemPrompt({
      profile: baseProfile(),
      kb: [],
      stages: [{ name: "Nuevo" }],
      provincias: ["Pichincha", "Guayas", "Azuay"],
    });
    expect(prompt).toContain("update_ficha");
    expect(prompt).toContain("Provincias válidas:");
    expect(prompt).toContain("Pichincha, Guayas, Azuay");
  });

  it("sin provincias no incluye la regla de provincias válidas", () => {
    const prompt = buildAgentSystemPrompt({
      profile: baseProfile(),
      kb: [],
      stages: [{ name: "Nuevo" }],
    });
    // La acción update_ficha siempre se ofrece; la lista de provincias no.
    expect(prompt).toContain("update_ficha");
    expect(prompt).not.toContain("Provincias válidas:");
  });
});
