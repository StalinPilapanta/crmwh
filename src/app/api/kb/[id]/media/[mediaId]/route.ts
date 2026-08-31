import { apiError, withAuth } from "@/lib/api";
import { removeKbImage } from "@/server/kb/media";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; mediaId: string }> };

/** Desasocia y borra una imagen de un bloque de KB. */
export const DELETE = withAuth(async (session, _req: Request, ctx: Params) => {
  const { id, mediaId } = await ctx.params;
  const removed = await removeKbImage({
    organizationId: session.organizationId,
    kbEntryId: id,
    linkId: mediaId,
  });
  if (!removed) return apiError(404, "not_found", "Imagen no encontrada");
  return Response.json({ ok: true });
});
