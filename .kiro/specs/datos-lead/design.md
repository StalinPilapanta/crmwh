# Design — Datos del lead (captura por el agente + vista unificada)

## Visión general

Se definen 6 campos estándar del lead. Nombre y Teléfono reutilizan
`contact.name`/`contact.phone`; Provincia, Ciudad, Dirección y Referencia se
guardan en `contact.ficha` con claves canónicas. Provincia/Ciudad se eligen de un
catálogo JSON por país (Ecuador primero), y el país se configura en Marca. El
agente captura estos datos con una nueva acción `update_ficha`, y un componente
unificado (`LeadDataPanel`) los muestra/edita en Inbox, Pipeline y Contactos.

### Principios

- **Una sola fuente de verdad:** todo vive en `contact` (name/phone + ficha), leído
  por `GET /api/contacts/:id` y escrito por `PATCH /api/contacts/:id` →
  `upsertFicha`. Un cambio se refleja en las tres vistas.
- **Claves canónicas:** constantes compartidas (agente, API, UI) para no
  desincronizar.
- **Degradación segura:** sin catálogo/país, provincia y ciudad son texto libre.
- **Reusar lo existente:** `upsertFicha`, `FichaPanel`, branding en metadata.

## Componentes y cambios

### 1. Catálogo de países — `src/lib/geo/` (nuevo)

- `src/lib/geo/ec.json`: Ecuador, estructura:
  ```json
  { "provincias": [ { "nombre": "Pichincha", "ciudades": ["Quito", "Cayambe", ...] }, ... ] }
  ```
  (24 provincias con sus cantones/ciudades principales.)
- `src/lib/geo/index.ts`: registro de catálogos por código de país.
  ```ts
  export const SUPPORTED_COUNTRIES = [{ code: "EC", name: "Ecuador" }] as const;
  export function getGeoCatalog(country: string): GeoCatalog | null
  export function listProvincias(country): string[]
  export function listCiudades(country, provincia): string[]
  export function normalizeProvincia(country, raw): string | null   // acentos/mayúsc.
  export function normalizeCiudad(country, provincia, raw): string | null
  ```
- Estructura lista para agregar más países (agregar `xx.json` + registrar).

### 2. País en la marca — `src/lib/branding.ts`, `branding.ts`, API y UI

- Agregar `country: string` a `Branding` (default `"EC"`) en `normalizeBranding` y
  `DEFAULT_BRANDING`. Se guarda en `organization.metadata.branding` (sin migración).
- `PUT /api/settings/branding`: aceptar `country` en el `putSchema`
  (`z.enum(SUPPORTED_COUNTRY_CODES)`); solo owner (ya lo es).
- UI de Marca (`branding-client.tsx` o equivalente): selector de país de operación.

### 3. Claves canónicas del lead — `src/lib/lead-fields.ts` (nuevo)

```ts
export const LEAD_FIELDS = {
  provincia: "provincia",
  ciudad: "ciudad",
  direccion: "direccion",
  referencia: "referencia",
} as const;
// Nombre y teléfono NO van en ficha: son contact.name / contact.phone.
export const LEAD_FIELD_LABELS = { provincia:"Provincia", ciudad:"Ciudad",
  direccion:"Dirección", referencia:"Referencia" };
```
Estas claves las usan el agente, la API y la UI (fuente única de nombres).

### 4. Acción del agente `update_ficha` — `actions.ts`, `prompts.ts`, `pipeline.ts`

- **actions.ts:** nueva variante del `AgentAction`:
  ```ts
  { action: "update_ficha",
    fields: { name?, phone?, provincia?, ciudad?, direccion?, referencia? },
    reply?: string }
  ```
  Zod: todos opcionales, strings acotados. `name`/`phone` se enrutan a columnas;
  el resto a ficha.
- **prompts.ts:** documentar la acción y una regla: "Cuando el cliente dé datos de
  entrega (nombre, provincia, ciudad, dirección, referencia, teléfono), usa
  update_ficha para guardarlos. Provincia y Ciudad deben ser del país
  configurado. Si falta algún dato para cerrar el pedido, pídelo con naturalidad."
  Además, inyectar en el prompt las provincias válidas del país (lista) para que
  el modelo use nombres correctos. (Las ciudades no se listan completas por
  tamaño; se validan/normalizan server-side.)
- **pipeline.ts:** `case "update_ficha"`:
  - `name`/`phone` → update de columnas de `contact` (por helper scoped).
  - `provincia` → `normalizeProvincia(country, v)`; `ciudad` →
    `normalizeCiudad(country, provincia, v)`. Si no normaliza, se omite ese campo
    (no rompe).
  - Resto → `upsertFicha` con las claves canónicas.
  - `reply` opcional → `deliverReply`. Nunca rompe el turno.

