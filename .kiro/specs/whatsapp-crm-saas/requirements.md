# Requirements Document

## Introduction

Plataforma CRM SaaS multitenant para gestión de ventas y atención al cliente a través de WhatsApp. El sistema integra agentes de inteligencia artificial configurables con capacidad de handoff a agentes humanos, calificación automática de leads y seguimiento automatizado. Inspirado en el modelo de embudo de ventas de Kommo CRM. Incluye una sección centralizada de integraciones para configurar proveedores de IA, gestión de pedidos mediante Dropi, y base de conocimiento/inventario mediante Google Drive. Stack tecnológico: Next.js 16 (App Router) + Supabase + WhatsApp Business API (Meta) + OpenRouter (DeepSeek) + Vercel.

## Glossary

- **Plataforma**: El sistema CRM SaaS multitenant de WhatsApp en su totalidad.
- **Tenant**: Organización o empresa que contrata el servicio SaaS y tiene su propio espacio aislado de datos.
- **Usuario**: Persona que pertenece a un Tenant y opera dentro de la Plataforma (administrador, agente humano, etc.).
- **Agente_IA**: Bot de inteligencia artificial configurado mediante prompts que atiende conversaciones de WhatsApp de forma autónoma.
- **Agente_Humano**: Usuario del Tenant que toma el control de una conversación cuando el Agente_IA no puede resolver la consulta.
- **Lead**: Contacto que inicia una conversación por WhatsApp y es candidato a convertirse en cliente.
- **Conversación**: Hilo de mensajes entre un Lead y el sistema (Agente_IA o Agente_Humano) a través de WhatsApp.
- **Pipeline**: Embudo de ventas compuesto por etapas secuenciales que representan el avance de un Lead hacia la conversión.
- **Etapa**: Fase dentro del Pipeline por la que transita un Lead (por ejemplo: Nuevo, Contactado, Calificado, Propuesta, Cierre).
- **Sesión_WhatsApp**: Conexión activa con la API de WhatsApp Business asociada a un número telefónico del Tenant.
- **Handoff**: Transferencia del control de una Conversación desde un Agente_IA a un Agente_Humano.
- **Follow_Up**: Mensaje de seguimiento automático enviado a un Lead según reglas de tiempo o evento configuradas.
- **Base_Conocimiento**: Conjunto de documentos (Google Sheets, PDFs) que alimentan al Agente_IA con información contextual.
- **Panel_Conversaciones**: Interfaz donde los Usuarios visualizan y gestionan todas las Conversaciones activas.
- **Dashboard**: Vista principal con métricas, gráficos de rendimiento y KPIs del Tenant.
- **Calificación_Lead**: Puntuación asignada automáticamente a un Lead basada en criterios configurables.
- **Proveedor_IA**: Servicio externo de inteligencia artificial (OpenRouter, OpenAI, Anthropic, etc.) utilizado por el Agente_IA.
- **Dropi**: Plataforma de dropshipping utilizada para gestionar pedidos, catálogo de productos e inventario.
- **Google_Drive**: Servicio de almacenamiento en la nube de Google utilizado para alojar documentos de la Base_Conocimiento (Sheets, PDFs) e inventario.
- **Módulo_Integraciones**: Sección centralizada de configuración donde el administrador conecta y gestiona los servicios externos (Proveedor_IA, Dropi, Google_Drive, WhatsApp Business API).
- **Inventario**: Registro de productos disponibles del Tenant, sincronizado desde Dropi o Google_Drive, consultable por el Agente_IA.

## Requirements

### Requisito 1: Gestión Multitenant

**Historia de Usuario:** Como propietario de negocio, quiero registrar mi empresa en la plataforma y tener un espacio aislado, para que mis datos estén separados de otros clientes del servicio.

#### Criterios de Aceptación

