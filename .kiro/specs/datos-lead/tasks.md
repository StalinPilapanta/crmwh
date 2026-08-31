# Tasks — Datos del lead (captura por el agente + vista unificada)

- [ ] 1. Catálogo geográfico — `src/lib/geo/`
  - `ec.json`: 24 provincias de Ecuador con sus ciudades/cantones principales.
  - `index.ts`: `SUPPORTED_COUNTRIES`, `getGeoCatalog`, `listProvincias`,
    `listCiudades`, `normalizeProvincia`, `normalizeCiudad` (tolerante a
    acentos/mayúsculas). Estructura lista para más países.
  - Tests: listar; normalizar; ciudad fuera de provincia → null; país sin catálogo.
  - _Requisitos: 2.1, 2.2, 2.3, 2.4_

- [ ] 2. País de operación en la Marca
  - `src/lib/branding.ts`: agregar `country` (default `"EC"`) a `Branding`,
    `DEFAULT_BRANDING` y `normalizeBranding`.
  - `PUT /api/settings/branding`: aceptar `country` (enum de países soportados);
    solo owner.
  - UI de Marca: selector de país de operación.
  - _Requisitos: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. Claves canónicas del lead — `src/lib/lead-fields.ts`
  - `LEAD_FIELDS` (provincia, ciudad, direccion, referencia) y `LEAD_FIELD_LABELS`.
  - _Requisitos: 3.1, 3.3, 6.1_

- [ ] 4. Acción del agente `update_ficha`
  - [ ] 4.1 `actions.ts`: variante `{ action:"update_ficha", fields:{...}, reply? }`
    (todos opcionales, acotados). Helper para separar name/phone de las claves de
    ficha.
    - _Requisitos: 4.1, 4.3_
  - [ ] 4.2 `prompts.ts`: documentar la acción, regla de captura de datos de
    entrega, y listar las provincias válidas del país configurado.
    - _Requisitos: 4.2, 4.4_
  - [ ] 4.3 `pipeline.ts`: `case "update_ficha"`: normaliza provincia/ciudad contra
    el catálogo del país; name/phone → columnas de contact; resto → `upsertFicha`;
    reply opcional; nunca rompe el turno.
    - _Requisitos: 4.2, 4.3, 4.5, 3.4, 3.5_
  - [ ] 4.4 Tests: schema; ruteo; normalización/omisión de inválidos; no rompe.
    - _Requisitos: 4.1, 4.2, 4.5_

- [ ] 5. API de contactos — validar provincia/ciudad en el PATCH
  - `PATCH /api/contacts/:id`: si el patch de ficha trae provincia/ciudad,
    normalizar contra el catálogo del país de la org antes de `upsertFicha`.
  - Test: provincia válida pasa; inválida se omite; ciudad fuera de provincia se omite.
  - _Requisitos: 3.4, 3.5, 6.2_

- [ ] 6. Componente unificado `LeadDataPanel`
  - `src/components/lead/lead-data-panel.tsx`: muestra/edita Nombre, Teléfono,
    Provincia (select), Ciudad (select dependiente), Dirección, Referencia.
    Guarda con `PATCH /api/contacts/:id`. Degrada a texto si no hay catálogo.
  - _Requisitos: 3.1, 3.2, 5.5, 6.3_

- [ ] 7. Integración en las 3 vistas
  - [ ] 7.1 Inbox (`inbox/contact-panel.tsx`): insertar `LeadDataPanel`.
    - _Requisitos: 5.1, 5.4_
  - [ ] 7.2 Pipeline (`pipeline/lead-drawer.tsx`): insertar `LeadDataPanel`.
    - _Requisitos: 5.2, 5.4_
  - [ ] 7.3 Contactos (`contacts/contacts-client.tsx`): agregar el panel al
    abrir/editar un contacto (hoy no muestra ficha).
    - _Requisitos: 5.3, 5.4_

- [ ] 8. Verificación
  - Gate completo: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
  - _Requisitos: todos_

- [ ] 9. Despliegue y validación
  - Commit + push; deploy en Coolify.
  - Validación real: en Marca elegir Ecuador; en una conversación dar datos por
    WhatsApp y verificar que el agente los captura; abrir el lead en Inbox,
    Pipeline y Contactos y ver los mismos datos; editar provincia/ciudad por
    selector y ver que se refleja.
  - _Requisitos: 1.1, 4.1, 5.1, 5.2, 5.3_