### 5. API — extender `PATCH /api/contacts/:id`

- Ya acepta `name`, `notes`, `archived`, `ficha`. Añadir validación opcional: si
  el patch de ficha trae `provincia`/`ciudad`, validarlas/normalizarlas contra el
  catálogo del país de la org antes de `upsertFicha`. (Fuente única de escritura.)
- `GET /api/contacts/:id` ya devuelve `contact` (con ficha), `stage`, `lead`. Se
  reutiliza tal cual; el país se obtiene del branding.

### 6. Componente unificado — `src/components/lead/lead-data-panel.tsx` (nuevo)

`LeadDataPanel({ contact, country, onSave })` que muestra y edita los 6 campos:
- **Nombre** (edita `contact.name`).
- **Teléfono** (edita `contact.phone`): se auto-llena con el número de WhatsApp del
  contacto desde el primer mensaje. Es EDITABLE por si el número de entrega difiere
  del de WhatsApp (no se pierde el original salvo que el usuario lo cambie).
- **Provincia** y **Ciudad**: si el país tiene catálogo → `<select>` dependientes
  (ciudad filtra por provincia); si no → input de texto.
- **Dirección** y **Referencia**: input/textarea.
- Guarda con `PATCH /api/contacts/:id` (name/phone y/o ficha) — la misma ruta que
  ya usan Inbox y Pipeline.
- Reemplaza/*envuelve* al `FichaPanel` actual en las vistas, o se muestra encima de
  él (el `FichaPanel` puede seguir para claves libres extra).

**Integración en las 3 vistas:**
- **Inbox** (`inbox/contact-panel.tsx`): insertar `LeadDataPanel` en el detalle.
- **Pipeline** (`pipeline/lead-drawer.tsx`): insertar `LeadDataPanel` en el trato.
- **Contactos** (`contacts/contacts-client.tsx`): agregar el panel (hoy no muestra
  ficha) — al abrir/editar un contacto.

Todas comparten `country` (del branding, ya disponible) y el mismo endpoint.

## Flujo de datos

### Captura por el agente
1. Cliente: "Soy Ana, en Quito, Pichincha, calle X #123, junto al parque".
2. Agente emite `update_ficha { name:"Ana", provincia:"Pichincha", ciudad:"Quito",
   direccion:"Calle X #123", referencia:"junto al parque", reply:"¡Gracias Ana!" }`.
3. pipeline valida provincia/ciudad contra el catálogo EC, guarda name en columna y
   el resto en ficha vía `upsertFicha`, envía el reply.
4. El dato aparece de inmediato en Inbox/Pipeline/Contactos (misma fuente).

### Edición manual
1. En cualquier vista se abre `LeadDataPanel`.
2. Provincia/Ciudad por selector del catálogo; se guarda con `PATCH /api/contacts/:id`.
3. Se refleja en las otras vistas (Inbox refresca por SSE; las demás al reabrir).

## Manejo de errores

| Situación | Comportamiento |
|-----------|----------------|
| País sin catálogo | provincia/ciudad como texto libre |
| Agente manda provincia inválida | intenta normalizar; si no, omite ese campo |
| Ciudad no pertenece a la provincia | se omite la ciudad, se conserva la provincia |
| Falla la captura | log, no rompe el turno |
| Contacto de otra org | 404 (scoped), como hoy |

## Testing

- **Unit (Vitest):**
  - `geo`: listProvincias/listCiudades; normalizeProvincia/Ciudad (acentos,
    mayúsculas); ciudad que no pertenece a la provincia → null; país sin catálogo.
  - Acción `update_ficha`: schema válido/ inválido; ruteo name/phone vs ficha.
  - pipeline `case update_ficha`: normaliza provincia/ciudad, omite inválidos,
    guarda por upsertFicha, no rompe si falla.
  - branding: `country` default EC; PUT valida país soportado.
- **Gate:** `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.

## Decisiones

- **Provincia/Ciudad en ficha (no columnas nuevas):** evita migración de columnas y
  reutiliza `upsertFicha`; las claves canónicas dan consistencia. Nombre/Teléfono
  sí son columnas (ya existen).
- **Catálogo JSON en el repo (no API externa):** la división territorial casi no
  cambia; sin dependencia externa (constitución II). Estructura por país para
  escalar.
- **País en branding/metadata:** sin migración; ya es config por-organización del
  owner.
- **Acción `update_ficha` separada de `update_lead`:** `update_lead` sigue para
  notas; `update_ficha` para datos estructurados. Contrato claro y validado.
- **Componente único `LeadDataPanel`:** una sola implementación para las 3 vistas
  garantiza que se vean y editen igual.
