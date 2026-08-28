# Requirements — Agente multimedia (audio e imagen)

## Introducción

Hoy el agente de IA de Vocero solo procesa mensajes de texto. Cuando un cliente
envía una nota de voz o una foto por WhatsApp, el mensaje se almacena pero el
agente lo ignora (el pipeline filtra los mensajes sin `text`), así que el cliente
no recibe respuesta.

Esta feature dota al agente de tres capacidades:

1. **Entender audios** — transcribir las notas de voz entrantes a texto (STT) para
   que el agente las procese como si fueran mensajes escritos.
2. **Entender imágenes** — describir/interpretar las imágenes entrantes con visión
   AI para que el agente responda sobre su contenido.
3. **Responder con audio** — sintetizar la respuesta del agente como una nota de
   voz con voz de mujer (TTS) y enviarla por WhatsApp.

La infraestructura de media de Vocero (descarga desde Meta, almacenamiento durable,
envío de audio/imagen) ya existe. Esta feature añade las capas de STT, visión y TTS
y las conecta al pipeline del agente.

## Alcance

Dentro de alcance:
- Transcripción de audios entrantes de WhatsApp (notas de voz).
- Interpretación de imágenes entrantes de WhatsApp.
- Respuesta de voz (TTS con voz femenina) del agente.
- Persistencia de la transcripción/descripción para no reprocesar.
- Configuración por variables de entorno (proveedor y claves).

Fuera de alcance (por ahora):
- Video y documentos (PDF, etc.).
- Envío de imágenes de productos por el agente (feature separada).
- Cambiar el proveedor LLM principal del agente.

## Requisitos

### Requisito 1 — Transcribir audios entrantes

**Historia:** Como cliente que prefiere hablar en vez de escribir, quiero enviar
una nota de voz por WhatsApp y que el agente entienda lo que dije, para que me
responda sin que yo tenga que escribir.

#### Criterios de aceptación

1. CUANDO llega un mensaje de WhatsApp de tipo `audio` ENTONCES el sistema DEBERÁ
   descargar el archivo de audio y transcribirlo a texto.
2. CUANDO la transcripción se completa con éxito ENTONCES el sistema DEBERÁ
   persistir el texto transcrito asociado al mensaje/asset, de modo que no se
   vuelva a transcribir en turnos posteriores.
3. CUANDO el agente arma el contexto de la conversación ENTONCES el sistema DEBERÁ
   incluir la transcripción del audio como si fuera un mensaje de texto del cliente.
4. SI la transcripción falla (error del proveedor, audio corrupto) ENTONCES el
   sistema DEBERÁ registrar el error y continuar sin tumbar el turno del agente,
   respondiendo con un mensaje de cortesía que pida al cliente reformular.
5. CUANDO el audio excede el tamaño o formato soportado ENTONCES el sistema DEBERÁ
   omitir la transcripción y registrar la razón, sin romper el flujo.

### Requisito 2 — Entender imágenes entrantes

**Historia:** Como cliente, quiero enviar una foto (por ejemplo de un producto o
de un comprobante) y que el agente entienda qué contiene, para que me responda de
forma relevante.

#### Criterios de aceptación

1. CUANDO llega un mensaje de WhatsApp de tipo `image` ENTONCES el sistema DEBERÁ
   descargar la imagen y obtener una interpretación textual mediante visión AI.
2. CUANDO la imagen trae un caption ENTONCES el sistema DEBERÁ considerar tanto el
   caption como el contenido visual al interpretar la intención del cliente.
3. CUANDO la interpretación se completa ENTONCES el sistema DEBERÁ persistir la
   descripción asociada al asset para no reprocesarla.
4. CUANDO el agente arma el contexto ENTONCES el sistema DEBERÁ incluir la
   descripción de la imagen como parte del mensaje del cliente.
5. SI la interpretación de la imagen falla ENTONCES el sistema DEBERÁ continuar sin
   romper el turno y responder pidiendo al cliente que describa lo que necesita.

### Requisito 3 — Responder con audio (voz de mujer)

**Historia:** Como cliente que recibió mi consulta por voz, quiero recibir la
respuesta también en una nota de voz con una voz natural, para una experiencia más
cercana.

#### Criterios de aceptación

1. CUANDO el agente genera una respuesta destinada a audio ENTONCES el sistema
   DEBERÁ sintetizar el texto a una nota de voz con voz femenina.
2. CUANDO el audio se genera ENTONCES el sistema DEBERÁ enviarlo por WhatsApp como
   mensaje de tipo `audio` (formato compatible con nota de voz de WhatsApp).
3. CUANDO se decide responder con voz ENTONCES el sistema DEBERÁ regirse por una
   política configurable (por ejemplo: responder en voz solo si el cliente escribió
   por voz, o siempre, o nunca).
4. SI la síntesis de voz falla ENTONCES el sistema DEBERÁ degradar a respuesta de
   texto para no dejar al cliente sin contestación.
5. CUANDO la conversación es de prueba (sandbox del Laboratorio) ENTONCES el sistema
   DEBERÁ NO enviar audio a la API real de Meta, respetando el guardrail existente.

### Requisito 4 — Configuración y credenciales

**Historia:** Como operador del sistema, quiero configurar el proveedor de
STT/visión/TTS por variables de entorno, para activar o cambiar el servicio sin
tocar código.

#### Criterios de aceptación

1. CUANDO no hay proveedor de STT/TTS/visión configurado ENTONCES el sistema DEBERÁ
   comportarse como hoy (procesar solo texto) sin errores.
2. CUANDO se configura la clave del proveedor ENTONCES el sistema DEBERÁ activar las
   capacidades correspondientes automáticamente.
3. El sistema DEBERÁ documentar las nuevas variables de entorno en `.env.example`
   con guía inline.
4. Las credenciales NUNCA DEBERÁN exponerse al cliente ni aparecer en logs.

### Requisito 5 — Robustez y costo

**Historia:** Como dueño del negocio, quiero que la feature no incremente costos ni
falle de forma silenciosa, para operar con confianza.

#### Criterios de aceptación

1. CUANDO un audio o imagen ya fue procesado ENTONCES el sistema NO DEBERÁ volver a
   llamar al proveedor (usa la transcripción/descripción persistida).
2. CUANDO un proveedor externo responde con error o timeout ENTONCES el sistema
   DEBERÁ registrar el detalle y continuar, sin propagar excepciones al webhook.
3. CUANDO se procesa media ENTONCES el sistema DEBERÁ respetar límites de tamaño
   configurables para evitar costos inesperados.