1. WHEN un usuario se registra proporcionando nombre, correo electrónico, nombre de empresa y contraseña, THE Plataforma SHALL crear un Tenant con espacio de datos lógicamente aislado (sin acceso cruzado entre Tenants a nivel de base de datos) y asignar al usuario como administrador del Tenant en un máximo de 5 segundos.
2. WHILE un Usuario opera dentro de la Plataforma, THE Plataforma SHALL restringir el acceso exclusivamente a los datos del Tenant al que pertenece el Usuario, sin que ninguna consulta o acción devuelva datos pertenecientes a otro Tenant.
3. THE Plataforma SHALL permitir al administrador del Tenant invitar hasta un máximo de 50 Usuarios al Tenant mediante correo electrónico y asignarles uno de los siguientes roles: administrador, agente o supervisor.
4. IF un Usuario intenta acceder a datos de un Tenant diferente al suyo, THEN THE Plataforma SHALL denegar el acceso, retornar una respuesta de acceso denegado y registrar el intento en un log de seguridad incluyendo identificador del Usuario, Tenant objetivo y marca de tiempo.
5. IF el registro de un nuevo Tenant falla porque el correo electrónico ya está registrado o los datos obligatorios están incompletos, THEN THE Plataforma SHALL rechazar la solicitud y mostrar un mensaje de error indicando el motivo específico del rechazo sin crear el Tenant.
6. IF una invitación enviada a un correo electrónico no es aceptada dentro de las 72 horas siguientes a su envío, THEN THE Plataforma SHALL invalidar la invitación y requerir que el administrador genere una nueva invitación para ese correo electrónico.

---

### Requisito 2: Conexión con WhatsApp Business API

**Historia de Usuario:** Como administrador del Tenant, quiero conectar uno o más números de WhatsApp Business, para que mis clientes puedan comunicarse con mi empresa a través de WhatsApp.

#### Criterios de Aceptación

1. WHEN el administrador configura una nueva Sesión_WhatsApp, THE Plataforma SHALL validar las credenciales proporcionadas (Phone Number ID, WhatsApp Business Account ID y Access Token) e intentar establecer conexión con la API de WhatsApp Business de Meta en un tiempo máximo de 15 segundos.
2. IF las credenciales proporcionadas para una Sesión_WhatsApp son inválidas o la conexión no se establece dentro de 15 segundos, THEN THE Plataforma SHALL mostrar un mensaje de error indicando el motivo del fallo y no crear la Sesión_WhatsApp.
3. THE Plataforma SHALL admitir un máximo de 10 Sesiones_WhatsApp activas por Tenant, permitiendo atender desde varios números telefónicos simultáneamente.
4. WHEN la Plataforma recibe un mensaje entrante en una Sesión_WhatsApp, THE Plataforma SHALL identificar al Lead por coincidencia exacta del número telefónico del remitente, y crear o asociar la Conversación a dicho Lead en un tiempo máximo de 2 segundos.
5. IF la Plataforma recibe un mensaje entrante de un número telefónico que no corresponde a ningún Lead existente en el Tenant, THEN THE Plataforma SHALL crear un nuevo Lead con el número telefónico como identificador y asociar la Conversación al nuevo Lead.
6. IF la conexión con la API de WhatsApp Business se interrumpe, THEN THE Plataforma SHALL notificar al administrador del Tenant, reintentar la conexión cada 30 segundos durante un máximo de 5 minutos, y marcar la Sesión_WhatsApp como "desconectada" si no se restablece la conexión tras agotar los reintentos.
7. WHILE una Sesión_WhatsApp está activa, THE Plataforma SHALL mostrar el estado de conexión (conectada, reconectando o desconectada) en el panel de administración del Tenant, actualizando el estado en un máximo de 5 segundos tras cualquier cambio.

---

### Requisito 3: Configuración de Agentes IA

**Historia de Usuario:** Como administrador del Tenant, quiero crear y configurar agentes de IA con prompts personalizados y fuentes de conocimiento, para que atiendan automáticamente las conversaciones según las necesidades de mi negocio.

#### Criterios de Aceptación

