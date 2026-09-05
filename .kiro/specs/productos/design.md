# Design — Sección de Productos (catálogo del agente)

## Visión general

Nueva sección "Productos" de nivel superior. Dos tablas nuevas (`product` y
`productMedia`, moldeadas sobre `kbEntry`/`kbEntryMedia`), su API CRUD + imágenes
(réplica del patrón de KB), una UI de grid + formulario (molde de Contactos), y la
inyección de los productos activos al contexto del agente (prompt + `send_media`).

### Principios

- **Reutilizar, no reinventar:** imágenes, `/api/media`, multi-tenancy, patrón de
  sección y de acción `send_media` ya existen; se replican o extienden.
- **Precio exacto:** centavos enteros (como `lead.amountCents`), nunca float.
- **Degradación segura:** sin productos activos, el agente usa el KB como hoy.
- **Aislamiento por organización** en todo.

## Componentes y cambios

### 1. Schema — `src/lib/db/schema.ts` (+ migración)

**`product`:**
```ts
product {
  id, organizationId (FK org cascade),
  name: text notNull,
  priceCents: integer notNull,      // exacto, en centavos
  currency: text notNull,            // ISO (usa CURRENCIES)
  type: text enum ["fisico","virtual","servicio"] notNull,
  dropiId: text,                     // opcional, solo dígitos (validado en API)
  active: boolean notNull default true,
  productPrompt: text,               // instrucciones de venta del producto
  position: integer notNull default 0,
  createdAt, updatedAt
}
index product_org_idx (organizationId, createdAt)
```

**`productMedia`** (idéntica a `kbEntryMedia`, cambiando la FK):
```ts
productMedia {
  id, organizationId (FK org cascade),
  productId (FK product cascade),
  mediaAssetId (FK mediaAsset cascade),
  shortId: text notNull,             // "img_xxxx", único por org
  position: integer notNull default 0,
  createdAt, updatedAt
}
index product_media_org_idx, product_media_product_idx
unique (productId, mediaAssetId), unique (organizationId, shortId)
```

**`ids.ts`:** añadir prefijos `product: "prod"`, `productMedia: "prodm"`.

Migración Drizzle idempotente.

> Nota shortId: los shortId de KB (`kb_entry_media`) y de producto
> (`product_media`) comparten el espacio "único por org" — como se generan con
> nanoid la colisión es improbable; para máxima seguridad, el `send_media`
> resuelve buscando en ambas fuentes por shortId, así que aunque coincidieran
> apuntarían a assets distintos sin romper (se prioriza producto).

### 2. Servicio de imágenes — `src/server/products/media.ts`

Copia de `kb/media.ts` cambiando `kbEntry`/`kbEntryMedia` → `product`/`productMedia`
y quitando la validación de "kind block":
- `listProductImages(orgId, productId)`, `productImagesByOrg(orgId)` (Map por
  productId), `addProductImage({organizationId, productId, file})`,
  `removeProductImage(...)`.
- Reutiliza `validateOutgoing` (solo imagen), `saveMediaFile`, `uploadGraphMedia`
  (pre-sube a Graph para tener `waMediaId`), inserta `mediaAsset` + `productMedia`.
- `ProductImage { id, assetId, shortId, url:"/api/media/<assetId>", position }`.

### 3. API — rutas nuevas (patrón `withAuth` + `scoped`)

- `GET /api/products` — lista productos de la org (con sus imágenes) ordenados.
  Soporta `?q=` para buscar por nombre.
- `POST /api/products` — crea. Zod: `name` (1-120), `priceCents` (int ≥ 0) o
  `price` (string) que se convierte a centavos, `currency` (enum CURRENCIES),
  `type` (enum), `dropiId` (regex `^\d{1,12}$` opcional), `active` (bool),
  `productPrompt` (≤ 4000 opcional).
- `PATCH /api/products/[id]` — edita campos.
- `DELETE /api/products/[id]` — borra (cascade borra imágenes).
- `POST /api/products/[id]/media` — sube imagen (multipart, molde de KB).
- `GET /api/products/[id]/media` — lista imágenes.
- `DELETE /api/products/[id]/media/[mediaId]` — quita imagen.
- `/api/media/[assetId]` se reutiliza sin cambios.

