import { and, eq, sql } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import {
  MediaValidationError,
  saveMediaFile,
  uploadGraphMedia,
  validateOutgoing,
} from "@/server/whatsapp/media";
import { getCredentialsByOrg } from "@/server/whatsapp/credentials";

/** shortId corto y legible para que el agente referencie la imagen. */
const shortNano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 4);

export class ProductMediaError extends Error {
  code: "not_found" | "invalid";
  constructor(code: ProductMediaError["code"], message: string) {
    super(message);
    this.name = "ProductMediaError";
    this.code = code;
  }
}

export type ProductImage = {
  id: string; // id de productMedia
  assetId: string; // id del mediaAsset (para /api/media/[assetId])
  shortId: string;
  url: string;
  position: number;
};

/** Imágenes de un producto, ordenadas. */
export async function listProductImages(
  organizationId: string,
  productId: string
): Promise<ProductImage[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.productMedia)
    .where(
      scoped(
        schema.productMedia.organizationId,
        organizationId,
        eq(schema.productMedia.productId, productId)
      )
    )
    .orderBy(schema.productMedia.position);
  return rows.map(toProductImage);
}

/** Todas las imágenes de producto de la org, agrupadas por productId. */
export async function productImagesByOrg(
  organizationId: string
): Promise<Map<string, ProductImage[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.productMedia)
    .where(scoped(schema.productMedia.organizationId, organizationId))
    .orderBy(schema.productMedia.position);
  const map = new Map<string, ProductImage[]>();
  for (const r of rows) {
    const list = map.get(r.productId) ?? [];
    list.push(toProductImage(r));
    map.set(r.productId, list);
  }
  return map;
}

function toProductImage(
  r: typeof schema.productMedia.$inferSelect
): ProductImage {
  return {
    id: r.id,
    assetId: r.mediaAssetId,
    shortId: r.shortId,
    url: `/api/media/${r.mediaAssetId}`,
    position: r.position,
  };
}

/**
 * Sube una imagen y la asocia a un producto. Reutiliza la infraestructura de
 * media: valida tipo/tamaño (solo imagen), guarda en disco, crea el mediaAsset
 * y (si hay credenciales) pre-sube a Graph para tener el waMediaId listo.
 */
export async function addProductImage(input: {
  organizationId: string;
  productId: string;
  file: { data: Buffer; mimeType: string; fileName?: string };
}): Promise<ProductImage> {
  const db = getDb();

  // El producto debe existir y ser de la org.
  const rows = await db
    .select()
    .from(schema.product)
    .where(
      scoped(
        schema.product.organizationId,
        input.organizationId,
        eq(schema.product.id, input.productId)
      )
    )
    .limit(1);
  if (!rows[0]) throw new ProductMediaError("not_found", "Producto no encontrado");

  // Solo imágenes.
  const kind = validateOutgoing(input.file.mimeType, input.file.data.byteLength);
  if (kind !== "image") {
    throw new MediaValidationError(
      "unsupported_type",
      "Solo se permiten imágenes (jpeg, png, webp)"
    );
  }

  const assetId = newId("mediaAsset");
  const storagePath = await saveMediaFile(
    input.organizationId,
    assetId,
    input.file.data
  );

  let waMediaId: string | null = null;
  try {
    const creds = await getCredentialsByOrg(input.organizationId);
    if (creds) {
      waMediaId = await uploadGraphMedia(creds, {
        data: input.file.data,
        mimeType: input.file.mimeType,
        fileName: input.file.fileName,
      });
    }
  } catch (err) {
    console.warn(
      `[product-media] no se pudo pre-subir a Graph: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  await db.insert(schema.mediaAsset).values({
    id: assetId,
    organizationId: input.organizationId,
    kind: "image",
    waMediaId,
    mimeType: input.file.mimeType,
    fileName: input.file.fileName ?? null,
    fileSize: input.file.data.byteLength,
    storagePath,
    fetchStatus: "available",
  });

  const posRows = await db
    .select({ max: sql<number>`coalesce(max(${schema.productMedia.position}), -1)` })
    .from(schema.productMedia)
    .where(eq(schema.productMedia.productId, input.productId));
  const nextPos = (posRows[0]?.max ?? -1) + 1;

  const linkId = newId("productMedia");
  const shortId = `img_${shortNano()}`;
  await db.insert(schema.productMedia).values({
    id: linkId,
    organizationId: input.organizationId,
    productId: input.productId,
    mediaAssetId: assetId,
    shortId,
    position: nextPos,
  });

  return {
    id: linkId,
    assetId,
    shortId,
    url: `/api/media/${assetId}`,
    position: nextPos,
  };
}

/**
 * Desasocia una imagen de un producto y borra el mediaAsset (cascade borra la
 * fila puente). Scoped por org. Devuelve true si borró algo.
 */
export async function removeProductImage(input: {
  organizationId: string;
  productId: string;
  linkId: string;
}): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.productMedia)
    .where(
      and(
        eq(schema.productMedia.id, input.linkId),
        eq(schema.productMedia.organizationId, input.organizationId),
        eq(schema.productMedia.productId, input.productId)
      )
    )
    .limit(1);
  const link = rows[0];
  if (!link) return false;

  await db
    .delete(schema.mediaAsset)
    .where(eq(schema.mediaAsset.id, link.mediaAssetId));
  return true;
}
