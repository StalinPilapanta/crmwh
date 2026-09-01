# Design — Agente robusto y vendedor

## Visión general

Cuatro mejoras al agente, todas apoyadas en infraestructura existente:

1. **Robustez**: `extractJson` gana un 4º fallback (prosa → `reply`) y saneo de
   JSON; el pipeline, ante fallo total, envía cortesía en vez de callarse.
2. **Ventas**: `buildAgentSystemPrompt` gana un bloque de directrices de venta,
   combinado con el tono/instrucciones del dueño.
3. **Typing**: se extrae el payload Graph del endpoint bot/typing a un helper y el
   pipeline lo dispara antes de llamar al LLM.
4. **Re-enganche contextual**: nuevo estado "esperando datos" en la conversación,
   un barrido corto (nuevo endpoint + cron) que retoma con mensaje contextual, y
   reset al responder el cliente.

### Principios

- **Nunca silencio:** cualquier fallo termina en un mensaje al cliente.
- **Best-effort en lo secundario:** typing y re-enganche no rompen el turno.
- **Reutilizar:** typing ya existe; el barrido de followups es la plantilla.
- **Respetar guardrails:** sandbox (`isTest`), handoff, IA apagada, ventana 24h.

## Componentes y cambios

### 1. Robustez — `src/lib/ai/index.ts` y `pipeline.ts`

**`extractJson` (más tolerante):**
- Mantener las 3 estrategias actuales.
- Añadir saneo: quitar comas colgantes (`,}` / `,]`) antes de `JSON.parse`.
- **4º fallback (clave):** si NO hay JSON extraíble pero sí hay texto plano no
  vacío, devolver un marcador especial para que el llamador lo trate como
  respuesta de texto. Como `extractJson` devuelve `unknown`, se implementa mejor
  en `chatJson`: si todos los intentos fallan por "sin JSON" y el último `raw`
  tiene prosa útil, retornar `{ ok:true, data: { action:"reply", text: raw } }`
  validado contra el schema (o un resultado especial `fallbackText`).
- Decisión: agregar a `chatJson` un modo opcional `textFallback` (default true
  para el agente) que, al agotar intentos por formato, envuelve el último texto
  del modelo como `reply` si el schema lo admite. Así el agente responde con lo
  que el modelo "quería decir" en vez de nada.

**Pipeline `if (!result.ok)` (`pipeline.ts` ~235):**
- Antes de `applyHandoff("error")`, enviar `deliverReply(conversation,
  "Permíteme un momento, enseguida te confirmo 🙌")` (texto de cortesía
  configurable). Luego escalar en segundo plano.
- Respetar `isTest` (persistir sandbox).

### 2. Ventas — `src/server/ai/prompts.ts`

En `buildAgentSystemPrompt`, añadir un bloque de **directrices de venta** al
template base (después del conocimiento, antes del contrato JSON):

```
Eres un vendedor experto, cálido y persuasivo. Tu objetivo es cerrar la venta.
- Responde con energía y seguridad; destaca BENEFICIOS, no solo características.
- Si el cliente duda, maneja la objeción y da una razón para decidir hoy.
- En cuanto haya interés, pide los datos de entrega y cierra el pedido.
- No dejes la conversación abierta: termina con una pregunta o un siguiente paso.
- Da el precio con seguridad y ofrece de inmediato avanzar.
```

Estas directrices se combinan con `profile.tone` e `profile.instructions` (que el
dueño configura y tienen prioridad estilística). Se mantiene la regla
anti-alucinación existente.

### 3. Typing — helper compartido + disparo en el pipeline

- **`src/server/whatsapp/typing.ts` (nuevo):** extraer el payload Graph que hoy
  vive en `bot/typing/route.ts`:
  ```ts
  export async function markReadAndTyping(input: {
    organizationId: string; conversationId: string;
  }): Promise<void>  // best-effort, nunca lanza
  ```
  Resuelve credenciales y el `waMessageId` del último inbound; llama
  `graphRequest(.../messages, { status:"read", message_id, typing_indicator:{type:"text"} })`.
  Respeta `isTest`/`handoffAt`/`aiEnabled` (no hace nada si no aplica).
