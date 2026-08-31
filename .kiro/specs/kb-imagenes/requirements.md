# Requirements — Imágenes de producto en la base de conocimiento

## Introducción

Hoy la base de conocimiento (KB) del agente es solo texto: preguntas/respuestas y
bloques de texto libre. Cuando un cliente pide "¿me mandas una foto del producto?",
el agente no tiene forma de enviarla.

Esta feature permite **adjuntar imágenes a un bloque de texto libre** de la KB
(por ejemplo, la ficha de un producto), de modo que el **agente pueda enviar esas
imágenes por WhatsApp** cuando el cliente las solicite o cuando sean relevantes
para la conversación.

Ejemplo: el dueño crea un bloque "Gomitas de Moringa" con la descripción y sube 2
fotos del producto. Cuando un cliente pregunta "¿cómo se ven las gomitas?", el
agente responde y envía las fotos.

## Alcance

Dentro de alcance:
- Adjuntar una o varias imágenes a un bloque de texto libre de la KB.
- Ver miniaturas de las imágenes adjuntas en la UI de Agentes.
- Quitar imágenes de un bloque.
- Que el agente envíe la(s) imagen(es) del bloque relevante cuando aplique.

Fuera de alcance (por ahora):
- Imágenes en las entradas de pregunta/respuesta (solo en bloques de texto libre).
- Video u otros adjuntos (solo imágenes).
- Edición de imágenes (recorte, etc.).

## Restricción técnica

WhatsApp permite enviar imágenes solo dentro de la ventana de 24h (mensaje de
servicio, gratis) o vía plantilla fuera de ella. El agente responde a mensajes
entrantes, así que casi siempre estará dentro de la ventana. Si la ventana está
cerrada, no se fuerza el envío.

La infraestructura de envío/almacenamiento de imágenes ya existe
(`sendMediaMessage`, `mediaAsset`, `MEDIA_DIR`, endpoint de servido). Esta feature
la reutiliza.

## Requisitos

### Requisito 1 — Adjuntar imágenes a un bloque de KB

**Historia:** Como dueño del negocio, quiero subir fotos de un producto al crear o
editar un bloque de texto libre, para que el agente pueda mostrarlas.

#### Criterios de aceptación

1. CUANDO el usuario crea o edita un bloque de texto libre ENTONCES el sistema
   DEBERÁ permitir adjuntar una o varias imágenes (jpeg, png, webp).
2. CUANDO se sube una imagen ENTONCES el sistema DEBERÁ validar tipo y tamaño
   (máximo permitido por WhatsApp para imágenes) y rechazar las inválidas con un
   mensaje claro.
3. CUANDO la imagen se sube con éxito ENTONCES el sistema DEBERÁ almacenarla de
   forma durable y asociarla al bloque de KB.
4. CUANDO el usuario ve la lista de bloques ENTONCES el sistema DEBERÁ mostrar
   miniaturas de las imágenes adjuntas a cada bloque.
5. CUANDO el usuario quita una imagen de un bloque ENTONCES el sistema DEBERÁ
   desasociarla del bloque.
6. CUANDO se borra un bloque de KB ENTONCES sus imágenes asociadas DEBERÁN
   desasociarse (sin dejar referencias colgantes).

### Requisito 2 — El agente conoce las imágenes disponibles

**Historia:** Como agente de IA, necesito saber qué imágenes existen y a qué
producto pertenecen, para enviarlas cuando el cliente las pida.

#### Criterios de aceptación

1. CUANDO el agente arma su contexto ENTONCES el sistema DEBERÁ incluir, junto a
   cada bloque de KB, la información de sus imágenes con un identificador que el
   agente pueda usar para enviarlas.
2. CUANDO un bloque no tiene imágenes ENTONCES el prompt del agente DEBERÁ
   comportarse como hoy (solo texto), sin cambios.
3. El sistema DEBERÁ instruir al agente para enviar imágenes solo cuando sean
   relevantes (el cliente las pide o encajan con la consulta), no de forma
   indiscriminada.

### Requisito 3 — El agente envía las imágenes

**Historia:** Como cliente, quiero recibir la foto del producto cuando la pido,
para decidir mi compra.

#### Criterios de aceptación

1. CUANDO el agente decide enviar una imagen ENTONCES el sistema DEBERÁ enviar la
   imagen correcta (la asociada al bloque relevante) por WhatsApp.
2. CUANDO el agente envía una imagen ENTONCES esta DEBERÁ aparecer en el hilo de
   la conversación como mensaje saliente automático.
3. CUANDO el agente acompaña la imagen con texto ENTONCES el sistema DEBERÁ
   enviar ambos (texto + imagen) de forma coherente.
4. SI el envío de la imagen falla ENTONCES el sistema DEBERÁ degradar a una
   respuesta de texto, sin tumbar el turno.
5. CUANDO la conversación es de prueba (Laboratorio, `isTest`) ENTONCES el sistema
   NO DEBERÁ enviar la imagen a la API real (respeta el sandbox), persistiéndola
   localmente como salida de prueba.
6. CUANDO la ventana de 24h está cerrada ENTONCES el sistema NO DEBERÁ forzar el
   envío de imagen (se comporta como con el texto: handoff por ventana).
7. CUANDO el agente referencia un identificador de imagen inexistente ENTONCES el
   sistema NO DEBERÁ fallar: degrada a texto o lo ignora.

### Requisito 4 — Robustez y costo

**Historia:** Como dueño, quiero que la feature sea confiable y no dispare costos.

#### Criterios de aceptación

1. CUANDO una imagen ya fue subida a WhatsApp ENTONCES el sistema DEBERÁ
   reutilizar su identificador de media en lugar de volver a subirla en cada envío.
2. CUANDO el agente envía imágenes ENTONCES el sistema DEBERÁ evitar reenviar la
   misma imagen repetidamente en la misma conversación de forma innecesaria.
3. Las imágenes DEBERÁN respetar el aislamiento por organización (una org nunca
   envía imágenes de otra).
