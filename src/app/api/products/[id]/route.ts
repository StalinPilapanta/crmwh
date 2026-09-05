import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { CURRENCIES } from "@/lib/money";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.enum(CURRENCIES).optional(),
  type: z.enum(["fisico", "virtual", "servicio"]).optional(),
  dropiId: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, "El ID de Dropi debe ser solo números")
    .nullable()
    .optional()
    .or(z.literal("")),
  active: z.boolean().optional(),
  productPrompt: z.string().trim().max(12000).nullable().optional(),
});

export const PATCH = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  const set: Record<string, unknown> = { updatedAt: new Date() };
  const d = body.data;
  if (d.name !== undefined) set.name = d.name;
  if (d.priceCents !== undefined) set.priceCents = d.priceCents;
  if (d.currency !== undefined) set.currency = d.currency;
  if (d.type !== undefined) set.type = d.type;
  if (d.dropiId !== undefined) set.dropiId = d.dropiId ? d.dropiId : null;
  if (d.active !== undefined) set.active = d.active;
  if (d.productPrompt !== undefined) set.productPrompt = d.productPrompt;

  const db = getDb();
  const updated = await db
    .update(schema.product)
    .set(set)
    .where(
      scoped(
        schema.product.organizationId,
        session.organizationId,
        eq(schema.product.id, id)
      )
    )
    .returning();
  if (!updated[0]) return apiError(404, "not_found", "Producto no encontrado");
  return Response.json({ product: updated[0] });
});

export const DELETE = withAuth(async (session, _req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const db = getDb();
  const deleted = await db
    .delete(schema.product)
    .where(
      scoped(
        schema.product.organizationId,
        session.organizationId,
        eq(schema.product.id, id)
      )
    )
    .returning();
  if (!deleted[0]) return apiError(404, "not_found", "Producto no encontrado");
  return Response.json({ ok: true });
});
