# Tasks — Agente multimedia (audio e imagen)

- [ ] 1. Configuración de entorno y helper de activación
  - Agregar variables a `src/lib/env.ts`: `OPENAI_API_KEY` (opcional),
    `OPENAI_BASE_URL` (default `https://api.openai.com`), `OPENAI_STT_MODEL`
    (default `whisper-1`), `OPENAI_VISION_MODEL` (default `gpt-4o-mini`),
    `OPENAI_TTS_MODEL` (default `tts-1`), `OPENAI_TTS_VOICE` (default `nova`),
    `AGENT_VOICE_REPLY` (default `mirror`), `MEDIA_STT_MAX_BYTES` (default 16000000).
  - Agregar helper `isMediaAiConfigured()` que devuelve true si `OPENAI_API_KEY`
    está presente y no vacía.
  - Documentar cada variable en `.env.example` con guía inline.
  - _Requisitos: 4.1, 4.2, 4.3_

- [ ] 2. Migración: columna `transcript` en `media_asset`
  - Agregar `transcript: text("transcript")` al schema `mediaAsset` en
    `src/lib/db/schema.ts`.
  - Generar la migración con `pnpm db:generate` (o crear el `.sql` manual con
    `ALTER TABLE "media_asset" ADD COLUMN IF NOT EXISTS "transcript" text;` y
    actualizar el journal, siguiendo el patrón del repo).
  - _Requisitos: 1.2, 2.3, 5.1_

- [ ] 3. Adaptador OpenAI multimedia — `src/lib/ai/openai-media.ts`
  - [ ] 3.1 Implementar `transcribeAudio({ data, mimeType })` con
    `POST /v1/audio/transcriptions` (multipart, modelo de env, `language=es`).
    Devuelve resultado tipado, nunca lanza. Timeout + manejo de error.
    - _Requisitos: 1.1, 1.4, 5.2_
  - [ ] 3.2 Implementar `describeImage({ data, mimeType, caption? })` con
    `POST /v1/chat/completions` multimodal (`image_url` data-URI base64), prompt
    en español que pide descripción breve y accionable. Resultado tipado.
    - _Requisitos: 2.1, 2.2, 2.5_
  - [ ] 3.3 Implementar `synthesizeSpeech(text)` con `POST /v1/audio/speech`
    (modelo/voz de env, `response_format="opus"`). Devuelve `{ data: Buffer,
    mimeType: "audio/ogg" }`. Resultado tipado.
    - _Requisitos: 3.1, 3.4_
  - [ ] 3.4 Tests unitarios (Vitest) del adaptador con `fetch` mockeado: casos
    ok y error para las tres funciones; verificar que nunca lanzan.
    - _Requisitos: 1.4, 2.5, 3.4, 5.2_

- [ ] 4. Resolución de contenido entrante — `src/server/ai/resolve-content.ts`
  - [ ] 4.1 Implementar `resolveInboundContent(message, mediaAsset)`:
    - texto → `message.text`.
    - audio → si `transcript` existe, reusar; si no, `readMediaFile` +
      `transcribeAudio` + persistir `transcript`; devolver `[nota de voz]: …`.
    - image → análogo con `describeImage` (incluye caption); devolver `[imagen]: …`.
    - fallo → `null` + `console.error`.
    - _Requisitos: 1.1, 1.2, 1.3, 2.1, 2.3, 2.4, 5.1_
  - [ ] 4.2 Respetar límite `MEDIA_STT_MAX_BYTES` y `isMediaAiConfigured()`
    (si no está configurado, audio/imagen resuelven a `null` sin llamar a OpenAI).
    - _Requisitos: 4.1, 5.3_
  - [ ] 4.3 Tests unitarios: asset ya transcrito no re-llama; asset pendiente
    llama una vez y persiste; fallo devuelve null.
    - _Requisitos: 5.1_

- [ ] 5. Integración en el pipeline — `src/server/ai/pipeline.ts`
  - [ ] 5.1 Cargar los `media_asset` de los mensajes del historial (join o fetch
    por `mediaAssetId`) para poder resolver su contenido.
  - [ ] 5.2 Reemplazar `history.filter((m) => m.text)` por una resolución async
    con `resolveInboundContent`; omitir del prompt los que resuelvan a `null`.
    - _Requisitos: 1.3, 2.4_
  - [ ] 5.3 Calcular flag `voice` según `AGENT_VOICE_REPLY` y si el `lastInbound`
    fue de tipo `audio` (política `mirror`).
    - _Requisitos: 3.3_
  - [ ] 5.4 Extender `deliverReply(conversation, text, { voice })`:
    - `voice=false` → `sendText` (actual).
    - `voice=true` → `synthesizeSpeech`; si ok → `sendMediaMessage(audio/ogg)`;
      si falla → degradar a `sendText`.
    - `isTest` → persistir salida local, sin OpenAI ni Meta.
    - _Requisitos: 3.1, 3.2, 3.4, 3.5_
  - [ ] 5.5 Mensajes de cortesía cuando el único inbound no se pudo resolver
    (audio inescuchable / imagen no interpretable).
    - _Requisitos: 1.4, 2.5_

- [ ] 6. Verificación end-to-end
  - [ ] 6.1 Extender el arnés de mocks (wa-mock/ai-mock) para simular inbound de
    audio e imagen y aserciones de salida (transcribe → responde; imagen → texto;
    audio → respuesta de voz).
    - _Requisitos: 1.1, 2.1, 3.1, 3.5_
  - [ ] 6.2 Correr el gate completo:
    `pnpm typecheck && pnpm lint && pnpm build && pnpm test`. Corregir hasta verde.
    - _Requisitos: todos_

- [ ] 7. Despliegue y validación en Coolify
  - Agregar `OPENAI_API_KEY` y variables relacionadas en la app de Coolify.
  - Redeploy y prueba real: enviar nota de voz al número y verificar que el agente
    transcribe y responde con voz; enviar una imagen y verificar respuesta en texto.
  - _Requisitos: 1.1, 2.1, 3.1, 3.2_
