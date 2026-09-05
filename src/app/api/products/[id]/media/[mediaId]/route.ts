import { apiError, withAuth } from "@/lib/api";
import { removeProductImage } from "@/server/products/media";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; mediaId: string }> };

/** Desasocia y borra una imagen de un producto. */
export const DELETE = withAuth(async (session, _req: Request, ctx: Params) => {
  const { id, mediaId } = await ctx.params;
  const removed = await removeProductImage({
    organizationId: session.organizationId,
    productId: id,
    linkId: mediaId,
  });
  if (!removed) return apiError(404, "not_found", "Imagen no encontrada");
  return Response.json({ ok: true });
});
