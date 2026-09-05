import { z } from "zod";

/**
 * Campo de texto opcional del agente que tolera la cadena vacía. El modelo
 * suele emitir `"referencia":""` para los datos que todavía no tiene; tratar
 * eso como error rechazaba TODA la acción `update_ficha` y el turno se caía.
 * Aquí `""`/espacios → `undefined` (no informado), y se recorta al máximo.
 */
function emptyToUndef(max: number): z.ZodType<string | undefined> {
  return z
    .string()
    .max(max)
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      const t = v.trim();
      return t === "" ? undefined : t;
    });
}

/**
 * Acción tipada del agente: exactamente UNA por turno (FR-021).
 * El servidor valida cada acción contra sus allowlists (etapas de la org);
 * lo que no valida se degrada, nunca se ejecuta a ciegas.
 */
export const AgentAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("none") }),
  z.object({ action: z.literal("reply"), text: z.string().min(1) }),
  z.object({
    action: z.literal("update_lead"),
    note: z.string().min(1),
    reply: z.string().optional(),
  }),
  z.object({
    action: z.literal("move_stage"),
    stage: z.string().min(1),
    reply: z.string().optional(),
  }),
  z.object({
    action: z.literal("handoff"),
    reason: z.string().optional(),
    farewell: z.string().optional(),
  }),
  z.object({
    action: z.literal("send_media"),
    mediaId: z.string().min(1),
    reply: z.string().optional(),
  }),
  z.object({
    action: z.literal("update_ficha"),
    fields: z
      .object({
        // Un campo vacío ("" o solo espacios) NO es un error: el modelo suele
        // mandar los campos que aún no tiene como cadena vacía. Se normaliza a
        // undefined para que la acción completa no se rechace por eso.
        name: emptyToUndef(120),
        phone: emptyToUndef(30),
        provincia: emptyToUndef(120),
        ciudad: emptyToUndef(120),
        direccion: emptyToUndef(300),
        referencia: emptyToUndef(300),
      })
      .refine(
        (f) => Object.values(f).some((v) => v !== undefined),
        "al menos un campo con valor"
      ),
    reply: z.string().optional(),
  }),
]);

export type AgentActionType = z.infer<typeof AgentAction>;

/** Campos que el agente puede capturar del lead (para update_ficha). */
export type LeadFichaFields = {
  name?: string;
  phone?: string;
  provincia?: string;
  ciudad?: string;
  direccion?: string;
  referencia?: string;
};

/**
 * Resuelve el id (shortId) de imagen devuelto por el modelo contra las imágenes
 * de KB de la organización. Sin match: null (se degrada, nunca se envía algo
 * fuera de la allowlist de la org).
 */
export function resolveKbMedia(
  requested: string,
  images: { shortId: string; assetId: string }[]
): { shortId: string; assetId: string } | null {
  const q = requested.trim();
  return (
    images.find((i) => i.shortId === q) ??
    images.find((i) => i.shortId.toLowerCase() === q.toLowerCase()) ??
    null
  );
}

/**
 * Resuelve el nombre de etapa devuelto por el modelo contra las etapas reales
 * de la organización (exacto → lower-case). Sin match: degradar a reply/none.
 */
export function resolveStage(
  requested: string,
  stages: { id: string; name: string }[]
): { id: string; name: string } | null {
  const exact = stages.find((s) => s.name === requested.trim());
  if (exact) return exact;
  const lower = requested.trim().toLowerCase();
  return stages.find((s) => s.name.toLowerCase() === lower) ?? null;
}

/** Degrada una acción sin recurso válido a reply/none (FR-021 / contrato ai.md).
 * Aplica a move_stage (etapa inválida) y send_media (imagen inexistente). */
export function degradeAction(action: AgentActionType): AgentActionType {
  if (action.action === "move_stage" || action.action === "send_media") {
    return action.reply
      ? { action: "reply", text: action.reply }
      : { action: "none" };
  }
  return action;
}
