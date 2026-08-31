# Design — Imágenes de producto en la base de conocimiento

## Visión general

Se asocian imágenes a los bloques de texto libre de la KB. El agente ve, en su
prompt, qué imágenes existen (con un id corto por imagen) y una regla de cuándo
enviarlas. Cuando decide enviarlas, emite una nueva acción `send_media` que el
pipeline ejecuta reutilizando `sendMediaMessage`.

Casi toda la infraestructura ya existe (`mediaAsset`, `sendMediaMessage`,
`uploadGraphMedia`, `saveMediaFile`, endpoint `/api/media/[assetId]`, patrón de
upload multipart). Se agrega: la relación KB↔imagen, un endpoint de upload para KB,
la UI de adjuntar/ver/quitar, la exposición al prompt, la acción `send_media`, y su
ejecución en el pipeline.

### Principios

- **Aditivo:** un bloque sin imágenes se comporta exactamente como hoy.
- **Reutiliza infraestructura:** nada nuevo para almacenar/enviar imágenes.
- **Nunca tumba el turno:** id inválido, ventana cerrada o envío fallido → degrada
  a texto o se ignora.
- **Respeta sandbox y tenant:** `isTest` no toca Meta; imágenes scoped por org.

## Arquitectura

```
UI Agentes (KbSection)
  └─ crea bloque (texto) + sube imágenes (multipart)
        │
        ▼
POST /api/kb/[id]/media  (nuevo, multipart)
  └─ valida (validateOutgoing) → saveMediaFile → inserta mediaAsset (kind image,
     fetchStatus available) → uploadGraphMedia (waMediaId listo) → enlaza a kbEntry
        │
        ▼
kbEntryMedia (tabla puente: kbEntryId, mediaAssetId, position)

--- en cada turno del agente ---
runAgentTurn → buildAgentSystemPrompt({ profile, kb, kbMedia, stages })
  └─ renderKb incluye, por bloque con imágenes:
       "[imágenes disponibles: img_ab12, img_cd34]"
        │
        ▼
chatJson(AgentAction) → puede devolver:
   { action: "send_media", mediaId: "img_ab12", reply?: "Aquí la foto 👇" }
        │
        ▼
switch → case "send_media":
   resuelve mediaId → mediaAsset (validando que pertenece a la org y a un bloque)
   → sendMediaMessage(waMediaId ya subido)  (+ reply opcional)
```

## Componentes y cambios

### 1. Schema — relación KB ↔ imagen

Nueva tabla puente **`kbEntryMedia`** (un bloque puede tener varias imágenes, y el
orden importa):

```ts
kbEntryMedia {
  id: text pk,
  organizationId: text (FK org, cascade),   // para scoping directo
  kbEntryId: text (FK kbEntry, cascade),      // borrar bloque → borra enlaces
  mediaAssetId: text (FK mediaAsset, cascade),
  shortId: text,        // id corto legible para el prompt (ej. "img_ab12")
  position: integer default 0,
  createdAt, updatedAt
}
index por (organizationId), (kbEntryId)
unique (kbEntryId, mediaAssetId)
```

`shortId`: identificador estable y corto que el modelo usa en `send_media`
(evita exponer ids largos y frágiles). Se genera al enlazar.

Migración Drizzle idempotente.

### 2. Endpoint de upload — `POST /api/kb/[id]/media` (nuevo)

Réplica del patrón de `conversations/[id]/messages/media/route.ts`, pero SIN
enviar: solo guarda y enlaza.
- `withAuth` (sesión), `scoped` por org, valida que el `kbEntry` existe y es `block`.
- `req.formData()` → `file` (File) → `Buffer`.
- `validateOutgoing(mime, size)` (solo permite imagen; 413/415 en error).
- `saveMediaFile(orgId, assetId, buffer)` + insert `mediaAsset` (kind "image",
  fetchStatus "available").
- `uploadGraphMedia(credentials, file)` para obtener `waMediaId` desde ya
  (Req 4.1: no re-subir en cada envío). Si no hay credenciales de WhatsApp aún, se
  guarda igual y el `waMediaId` se resuelve en el primer envío.
- Inserta `kbEntryMedia` con `shortId` y `position`.
- Devuelve el asset enlazado (id, shortId, url para miniatura).

**`DELETE /api/kb/[id]/media/[mediaId]`**: desasocia (borra la fila de
`kbEntryMedia`; el `mediaAsset` puede quedar o borrarse — se opta por borrar el
enlace y el asset si ya no lo referencia nadie).

`GET /api/kb` se extiende para incluir, por bloque, sus imágenes (id, shortId, url).

### 3. UI — `KbSection` en `agent-client.tsx`

- En el bloque "Nuevo bloque de texto libre": agregar un input de archivo (o
  dropzone) para adjuntar imágenes. Flujo: crear el bloque (POST JSON como hoy) →
  con el id devuelto, subir cada imagen a `POST /api/kb/[id]/media` (multipart).
