import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaValidationError } from "@/server/whatsapp/media";

/**
 * Servicio de imágenes de KB: validación (solo imagen), aislamiento por
 * organización (bloque de otra org → not_found), rechazo de entradas que no
 * son bloque, y enlace correcto en éxito.
 */

const {
  saveMediaFile,
  uploadGraphMedia,
  getCredentialsByOrg,
  selectRows,
  inserts,
} = vi.hoisted(() => ({
  saveMediaFile: vi.fn(),
  uploadGraphMedia: vi.fn(),
  getCredentialsByOrg: vi.fn(),
  selectRows: [] as unknown[][],
  inserts: [] as { table: string; values: Record<string, unknown> }[],
}));

vi.mock("@/server/whatsapp/media", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/whatsapp/media")>();
  return { ...actual, saveMediaFile, uploadGraphMedia };
});

vi.mock("@/server/whatsapp/credentials", () => ({ getCredentialsByOrg }));

vi.mock("@/lib/db/tenant", () => ({
  scoped: (_col: unknown, _org: string, extra?: unknown) => extra ?? true,
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      // where puede ser terminal (thenable) o encadenar a orderBy/limit.
      chain.where = () => chain;
      chain.orderBy = () => Promise.resolve(selectRows.shift() ?? []);
      chain.limit = () => Promise.resolve(selectRows.shift() ?? []);
      (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) =>
        Promise.resolve(selectRows.shift() ?? []).then(resolve);
      return chain;
    },
    insert: (table: { _name?: string }) => ({
      values: (values: Record<string, unknown>) => {
        inserts.push({ table: table?._name ?? "?", values });
        return Promise.resolve();
      },
    }),
  }),
  schema: {
    kbEntry: { organizationId: "kbEntry.org", id: "kbEntry.id", _name: "kbEntry" },
    kbEntryMedia: {
      organizationId: "kbm.org",
      kbEntryId: "kbm.entry",
      position: "kbm.position",
      _name: "kbEntryMedia",
    },
    mediaAsset: { id: "ma.id", _name: "mediaAsset" },
  },
}));

const PNG = "image/png";
const smallImg = Buffer.alloc(1024);

beforeEach(() => {
  saveMediaFile.mockReset().mockResolvedValue("org_1/ma_x");
  uploadGraphMedia.mockReset().mockResolvedValue("wamid_123");
  getCredentialsByOrg.mockReset().mockResolvedValue({
    phoneNumberId: "pn_1",
    token: "tok",
  });
  selectRows.length = 0;
  inserts.length = 0;
});

afterEach(() => vi.clearAllMocks());

async function load() {
  return import("@/server/kb/media");
}

describe("addKbImage", () => {
  it("bloque válido + imagen → crea mediaAsset y enlace kbEntryMedia", async () => {
    // 1) lookup del kbEntry (block), 2) max(position)
    selectRows.push([{ id: "kb_1", organizationId: "org_1", kind: "block" }]);
    selectRows.push([{ max: -1 }]);

    const { addKbImage } = await load();
    const img = await addKbImage({
      organizationId: "org_1",
      kbEntryId: "kb_1",
      file: { data: smallImg, mimeType: PNG, fileName: "prod.png" },
    });

    expect(img.shortId).toMatch(/^img_/);
    expect(img.url).toContain("/api/media/");
    expect(img.position).toBe(0);
    // insertó mediaAsset y kbEntryMedia
    const tables = inserts.map((i) => i.table);
    expect(tables).toContain("mediaAsset");
    expect(tables).toContain("kbEntryMedia");
    expect(uploadGraphMedia).toHaveBeenCalledTimes(1);
  });

  it("bloque de otra org / inexistente → KbMediaError not_found", async () => {
    selectRows.push([]); // no encuentra el bloque
    const { addKbImage, KbMediaError } = await load();
    await expect(
      addKbImage({
        organizationId: "org_1",
        kbEntryId: "kb_ajeno",
        file: { data: smallImg, mimeType: PNG },
      })
    ).rejects.toBeInstanceOf(KbMediaError);
  });

  it("entrada tipo qa (no block) → KbMediaError not_block", async () => {
    selectRows.push([{ id: "kb_1", organizationId: "org_1", kind: "qa" }]);
    const { addKbImage } = await load();
    await expect(
      addKbImage({
        organizationId: "org_1",
        kbEntryId: "kb_1",
        file: { data: smallImg, mimeType: PNG },
      })
    ).rejects.toMatchObject({ code: "not_block" });
  });

  it("archivo no-imagen (pdf) → MediaValidationError", async () => {
    selectRows.push([{ id: "kb_1", organizationId: "org_1", kind: "block" }]);
    const { addKbImage } = await load();
    await expect(
      addKbImage({
        organizationId: "org_1",
        kbEntryId: "kb_1",
        file: { data: smallImg, mimeType: "application/pdf" },
      })
    ).rejects.toBeInstanceOf(MediaValidationError);
  });

  it("sin credenciales de WhatsApp → guarda igual (waMediaId se resuelve luego)", async () => {
    getCredentialsByOrg.mockResolvedValue(null);
    selectRows.push([{ id: "kb_1", organizationId: "org_1", kind: "block" }]);
    selectRows.push([{ max: 2 }]);

    const { addKbImage } = await load();
    const img = await addKbImage({
      organizationId: "org_1",
      kbEntryId: "kb_1",
      file: { data: smallImg, mimeType: PNG },
    });

    expect(img.position).toBe(3);
    expect(uploadGraphMedia).not.toHaveBeenCalled();
    expect(inserts.map((i) => i.table)).toContain("mediaAsset");
  });
});