1. WHEN el administrador crea un Agente_IA, THE Plataforma SHALL solicitar un nombre identificador (máximo 100 caracteres) y un prompt de sistema (máximo 4000 caracteres) que defina el comportamiento del Agente_IA.
2. WHEN el administrador configura la API key de un Proveedor_IA, THE Plataforma SHALL validar la conectividad con el Proveedor_IA seleccionado (OpenRouter, OpenAI, Anthropic u otro compatible) y confirmar al administrador si la clave es válida en un máximo de 10 segundos.
3. IF la API key proporcionada es inválida o el Proveedor_IA no responde, THEN THE Plataforma SHALL mostrar un mensaje de error indicando el motivo del fallo y no permitir guardar la configuración del Proveedor_IA hasta que se proporcione una clave válida.
4. WHEN el administrador sube un archivo PDF (máximo 10 MB) o proporciona un enlace a Google Sheets (máximo 10,000 filas), THE Plataforma SHALL procesar el contenido, almacenarlo como Base_Conocimiento asociada al Agente_IA, y mostrar una confirmación con el estado del procesamiento (exitoso o fallido) en un máximo de 60 segundos.
5. IF el archivo subido excede el tamaño máximo permitido o el formato no es PDF ni enlace válido de Google Sheets, THEN THE Plataforma SHALL rechazar el archivo y mostrar un mensaje de error indicando la restricción incumplida.
6. WHEN el administrador modifica el prompt o la Base_Conocimiento de un Agente_IA, THE Plataforma SHALL aplicar los cambios únicamente a las Conversaciones iniciadas después del momento de la modificación, preservando el comportamiento de las Conversaciones en curso hasta su finalización.
7. WHEN el administrador asigna un Agente_IA a una o más Sesiones_WhatsApp del Tenant, THE Plataforma SHALL activar el Agente_IA para responder automáticamente en las Sesiones_WhatsApp seleccionadas.

---

### Requisito 4: Handoff de Agente IA a Agente Humano

**Historia de Usuario:** Como agente humano, quiero recibir la transferencia de conversaciones que el agente IA no puede resolver, para que pueda atender personalmente al cliente sin perder contexto.

#### Criterios de Aceptación

1. WHEN el Agente_IA detecta que no puede resolver una consulta según los criterios configurados por el administrador del Tenant, THE Plataforma SHALL iniciar un Handoff y notificar a los Agentes_Humanos que estén conectados y con estado "disponible" dentro del mismo Tenant.
2. WHEN un Agente_Humano acepta un Handoff, THE Plataforma SHALL transferir el control de la Conversación al Agente_Humano y mostrar el historial de todos los mensajes previos de esa Conversación, incluyendo los intercambiados con el Agente_IA.
3. WHILE un Agente_Humano tiene el control de una Conversación, THE Plataforma SHALL suspender las respuestas automáticas del Agente_IA para esa Conversación.
4. WHEN el Agente_Humano ejecuta la acción explícita de finalizar la atención, THE Plataforma SHALL devolver el control de la Conversación al Agente_IA y registrar el momento del traspaso.
5. IF ningún Agente_Humano acepta el Handoff en un plazo de 3 minutos, THEN THE Plataforma SHALL enviar un mensaje al Lead indicando que un agente le atenderá próximamente y escalar la notificación al supervisor del Tenant.
6. IF no existen Agentes_Humanos conectados con estado "disponible" al momento de iniciar el Handoff, THEN THE Plataforma SHALL encolar la solicitud, enviar un mensaje al Lead indicando tiempo de espera estimado, y notificar al supervisor del Tenant.
7. WHEN un Agente_Humano acepta un Handoff, THE Plataforma SHALL dejar de mostrar ese Handoff como pendiente a los demás Agentes_Humanos notificados dentro de 2 segundos.

---

### Requisito 5: Panel de Conversaciones

**Historia de Usuario:** Como agente humano, quiero visualizar todas las conversaciones en un panel centralizado, para que pueda gestionar múltiples chats de forma eficiente.

#### Criterios de Aceptación

