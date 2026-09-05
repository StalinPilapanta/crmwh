# Tasks — Sección de Productos (catálogo del agente)

- [ ] 1. Schema y migración
  - `src/lib/db/ids.ts`: prefijos `product: "prod"`, `productMedia: "prodm"`.
  - `src/lib/db/schema.ts`: tabla `product` (name, priceCents, currency, type
    enum físico/virtual/servicio, dropiId, active, productPrompt, position,
    timestamps, índice org-first) y `productMedia` (molde de kbEntryMedia).
  - Generar migración idempotente (`pnpm db:generate` + ADD/CREATE IF NOT EXISTS).
  - _Requisitos: 2.1, 2.3, 2.6, 3.3_

- [ ] 2. Servicio de imágenes de producto — `src/server/products/media.ts`
  - Copia de `kb/media.ts` para `product`/`productMedia` (sin validación "block"):
    `listProductImages`, `productImagesByOrg`, `addProductImage`,
    `removeProductImage`. Reutiliza validateOutgoing/saveMediaFile/uploadGraphMedia.
  - Tests: agrega/valida (solo imagen)/aisla por org.
  - _Requisitos: 3.1, 3.2, 3.3_

- [ ] 3. API de productos
  - [ ] 3.1 `GET /api/products` (lista + imágenes, `?q=` por nombre) y
    `POST /api/products` (Zod: name, precio→centavos, currency, type, dropiId
    solo dígitos, active, productPrompt). Scoped por org, `newId("product")`.
    - _Requisitos: 1.2, 1.3, 2.1, 2.3, 2.4, 2.6_
  - [ ] 3.2 `PATCH /api/products/[id]` (editar) y `DELETE /api/products/[id]`
    (borrar; cascade borra imágenes).
    - _Requisitos: 2.2, 2.5, 2.6_
  - [ ] 3.3 `POST /api/products/[id]/media`, `GET` (listar),
    `DELETE /api/products/[id]/media/[mediaId]` (molde de KB).
    - _Requisitos: 3.1, 3.2_
  - [ ] 3.4 Tests: crear valida precio/tipo/dropiId; scoped; imágenes.
    - _Requisitos: 2.4, 2.6, 3.1_

- [ ] 4. UI — sección Productos
  - [ ] 4.1 `app-nav.tsx`: item "Productos" (ícono Package) en NAV.
    - _Requisitos: 1.1_
  - [ ] 4.2 `src/app/(app)/products/page.tsx` (server minimal) +
    `src/components/products/products-client.tsx`: grid de tarjetas (imagen,
    nombre, tipo, precio, estado), buscador, estado vacío.
    - _Requisitos: 1.2, 1.3, 1.4_
  - [ ] 4.3 Diálogo Crear/Editar: campos (nombre, precio+moneda, tipo, ID Dropi,
    estado, prompt del producto) + panel de imágenes (subir, miniaturas, quitar).
    Formateo de precio con lib/money.
    - _Requisitos: 2.1, 2.2, 2.3, 3.1, 3.2, 3.4_

- [ ] 5. Contexto del agente
  - [ ] 5.1 `pipeline.ts` (`runAgentTurn`): cargar productos activos + imágenes
    (`productImagesByOrg`); pasarlos a `buildAgentSystemPrompt`.
    - _Requisitos: 4.1, 4.2, 4.6_
  - [ ] 5.2 `prompts.ts`: bloque "CATÁLOGO DE PRODUCTOS ACTIVOS" (nombre, precio,
    tipo, productPrompt, imágenes); `hasImages` incluye imágenes de producto;
    regla anti-invención.
    - _Requisitos: 4.1, 4.4, 4.5_
  - [ ] 5.3 `send_media`: incluir imágenes de producto en el `allImages` que
    resuelve `resolveKbMedia`.
    - _Requisitos: 4.3, 5.2_
  - [ ] 5.4 Tests: prompt con productos activos (excluye inactivos, ofrece
    send_media); resolución de shortId de producto.
    - _Requisitos: 4.1, 4.2, 4.3_

- [ ] 6. Verificación
  - Gate completo: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
  - _Requisitos: 5.1, 5.2, 5.3_

- [ ] 7. Despliegue y validación
  - Commit + push; deploy en Coolify (migración al boot).
  - Validación real: crear un producto con imágenes; en WhatsApp preguntar por él
    y verificar que el agente da precio/info correctos y envía la foto; confirmar
    que un producto inactivo no aparece.
  - _Requisitos: 1.1, 4.1, 4.3_
