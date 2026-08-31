# Requirements — Datos del lead (captura por el agente + vista unificada)

## Introducción

Para vender y despachar pedidos, el negocio necesita datos del cliente: nombre,
ubicación (provincia, ciudad), dirección, referencia y teléfono. Hoy:

- El agente **no puede** guardar datos estructurados (solo notas de texto libre).
- La "ficha" del contacto ya existe y se muestra en el Inbox y el Pipeline, pero
  no en Contactos, y no de forma unificada con los campos que el negocio necesita.
- Provincia y ciudad hoy serían texto libre (propenso a errores).

Esta feature:
1. Define **campos estándar del lead**: Nombre, Provincia, Ciudad, Dirección,
   Referencia, Teléfono.
2. Provincia y Ciudad se eligen de un **listado fijo por país** (empezando por
   Ecuador: 24 provincias y sus ciudades/cantones), tomado de un JSON incluido en
   la app. El **país de operación** se configura en Ajustes → Marca.
3. El **agente captura** estos datos durante la conversación y los guarda.
4. Los datos se **ven y editan** de forma unificada en los tres lugares: Inbox
   (detalle del lead), Pipeline (ventana de trato) y Contactos.

## Contexto técnico (lo que ya existe)

- La "ficha" del contacto es un JSON flexible en `contact.ficha`, con puerta única
  `upsertFicha` (merge campo a campo, `null` borra). Ya se muestra con el
  componente `FichaPanel` en Inbox y Pipeline.
- `name` y `phone` son columnas propias de `contact`.
- El branding (nombre, color, moneda, favicon) se guarda en
  `organization.metadata`; agregar `country` no requiere migración.
- El agente tiene acciones tipadas (`reply`, `update_lead`, `move_stage`, etc.).
  `update_lead` solo escribe notas hoy.

## Alcance

Dentro de alcance:
- Campos estándar del lead (los 6 mencionados).
- JSON de provincias/ciudades de Ecuador; selección de país en Marca.
- Acción del agente para capturar/actualizar estos datos.
- Vista/edición unificada en Inbox, Pipeline y Contactos.

Fuera de alcance (por ahora):
- Otros países además de Ecuador (la estructura queda lista para agregarlos).
- Validación de dirección contra un servicio externo (mapas, etc.).
- Integración con Dropi (se hará cuando haya token de API).

## Requisitos

### Requisito 1 — País de operación (Ajustes → Marca)

**Historia:** Como dueño, quiero elegir el país de operación, para que las
provincias y ciudades correspondan a mi mercado.

#### Criterios de aceptación

1. CUANDO el propietario abre Ajustes → Marca ENTONCES el sistema DEBERÁ permitir
   seleccionar el país de operación de una lista de países soportados.
2. CUANDO no se ha elegido país ENTONCES el sistema DEBERÁ usar Ecuador por
   defecto.
3. CUANDO se guarda el país ENTONCES el sistema DEBERÁ persistirlo en la marca de
   la organización (sin requerir migración).
4. Solo el propietario DEBERÁ poder cambiar el país (igual que el resto de la marca).

### Requisito 2 — Catálogo de provincias y ciudades

**Historia:** Como usuario, quiero elegir provincia y ciudad de un listado
correcto para el país, para evitar errores de captura.

#### Criterios de aceptación

1. El sistema DEBERÁ incluir un catálogo (JSON) con las provincias y ciudades de
   Ecuador (24 provincias y sus ciudades/cantones).
2. CUANDO se selecciona una provincia ENTONCES el sistema DEBERÁ ofrecer solo las
   ciudades de esa provincia.
3. El catálogo DEBERÁ estar estructurado para admitir más países en el futuro sin
   cambiar la lógica.
4. CUANDO el país configurado no tiene catálogo ENTONCES provincia y ciudad
   DEBERÁN comportarse como texto libre (degradación segura).

### Requisito 3 — Campos estándar del lead

**Historia:** Como negocio, quiero que cada lead tenga sus datos estándar, para
procesar pedidos y envíos.

#### Criterios de aceptación

1. El sistema DEBERÁ definir estos campos del lead: Nombre, Provincia, Ciudad,
   Dirección, Referencia, Teléfono.
2. Nombre y Teléfono DEBERÁN reutilizar los datos existentes del contacto
   (`name`, `phone`) para no duplicar.
3. Provincia, Ciudad, Dirección y Referencia DEBERÁN guardarse en la ficha del
   contacto con claves canónicas estables.
4. Provincia y Ciudad DEBERÁN validarse contra el catálogo del país; una ciudad
   DEBERÁ pertenecer a la provincia elegida.
5. CUANDO se editan estos campos manualmente ENTONCES el sistema DEBERÁ guardarlos
   por la misma puerta única que usa el agente (consistencia).

### Requisito 4 — Captura por el agente

**Historia:** Como cliente, al conversar por WhatsApp quiero que el agente tome mis
datos de entrega naturalmente, sin llenar formularios.

#### Criterios de aceptación

1. CUANDO el agente detecta datos del cliente en la conversación (nombre,
   ubicación, dirección, referencia, teléfono) ENTONCES el sistema DEBERÁ permitir
   al agente guardarlos de forma estructurada.
2. CUANDO el agente guarda provincia o ciudad ENTONCES el sistema DEBERÁ validarlas
   contra el catálogo del país; si no coinciden, DEBERÁ intentar normalizar (p. ej.
   acentos/mayúsculas) o dejar el dato sin fijar y continuar sin error.
3. CUANDO el agente guarda un dato ENTONCES DEBERÁ hacerlo por la puerta única de
   la ficha (`upsertFicha`), respetando el aislamiento por organización.
4. CUANDO faltan datos para completar un pedido ENTONCES el agente DEBERÁ poder
   pedirlos al cliente de forma conversacional (por instrucción del prompt).
5. SI la captura falla ENTONCES el turno del agente NO DEBERÁ romperse.

### Requisito 5 — Vista unificada en los tres lugares

**Historia:** Como usuario, quiero ver los mismos datos del lead sin importar
desde dónde lo abra (Inbox, Pipeline, Contactos).

#### Criterios de aceptación

1. CUANDO abro el detalle del lead en el Inbox ENTONCES el sistema DEBERÁ mostrar
   los campos estándar (Nombre, Provincia, Ciudad, Dirección, Referencia,
   Teléfono) de forma clara y editable.
2. CUANDO abro la ventana de trato en el Pipeline ENTONCES el sistema DEBERÁ
   mostrar los mismos campos, con los mismos valores.
3. CUANDO abro un contacto en Contactos ENTONCES el sistema DEBERÁ mostrar los
   mismos campos (hoy Contactos no muestra la ficha).
4. Los datos DEBERÁN provenir de una única fuente (la ficha del contacto), de modo
   que un cambio en un lugar se refleje en los demás.
5. CUANDO se edita provincia/ciudad en cualquier vista ENTONCES el sistema DEBERÁ
   usar selectores del catálogo (no texto libre) cuando el país tenga catálogo.

### Requisito 6 — Consistencia y robustez

#### Criterios de aceptación

1. Los campos estándar DEBERÁN usar claves canónicas idénticas en agente, API y UI.
2. Editar un campo en cualquier vista DEBERÁ reflejarse en las demás (misma fuente).
3. CUANDO el catálogo o el país no están disponibles ENTONCES la feature DEBERÁ
   degradar a texto libre sin romper la captura ni la edición.