1. THE Panel_Conversaciones SHALL mostrar la lista de Conversaciones activas del Tenant organizadas por estado (pendiente, en curso, resuelta), paginadas en bloques de 50 conversaciones por página, mostrando para cada una el nombre del Lead, el último mensaje recibido y el contador de mensajes no leídos.
2. WHEN un Usuario selecciona una Conversación en el Panel_Conversaciones, THE Plataforma SHALL mostrar los últimos 50 mensajes del historial con indicación de quién envió cada mensaje (Lead, Agente_IA o Agente_Humano) y permitir cargar mensajes anteriores en bloques de 50 mediante scroll hacia arriba.
3. WHEN se recibe un nuevo mensaje en una Conversación del Tenant, THE Panel_Conversaciones SHALL reflejar el mensaje en la vista activa en un máximo de 2 segundos sin requerir recarga manual de la página.
4. THE Panel_Conversaciones SHALL permitir filtrar Conversaciones por Sesión_WhatsApp, Agente_IA asignado, Agente_Humano asignado y Etapa del Pipeline, aplicando los filtros seleccionados en un máximo de 1 segundo y mostrando el número de resultados encontrados.
5. WHEN un nuevo mensaje llega a una Conversación, THE Panel_Conversaciones SHALL mover esa Conversación al inicio de su grupo de estado correspondiente, incrementar el contador de mensajes no leídos y mostrar una indicación visual distinguible durante al menos 3 segundos.
6. IF no existen Conversaciones activas para el Tenant o para los filtros aplicados, THEN THE Panel_Conversaciones SHALL mostrar un mensaje indicando que no hay conversaciones disponibles junto con las acciones aplicables según el contexto.

---

### Requisito 6: Pipeline de Ventas (Embudo)

**Historia de Usuario:** Como gerente de ventas, quiero visualizar y gestionar un pipeline de ventas tipo Kanban, para que pueda dar seguimiento al progreso de cada lead a través del embudo de ventas.

#### Criterios de Aceptación

1. THE Plataforma SHALL proporcionar una vista tipo Kanban donde cada columna representa una Etapa del Pipeline y cada tarjeta representa un Lead.
2. WHEN un Usuario arrastra un Lead de una Etapa a otra, THE Plataforma SHALL actualizar la Etapa del Lead, registrar la fecha y hora del cambio, y mostrar la tarjeta en la nueva columna en un máximo de 2 segundos.
3. IF el movimiento de un Lead entre Etapas falla por error de red o de servidor, THEN THE Plataforma SHALL revertir la tarjeta a su Etapa original, mostrar un mensaje de error indicando que el cambio no se pudo guardar, y preservar el estado anterior del Lead.
4. THE Plataforma SHALL permitir al administrador crear, editar, reordenar y eliminar Etapas del Pipeline del Tenant, con un mínimo de 2 y un máximo de 20 Etapas por Pipeline.
5. IF un administrador intenta eliminar una Etapa que contiene Leads, THEN THE Plataforma SHALL solicitar al administrador seleccionar una Etapa destino a la cual reubicar los Leads antes de completar la eliminación.
6. WHEN un Lead es creado a partir de una nueva Conversación, THE Plataforma SHALL asignar automáticamente el Lead a la primera Etapa del Pipeline.
7. THE Plataforma SHALL mostrar en cada tarjeta del Lead: nombre, número de WhatsApp, Etapa actual, Calificación_Lead y tiempo transcurrido en la Etapa actual expresado en días y horas (ej. "3d 5h").
8. WHEN un nuevo Tenant es creado, THE Plataforma SHALL generar un Pipeline por defecto con las Etapas: "Nuevo", "Contactado", "Calificado", "Propuesta" y "Cierre".

---

### Requisito 7: Calificación Automática de Leads

**Historia de Usuario:** Como gerente de ventas, quiero que el sistema califique automáticamente los leads según criterios configurables, para que pueda priorizar los más prometedores.

#### Criterios de Aceptación

1. WHEN se recibe un nuevo mensaje del Lead en una Conversación activa, THE Plataforma SHALL recalcular la Calificación_Lead basada en los criterios configurados por el Tenant en un tiempo máximo de 5 segundos desde la recepción del mensaje.
2. THE Plataforma SHALL permitir al administrador configurar los criterios de calificación (palabras clave, intención de compra, presupuesto mencionado, urgencia detectada) con pesos independientes asignables en un rango de 1 a 10 cada uno, permitiendo un máximo de 50 palabras clave y hasta 10 criterios personalizados por Tenant.
3. THE Plataforma SHALL representar la Calificación_Lead como un valor numérico de 0 a 100 con clasificación categórica basada en umbrales configurables por el Tenant, con valores por defecto: frío (0-33), tibio (34-66), caliente (67-100).
4. WHEN la Calificación_Lead cambia de categoría, THE Plataforma SHALL enviar una notificación in-app al Agente_Humano asignado y al supervisor del Tenant en un plazo máximo de 30 segundos, indicando la categoría anterior, la nueva categoría y el valor numérico actual.
5. THE Plataforma SHALL utilizar el Agente_IA para analizar el contenido de la Conversación y extraer señales correspondientes a los criterios configurados por el Tenant de forma automática.
6. IF la Conversación no contiene información suficiente para evaluar al menos un criterio de calificación, THEN THE Plataforma SHALL asignar al Lead una Calificación_Lead de 0 con categoría "frío" hasta que se obtengan señales evaluables.
7. IF el administrador configura un peso fuera del rango permitido (1-10) o define umbrales de categoría que no cubren el rango completo de 0 a 100 sin solapamientos, THEN THE Plataforma SHALL rechazar la configuración mostrando un mensaje de error que indique el campo inválido y el rango aceptado.

