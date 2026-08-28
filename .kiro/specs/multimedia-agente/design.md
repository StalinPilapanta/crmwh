# Design — Agente multimedia (audio e imagen)

## Visión general

Vocero ya descarga, almacena y sabe enviar audio/imagen por WhatsApp. Lo que falta
es la "inteligencia" multimedia: convertir audio entrante a texto (STT), interpretar
imágenes entrantes (visión), y convertir la respuesta del agente a voz (TTS). Todo
con OpenAI (Whisper, gpt-4o-mini visión, tts-1 voz `nova`).

El diseño respeta la convención del repo: cada servicio externo pasa por un
adaptador dedicado en `src/lib/ai/`, y el pipeline del agente sigue siendo el
único orquestador.

### Principios de diseño

- **No romper lo existente:** si no hay `OPENAI_API_KEY`, el sistema se comporta
  como hoy (solo texto). La feature es aditiva y degradable.
- **Procesar una sola vez:** la transcripción/descripción se persiste en
  `media_asset`; nunca se reprocesa un asset ya resuelto.
- **Nunca tumbar el turno:** cualquier fallo de STT/visión/TTS degrada con gracia
  (texto de cortesía o respuesta de texto), nunca propaga excepción al webhook.
- **Respetar el sandbox:** conversaciones `isTest` jamás llaman a la API real de
  Meta (guardrail existente en `deliverReply`).

## Arquitectura

```
Mensaje entrante (audio/imagen)
        │
        ▼
ingest.ts → ensureAssetAvailable (descarga ya existente)
        │
        ▼
maybeRunAgentTurn → runAgentTurn (pipeline.ts)
        │
        ├── resolveInboundContent(message)  ← NUEVO
        │      audio → transcribeAudio (Whisper)  → guarda transcript
        │      image → describeImage (gpt-4o visión) → guarda transcript
        │      text  → devuelve el texto tal cual
        │
        ▼
   arma ChatMessage[] (ya con texto resuelto)
        │
        ▼
   chatJson(AgentAction, messages)   ← sin cambios
        │
        ▼
   deliverReply(conversation, text, { voice })   ← EXTENDIDO
        │
        ├── voice=false → sendText (como hoy)
        └── voice=true  → synthesizeSpeech (tts-1 nova)
                          → sendMediaMessage(audio/ogg)   ← ya existe
```

## Componentes y cambios

### 1. Nuevo adaptador OpenAI multimedia — `src/lib/ai/openai-media.ts`

Frontera única con OpenAI para las tres capacidades. Todas las funciones son
"safe": devuelven un resultado tipado y nunca lanzan.

```ts
// Transcripción (Whisper)
transcribeAudio(input: { data: Buffer; mimeType: string }):
  Promise<{ ok: true; text: string } | { ok: false; error: string }>

// Visión (gpt-4o-mini)
describeImage(input: { data: Buffer; mimeType: string; caption?: string }):
  Promise<{ ok: true; text: string } | { ok: false; error: string }>

// Síntesis de voz (tts-1, voz "nova")
synthesizeSpeech(text: string):
  Promise<{ ok: true; data: Buffer; mimeType: string } | { ok: false; error: string }>
```

- Endpoints OpenAI:
  - STT: `POST /v1/audio/transcriptions` (multipart, modelo `whisper-1`, `language=es`).
  - Visión: `POST /v1/chat/completions` con `content` multimodal (`image_url`
    en data-URI base64), modelo `gpt-4o-mini`, prompt que pide una descripción
    breve y accionable en español.
  - TTS: `POST /v1/audio/speech` (modelo `tts-1`, `voice="nova"`,
    `response_format="opus"`), devuelve binario listo para WhatsApp.
- Autenticación con `OPENAI_API_KEY` (env nueva). Timeout y manejo de error
  siguiendo el patrón de `chatJson`.

**Decisión (visión):** se hace una llamada separada de "describir imagen" que
inyecta texto al historial, en vez de volver multimodal el `chatJson` principal.
Razón: mantiene el adaptador `chatJson` intacto (solo texto), aísla el costo de
visión, y persiste la descripción para reusarla. Menos superficie de cambio.

### 2. Resolución de contenido entrante — `src/server/ai/resolve-content.ts` (nuevo)

Función `resolveInboundContent(message, mediaAsset)` que, dado un mensaje del
historial:

- Si `type === "text"` → devuelve `message.text`.
- Si `type === "audio"` → si el asset ya tiene `transcript`, lo devuelve; si no,
  lee el buffer (`readMediaFile`), llama `transcribeAudio`, **persiste** en
  `media_asset.transcript`, y devuelve el texto. Prefija `[nota de voz]: …` para
  que el agente sepa el origen.
- Si `type === "image"` → análogo con `describeImage`, persiste en
  `media_asset.transcript` (reutilizamos la columna), devuelve
  `[imagen]: <descripción> (caption: …)`.
- Si falla → devuelve `null` y registra; el pipeline lo trata como mensaje sin
  contenido procesable.

### 3. Cambios en el pipeline — `src/server/ai/pipeline.ts`

