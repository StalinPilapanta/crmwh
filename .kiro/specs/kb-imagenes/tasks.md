# Tasks — Imágenes de producto en la base de conocimiento

- [ ] 1. Schema y migración: relación KB ↔ imagen
  - Agregar tabla `kbEntryMedia` a `src/lib/db/schema.ts`: `id`, `organizationId`
    (FK org cascade), `kbEntryId` (FK kbEntry cascade), `mediaAssetId` (FK
    mediaAsset cascade), `shortId` (text), `position` (int default 0),
    timestamps. Índices por org y kbEntry; unique (kbEntryId, mediaAssetId).
  - Generar migración idempotente con `pnpm db:generate`.
  - _Requisitos: 1.3, 1.6, 4.3_

- [ ] 2. Endpoint de upload y borrado de imágenes de KB
  - [ ] 2.1 `POST /api/kb/[id]/media` (multipart): valida sesión + scoped, que el
    kbEntry es `block`; `validateOutgoing` (solo imagen); `saveMediaFile` +
    insert `mediaAsset` (kind image, available); `uploadGraphMedia` para
    `waMediaId` (con fallback si no hay credenciales); insert `kbEntryMedia` con
    `shortId` y `position`. Devuelve {id, shortId, url}.
    - _Requisitos: 1.1, 1.2, 1.3, 4.1_
  - [ ] 2.2 `DELETE /api/kb/[id]/media/[mediaId]`: desasocia (borra fila puente);
    borra el `mediaAsset` si ya no lo referencia nadie. Scoped por org.
    - _Requisitos: 1.5, 4.3_
  - [ ] 2.3 Extender `GET /api/kb` para incluir, por bloque, sus imágenes
    (id, shortId, url).
    - _Requisitos: 1.4_
  - [ ] 2.4 Tests: rechaza no-imagen (415) y muy grande (413); enlaza en éxito;
    bloque de otra org → 404 (aislamiento).
    - _Requisitos: 1.2, 4.3_

- [ ] 3. UI — adjuntar / ver / quitar imágenes en `KbSection`
  - Input de archivo (o dropzone) en "Nuevo bloque de texto libre"; tras crear el
    bloque, subir cada imagen a `POST /api/kb/[id]/media`.
  - Miniaturas de las imágenes por bloque (`/api/media/[assetId]`) con botón
    "quitar" (DELETE). Tipo local `KbEntry` con `images[]`.
  - Validación de tipo/tamaño en cliente (feedback) además de la del servidor.
  - _Requisitos: 1.1, 1.4, 1.5_

- [ ] 4. Exponer imágenes al agente — `prompts.ts`
  - `buildAgentSystemPrompt` recibe las imágenes por bloque; `renderKb` agrega, a
    los bloques con imágenes, la línea `[imágenes disponibles: <shortId>, ...]`.
  - Regla en el prompt: enviar imágenes solo cuando sean relevantes (cliente las
    pide / encajan), sin repetir.
  - Test: bloque con imágenes agrega la línea; sin imágenes, salida igual que hoy.
  - _Requisitos: 2.1, 2.2, 2.3_

- [ ] 5. Acción `send_media` — `actions.ts`
  - Extender `AgentAction` con `{ action:"send_media", mediaId, reply? }`.
  - `resolveKbMedia(mediaId, kbMedia)`: match por shortId en la org; si no existe,
    `degradeAction` (a reply si hay texto, o none).
  - Tests: schema válido/ inválido; resolución y degradación.
  - _Requisitos: 3.7_

- [ ] 6. Ejecución en el pipeline — `pipeline.ts`
  - [ ] 6.1 Cargar imágenes de KB de la org (join kbEntryMedia + mediaAsset) y
    pasarlas a `buildAgentSystemPrompt` y a la resolución de acción.
    - _Requisitos: 2.1_
  - [ ] 6.2 `case "send_media"` en el switch: resolver shortId → mediaAsset de la
    org; si hay `reply`, entregar texto; enviar imagen con `sendMediaMessage`
    (reusar `waMediaId` si existe, si no leer binario con `readMediaFile`).
    - _Requisitos: 3.1, 3.2, 3.3, 4.1_
  - [ ] 6.3 Sandbox (`isTest`) → persistir outbound de prueba (no toca Meta);
    `window_closed` → `applyHandoff("ventana")`; fallo de envío → degradar a texto.
    - _Requisitos: 3.4, 3.5, 3.6_
  - [ ] 6.4 Evitar reenvío innecesario de la misma imagen en la conversación
    (heurística: no repetir mediaId ya enviado en los últimos N salientes).
    - _Requisitos: 4.2_
  - [ ] 6.5 Tests del case: sandbox persiste local; id inválido degrada; éxito
    llama `sendMediaMessage`.
    - _Requisitos: 3.1, 3.5, 3.7_

- [ ] 7. Verificación
  - Gate completo: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
    Corregir hasta verde.
  - _Requisitos: todos_

- [ ] 8. Despliegue y validación
  - Commit + push; deploy en Coolify (migración corre al boot).
  - Validación real: en Agentes, crear un bloque de producto con 1-2 fotos;
    desde WhatsApp pedir "¿me mandas una foto?" y verificar que el agente envía la
    imagen correcta, y que en el Laboratorio no se envía a Meta.
  - _Requisitos: 1.1, 3.1, 3.5_