---

### Requisito 8: Follow-Up Automático

**Historia de Usuario:** Como agente de ventas, quiero que el sistema envíe mensajes de seguimiento automáticos, para que ningún lead se pierda por falta de contacto oportuno.

#### Criterios de Aceptación

1. WHEN un Lead no responde dentro del tiempo configurado por el Tenant, THE Plataforma SHALL enviar el primer Follow_Up automático de la secuencia asignada a través de la Sesión_WhatsApp correspondiente.
2. THE Plataforma SHALL permitir al administrador configurar secuencias de Follow_Up con un máximo de 10 mensajes por secuencia, intervalos de tiempo entre cada mensaje (mínimo 1 hora, máximo 168 horas) y condiciones de parada.
3. WHEN un Lead responde a un Follow_Up, THE Plataforma SHALL detener la secuencia de Follow_Up activa y reanudar la Conversación con el Agente_IA o Agente_Humano asignado.
4. IF un Follow_Up está programado para enviarse fuera de la ventana de horario configurada por el Tenant, THEN THE Plataforma SHALL diferir el envío al siguiente inicio de ventana horaria válida.
5. IF un Follow_Up falla en su envío, THEN THE Plataforma SHALL reintentar el envío hasta 3 veces con intervalos de 5 minutos y notificar al administrador mediante una alerta visible en la Plataforma si todos los reintentos fallan.
6. IF el Lead es marcado como convertido, solicita no recibir más mensajes, o la secuencia alcanza su último mensaje configurado, THEN THE Plataforma SHALL detener la secuencia de Follow_Up activa para ese Lead.

---

### Requisito 9: Dashboard y Métricas

**Historia de Usuario:** Como administrador del Tenant, quiero visualizar métricas de rendimiento en un dashboard, para que pueda tomar decisiones basadas en datos sobre la operación de ventas y atención al cliente.

#### Criterios de Aceptación

1. WHEN el administrador accede al Dashboard, THE Dashboard SHALL mostrar tarjetas con métricas clave: total de Conversaciones activas, Leads nuevos del período seleccionado (por defecto últimos 7 días), tasa de conversión del Pipeline expresada en porcentaje, tiempo promedio de respuesta expresado en minutos y Calificación_Lead promedio expresada en escala numérica de 1 a 100.
2. THE Dashboard SHALL presentar gráficos de línea con la evolución temporal de Conversaciones, Leads y conversiones en períodos seleccionables: día (puntos por hora), semana (puntos por día) y mes (puntos por día), mostrando un máximo de 31 puntos de datos por serie.
3. THE Dashboard SHALL presentar gráficos de barras con el rendimiento por Agente_Humano (conversaciones atendidas, tiempo promedio de respuesta en minutos, leads convertidos), mostrando un máximo de 50 agentes ordenados por mayor número de conversaciones atendidas.
4. WHEN el período de tiempo seleccionado cambia, THE Dashboard SHALL actualizar todas las métricas y gráficos en un tiempo máximo de 3 segundos.
5. THE Dashboard SHALL mostrar indicadores de progreso circular para las metas configuradas por el Tenant (meta de leads, meta de conversiones, meta de respuestas), representando el avance como porcentaje de 0% a 100% respecto al valor objetivo numérico definido por el Tenant.
6. IF no existen datos para el período seleccionado, THEN THE Dashboard SHALL mostrar las tarjetas y gráficos en estado vacío con valor cero o sin puntos de datos, e indicar un mensaje informando que no hay datos disponibles para el período.
7. IF la carga de métricas falla por error de conexión o timeout superior a 10 segundos, THEN THE Dashboard SHALL mostrar un mensaje de error indicando la indisponibilidad temporal de los datos y ofrecer una opción para reintentar la carga.
8. WHEN el Dashboard se carga por primera vez en una sesión, THE Dashboard SHALL mostrar el período "última semana" como selección por defecto y actualizar los datos automáticamente cada 60 segundos mientras el administrador permanezca en la vista.

