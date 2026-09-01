# Tasks — Agente robusto y vendedor

- [ ] 1. Robustez del adaptador de IA — `src/lib/ai/index.ts`
  - [ ] 1.1 `extractJson`: sanear comas colgantes (`,}` / `,]`) antes de parsear.
    - _Requisitos: 1.2_
  - [ ] 1.2 `chatJson`: opción `textFallback` (default true). Si se agotan los
    intentos por falta de JSON pero el último `raw` tiene prosa útil, envolver como
    `{ action:"reply", text: raw }` validado por el schema. Devolver ok.
    - _Requisitos: 1.1_
  - [ ] 1.3 Tests: prosa → reply; comas colgantes saneadas; JSON válido intacto;
    sin texto → sigue siendo error.
    - _Requisitos: 1.1, 1.2_

- [ ] 2. Cortesía en vez de silencio — `src/server/ai/pipeline.ts`
  - En el bloque `if (!result.ok)` (fallo del proveedor / salida imposible):
    enviar `deliverReply(conversation, mensajeCortesia)` antes de
    `applyHandoff("error")`. Respetar `isTest`.
  - Test: fallo del proveedor → se entrega cortesía y luego handoff.
  - _Requisitos: 1.3, 1.4, 1.5_

- [ ] 3. Prompt de ventas — `src/server/ai/prompts.ts`
  - Añadir bloque de directrices de venta al template base de
    `buildAgentSystemPrompt`, combinado con `tone`/`instructions` del perfil.
    Mantener la regla anti-alucinación.
  - Test: el prompt incluye las directrices de venta y sigue respetando
    tono/instrucciones.
  - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 4. Indicador "escribiendo…"
  - [ ] 4.1 `src/server/whatsapp/typing.ts` (nuevo): `markReadAndTyping({
    organizationId, conversationId })` best-effort (nunca lanza); reutiliza el
    payload Graph (`status:read` + `typing_indicator`). Respeta isTest/handoff/IA.
    - _Requisitos: 3.1, 3.2, 3.4_
  - [ ] 4.2 Refactor `src/app/api/bot/typing/route.ts` para usar el helper.
    - _Requisitos: 3.4_
  - [ ] 4.3 `pipeline.ts`: disparar `void markReadAndTyping(...)` antes de
    `chatJson` en `runAgentTurn`. No bloquear el turno.
    - _Requisitos: 3.1, 3.3_
  - [ ] 4.4 Test: helper no hace nada si isTest/handoff; llama Graph en caso normal.
    - _Requisitos: 3.2, 3.3_

- [ ] 5. Estado de re-enganche — migración
  - `conversation`: `awaitingReplyAt timestamp`, `reengageStage integer default 0`.
  - `agentProfile`: `reengageText text` (nullable).
  - Migración Drizzle idempotente.
  - _Requisitos: 4.1, 4.2, 4.5_

- [ ] 6. Marcar/limpiar el estado de espera — `pipeline.ts` e `ingest.ts`
  - [ ] 6.1 pipeline: al ejecutar `update_ficha` (agente pide/recaba datos),
    marcar `awaitingReplyAt = now`, `reengageStage = 0`.
    - _Requisitos: 4.1_
  - [ ] 6.2 ingest: al recibir inbound, resetear `awaitingReplyAt = null`,
    `reengageStage = 0` (junto al reset de followup).
    - _Requisitos: 4.3_

- [ ] 7. Barrido de re-enganche corto
  - [ ] 7.1 `src/lib/env.ts`: `REENGAGE_AFTER_MIN` (default 45). `.env.example`.
    - _Requisitos: 4.1_
  - [ ] 7.2 `src/server/reengage/run.ts`: barrido (plantilla de followups):
    candidatas por `awaitingReplyAt` ≥ umbral, `reengageStage=0`, ventana abierta,
    negocio habló último; envía `reengageText` o default contextual; marca
    `reengageStage=1`. Idempotente, best-effort.
    - _Requisitos: 4.1, 4.2, 4.4, 4.5, 4.6_
  - [ ] 7.3 `POST /api/reengage/run`: protegido por `FOLLOWUP_CRON_KEY`; 401 sin
    clave; ejecuta el barrido.
    - _Requisitos: 4.1_
  - [ ] 7.4 Tests: umbral corto; idempotencia; ventana cerrada omite; endpoint 401.
    - _Requisitos: 4.4, 4.5_

- [ ] 8. Verificación
  - Gate completo: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
  - _Requisitos: 5.1, 5.2, 5.3_

- [ ] 9. Despliegue y activación
  - Commit + push; deploy en Coolify (migración al boot).
  - Crear Scheduled Task en Coolify: `*/15 * * * *` → `POST /api/reengage/run`
    con `Authorization: Bearer $FOLLOWUP_CRON_KEY`.
  - Validación real: forzar un fallo de formato y ver que el cliente recibe
    cortesía; ver "escribiendo…" al responder; dejar sin responder tras que el
    agente pida datos y ver el re-enganche corto.
  - _Requisitos: 1.3, 3.1, 4.1_
