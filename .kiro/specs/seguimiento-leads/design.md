# Design — Seguimiento automático de leads (re-enganche)

## Visión general

Un barrido periódico (cron externo → endpoint protegido) revisa las conversaciones
donde el negocio habló último y el cliente no respondió, y envía **un** recordatorio
amable **antes** de que cierre la ventana de 24h (a las ~20h por defecto). Al estar
dentro de la ventana, es un mensaje de servicio con `sendText`: **gratis** y sin
plantillas de Meta.

Se apoya en infraestructura existente: `sendText`, la ventana de 24h
(`isWindowOpen`), y los campos `lastInboundAt`/`lastMessageAt` de la conversación.

El segundo toque a los 3 días (plantilla, con costo) queda **fuera de alcance** por
ahora; el diseño deja el estado preparado para agregarlo luego sin refactor.

### Principios

- **Aditivo y desactivable:** sin `followupEnabled`, no hace nada.
- **Idempotente:** el estado por conversación evita toques dobles; correr el
  barrido de más no reenvía.
- **Gratis:** solo envía dentro de la ventana (texto libre). Si la ventana cerró,
  omite (no fuerza plantilla con costo).
- **Respeta el control humano:** nunca actúa con handoff, IA apagada, o `isTest`.
- **Se reinicia solo:** si el cliente responde, el estado se limpia en la ingesta.

## Arquitectura

```
Cron de Coolify (cada hora)
        │  POST /api/followups/run  (Authorization: Bearer FOLLOWUP_CRON_KEY)
        ▼
runFollowups()  ← NUEVO (src/server/followups/run.ts)
        │
        └── para cada organización con followupEnabled:
              selecciona conversaciones candidatas (SQL):
                - último mensaje SALIENTE (lastMessageAt > lastInboundAt, o sin inbound)
                - no handoff, aiEnabled, no isTest
                - followupStage = 0  (aún sin recordatorio)
              para cada candidata:
                - edad desde lastMessageAt ≥ REMINDER_AFTER_H
                - ventana de 24h AÚN abierta (isWindowOpen(lastInboundAt))
                  → sendText(reminderText, aiGenerated:true)
                  → followupStage = 1, followupLastAt = now
                - si la ventana ya cerró → omitir (no forzar costo)
```

Cuando el cliente responde, `ingest.ts` (donde ya se actualiza `lastInboundAt`)
resetea `followupStage=0` y `followupLastAt=null`.

## Componentes y cambios

### 1. Schema — nuevos campos

**`conversation`** (estado de seguimiento):
- `followupStage: integer` (default 0) — 0=sin recordatorio, 1=recordatorio
  enviado. (Se reserva 2 para el futuro toque de 3 días.)
- `followupLastAt: timestamp | null` — cuándo se envió el último toque.

**`agentProfile`** (config por organización, ya es por-org):
- `followupEnabled: boolean` (default false).
- `followupReminderText: text | null` — texto del recordatorio; si null, default.

Migración Drizzle idempotente (`ADD COLUMN IF NOT EXISTS`).

### 2. Config — `src/lib/env.ts` y `.env.example`

```
FOLLOWUP_CRON_KEY=              # clave que exige el endpoint /api/followups/run
FOLLOWUP_REMINDER_AFTER_H=20    # horas para el recordatorio (antes de cerrar 24h)
FOLLOWUP_BATCH_LIMIT=200        # tope de conversaciones por barrido
```

Helper `isFollowupCronConfigured()` (hay `FOLLOWUP_CRON_KEY` no vacío).

### 3. Lógica de barrido — `src/server/followups/run.ts` (nuevo)

`runFollowups(now = new Date())`:
- Itera organizaciones con `agentProfile.followupEnabled = true`.
- Query de candidatas por org (con `scoped`): `isTest=false`, `handoffAt IS NULL`,
  `aiEnabled=true`, `followupStage = 0`, negocio habló último
  (`lastMessageAt IS NOT NULL` y (`lastInboundAt IS NULL` o
  `lastMessageAt > lastInboundAt`)), limitado a `FOLLOWUP_BATCH_LIMIT`.
