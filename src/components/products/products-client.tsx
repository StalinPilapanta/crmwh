"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES, formatMoneyCents, parseMoneyToCents } from "@/lib/money";

type ProductImage = { id: string; assetId: string; shortId: string; url: string };

type ProductType = "fisico" | "virtual" | "servicio";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  type: ProductType;
  dropiId: string | null;
  active: boolean;
  productPrompt: string | null;
  images?: ProductImage[];
};

const TYPE_LABELS: Record<ProductType, string> = {
  fisico: "físico",
  virtual: "virtual",
  servicio: "servicio",
};

/** Extrae el mensaje de error real de la API ({ error: { message } }). */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error?.message ?? fallback;
}

export function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const refetch = useCallback(async (q?: string) => {
    const url = q ? `/api/products?q=${encodeURIComponent(q)}` : "/api/products";
    const data = await fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (data) setProducts(data.products);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Productos</h1>
          <p className="text-xs text-text-3">
            Lo que vendes. El agente usa los productos activos para vender.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nuevo producto
        </Button>
      </header>

      <div className="border-b px-4 py-3">
        <div className="flex max-w-sm items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
            <Input
              placeholder="Buscar productos por nombre"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void refetch(query.trim() || undefined);
              }}
            />
          </div>
          <Button variant="secondary" onClick={() => void refetch(query.trim() || undefined)}>
            Buscar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!loaded ? (
          <p className="text-sm text-text-3">Cargando…</p>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Package className="h-10 w-10 text-text-3" />
            <p className="text-sm text-text-3">
              Aún no tienes productos. Crea el primero para que el agente lo venda.
            </p>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nuevo producto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              onClick={() => setCreating(true)}
              className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-text-3 hover:border-accent hover:text-accent"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm">Agregar nuevo producto</span>
            </button>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onClick={() => setEditing(p)} />
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <ProductDialog
          product={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void refetch(query.trim() || undefined);
          }}
        />
      )}
    </div>
  );
}

function ProductCard({
  product,
  onClick,
}: {
  product: Product;
  onClick: () => void;
}) {
  const main = product.images?.[0];
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className="aspect-square w-full bg-muted">
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main.url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-text-3">
            <Package className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <div className="flex items-center gap-2">
          <Badge variant={product.active ? "secondary" : "outline"}>
            {product.active ? "Activo" : "Inactivo"}
          </Badge>
          <span className="text-xs text-text-3">{TYPE_LABELS[product.type]}</span>
        </div>
        <p className="text-sm font-semibold">
          {formatMoneyCents(product.priceCents, product.currency)}
        </p>
        <Button className="mt-2 w-full" variant="secondary" onClick={onClick}>
          Configurar
        </Button>
      </div>
    </div>
  );
}

function ProductDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(product);
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(
    product ? (product.priceCents / 100).toFixed(2) : ""
  );
  const [currency, setCurrency] = useState(product?.currency ?? "USD");
  const [type, setType] = useState<ProductType>(product?.type ?? "fisico");
  const [dropiId, setDropiId] = useState(product?.dropiId ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [prompt, setPrompt] = useState(product?.productPrompt ?? "");
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? []);
  // En creación no hay id todavía: las imágenes elegidas quedan PENDIENTES y se
  // suben en cuanto el producto existe. En edición se suben al instante.
  const [pending, setPending] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Sube un archivo a un producto ya existente; devuelve la imagen creada. */
  async function uploadTo(productId: string, file: File): Promise<ProductImage> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/products/${productId}/media`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(await errorMessage(res, "No se pudo subir la imagen"));
    const data = await res.json();
    return data.image as ProductImage;
  }

  async function save() {
    setSaving(true);
    setError(null);
    const priceCents = parseMoneyToCents(price);
    if (priceCents === null) {
      setError("Precio inválido");
      setSaving(false);
      return;
    }
    if (dropiId && !/^\d{1,12}$/.test(dropiId.trim())) {
      setError("El ID de Dropi debe ser solo números");
      setSaving(false);
      return;
    }
    if (prompt.trim().length > 12000) {
      setError("El prompt del producto es demasiado largo (máx. 12000 caracteres)");
      setSaving(false);
      return;
    }
    const payload = {
      name: name.trim(),
      priceCents,
      currency,
      type,
      dropiId: dropiId.trim() || undefined,
      active,
      productPrompt: prompt.trim() || undefined,
    };

    try {
      if (isEdit && product) {
        const res = await fetch(`/api/products/${product.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await errorMessage(res, "No se pudo guardar"));
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await errorMessage(res, "No se pudo crear"));
        const data = await res.json();
        const newId: string = data.product.id;
        // Ahora que el producto existe, subimos las imágenes que se eligieron
        // durante la creación.
        for (const file of pending) {
          await uploadTo(newId, file);
        }
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSaving(false);
    }
  }

  async function deleteProduct() {
    if (!product) return;
    if (!confirm(`¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo eliminar"));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDeleting(false);
    }
  }

  /** Al elegir un archivo: en edición sube ya; en creación lo deja pendiente. */
  async function pickImage(file: File) {
    setError(null);
    if (isEdit && product) {
      try {
        const image = await uploadTo(product.id, file);
        setImages((prev) => [...prev, image]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir la imagen");
      }
    } else {
      setPending((prev) => [...prev, file]);
    }
  }

  async function removeImg(imageId: string) {
    if (!product) return;
    await fetch(`/api/products/${product.id}/media/${imageId}`, {
      method: "DELETE",
    }).catch(() => null);
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  }

  function removePending(index: number) {
    setPending((prev) => prev.filter((_, i) => i !== index));
  }

  // El overlay cierra solo si el gesto EMPIEZA y TERMINA en él mismo. Sin esto,
  // arrastrar el "resize" del textarea suelta el mouse fuera del diálogo y
  // cerraba la ventana por error.
  const [downOnOverlay, setDownOnOverlay] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-overlay p-4"
      onMouseDown={(e) => setDownOnOverlay(e.target === e.currentTarget)}
      onMouseUp={(e) => {
        if (downOnOverlay && e.target === e.currentTarget) onClose();
        setDownOnOverlay(false);
      }}
    >
      <div className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card p-5 shadow-xl">
        <h3 className="mb-4 font-semibold">
          {isEdit ? "Configurar producto" : "Nuevo producto"}
        </h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nombre del producto</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Gomitas de Moringa"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="p-price">Precio</Label>
              <Input
                id="p-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <Label htmlFor="p-currency">Moneda</Label>
              <select
                id="p-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-type">Tipo de producto</Label>
            <select
              id="p-type"
              value={type}
              onChange={(e) => setType(e.target.value as ProductType)}
              className="h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="fisico">Producto físico</option>
              <option value="virtual">Producto virtual</option>
              <option value="servicio">Servicio</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-dropi">ID del producto en Dropi (opcional)</Label>
            <Input
              id="p-dropi"
              value={dropiId}
              onChange={(e) => setDropiId(e.target.value)}
              placeholder="Solo números"
              inputMode="numeric"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-prompt">Prompt del producto (opcional)</Label>
            <Textarea
              id="p-prompt"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Cómo debe vender el agente este producto: beneficios, objeciones, etc."
              className="resize-y"
            />
            <p className="text-right text-xs text-text-3">
              {prompt.trim().length}/12000
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Activo (el agente lo usa para vender)
          </label>

          <div className="space-y-2 border-t pt-3">
            <Label>Imágenes del producto</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickImage(f);
                e.target.value = "";
              }}
            />
            {!isEdit && (
              <p className="text-xs text-text-3">
                Las imágenes se guardarán al crear el producto.
              </p>
            )}
            {(images.length > 0 || pending.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {images.map((img) => (
                  <div key={img.id} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt="Producto"
                      className="h-16 w-16 rounded object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Quitar imagen"
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => void removeImg(img.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {pending.map((file, i) => (
                  <div key={`pending-${i}`} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Pendiente"
                      className="h-16 w-16 rounded object-cover opacity-70"
                    />
                    <button
                      type="button"
                      aria-label="Quitar imagen pendiente"
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => removePending(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          {isEdit ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={saving || deleting}
              onClick={() => void deleteProduct()}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!name.trim() || !price.trim() || saving || deleting}
              onClick={() => void save()}
            >
              {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