- **Reemplazar el filtro** `history.filter((m) => m.text)` por una resolución
  async: para cada mensaje del historial, obtener su contenido textual vía
  `resolveInboundContent` (texto directo, transcripción o descripción). Los
  mensajes que no resuelven a texto se omiten del prompt.
- **Detectar modалidad de voz:** marcar si el `lastInbound` fue de tipo `audio`.
  Ese flag decide la política de respuesta por voz.
- **`deliverReply` extendido** con opción `{ voice: boolean }`:
  - `voice=false`: comportamiento actual (`sendText`).
  - `voice=true`: `synthesizeSpeech(text)` → si `ok`, `sendMediaMessage` con
    `audio/ogg`; si falla, degradar a `sendText(text)`.
  - En `isTest`: persistir salida localmente (como hoy), sin tocar Meta ni OpenAI TTS.
- La política ("responder en voz solo si el cliente escribió por voz") se aplica
  al calcular el flag `voice` antes de llamar `deliverReply`. Configurable por env
  `AGENT_VOICE_REPLY` = `off | mirror | always` (default `mirror`).

### 4. Persistencia — migración Drizzle

`media_asset` ya tiene casi todo. Se agrega **una columna**:

```sql
ALTER TABLE "media_asset" ADD COLUMN IF NOT EXISTS "transcript" text;
```

Guarda la transcripción del audio o la descripción de la imagen. NULL hasta que
se procese. Idempotencia: si `transcript` no es NULL, no se reprocesa.

(Nota: no confundir con `agent_test_run.transcript` que es jsonb y de otro dominio.)

### 5. Configuración — `src/lib/env.ts` y `.env.example`

Nuevas variables (todas opcionales; sin ellas la feature queda inactiva):

```
OPENAI_API_KEY=            # clave de OpenAI (STT/visión/TTS)
OPENAI_BASE_URL=https://api.openai.com   # override opcional
OPENAI_STT_MODEL=whisper-1
OPENAI_VISION_MODEL=gpt-4o-mini
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=nova       # voz femenina
AGENT_VOICE_REPLY=mirror    # off | mirror | always
MEDIA_STT_MAX_BYTES=16000000
```

Helper `isMediaAiConfigured()` (análogo a `isAiConfigured`) que activa las
capacidades cuando `OPENAI_API_KEY` está presente.

## Flujo de datos detallado

### Audio entrante
1. Webhook → `ingest` clasifica `kind:"audio"`, crea `media_asset` (`pending`),
   dispara `ensureAssetAvailable` (descarga el .ogg de Meta).
2. `runAgentTurn` → `resolveInboundContent`: lee buffer, `transcribeAudio`,
   persiste `transcript`, devuelve `[nota de voz]: <texto>`.
3. El agente procesa como texto normal → genera `reply`.
4. Política `mirror`: como el último inbound fue audio → `voice=true`.
5. `synthesizeSpeech` → `sendMediaMessage(audio/ogg)`.

### Imagen entrante
1. Igual hasta la descarga.
2. `resolveInboundContent`: `describeImage` (con caption) → persiste, devuelve
   `[imagen]: <descripción>`.
3. Agente responde. Política `mirror`: imagen no es voz → responde en texto.

## Manejo de errores

| Fallo | Comportamiento |
|-------|----------------|
| STT falla | Mensaje se omite del prompt; si era el único inbound, responder cortesía "no pude escuchar tu audio, ¿me lo escribes?" |
| Visión falla | Igual: "no pude ver bien la imagen, ¿me cuentas qué necesitas?" |
| TTS falla | Degradar a `sendText` (el cliente recibe la respuesta en texto) |
| Asset no descargable (410 Meta) | `fetchStatus:"failed"`, se omite; sin romper turno |
| Sin `OPENAI_API_KEY` | Feature inactiva; audio/imagen se ignoran como hoy |

Todos los errores se registran con `console.error` sin exponer secretos, igual que
el patrón actual del pipeline.

## Testing

- **Unit (Vitest):** adaptador `openai-media` con `fetch` mockeado (STT ok/err,
  visión ok/err, TTS ok/err). `resolveInboundContent` con asset ya transcrito
  (no re-llama) vs pendiente.
- **E2E (arnés existente + mocks):** extender wa-mock/ai-mock para simular un
  inbound de audio y verificar que (a) se transcribe, (b) el agente responde, (c)
  la respuesta sale como audio. Respetar `WA_MOCK_ENABLED` y el sandbox.
- **Gate:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.

## Decisiones y alternativas consideradas

- **Visión: llamada separada vs `chatJson` multimodal.** Elegido separado para no
  tocar el adaptador principal ni el contrato de acciones. Trade-off: una llamada
  extra a OpenAI por imagen, pero se persiste y no se repite.
- **Reusar `transcript` para audio e imagen** en vez de dos columnas. Menos
  superficie de esquema; el `kind` del asset ya distingue el origen.
- **Formato TTS `opus`/`ogg`** para que WhatsApp lo muestre como nota de voz real
  (no como archivo adjunto).
- **Política de voz configurable** con default `mirror` (coincide con lo que el
  usuario pidió: responder en voz solo si escribió por voz).
