# Requirements — Seguimiento automático de leads (re-enganche)

## Introducción

Hoy el agente de Vocero es puramente reactivo: solo responde cuando llega un
mensaje. Si un cliente escribe, recibe respuesta y luego deja la conversación
"en visto", nadie lo vuelve a contactar. Se pierden leads que solo necesitaban
un empujón.

Esta feature agrega **seguimiento automático**: si un cliente no responde en
cierto tiempo, el sistema le envía **un** recordatorio amable para retomar la
conversación.

Regla de negocio (alcance actual):
- **Antes de que cierre la ventana de 24h** (a las ~20h por defecto, configurable)
  sin respuesta del cliente → enviar **un** recordatorio con **texto libre del
  agente**. Al estar dentro de la ventana, es un mensaje de servicio: **sin costo**
  y sin necesidad de plantillas aprobadas por Meta.
- Un solo toque por ciclo. No se insiste más.

Fuera de alcance (por ahora): el segundo toque a los 3 días con plantilla
(tiene costo por mensaje y requiere plantilla aprobada por Meta). Se deja
documentado para una fase futura.

## Restricción técnica clave: ventana de 24h de WhatsApp

WhatsApp solo permite enviar **texto libre** dentro de las 24 horas siguientes al
último mensaje ENTRANTE del cliente (`lastInboundAt`). Dentro de esa ventana el
mensaje es gratis (mensaje de servicio); fuera, solo se pueden enviar plantillas
pre-aprobadas y con costo.

Por eso el recordatorio se envía **antes** del cierre (a las ~20h): usa
`sendText` (texto libre), es gratis, y no depende de plantillas. Si por cualquier
motivo la ventana ya cerró cuando corre el barrido, la conversación se omite (no
se fuerza un envío con costo).

## Restricción técnica: sin scheduler interno

Vocero es un monolito sin colas ni cron internos (constitución II). El barrido
periódico de conversaciones inactivas se dispara desde **fuera**: un cron job de
Coolify que llama a un endpoint protegido del CRM cada cierto tiempo (p. ej. cada
hora). El endpoint hace el trabajo de detectar y enviar.

## Requisitos

### Requisito 1 — Detección de leads inactivos

**Historia:** Como dueño del negocio, quiero que el sistema detecte a los clientes
que dejaron de responder, para recuperarlos automáticamente.

#### Criterios de aceptación

1. CUANDO se ejecuta el barrido de seguimiento ENTONCES el sistema DEBERÁ
   identificar las conversaciones cuyo último mensaje fue SALIENTE (el negocio
   habló último) y el cliente no ha respondido.
2. CUANDO una conversación lleva ≥ 20h (configurable) sin respuesta del cliente Y
   aún no se le ha enviado el recordatorio Y la ventana de 24h sigue abierta
   ENTONCES el sistema DEBERÁ marcarla para el recordatorio.
3. CUANDO una conversación tiene handoff activo (`handoffAt`) o IA desactivada
   (`aiEnabled=false`) ENTONCES el sistema NO DEBERÁ enviar seguimiento (respeta
   el control humano).
4. CUANDO una conversación ya recibió su recordatorio ENTONCES el sistema NO
   DEBERÁ enviar más seguimientos en ese ciclo.
5. CUANDO la conversación es de prueba (`isTest`) ENTONCES el sistema NO DEBERÁ
   enviar nada a la API real.
6. CUANDO la ventana de 24h ya cerró ENTONCES el sistema NO DEBERÁ enviar el
   recordatorio (se evita el costo de plantilla); la conversación se omite.

### Requisito 2 — Envío del recordatorio

**Historia:** Como cliente que no respondió, quiero recibir un recordatorio
amable, para retomar la conversación si aún me interesa.

#### Criterios de aceptación

1. CUANDO una conversación califica para el recordatorio ENTONCES el sistema
   DEBERÁ enviar un texto libre (mensaje configurado o un default razonable) vía
   `sendText`, sin costo.
2. CUANDO el recordatorio se envía con éxito ENTONCES el sistema DEBERÁ registrar
   que el toque ya ocurrió, con su marca de tiempo, para no repetirlo.
3. SI el envío falla ENTONCES el sistema DEBERÁ registrar el error y reintentar en
   el siguiente barrido, sin duplicar toques ya enviados.
4. SI el cliente responde en cualquier momento ENTONCES el ciclo de seguimiento
   DEBERÁ reiniciarse (la conversación vuelve al flujo normal y podrá recibir un
   nuevo recordatorio si vuelve a quedar inactiva).

### Requisito 3 — Configuración

**Historia:** Como operador, quiero configurar el mensaje y el tiempo del
seguimiento, para adaptarlo al negocio.

#### Criterios de aceptación

1. El sistema DEBERÁ permitir activar o desactivar el seguimiento automático por
   organización.
2. El sistema DEBERÁ permitir configurar el texto del recordatorio; si no se
   configura, usa un default razonable.
3. El tiempo del recordatorio (≈20h) DEBERÁ ser configurable, con ese valor por
   defecto.
4. CUANDO el seguimiento está desactivado ENTONCES el sistema NO DEBERÁ enviar
   nada (sin errores).

### Requisito 4 — Disparo periódico y seguridad

**Historia:** Como operador, quiero que el barrido corra solo y de forma segura,
sin exponer el sistema.

#### Criterios de aceptación

1. El sistema DEBERÁ exponer un endpoint que ejecute el barrido de seguimiento.
2. CUANDO el endpoint se invoca sin la credencial correcta ENTONCES DEBERÁ
   responder 401 sin ejecutar nada.
3. CUANDO el barrido corre ENTONCES DEBERÁ ser idempotente: ejecutarlo dos veces
   seguidas NO DEBERÁ duplicar toques.
4. El barrido DEBERÁ procesar todas las organizaciones con seguimiento activo.

### Requisito 5 — Registro y visibilidad

**Historia:** Como dueño, quiero ver que los seguimientos se enviaron, en el
inbox, para tener trazabilidad.

#### Criterios de aceptación

1. CUANDO se envía un seguimiento ENTONCES el mensaje DEBERÁ aparecer en el hilo
   de la conversación como mensaje saliente, marcado como automático (`aiGenerated`).
2. CUANDO se envía un seguimiento ENTONCES el sistema DEBERÁ actualizar
   `lastMessageAt` de la conversación.
