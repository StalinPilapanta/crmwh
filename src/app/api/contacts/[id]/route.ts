import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import {
  getContactById,
  getContactStage,
  serializeContact,
} from "@/server/contacts";
import { upsertFicha } from "@/server/bot/ficha";
import { getBranding } from "@/server/branding";
import { normalizeCiudad, normalizeProvincia } from "@/lib/geo";
import { LEAD_FIELDS } from "@/lib/lead-fields";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth(async (session, _req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const contact = await getContactById(session.organizationId, id);
  if (!contact) return apiError(404, "not_found", "Contacto no encontrado");
  const stageRow = await getContactStage(session.organizationId, id);
  return Response.json({
    contact: serializeContact(contact),
    stage: stageRow
      ? {
          id: stageRow.stage.id,
          name: stageRow.stage.name,
          position: stageRow.stage.position,
          kind: stageRow.stage.kind,
        }
      : null,
    lead: stageRow ? { id: stageRow.lead.id } : null,
  });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(3).max(30).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  archived: z.boolean().optional(),
  /**
   * Parche de la ficha: solo las claves que cambian. `null` borra una clave.
   * No es un reemplazo — el agente sigue escribiendo mientras el dueño
   * corrige, y mandar la ficha entera haría que el último en guardar le
   * borrara lo recién descubierto al otro.
   */
  ficha: z.record(z.unknown()).optional(),
});

/**
 * Valida/normaliza provincia y ciudad del patch de ficha contra el catálogo
 * del país de la org. Los valores que no coinciden se omiten (no rompen); el
 * resto de claves pasan tal cual.
 */
async function normalizeFichaGeo(
  organizationId: string,
  ficha: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const hasProv = LEAD_FIELDS.provincia in ficha;
  const hasCity = LEAD_FIELDS.ciudad in ficha;
  if (!hasProv && !hasCity) return ficha;

  const country = (await getBranding(organizationId)).country;
  const out = { ...ficha };

  let provinciaCanonica: string | null = null;
  const rawProv = ficha[LEAD_FIELDS.provincia];
  if (hasProv && typeof rawProv === "string") {
    provinciaCanonica = normalizeProvincia(country, rawProv);
    if (provinciaCanonica) out[LEAD_FIELDS.provincia] = provinciaCanonica;
    else delete out[LEAD_FIELDS.provincia]; // inválida → se omite
  }

  const rawCity = ficha[LEAD_FIELDS.ciudad];
  if (hasCity && typeof rawCity === "string") {
    const provRef = provinciaCanonica ?? "";
    const ciudad = normalizeCiudad(country, provRef, rawCity);
    if (ciudad) out[LEAD_FIELDS.ciudad] = ciudad;
    else delete out[LEAD_FIELDS.ciudad]; // no pertenece a la provincia → se omite
  }
  return out;
}

export const PATCH = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  // La ficha va por su propia puerta —la MISMA que usa el cerebro externo en
  // `PUT /api/bot/ficha`— para heredar el merge y las cotas. Escribirla aquí
  // con un `set` plano sería un segundo camino con otras reglas.
  if (body.data.ficha !== undefined) {
    const fichaPatch = await normalizeFichaGeo(
      session.organizationId,
      body.data.ficha
    );
    const res = await upsertFicha({
      organizationId: session.organizationId,
      contactId: id,
      ficha: fichaPatch,
    });
    if (!res) return apiError(404, "not_found", "Contacto no encontrado");
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (body.data.name !== undefined) set.name = body.data.name;
  if (body.data.phone !== undefined) set.phone = body.data.phone;
  if (body.data.notes !== undefined) set.notes = body.data.notes;
  if (body.data.archived !== undefined) {
    set.archivedAt = body.data.archived ? new Date() : null;
  }

  const db = getDb();
  const updated = await db
    .update(schema.contact)
    .set(set)
    .where(
      scoped(
        schema.contact.organizationId,
        session.organizationId,
        eq(schema.contact.id, id)
      )
    )
    .returning();
  if (!updated[0]) return apiError(404, "not_found", "Contacto no encontrado");
  return Response.json({ contact: serializeContact(updated[0]) });
});