- Para cada candidata:
  - edad = now − lastMessageAt; si edad < `REMINDER_AFTER_H` → omitir.
  - si NO `isWindowOpen(lastInboundAt, now)` → omitir (evita costo).
  - `sendText({ conversationId, organizationId, text: reminderText,
    aiGenerated: true })`.
  - éxito → `followupStage=1`, `followupLastAt=now`.
  - error → log, no avanza stage (reintenta el próximo barrido).
- Devuelve `{ reminders, skipped, errors }` para logs.

`reminderText` = `agentProfile.followupReminderText` o un default:
"Hola 👋 ¿Sigues interesado? Quedo atento para ayudarte con lo que necesites."

### 4. Endpoint — `src/app/api/followups/run/route.ts` (nuevo)

- `POST`. Exige `Authorization: Bearer ${FOLLOWUP_CRON_KEY}`; si falta o no
  coincide → 401 sin ejecutar. Si `FOLLOWUP_CRON_KEY` no está configurada → 401
  siempre (feature de disparo inactiva).
- Llama `runFollowups()` y responde `{ ok: true, summary }`.
- Errores internos → 500 con detalle mínimo, ya logueados.

### 5. Reset en ingesta — `src/server/inbox/ingest.ts`

Donde ya se actualiza `lastInboundAt` al recibir un entrante, añadir
`followupStage = 0`, `followupLastAt = null`. Así un cliente que vuelve a escribir
sale del ciclo y puede recibir un nuevo recordatorio si vuelve a quedar inactivo.

### 6. Disparo periódico — cron de Coolify

Scheduled Task en la app de Coolify, `0 * * * *` (cada hora):

```
curl -fsS -X POST https://crm.neolabsgroup.io/api/followups/run \
  -H "Authorization: Bearer $FOLLOWUP_CRON_KEY"
```

Cada hora es suficiente para un umbral de ~20h; correr de más es inofensivo
(idempotente por `followupStage`).

## Flujo de datos

### Recordatorio (camino feliz)
1. Cliente escribió, el agente respondió, el cliente no volvió a responder.
2. A las ~20h el barrido detecta `stage=0`, negocio habló último, ventana abierta.
3. `sendText(reminderText)` → aparece en el inbox como saliente automático.
4. `followupStage=1`, `followupLastAt=now`. No más toques este ciclo.

### Cliente responde
1. `ingest` actualiza `lastInboundAt` y resetea `followupStage=0`.
2. La conversación vuelve al flujo normal del agente.

### Ventana ya cerrada
1. El barrido ve la conversación pero `isWindowOpen=false`.
2. La omite (no envía, no avanza stage). No hay costo.

## Manejo de errores

| Situación | Comportamiento |
|-----------|----------------|
| Sin `FOLLOWUP_CRON_KEY` | Endpoint 401 siempre; feature inactiva |
| `followupEnabled=false` | La org se omite |
| Ventana cerrada | Conversación omitida (sin costo) |
| Envío falla (Meta/red) | Log, no avanza stage → reintenta próximo barrido |
| Conversación is_test | Nunca entra al barrido |

## Testing

- **Unit (Vitest):**
  - Candidatas: negocio habló último vs cliente habló último; respeta handoff /
    aiEnabled / isTest / stage.
  - Umbral: 19h no dispara, 20h sí.
  - Ventana: abierta envía; cerrada omite sin avanzar stage.
  - Idempotencia: segunda corrida no reenvía (stage=1).
  - Reset en ingesta: entrante deja stage=0.
  - Endpoint: 401 sin key correcta; 200 con key.
- **Gate:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.

## Extensión futura (documentada, no implementada)

Segundo toque a las 72h con plantilla (categoría **Utility** para minimizar
costo): reusar `followupStage=2`, un `followupLastTemplateId` en `agentProfile`,
y `sendTemplate`. El estado y el barrido ya quedan preparados para agregarlo sin
refactor.

## Decisiones

- **Un solo toque, dentro de ventana, texto libre:** gratis y sin plantillas de
  Meta (que tienen costo y requieren aprobación). Máximo valor, mínimo costo.
- **Estado en `conversation`:** ciclo 1:1 con la conversación; dos columnas bastan.
- **Cron externo (Coolify):** respeta la arquitectura sin schedulers internos.
- **Config en `agentProfile`:** por-organización, junto al resto del comportamiento
  del agente.
