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

export class KbMediaError extends Error {
  code: "not_found" | "not_block" | "invalid";
  constructor(code: KbMediaError["code"], message: string) {
    super(message);
    this.name = "KbMediaError";
    this.code = code;
  }
}

export type KbImage = {
  id: string; // id de kbEntryMedia
  assetId: string; // id del mediaAsset (para /api/media/[assetId])
  shortId: string;
  url: string;
  position: number;
};

/** Imágenes de un bloque de KB, ordenadas. */
export async function listKbImages(
  organizationId: string,
  kbEntryId: string
): Promise<KbImage[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.kbEntryMedia)
    .where(
      scoped(
        schema.kbEntryMedia.organizationId,
        organizationId,
        eq(schema.kbEntryMedia.kbEntryId, kbEntryId)
      )
    )
    .orderBy(schema.kbEntryMedia.position);
  return rows.map(toKbImage);
}

/** Todas las imágenes de KB de la org, agrupadas por kbEntryId. */
export async function kbImagesByEntry(
  organizationId: string
): Promise<Map<string, KbImage[]>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.kbEntryMedia)
    .where(scoped(schema.kbEntryMedia.organizationId, organizationId))
    .orderBy(schema.kbEntryMedia.position);
  const map = new Map<string, KbImage[]>();
  for (const r of rows) {
    const list = map.get(r.kbEntryId) ?? [];
    list.push(toKbImage(r));
    map.set(r.kbEntryId, list);
  }
  return map;
}

function toKbImage(r: typeof schema.kbEntryMedia.$inferSelect): KbImage {
  return {
    id: r.id,
    assetId: r.mediaAssetId,
    shortId: r.shortId,
    url: `/api/media/${r.mediaAssetId}`,
    position: r.position,
  };
}

/**
 * Sube una imagen y la asocia a un bloque de KB. Reutiliza la infraestructura
 * de media: valida tipo/tamaño, guarda en disco, crea el mediaAsset y (si hay
 * credenciales) sube a Graph para tener el waMediaId listo desde ya.
 */
export async function addKbImage(input: {
  organizationId: string;
  kbEntryId: string;
  file: { data: Buffer; mimeType: string; fileName?: string };
}): Promise<KbImage> {
  const db = getDb();

  // El bloque debe existir, ser de la org y de tipo "block".
  const entries = await db
    .select()
    .from(schema.kbEntry)
    .where(
      scoped(
        schema.kbEntry.organizationId,
        input.organizationId,
        eq(schema.kbEntry.id, input.kbEntryId)
      )
    )
    .limit(1);
  const entry = entries[0];
  if (!entry) throw new KbMediaError("not_found", "Bloque no encontrado");
  if (entry.kind !== "block") {
    throw new KbMediaError("not_block", "Solo los bloques admiten imágenes");
  }

  // Validación de tipo/tamaño (solo imágenes). Lanza MediaValidationError.
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

  // Sube a Graph para tener el waMediaId listo (evita re-subir en cada envío).
  // Si aún no hay credenciales de WhatsApp, se guarda igual; el waMediaId se
  // resolverá en el primer envío.
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
    // No es fatal: el binario ya está en disco y se puede subir al enviar.
    console.warn(
      `[kb-media] no se pudo pre-subir a Graph: ${
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

  // position = siguiente al máximo actual del bloque.
  const posRows = await db
    .select({ max: sql<number>`coalesce(max(${schema.kbEntryMedia.position}), -1)` })
    .from(schema.kbEntryMedia)
    .where(eq(schema.kbEntryMedia.kbEntryId, input.kbEntryId));
  const nextPos = (posRows[0]?.max ?? -1) + 1;

  const linkId = newId("kbEntryMedia");
  const shortId = `img_${shortNano()}`;
  await db.insert(schema.kbEntryMedia).values({
    id: linkId,
    organizationId: input.organizationId,
    kbEntryId: input.kbEntryId,
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
 * Desasocia una imagen de un bloque y borra el mediaAsset (cascade borra la
 * fila puente). Scoped por org. Devuelve true si borró algo.
 */
export async function removeKbImage(input: {
  organizationId: string;
  kbEntryId: string;
  linkId: string;
}): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.kbEntryMedia)
    .where(
      and(
        eq(schema.kbEntryMedia.id, input.linkId),
        eq(schema.kbEntryMedia.organizationId, input.organizationId),
        eq(schema.kbEntryMedia.kbEntryId, input.kbEntryId)
      )
    )
    .limit(1);
  const link = rows[0];
  if (!link) return false;

  // Borrar el mediaAsset elimina la fila puente por cascade.
  await db
    .delete(schema.mediaAsset)
    .where(eq(schema.mediaAsset.id, link.mediaAssetId));
  return true;
}