- **`bot/typing/route.ts`:** refactor para usar el helper (no duplicar).
- **`pipeline.ts`:** al inicio de `runAgentTurn`, tras validar guards y tener el
  `lastInbound`, llamar `void markReadAndTyping(...)` (sin await que bloquee) justo
  antes de `chatJson`. Así el "escribiendo…" aparece mientras el LLM piensa. El
  typing de WhatsApp se apaga solo cuando llega el mensaje o a los ~25s.

### 4. Re-enganche contextual — estado + barrido corto

**Estado en `conversation` (migración):**
- `awaitingReplyAt: timestamp | null` — cuándo el agente pidió datos y quedó
  esperando respuesta del cliente.
- `reengageStage: integer default 0` — 0=nada, 1=re-enganche corto ya enviado.
  (Independiente de `followupStage` para no chocar con el seguimiento de 20h.)

**Marcado del estado (`pipeline.ts`):**
- Cuando la acción es `update_ficha` con `reply` que pide datos, o un `reply` que
  claramente pide un dato para cerrar, marcar `awaitingReplyAt = now`,
  `reengageStage = 0`. (Heurística simple: al ejecutar `update_ficha` se asume que
  el agente está recabando datos → set del flag.)

**Barrido corto — `src/server/reengage/run.ts` (nuevo, plantilla de followups):**
- Candidatas: `isTest=false`, `handoffAt IS NULL`, `aiEnabled=true`,
  `awaitingReplyAt` no nulo, antigüedad ≥ `REENGAGE_AFTER_MIN` (default 45 min),
  `reengageStage = 0`, negocio habló último, ventana 24h abierta.
- Mensaje contextual: un texto configurable por org
  (`agentProfile.reengageText`) o un default: "¿Seguimos con tu pedido? Cuando
  quieras me pasas los datos y lo dejamos listo 😊".
- Éxito → `reengageStage = 1`.
- Endpoint `POST /api/reengage/run` protegido por la misma `FOLLOWUP_CRON_KEY`
  (reutiliza la clave); cron de Coolify cada ~15 min.

**Reset (`ingest.ts`):** donde ya se resetea `followupStage`, resetear también
`awaitingReplyAt = null`, `reengageStage = 0` al recibir un inbound.

**Coordinación con el seguimiento de 20h:** son estados independientes
(`reengageStage` vs `followupStage`). El re-enganche corto actúa primero (45 min);
el de 20h sigue para leads fríos. Un inbound resetea ambos.

## Config — `src/lib/env.ts` y `.env.example`

```
REENGAGE_AFTER_MIN=45     # minutos para el re-enganche corto tras pedir datos
# (Reutiliza FOLLOWUP_CRON_KEY y FOLLOWUP_BATCH_LIMIT existentes.)
```
`agentProfile.reengageText` (nullable) para el mensaje contextual configurable.

## Manejo de errores

| Situación | Comportamiento |
|-----------|----------------|
| Modelo devuelve prosa sin JSON | se envía como reply (fallback), no silencio |
| JSON con comas colgantes | se sanea y se parsea |
| Fallo total del proveedor | cortesía al cliente + handoff en background |
| Typing falla | se ignora, la respuesta sigue |
| Re-enganche: ventana cerrada | se omite (sin costo) |
| isTest | typing/reenganche/envíos nunca tocan Meta |

## Testing

- **Unit (Vitest):**
  - `extractJson`/`chatJson`: prosa → reply; comas colgantes saneadas; JSON válido
    intacto; fallo total → resultado que dispara cortesía.
  - `markReadAndTyping`: no hace nada si isTest/handoff; llama Graph con el payload
    correcto en caso normal (mock).
  - Barrido `reengage`: candidatas por umbral corto; idempotencia (reengageStage);
    ventana cerrada omite; reset en ingesta.
  - prompt: incluye el bloque de ventas; respeta tono/instrucciones.
- **Gate:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.

## Decisiones

- **Fallback de prosa a reply:** la mejora de mayor impacto para "nunca quedarse
  mudo": convierte el modo de fallo más común (el modelo responde en texto) en una
  respuesta válida.
- **Cortesía antes del handoff:** el cliente siempre recibe algo; el humano se
  entera por el badge, como hoy.
- **Typing reutiliza el mecanismo existente:** cero riesgo, solo se comparte.
- **Re-enganche corto separado del de 20h:** distinto propósito (retomar un cierre
  en caliente vs recuperar un lead frío), distinto estado y umbral; no se pisan.
- **Reutilizar FOLLOWUP_CRON_KEY y el patrón de barrido:** menos superficie nueva.
