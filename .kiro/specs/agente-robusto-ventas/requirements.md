# Requirements — Agente robusto y vendedor

## Introducción

El agente de Vocero a veces se queda sin responder y el cliente ve que "se
reenvía el mensaje". La causa: el agente debe devolver una acción en JSON; si el
modelo devuelve algo mal formado, tras 3 reintentos el agente hace un **handoff
silencioso** (no envía nada al cliente). Además, el prompt actual es consultivo
(informa, no vende), no muestra el indicador "escribiendo…", y no retoma la
conversación cuando pide un dato y el cliente no responde.

Esta feature mejora el agente en cuatro frentes:

1. **Robustez** — el agente NUNCA se queda mudo: si el modelo falla el formato,
   degrada a una respuesta útil en vez de callarse.
2. **Ventas** — prompt orientado a cerrar: beneficios, manejo de objeciones,
   empuje al cierre, pedir el pedido.
3. **Indicador "escribiendo…"** — mientras el agente procesa, el cliente ve el
   typing como en un chat normal.
4. **Re-enganche contextual** — si el agente pide un dato (ej. dirección) y el
   cliente no responde en un rato, le envía un mensaje breve para retomar.

## Contexto técnico (lo que ya existe)

- `chatJson` reintenta 3 veces con corrección de formato; si falla devuelve un
  error tipado (no lanza). El pipeline reacciona con `applyHandoff("error")`
  **sin enviar nada al cliente** — ese es el hueco de robustez.
- `extractJson` extrae JSON de 3 formas (bloque markdown, texto completo, de `{`
  a `}`). Se puede hacer más tolerante.
- El indicador "escribiendo…" + marcar leído **ya está implementado** en
  `POST /api/bot/typing` (payload Graph `status:read` + `typing_indicator`), pero
  solo lo usa el bot externo, no el agente in-process.
- Existe un re-enganche genérico a ~20h (`followups/run.ts`) con estado
  idempotente por conversación (`followupStage`) y reset al responder el cliente.
  Sirve de plantilla, pero es genérico y de ventana larga.
- El prompt del agente (`buildAgentSystemPrompt`) inyecta `profile.tone` e
  `profile.instructions` por organización, además de un template base.

## Requisitos

### Requisito 1 — El agente nunca se queda sin responder

**Historia:** Como cliente, quiero recibir siempre una respuesta, aunque el
sistema tenga un problema interno, para no quedarme esperando.

#### Criterios de aceptación

1. CUANDO el modelo devuelve una respuesta en prosa sin JSON válido ENTONCES el
   sistema DEBERÁ interpretarla como una respuesta de texto al cliente (envolverla
   como `reply`) en lugar de descartarla.
2. CUANDO el JSON tiene errores menores (comas colgantes, comillas) ENTONCES el
   sistema DEBERÁ intentar sanearlo antes de descartarlo.
3. CUANDO, tras todos los intentos, no se obtiene una acción válida ENTONCES el
   sistema DEBERÁ enviar al cliente un mensaje de cortesía ("Dame un momento, ya
   te confirmo…") en vez de quedarse callado, y escalar a un humano en segundo
   plano.
4. CUANDO el proveedor de IA está caído o hay timeout ENTONCES el sistema DEBERÁ
   comportarse igual: mensaje de cortesía + escalar, nunca silencio.
5. El comportamiento anterior NO DEBERÁ romper el sandbox del Laboratorio
   (`isTest` nunca toca la API real).

### Requisito 2 — Prompt orientado a ventas

**Historia:** Como dueño, quiero que el agente venda de verdad (no solo informe),
para cerrar más pedidos.

#### Criterios de aceptación

1. El prompt base del agente DEBERÁ incluir directrices de venta: responder con
   entusiasmo, destacar beneficios, manejar objeciones y empujar al cierre.
2. CUANDO el cliente muestra interés ENTONCES el agente DEBERÁ pedir los datos
   para cerrar el pedido y no dejar la conversación abierta.
3. CUANDO el cliente pregunta el precio ENTONCES el agente DEBERÁ darlo con
   seguridad y ofrecer de inmediato el siguiente paso hacia el cierre.
4. Las directrices de venta DEBERÁN respetar y combinarse con el `tono` e
   `instrucciones` que el dueño configure por organización (no reemplazarlas).
5. El agente NO DEBERÁ inventar información fuera del conocimiento (se mantiene la
   regla anti-alucinación).

### Requisito 3 — Indicador "escribiendo…"

**Historia:** Como cliente, quiero ver "escribiendo…" mientras el agente prepara
la respuesta, para saber que me están atendiendo.

#### Criterios de aceptación

1. CUANDO llega un mensaje del cliente y el agente va a responder ENTONCES el
   sistema DEBERÁ marcar el mensaje como leído y mostrar el indicador
   "escribiendo…" antes de generar la respuesta.
2. El indicador DEBERÁ enviarse best-effort: si falla, NO DEBERÁ afectar la
   respuesta del agente.
3. CUANDO la conversación es de prueba (`isTest`) o está en handoff / IA apagada
   ENTONCES el sistema NO DEBERÁ enviar el indicador.
4. El indicador DEBERÁ reutilizar el mecanismo ya existente (marcar leído +
   typing de la Graph API), sin duplicar lógica.

### Requisito 4 — Re-enganche contextual cuando se piden datos

**Historia:** Como negocio, quiero que si el agente pide un dato para cerrar
(dirección, etc.) y el cliente no responde, el agente le escriba de nuevo para
retomar, y así no perder la venta.

#### Criterios de aceptación

1. CUANDO el agente pide datos de entrega y el cliente no responde en un tiempo
   corto configurable (p. ej. 30–60 min) ENTONCES el sistema DEBERÁ enviar un
   mensaje breve para retomar la conversación.
2. El mensaje de re-enganche DEBERÁ ser contextual (retomar el pedido/dato
   pendiente), no un genérico "¿sigues ahí?".
3. CUANDO el cliente responde ENTONCES el estado de espera DEBERÁ reiniciarse (no
   se vuelve a molestar por ese ciclo).
4. El re-enganche DEBERÁ enviarse solo dentro de la ventana de 24h (mensaje de
   servicio, sin costo), respetando handoff / IA apagada / sandbox.
5. El re-enganche corto DEBERÁ ser idempotente: no enviar el mismo recordatorio
   dos veces por el mismo periodo de espera.
6. El re-enganche corto NO DEBERÁ entrar en conflicto con el seguimiento genérico
   de ~20h ya existente (se coordinan por el estado de la conversación).

### Requisito 5 — Sin regresiones

#### Criterios de aceptación

1. Las conversaciones normales (con JSON válido) DEBERÁN seguir funcionando igual.
2. El seguimiento de ~20h existente DEBERÁ seguir operando.
3. El gate técnico (typecheck + lint + build + tests) DEBERÁ quedar verde.
