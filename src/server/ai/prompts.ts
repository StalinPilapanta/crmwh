import type { schema } from "@/lib/db";
import { formatMoneyCents } from "@/lib/money";

type AgentProfile = typeof schema.agentProfile.$inferSelect;
type KbEntry = typeof schema.kbEntry.$inferSelect;

/** Marcador del prompt del juez: el ai-mock lo usa para despachar veredictos. */
export const JUDGE_MARKER = "[JUEZ]";

/** Imágenes de un bloque de KB, para exponer sus shortId al agente. */
export type KbEntryImage = { shortId: string };

/** Producto del catálogo para el contexto del agente. */
export type PromptProduct = {
  name: string;
  priceCents: number;
  currency: string;
  type: string;
  productPrompt: string | null;
  imageShortIds: string[];
};

/** Renderiza el catálogo de productos activos para el system prompt. */
export function renderProducts(products: PromptProduct[]): string {
  return products
    .map((p) => {
      const price = formatMoneyCents(p.priceCents, p.currency) ?? `${p.priceCents / 100} ${p.currency}`;
      const lines = [`• ${p.name} — ${price} (${p.type})`];
      if (p.productPrompt?.trim()) lines.push(`  Cómo venderlo: ${p.productPrompt.trim()}`);
      if (p.imageShortIds.length > 0) {
        lines.push(`  [imágenes disponibles: ${p.imageShortIds.join(", ")}]`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

export function renderKb(
  entries: KbEntry[],
  imagesByEntry?: Map<string, KbEntryImage[]>
): string {
  if (entries.length === 0) return "(knowledge base vacío)";
  return entries
    .map((e) => {
      const base =
        e.kind === "qa" ? `P: ${e.question}\nR: ${e.answer}` : (e.content ?? "");
      if (!base) return "";
      const imgs = imagesByEntry?.get(e.id) ?? [];
      if (imgs.length === 0) return base;
      const ids = imgs.map((i) => i.shortId).join(", ");
      return `${base}\n[imágenes disponibles: ${ids}]`;
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * System prompt del agente (v1: inyecta el KB completo — el límite se
 * documenta con el contador de tamaño en la UI).
 */
export function buildAgentSystemPrompt(input: {
  profile: AgentProfile;
  kb: KbEntry[];
  stages: { name: string }[];
  kbImages?: Map<string, KbEntryImage[]>;
  /** Provincias válidas del país de operación (para capturar datos de entrega). */
  provincias?: string[];
  /** Catálogo de productos activos. */
  products?: PromptProduct[];
}): string {
  const { profile } = input;
  const stageNames = input.stages.map((s) => s.name).join(" | ");
  const products = input.products ?? [];
  const productImageCount = products.reduce(
    (n, p) => n + p.imageShortIds.length,
    0
  );
  const hasImages =
    (input.kbImages?.size ?? 0) > 0 || productImageCount > 0;
  const provincias = input.provincias ?? [];
  const hasGeo = provincias.length > 0;
  return [
    `Eres "${profile.name}", el asistente de WhatsApp de este negocio. Respondes SIEMPRE en español neutro, con mensajes breves y naturales para chat.`,
    // Directrices de venta (mejores prácticas del mercado para agentes vendedores).
    [
      "ERES UN VENDEDOR EXPERTO, cálido y persuasivo. Tu objetivo es CERRAR LA VENTA:",
      "- Responde con energía y seguridad; destaca BENEFICIOS, no solo características.",
      "- Si el cliente duda, maneja la objeción con empatía y da una razón para decidir hoy.",
      "- En cuanto haya interés, pide los datos de entrega para cerrar el pedido.",
      "- No dejes la conversación abierta: termina SIEMPRE con una pregunta o un siguiente paso concreto.",
      "- Da el precio con seguridad y ofrece de inmediato avanzar al pedido.",
      "- Si el cliente dice que lo va a pensar, sugiere un beneficio adicional o confirma disponibilidad.",
      "- Sé conciso: máximo 3 líneas por mensaje. WhatsApp no es un correo.",
    ].join("\n"),
    profile.tone ? `Tono: ${profile.tone}` : null,
    profile.instructions ? `Instrucciones del negocio:\n${profile.instructions}` : null,
    profile.escalationRules
      ? `Reglas de escalado a humano:\n${profile.escalationRules}`
      : null,
    profile.greeting ? `Saludo sugerido para conversaciones nuevas: ${profile.greeting}` : null,
    `CONOCIMIENTO DEL NEGOCIO (tu única fuente de verdad; si algo no está aquí, NO lo inventes — di que lo confirmarás con el equipo o escala):\n${renderKb(input.kb, input.kbImages)}`,
    products.length > 0
      ? `CATÁLOGO DE PRODUCTOS ACTIVOS (usa SOLO estos productos y precios; no inventes productos ni precios):\n${renderProducts(products)}`
      : null,
    `Etapas del pipeline disponibles: ${stageNames}`,
    [
      "En cada turno respondes ÚNICAMENTE un objeto JSON con UNA acción:",
      '- {"action":"none"} — no responder nada.',
      '- {"action":"reply","text":"..."} — responder al cliente.',
      '- {"action":"update_lead","note":"...","reply":"..."} — guardar una nota del lead (reply opcional).',
      '- {"action":"move_stage","stage":"<nombre exacto de etapa>","reply":"..."} — mover el lead (reply opcional).',
      '- {"action":"handoff","reason":"...","farewell":"..."} — escalar a un humano (farewell opcional para despedirte).',
      hasImages
        ? '- {"action":"send_media","mediaId":"<id de la imagen>","reply":"..."} — enviar una imagen del conocimiento (reply opcional para acompañarla).'
        : null,
      '- {"action":"update_ficha","fields":{"name":"...","phone":"...","provincia":"...","ciudad":"...","direccion":"...","referencia":"..."},"reply":"..."} — guardar los datos de entrega del cliente (incluye solo los campos que tengas; reply opcional).',
      "Reglas duras:",
      "- Si el cliente pide hablar con una persona/humano/asesor → handoff.",
      "- Si la pregunta NO está cubierta por el conocimiento → NO inventes: responde que lo confirmarás o escala.",
      "- Si detectas intención clara de compra → move_stage a la etapa de interesados y confirma al cliente.",
      hasImages
        ? "- ENVÍA FOTOS de forma PROACTIVA: cuando presentes un producto que tenga imágenes disponibles (aparece [imágenes disponibles: ...] junto a él), usa send_media con uno de esos ids para mostrarlo. No esperes a que el cliente la pida. Envía solo la imagen que corresponde al producto del que hablas y no repitas imágenes ya enviadas."
        : null,
      "- Cuando pidas los DATOS DE ENTREGA, preséntalos SIEMPRE como una lista clara, un dato por línea con guion, así:\n  Para completar tu pedido necesito:\n  - Nombre y apellido\n  - Provincia y ciudad\n  - Dirección exacta\n  - Referencia\n  - Teléfono de contacto",
      "- Cuando muestres PRECIOS o promociones, ponlos también en lista (un precio o promo por línea con guion), nunca todo en un párrafo corrido.",
      "- Cuando el cliente dé sus datos de entrega (nombre, provincia, ciudad, dirección, referencia, teléfono), usa update_ficha para guardarlos. Incluye SOLO los campos que el cliente ya te dio; NO mandes campos vacíos. Si falta algún dato, pídelo por su nombre en el reply.",
      hasGeo
        ? `- Provincia y ciudad deben corresponder al país de operación. Provincias válidas: ${provincias.join(", ")}. Usa el nombre correcto de la provincia; la ciudad debe pertenecer a esa provincia.`
        : null,
      "- JSON puro, sin markdown ni texto adicional.",
    ]
      .filter(Boolean)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Prompt del juez del Laboratorio: UNA llamada por conversación (FR-032). */
export function buildJudgePrompt(input: {
  persona: string;
  transcript: { role: "cliente" | "agente"; text: string }[];
  kbText: string;
  behaviorText: string;
}): { system: string; user: string } {
  const system = [
    `${JUDGE_MARKER} Eres un evaluador de calidad independiente de agentes de WhatsApp. Evalúas UNA conversación simulada completa contra el conocimiento y comportamiento configurados. Eres estricto: la alucinación (inventar datos que no están en el conocimiento) es la falla más grave.`,
    "Respondes ÚNICAMENTE un objeto JSON con este esquema:",
    '{"veredicto":"verde"|"amarillo"|"rojo","hallazgos":[{"tipo":"alucinacion"|"fuera_de_kb"|"debio_escalar"|"tono","evidencia":"cita textual del transcript","sugerencia":{"pregunta":"...","respuesta":"..."}}]}',
    "- verde: sin problemas relevantes. amarillo: mejorable. rojo: falla grave.",
    "- `sugerencia` es opcional: inclúyela cuando una nueva entrada P/R del knowledge base evitaría el problema.",
    "- Si el agente respondió sobre un tema que NO está en el conocimiento → hallazgo fuera_de_kb (o alucinacion si afirmó datos concretos).",
    "- Si el cliente pidió un humano y no hubo escalado → debio_escalar.",
  ].join("\n");

  const transcript = input.transcript
    .map((t) => `${t.role === "cliente" ? "CLIENTE" : "AGENTE"}: ${t.text}`)
    .join("\n");

  const user = [
    `PERSONA SIMULADA: ${input.persona}`,
    `COMPORTAMIENTO CONFIGURADO:\n${input.behaviorText || "(sin configurar)"}`,
    `CONOCIMIENTO CONFIGURADO:\n${input.kbText || "(vacío)"}`,
    `TRANSCRIPT COMPLETO:\n${transcript}`,
    "Evalúa y responde el JSON.",
  ].join("\n\n");

  return { system, user };
}
