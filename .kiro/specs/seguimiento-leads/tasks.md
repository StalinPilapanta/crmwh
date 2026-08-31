# Tasks — Seguimiento automático de leads (re-enganche)

- [ ] 1. Configuración de entorno
  - Agregar a `src/lib/env.ts`: `FOLLOWUP_CRON_KEY` (opcional),
    `FOLLOWUP_REMINDER_AFTER_H` (coerce number, default 20),
    `FOLLOWUP_BATCH_LIMIT` (coerce number, default 200).
  - Helper `isFollowupCronConfigured()` (true si `FOLLOWUP_CRON_KEY` no vacío).
  - Documentar las variables en `.env.example` con guía inline.
  - _Requisitos: 4.1, 4.2_

- [ ] 2. Migración: estado y config de seguimiento
  - En `src/lib/db/schema.ts`:
    - `conversation`: `followupStage: integer` (default 0),
      `followupLastAt: timestamp` (nullable).
    - `agentProfile`: `followupEnabled: boolean` (default false),
      `followupReminderText: text` (nullable).
  - Generar migración con `pnpm db:generate`; hacerla idempotente
    (`ADD COLUMN IF NOT EXISTS`) siguiendo el patrón del repo.
  - _Requisitos: 1.2, 2.2, 3.1, 3.2_

- [ ] 3. Lógica de barrido — `src/server/followups/run.ts`
  - [ ] 3.1 `runFollowups(now)`: iterar orgs con `followupEnabled`; query de
    candidatas por org (isTest=false, handoffAt null, aiEnabled, followupStage=0,
    negocio habló último, límite `FOLLOWUP_BATCH_LIMIT`).
    - _Requisitos: 1.1, 1.3, 1.4, 1.5, 4.4_
  - [ ] 3.2 Por candidata: aplicar umbral (`edad ≥ REMINDER_AFTER_H`) y ventana
    (`isWindowOpen`); si aplica, `sendText(reminderText, aiGenerated:true)` y
    marcar `followupStage=1`, `followupLastAt=now`; si la ventana cerró, omitir.
    - _Requisitos: 1.2, 1.6, 2.1, 2.2, 5.1, 5.2_
  - [ ] 3.3 Manejo de error por conversación (log, no avanza stage); resumen
    `{ reminders, skipped, errors }`. Texto default si no hay configurado.
    - _Requisitos: 2.3, 3.2_
  - [ ] 3.4 Tests unitarios: candidatas (quién habló último, filtros), umbral
    19h/20h, ventana abierta/cerrada, idempotencia (stage=1 no reenvía).
    - _Requisitos: 1.1, 1.2, 1.4, 1.6, 5.3_

- [ ] 4. Reset del ciclo en ingesta — `src/server/inbox/ingest.ts`
  - Donde se actualiza `lastInboundAt` de un entrante, añadir
    `followupStage = 0`, `followupLastAt = null`.
  - Test unitario: un mensaje entrante resetea el stage.
  - _Requisitos: 2.4_

- [ ] 5. Endpoint del barrido — `src/app/api/followups/run/route.ts`
  - `POST` con `Authorization: Bearer FOLLOWUP_CRON_KEY`; 401 si falta/no
    coincide o si la key no está configurada. Éxito → `{ ok, summary }`.
  - Test unitario: 401 sin key correcta; 200 con key (con `runFollowups` mockeado).
  - _Requisitos: 4.1, 4.2, 4.3_

- [ ] 6. Verificación
  - Gate completo: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
    Corregir hasta verde.
  - _Requisitos: todos_

- [ ] 7. Despliegue y activación
  - Agregar `FOLLOWUP_CRON_KEY` (y overrides opcionales) en Coolify; redeploy.
  - Crear la Scheduled Task en Coolify: `0 * * * *` que hace `curl -X POST`
    al endpoint con el Bearer.
  - Activar `followupEnabled` para la organización (por UI de settings si se
    agrega, o por SQL) y configurar el texto del recordatorio.
  - Validación: dejar una conversación de prueba "en visto" y verificar (o forzar
    el endpoint manualmente con la key) que el recordatorio se envía una sola vez
    y respeta la ventana.
  - _Requisitos: 2.1, 4.1, 5.1_

## Nota
El segundo toque a 72h con plantilla (con costo) está fuera de alcance; el estado
(`followupStage=2`) y la estructura quedan preparados para agregarlo después sin
refactor. Requerirá una plantilla Utility aprobada por Meta.