---

### Requisito 10: Interfaz de Usuario y Experiencia Visual

**Historia de Usuario:** Como usuario de la plataforma, quiero una interfaz moderna, limpia y profesional, para que pueda trabajar de manera eficiente y agradable durante jornadas extensas.

#### Criterios de Aceptación

1. THE Plataforma SHALL implementar un sidebar izquierdo de navegación con fondo en tonos verde oscuro/teal que contenga los accesos a: Dashboard, Conversaciones, Pipeline, Leads, Inventario, Agentes IA, Integraciones, Configuración.
2. THE Plataforma SHALL utilizar un esquema de colores basado en tonos verdes/mint como color de acento sobre fondo blanco, con tipografía sans-serif de al menos 14px para cuerpo de texto y al menos 18px para encabezados.
3. THE Plataforma SHALL presentar las métricas en tarjetas (cards) con bordes redondeados entre 8px y 12px de radio, sombras con desplazamiento vertical de no más de 4px y opacidad no mayor al 15%, e indicadores visuales de progreso circular que muestren el porcentaje numérico correspondiente.
4. WHILE la ventana del navegador tenga un ancho de 1024px o superior, THE Plataforma SHALL mostrar el sidebar expandido junto al contenido principal. WHILE la ventana del navegador tenga un ancho entre 768px y 1023px, THE Plataforma SHALL colapsar el sidebar mostrando solo iconos y reorganizar las tarjetas de métricas en una cuadrícula de máximo 2 columnas.
5. THE Plataforma SHALL utilizar tablas con filas de estilos alternados y mostrar en cada fila acciones contextuales (ver detalle, editar, eliminar) visibles mediante un menú desplegable o iconos al hacer hover sobre la fila, para la visualización de datos tabulares (Leads, Conversaciones, Agentes).
6. THE Plataforma SHALL cumplir un ratio de contraste mínimo de 4.5:1 entre texto y fondo en todos los elementos de la interfaz, según las pautas WCAG 2.1 nivel AA.
7. THE Plataforma SHALL mostrar un indicador visual de estado activo (resaltado de fondo o borde lateral de acento) en el ítem del sidebar correspondiente a la sección actualmente visible.

---

### Requisito 11: Autenticación y Seguridad

**Historia de Usuario:** Como administrador, quiero que la plataforma tenga autenticación segura y control de acceso, para que los datos de mis clientes estén protegidos.

#### Criterios de Aceptación

1. THE Plataforma SHALL autenticar a los Usuarios mediante correo electrónico y contraseña utilizando Supabase Auth con tokens JWT, exigiendo contraseñas de entre 8 y 128 caracteres que contengan al menos una letra mayúscula, una minúscula, un dígito y un carácter especial.
2. WHEN un Usuario ingresa credenciales inválidas 5 veces consecutivas, THE Plataforma SHALL bloquear temporalmente la cuenta por 15 minutos, mostrar un mensaje indicando el bloqueo temporal y el tiempo restante, y enviar una notificación por correo electrónico al administrador del Tenant.
3. THE Plataforma SHALL cifrar todas las API keys de los Proveedores_IA almacenadas en la base de datos utilizando cifrado AES-256.
4. WHILE un Usuario está autenticado, THE Plataforma SHALL verificar los permisos del rol asignado antes de ejecutar cualquier operación de lectura o escritura.
5. IF un Usuario autenticado solicita una operación para la cual su rol no tiene permisos, THEN THE Plataforma SHALL rechazar la solicitud, mostrar un mensaje indicando permisos insuficientes y registrar el intento en el log de auditoría del Tenant.
6. THE Plataforma SHALL transmitir toda la comunicación entre el cliente y el servidor mediante HTTPS/TLS 1.3.
7. WHEN un token JWT de acceso expira tras 60 minutos de su emisión, THE Plataforma SHALL requerir la renovación del token mediante refresh token válido por 7 días, o redirigir al Usuario a la pantalla de inicio de sesión si el refresh token también ha expirado.

