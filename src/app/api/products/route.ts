import { and, asc, ilike } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import { CURRENCIES } from "@/lib/money";
import { productImagesByOrg } from "@/server/products/media";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session, req: Request) => {
  const db = getDb();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  const where = q
    ? and(
        scoped(schema.product.organizationId, session.organizationId),
        ilike(schema.product.name, `%${q}%`)
      )
    : scoped(schema.product.organizationId, session.organizationId);

  const products = await db
    .select()
    .from(schema.product)
    .where(where)
    .orderBy(asc(schema.product.createdAt));

  const imagesByProduct = await productImagesByOrg(session.organizationId);
  const withImages = products.map((p) => ({
    ...p,
    images: imagesByProduct.get(p.id) ?? [],
  }));
  return Response.json({ products: withImages });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  priceCents: z.number().int().min(0),
  currency: z.enum(CURRENCIES),
  type: z.enum(["fisico", "virtual", "servicio"]),
  dropiId: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, "El ID de Dropi debe ser solo números")
    .optional()
    .or(z.literal("")),
  active: z.boolean().optional(),
  productPrompt: z.string().trim().max(8000).optional(),
});

export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const inserted = await db
    .insert(schema.product)
    .values({
      id: newId("product"),
      organizationId: session.organizationId,
      name: body.data.name,
      priceCents: body.data.priceCents,
      currency: body.data.currency,
      type: body.data.type,
      dropiId: body.data.dropiId ? body.data.dropiId : null,
      active: body.data.active ?? true,
      productPrompt: body.data.productPrompt ?? null,
    })
    .returning();
  if (!inserted[0]) return apiError(500, "internal", "No se pudo crear");
  return Response.json({ product: inserted[0] }, { status: 201 });
});