### 4. UI — sección Productos

- **`src/app/(app)/products/page.tsx`**: server minimal → `<ProductsClient />`.
- **`src/components/app-nav.tsx`**: agregar
  `{ href:"/products", label:"Productos", icon: Package }` al arreglo `NAV`.
- **`src/components/products/products-client.tsx`**:
  - Grid de tarjetas: imagen principal, nombre, badge tipo, badge activo/inactivo,
    precio formateado, botón Configurar. Tarjeta "Agregar nuevo producto".
  - Buscador por nombre.
  - Diálogo/pantalla Crear/Editar: campos (nombre, precio+moneda, tipo, ID Dropi,
    estado, prompt del producto) + panel de imágenes (subir multipart, miniaturas,
    quitar). Reutiliza la UX de imágenes que ya hicimos en Agentes/KB.
  - Formateo de precio con el helper de `lib/money`.

### 5. Contexto del agente — `prompts.ts` y `pipeline.ts`

- **`pipeline.ts` (`runAgentTurn`)**: junto a la carga de kb/stages/kbImages,
  cargar `products` activos (`WHERE active = true`) y sus imágenes con
  `productImagesByOrg(orgId)`. Pasar `products` (+ sus shortIds) a
  `buildAgentSystemPrompt`.
- **`prompts.ts` (`buildAgentSystemPrompt`)**: nuevo bloque "CATÁLOGO DE PRODUCTOS
  ACTIVOS" — por producto: nombre, precio formateado, tipo, `productPrompt`, y
  `[imágenes disponibles: <shortIds>]`. Marcar `hasImages=true` también si hay
  imágenes de producto (para ofrecer `send_media`). Regla: "usa SOLO productos y
  precios del catálogo; no inventes".
- **`send_media` (pipeline.ts)**: al aplanar `allImages` para `resolveKbMedia`,
  concatenar las imágenes de producto además de las de KB. Así el agente envía
  imágenes de producto con el mismo mecanismo (`deliverImage` no cambia: recibe un
  `assetId` y lo envía).

## Flujo de datos

### Alta de producto
1. Dueño abre Productos → "Agregar" → llena datos → guarda (`POST /api/products`).
2. Sube imágenes (`POST /api/products/[id]/media`) → miniaturas.
3. El producto activo entra al contexto del agente en el siguiente turno.

### Venta
1. Cliente pregunta por un producto.
2. El agente ve el catálogo (nombre, precio, tipo, prompt) en su system prompt.
3. Responde con datos correctos; si el cliente pide foto, emite `send_media` con
   el shortId de la imagen del producto → `deliverImage` la envía.

## Manejo de errores

| Situación | Comportamiento |
|-----------|----------------|
| Imagen inválida (tipo/tamaño) | 413/415 con mensaje |
| dropiId no numérico | 422 con mensaje claro |
| Sin productos activos | agente usa KB como hoy |
| Producto de otra org | 404 (scoped) |
| send_media con shortId inexistente | degrada a reply/none |
| isTest | envío de imagen no toca Meta (igual que hoy) |

## Testing

- **Unit (Vitest):**
  - Servicio `products/media`: agrega/valida (solo imagen)/aisla por org.
  - API productos: crear valida precio/tipo/dropiId; scoped; borrar cascada.
  - prompt: renderiza catálogo de productos activos; excluye inactivos; ofrece
    send_media si hay imágenes de producto.
  - send_media: resuelve shortId de producto además de KB.
- **Gate:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.

## Decisiones

- **Sección separada (no dentro del agente):** en Vocero hay un agente por org;
  los productos son un activo del negocio (catálogo, futuro Dropi/reportes), no una
  config del agente. Mejor UX y coherente con las demás secciones.
- **Tablas propias (no extender KB):** datos estructurados (precio, tipo, dropiId)
  merecen su modelo; el KB sigue para conocimiento general.
- **Reusar imágenes y send_media:** cero mecanismo nuevo de envío; shortId único
  por org permite que el agente trate igual imágenes de KB y de producto.
- **Precio en centavos:** exactitud monetaria, consistente con `lead.amountCents`.
- **prompt por producto:** control fino de venta sin fragmentar la navegación ni
  requerir múltiples asistentes.
