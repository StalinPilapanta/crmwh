import { apiError, withAuth } from "@/lib/api";
import { MediaValidationError } from "@/server/whatsapp/media";
import {
  addProductImage,
  listProductImages,
  ProductMediaError,
} from "@/server/products/media";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Lista las imágenes de un producto. */
export const GET = withAuth(async (session, _req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const images = await listProductImages(session.organizationId, id);
  return Response.json({ images });
});

/** Sube una imagen (multipart, campo `file`) y la asocia al producto. */
export const POST = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return apiError(400, "invalid", "Se esperaba multipart/form-data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError(422, "invalid", "Falta el archivo (campo `file`)");
  }
  const data = Buffer.from(await file.arrayBuffer());

  try {
    const image = await addProductImage({
      organizationId: session.organizationId,
      productId: id,
      file: {
        data,
        mimeType: file.type || "application/octet-stream",
        fileName: file.name || undefined,
      },
    });
    return Response.json({ image }, { status: 201 });
  } catch (err) {
    if (err instanceof MediaValidationError) {
      return apiError(
        err.code === "too_large" ? 413 : 415,
        err.code,
        err.message
      );
    }
    if (err instanceof ProductMediaError) {
      return apiError(
        err.code === "not_found" ? 404 : 422,
        err.code,
        err.message
      );
    }
    throw err;
  }
});