- En el listado de entradas: mostrar miniaturas (`<img src="/api/media/[assetId]">`)
  de las imágenes de cada bloque, con un botón "quitar" (DELETE).
- El tipo local `KbEntry` incluye `images: { id, shortId, url }[]`.
- Validación de tamaño/tipo en cliente (feedback rápido) + la dura en el servidor.

### 4. Prompt — `renderKb` y `buildAgentSystemPrompt` (prompts.ts)

- `buildAgentSystemPrompt` recibe además las imágenes por bloque (se cargan en
  `runAgentTurn` junto con la KB).
- `renderKb`: para un bloque con imágenes, tras el `content` agrega una línea:
  `[imágenes disponibles: img_ab12, img_cd34]`.
- Nueva regla en el prompt: "Si el cliente pide ver el producto o una foto, y el
  bloque relevante tiene imágenes disponibles, responde con la acción send_media
  usando el id de la imagen. No envíes imágenes que no correspondan ni de forma
  repetida."

### 5. Acción `send_media` — `actions.ts`

Extender el `discriminatedUnion` `AgentAction` con:
```ts
{ action: "send_media", mediaId: string, reply?: string }
```
- `resolveKbMedia(mediaId, kbMedia)`: match por `shortId` dentro de las imágenes de
  la org; si no existe → `degradeAction` (a `reply` si hay texto, o `none`).

### 6. Pipeline — `runAgentTurn` y switch (pipeline.ts)

- Cargar las imágenes de KB de la org (join `kbEntryMedia` + `mediaAsset`) y
  pasarlas a `buildAgentSystemPrompt` y para la resolución de la acción.
- Nuevo `case "send_media"` en el switch:
  - Resolver `mediaId` (shortId) → `mediaAsset` de la org. Si no existe → degradar.
  - Si `action.reply` → `deliverReply(conversation, reply)` primero (texto).
  - Enviar la imagen: reutilizar `sendMediaMessage` leyendo el binario con
    `readMediaFile` (o, si ya hay `waMediaId`, enviar por id sin re-subir).
  - Sandbox (`isTest`): persistir salida de prueba, no tocar Meta.
  - `window_closed` → `applyHandoff("ventana")` (mismo patrón que `deliverReply`).
  - Fallo de envío → log + degradar a texto (Req 3.4).
- Evitar reenvío innecesario (Req 4.2): registrar en el turno si ya se envió esa
  imagen recientemente (heurística simple: no reenviar la misma `mediaId` si ya
  fue enviada en los últimos N mensajes salientes de la conversación).

### 7. Reutilización directa (sin cambios)

`sendMediaMessage`, `uploadGraphMedia`, `saveMediaFile`/`readMediaFile`,
`validateOutgoing`+`MEDIA_LIMITS`, `mediaAsset`, `GET /api/media/[assetId]`.

## Manejo de errores

| Situación | Comportamiento |
|-----------|----------------|
| Imagen inválida (tipo/tamaño) en upload | 413/415 con mensaje claro; no se enlaza |
| `send_media` con id inexistente | degrada a `reply` o `none`; nunca falla |
| Envío de imagen falla (Meta/red) | log + degradar a texto |
| Ventana cerrada | handoff "ventana" (como el texto) |
| Conversación is_test | persistir outbound de prueba, no toca Meta |
| Bloque sin imágenes | prompt y flujo idénticos a hoy |

## Testing

- **Unit (Vitest):**
  - `resolveKbMedia`: match por shortId; id inexistente → degrada.
  - `renderKb`: bloque con imágenes agrega la línea de ids; sin imágenes, igual que hoy.
  - Acción `send_media`: schema Zod válido/ inválido.
  - Endpoint upload: rechaza no-imagen (415) y muy grande (413); enlaza en éxito.
  - Endpoint upload: aislamiento por tenant (bloque de otra org → 404).
  - Pipeline `case send_media`: sandbox persiste local; id inválido degrada;
    éxito llama `sendMediaMessage`.
- **Gate:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.

## Decisiones

- **Tabla puente `kbEntryMedia`** (no array en kbEntry): permite varias imágenes
  ordenadas, borrado en cascada limpio, y `shortId` estable por imagen.
- **`shortId` para el prompt:** el modelo maneja mejor ids cortos y legibles; se
  resuelve server-side contra la allowlist (nunca envía algo fuera de la org).
- **Subir a Graph al adjuntar (no al enviar):** obtiene `waMediaId` una vez y evita
  re-subir en cada envío (control de costo/latencia). Con fallback si aún no hay
  credenciales.
- **Acción `send_media` separada** (no meter media en `reply`): mantiene el
  contrato de acciones tipado y explícito, fácil de validar y degradar.
- **Solo bloques de texto libre** (no QA): es donde vive la ficha de producto; acota
  el alcance.