---

### Requisito 12: Gestión de Base de Conocimiento

**Historia de Usuario:** Como administrador del Tenant, quiero alimentar a mis agentes IA con documentos y datos externos, para que las respuestas automáticas sean relevantes y precisas para mi negocio.

#### Criterios de Aceptación

1. WHEN el administrador sube un archivo PDF de hasta 10 MB con un máximo de 500 páginas, THE Plataforma SHALL extraer el texto, procesarlo en fragmentos de entre 500 y 1000 tokens con solapamiento de 100 tokens, y almacenarlo como embeddings vectoriales en la Base_Conocimiento del Agente_IA en un plazo máximo de 120 segundos.
2. WHEN el administrador conecta una carpeta de Google_Drive, THE Plataforma SHALL sincronizar los documentos contenidos (Google Sheets y archivos PDF) y actualizar la Base_Conocimiento cada 60 minutos de forma automática, procesando un máximo de 100 documentos por carpeta conectada.
3. THE Plataforma SHALL limitar el tamaño máximo de archivos PDF a 10 MB por archivo y 50 MB por Tenant como almacenamiento total de Base_Conocimiento.
4. IF el administrador intenta subir un archivo que excede 10 MB o que superaría el límite de 50 MB del Tenant, THEN THE Plataforma SHALL rechazar la operación y mostrar un mensaje de error indicando el límite excedido y el espacio disponible restante.
5. WHEN el Agente_IA genera una respuesta, THE Plataforma SHALL realizar una búsqueda semántica en la Base_Conocimiento, recuperar los 5 fragmentos con mayor similitud coseno (umbral mínimo de 0.7), e incluirlos como contexto en el prompt enviado al Proveedor_IA.
6. THE Plataforma SHALL permitir al administrador visualizar la lista de documentos (nombre, fecha de carga, tamaño y estado de procesamiento), eliminar y reemplazar los documentos de la Base_Conocimiento desde el panel de configuración del Agente_IA.
7. WHEN se detecta un cambio en los archivos de Google_Drive conectados durante la sincronización periódica, THE Plataforma SHALL reprocesar los fragmentos afectados y actualizar los embeddings vectoriales correspondientes sin duplicar fragmentos existentes.
8. IF la sincronización con Google_Drive falla por token expirado o error de conexión, THEN THE Plataforma SHALL reintentar la conexión hasta 3 veces con intervalo de 5 minutos y, si persiste el fallo, notificar al administrador con un indicador de error visible en el panel de configuración.
9. IF el administrador sube un archivo PDF corrupto o sin texto extraíble, THEN THE Plataforma SHALL rechazar el archivo y mostrar un mensaje de error indicando que el documento no pudo ser procesado.

---

### Requisito 13: Módulo de Integraciones

**Historia de Usuario:** Como administrador del Tenant, quiero una sección centralizada de integraciones donde pueda configurar los servicios externos conectados, para que pueda gestionar todas las conexiones desde un solo lugar.

#### Criterios de Aceptación

