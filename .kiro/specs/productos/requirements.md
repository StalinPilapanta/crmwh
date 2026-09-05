# Requirements — Sección de Productos (catálogo del agente)

## Introducción

Hoy el agente vende con lo que hay en el knowledge base (bloques de texto libre,
con imágenes opcionales). Falta un catálogo **estructurado** de productos: lo que
el negocio realmente vende, con precio, tipo e imágenes, que el agente use como
contexto para vender y del que pueda enviar fotos.

Esta feature agrega una **sección "Productos"** de nivel superior en el CRM (junto
a Bandeja, Pipeline, Contactos, Agente), inspirada en ChateaPro pero adaptada a la
arquitectura de Vocero (un agente por organización).

Cada producto tiene: nombre, precio + moneda, tipo (físico/virtual/servicio), ID
de Dropi (u otra plataforma), imágenes, estado (activo/inactivo) y un **prompt del
producto** (instrucciones de venta específicas). El agente toma los productos
**activos** como contexto y puede enviar sus imágenes.

## Contexto técnico (lo que ya existe y se reutiliza)

- Patrón de sección: `contacts` (page server minimal + client component + API
  `withAuth` scoped por org).
- Sistema de imágenes: `kb/media.ts` (`addKbImage`, `listKbImages`,
  `kbImagesByEntry`, `shortId`), upload multipart, y `/api/media/[assetId]` que
  sirve cualquier imagen de la org. Se replica para imágenes de producto.
- El agente ya sabe enviar imágenes con la acción `send_media` (resuelve por
  `shortId` contra una allowlist de la org). Se extiende para incluir imágenes de
  producto sin cambiar el mecanismo.
- El prompt (`buildAgentSystemPrompt`) ya inyecta KB, imágenes y provincias; se
  añade un bloque de catálogo de productos activos.
- Multi-tenancy estricto (`organizationId`, `scoped`), `newId` con prefijos.

## Alcance

Dentro de alcance (fase 1):
- CRUD de productos (crear, listar, editar, borrar, activar/desactivar).
- Campos: nombre, precio+moneda, tipo, ID Dropi, imágenes (varias), estado,
  prompt del producto.
- Sección "Productos" en el menú, con grid de tarjetas y formulario.
- El agente usa los productos activos como contexto y envía sus imágenes.

Fuera de alcance (fases futuras, documentado):
- Variaciones (tallas/colores), upsells, remarketing/pixel por producto, voz por
  producto, activador de flujo por palabra clave.
- Múltiples asistentes (hoy un agente por organización).
- Integración real con Dropi (crear pedidos): se guarda el `dropiId`, pero la
  conexión espera el token de API correcto.

## Requisitos

### Requisito 1 — Sección y catálogo de productos

**Historia:** Como dueño, quiero una sección de Productos para administrar lo que
vendo, para que el agente lo conozca.

#### Criterios de aceptación

1. El sistema DEBERÁ mostrar "Productos" como sección de nivel superior en el menú.
2. CUANDO el usuario abre Productos ENTONCES el sistema DEBERÁ listar los productos
   de su organización en un grid de tarjetas (imagen principal, nombre, tipo,
   precio, estado activo/inactivo).
3. El sistema DEBERÁ permitir buscar productos por nombre.
4. CUANDO no hay productos ENTONCES el sistema DEBERÁ mostrar un estado vacío con
   la opción de crear el primero.

### Requisito 2 — Crear y editar productos

**Historia:** Como dueño, quiero crear y editar productos con sus datos, para
mantener el catálogo al día.

#### Criterios de aceptación

1. El sistema DEBERÁ permitir crear un producto con: nombre (requerido), precio y
   moneda (requerido), tipo (físico/virtual/servicio, requerido), ID de Dropi
   (opcional, solo números), estado activo/inactivo, y prompt del producto
   (opcional).
2. El sistema DEBERÁ permitir editar todos esos campos y borrar el producto.
3. El precio DEBERÁ guardarse de forma exacta (en centavos, sin coma flotante) y
   mostrarse formateado según la moneda.
4. El ID de Dropi DEBERÁ aceptar solo dígitos; si es inválido, rechazar con
   mensaje claro.
5. CUANDO se borra un producto ENTONCES sus imágenes asociadas DEBERÁN eliminarse
   (sin referencias colgantes).
6. Todas las operaciones DEBERÁN estar aisladas por organización.

### Requisito 3 — Imágenes del producto

**Historia:** Como dueño, quiero subir fotos del producto, para que el agente las
envíe a los clientes.

#### Criterios de aceptación

1. El sistema DEBERÁ permitir adjuntar una o varias imágenes (jpeg, png, webp) a un
   producto, validando tipo y tamaño.
2. El sistema DEBERÁ mostrar miniaturas de las imágenes del producto y permitir
   quitarlas.
3. Las imágenes DEBERÁN almacenarse de forma durable y servirse de forma segura
   (scoped por org), reutilizando el sistema existente.
4. La primera imagen DEBERÁ usarse como imagen principal en la tarjeta del catálogo.

### Requisito 4 — El agente usa los productos

**Historia:** Como cliente, quiero que el agente conozca los productos y me dé
precios e info correcta, y me envíe fotos cuando las pida.

#### Criterios de aceptación

1. CUANDO el agente arma su contexto ENTONCES el sistema DEBERÁ incluir los
   productos ACTIVOS con nombre, precio, tipo, su prompt de producto e
   identificadores de sus imágenes.
2. Los productos INACTIVOS NO DEBERÁN aparecer en el contexto del agente.
3. CUANDO el cliente pide una foto de un producto ENTONCES el agente DEBERÁ poder
   enviar la imagen correcta del producto (reutilizando la acción de envío de
   imágenes existente).
4. El prompt del producto DEBERÁ guiar al agente sobre cómo vender ESE producto,
   combinándose con el prompt general del agente.
5. El agente NO DEBERÁ inventar productos ni precios fuera del catálogo.
6. CUANDO no hay productos activos ENTONCES el agente DEBERÁ comportarse como hoy
   (usando el knowledge base), sin errores.

### Requisito 5 — Sin regresiones

#### Criterios de aceptación

1. El knowledge base y el envío de imágenes de KB existentes DEBERÁN seguir
   funcionando igual.
2. El envío de imágenes de producto y de KB DEBERÁN coexistir (identificadores
   únicos por organización).
3. El gate técnico (typecheck + lint + build + tests) DEBERÁ quedar verde.