1. THE Módulo_Integraciones SHALL presentar una vista con tarjetas para cada integración disponible: Proveedor_IA, WhatsApp Business API, Dropi y Google_Drive.
2. WHEN el administrador configura la integración de Proveedor_IA, THE Módulo_Integraciones SHALL solicitar la selección del proveedor (OpenRouter, OpenAI, Anthropic u otro), la API key y permitir validar la conexión mediante una llamada de prueba con un tiempo máximo de respuesta de 10 segundos, mostrando un indicador de resultado (éxito o fallo con mensaje de error indicando el motivo).
3. WHEN el administrador configura la integración de Dropi, THE Módulo_Integraciones SHALL solicitar la API key de Dropi y, tras validación exitosa, iniciar la sincronización del catálogo de productos e Inventario del Tenant, con un límite máximo de 10,000 productos por sincronización.
4. WHEN el administrador configura la integración de Google_Drive, THE Módulo_Integraciones SHALL autenticar mediante OAuth 2.0 y permitir seleccionar las carpetas que servirán como fuente para la Base_Conocimiento y el Inventario.
5. THE Módulo_Integraciones SHALL mostrar el estado de conexión (activa, inactiva, error) de cada integración configurada con la fecha de última sincronización exitosa.
6. IF una integración no responde a la verificación de estado durante 60 segundos o falla en 3 intentos consecutivos de conexión, THEN THE Plataforma SHALL cambiar el estado de la integración a "error", mostrar un indicador visual de error en el Módulo_Integraciones y enviar una notificación dentro de la plataforma al administrador del Tenant.
7. WHEN el Agente_IA necesita consultar disponibilidad de productos o crear un pedido, THE Plataforma SHALL consultar el Inventario sincronizado desde Dropi o Google_Drive y ejecutar la creación del pedido mediante la API de Dropi, con un tiempo máximo de respuesta de 15 segundos.
8. IF la API key proporcionada para Proveedor_IA o Dropi es inválida durante la configuración, THEN THE Módulo_Integraciones SHALL mostrar un mensaje de error indicando que la credencial no es válida, no guardar la configuración y mantener la integración en estado "inactiva".
9. IF la API de Dropi no está disponible cuando el Agente_IA intenta crear un pedido, THEN THE Plataforma SHALL informar al usuario que la operación no pudo completarse, registrar el intento fallido y reintentar la operación hasta un máximo de 3 intentos con intervalos de 5 segundos.
10. WHEN el administrador activa la sincronización automática de Dropi, THE Módulo_Integraciones SHALL ejecutar la sincronización del catálogo e Inventario cada 30 minutos y actualizar la fecha de última sincronización exitosa en la tarjeta de la integración.

---

### Requisito 14: Gestión de Inventario y Pedidos

**Historia de Usuario:** Como administrador del Tenant, quiero que el sistema pueda consultar mi inventario y gestionar pedidos a través de Dropi, para que los agentes IA puedan informar disponibilidad y procesar ventas de forma automática.

#### Criterios de Aceptación

1. WHILE la integración de Dropi está activa, WHEN se cumple el intervalo de sincronización de 30 minutos, THE Plataforma SHALL sincronizar el catálogo de productos incluyendo nombre, precio, stock disponible y variantes, con un timeout máximo de 60 segundos por solicitud a la API de Dropi.
2. WHEN un Lead pregunta por disponibilidad de un producto, THE Agente_IA SHALL consultar el Inventario sincronizado y responder con nombre del producto, precio, stock disponible y variantes, indicando que la información refleja la última sincronización realizada.
3. WHEN un Lead confirma una compra en la Conversación y proporciona nombre completo, dirección de envío, ciudad y teléfono de contacto, THE Plataforma SHALL crear un pedido en Dropi mediante la API con los datos del Lead y los productos seleccionados (máximo 20 productos por pedido).
4. THE Plataforma SHALL mostrar una vista de Inventario donde el Usuario pueda consultar productos, stock disponible y estado de pedidos de los últimos 30 días, con un máximo de 50 pedidos por página.
5. IF la creación de un pedido en Dropi falla, THEN THE Plataforma SHALL notificar al Agente_Humano asignado en un máximo de 60 segundos, registrar el error para reintento manual y preservar los datos del pedido sin pérdida de información.
6. IF la sincronización programada con Dropi falla por timeout o error de API, THEN THE Plataforma SHALL registrar el error, mantener los datos del último catálogo sincronizado exitosamente y reintentar la sincronización en el siguiente intervalo de 30 minutos.
7. IF un Lead consulta un producto que no existe en el catálogo sincronizado, THEN THE Agente_IA SHALL informar al Lead que el producto no se encuentra disponible en el catálogo actual.
8. IF al momento de crear el pedido en Dropi el stock del producto es insuficiente para la cantidad solicitada, THEN THE Plataforma SHALL cancelar la creación del pedido, informar al Lead sobre la falta de stock y notificar al Agente_Humano asignado.
