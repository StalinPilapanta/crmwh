# Implementation Plan: WhatsApp CRM SaaS Multitenant

## Overview

Plan de implementación para la plataforma CRM SaaS multitenant de WhatsApp con agentes IA, pipeline de ventas estilo Kommo, calificación automática de leads y follow-up automático. Stack: Next.js 16 (App Router) + Supabase + WhatsApp Business API + OpenRouter/OpenAI/Anthropic + Vercel.

## Tasks

- [x] 1. Inicializar proyecto Next.js 16 con configuración base
  - [x] 1.1. Crear proyecto Next.js 16 con App Router usando `npx create-next-app@latest` con TypeScript, Tailwind CSS, ESLint y src/ directory
  - [x] 1.2. Instalar dependencias core: `@supabase/supabase-js`, `@supabase/ssr`, `zustand`, `@tanstack/react-query`, `recharts`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`
  - [x] 1.3. Instalar shadcn/ui CLI y configurar con tema verde/mint personalizado (primary: hsl verde teal, radius: 0.5rem)
  - [x] 1.4. Crear archivo `src/lib/utils.ts` con función `cn()` para merge de clases Tailwind
  - [x] 1.5. Configurar `tailwind.config.ts` con paleta de colores verde/mint: primary (#0D9488), primary-dark (#0D4F4F), accent (#6EE7B7), background blanco, foreground oscuro
  - [x] 1.6. Crear `src/styles/globals.css` con variables CSS del tema y estilos base (sans-serif, 14px body, 18px headings)
  - [x] 1.7. Crear archivo `.env.local.example` con todas las variables de entorno requeridas según el diseño
  - [x] 1.8. Configurar `vercel.json` con cron jobs: followup (cada 5 min), dropi-sync (cada 30 min), gdrive-sync (cada 60 min), session-health (cada 2 min)
  > **Requirements addressed:** R10 (UI base), R11 (seguridad base)

- [x] 2. Configurar Supabase - esquema de base de datos y RLS
  - [x] 2.1. Crear archivo `supabase/migrations/001_initial_schema.sql` con todas las tablas: tenants, users, invitations, whatsapp_sessions, ai_providers, ai_agents, leads, conversations, messages, pipeline_stages, follow_up_sequences, follow_up_tasks, knowledge_docs, knowledge_chunks (vector(1536)), integrations, products, orders, scoring_config, notifications, audit_logs
  - [x] 2.2. Agregar constraints CHECK: leads.score (0-100), users.role IN ('admin','supervisor','agent'), conversations.controlled_by IN ('ai','human')
  - [x] 2.3. Crear índices de performance: idx_conversations_tenant_status, idx_messages_conversation, idx_leads_tenant_stage, idx_leads_tenant_score, idx_follow_up_tasks_scheduled, idx_notifications_user_unread
  - [x] 2.4. Crear índice vectorial IVFFlat en knowledge_chunks.embedding para búsqueda cosine similarity
  - [x] 2.5. Agregar UNIQUE constraints: (tenant_id, phone_number) en leads, (tenant_id, position) en pipeline_stages DEFERRABLE, (tenant_id) en scoring_config
  - [x] 2.6. Habilitar RLS en TODAS las tablas con tenant_id y crear políticas RLS usando `auth.jwt() -> 'app_metadata' ->> 'tenant_id'`
  - [x] 2.7. Crear función SQL `handle_new_user()` que asigna app_metadata.tenant_id y role al JWT, con trigger on_auth_user_created
  - [x] 2.8. Crear función `create_default_pipeline(tenant_uuid)` que inserta 5 etapas por defecto (Nuevo, Contactado, Calificado, Propuesta, Cierre)
  - [x] 2.9. Crear función `create_default_scoring_config(tenant_uuid)` con umbrales por defecto (cold 0-33, warm 34-66, hot 67-100)
  - [x] 2.10. Habilitar extensión vector (pgvector) y crear Supabase Storage bucket `knowledge-base` con política RLS
  > **Requirements addressed:** R1, R6, R7, R11, R12

- [x] 3. Configurar Supabase clients y middleware de autenticación
  - [x] 3.1. Crear `src/lib/supabase/client.ts` - browser client con createBrowserClient()
  - [x] 3.2. Crear `src/lib/supabase/server.ts` - server client con createServerClient() usando cookies
  - [x] 3.3. Crear `src/lib/supabase/admin.ts` - admin client con service_role_key para cron jobs
  - [x] 3.4. Crear `src/lib/supabase/types.ts` - tipos TypeScript generados
  - [x] 3.5. Crear `src/middleware.ts` que verifica sesión, redirige a /login si no autenticado, excluye webhook y assets
  - [x] 3.6. Crear `src/lib/encryption.ts` con funciones encrypt/decrypt usando AES-256-GCM
  > **Requirements addressed:** R1, R11

- [x] 4. Implementar sistema de autenticación (registro, login, invitaciones)
  - [x] 4.1. Crear `src/app/(auth)/layout.tsx` - layout centrado para auth con fondo blanco y logo
  - [x] 4.2. Crear `src/app/(auth)/login/page.tsx` - formulario login con validación de password (8-128 chars, mayúscula, minúscula, dígito, especial) y manejo de bloqueo
  - [x] 4.3. Crear `src/app/(auth)/register/page.tsx` - formulario registro con nombre, email, empresa, password
  - [x] 4.4. Crear `src/app/api/auth/register/route.ts` - orquesta: crear auth user, crear tenant, crear user row, asignar claims, crear pipeline default, crear scoring config default
  - [x] 4.5. Crear `src/app/api/tenant/invite/route.ts` - genera invitación con token, expires_at +72h, envía email
  - [x] 4.6. Crear `src/app/(auth)/invite/[token]/page.tsx` - aceptar invitación, verificar token válido y no expirado
  - [x] 4.7. Crear `src/app/api/tenant/members/route.ts` y `[id]/route.ts` - listar y actualizar miembros
  - [x] 4.8. Implementar bloqueo por 5 intentos fallidos (15 min) con notificación al admin
  - [x] 4.9. Crear hook `src/hooks/use-tenant.ts` que lee tenant_id y role del JWT
  > **Requirements addressed:** R1, R11

- [x] 5. Crear layout principal del dashboard con sidebar verde/teal
  - [x] 5.1. Inicializar componentes shadcn/ui: button, card, input, badge, dropdown-menu, dialog, toast, separator, avatar, scroll-area, tabs, tooltip
  - [x] 5.2. Crear `src/components/layout/sidebar.tsx` - fondo #0D4F4F, iconos Lucide, indicador activo con borde verde mint, colapsa a iconos < 1024px
  - [x] 5.3. Crear `src/components/layout/header.tsx` - barra búsqueda, notification bell, avatar con dropdown
  - [x] 5.4. Crear `src/components/layout/mobile-nav.tsx` - navegación para tablet
  - [x] 5.5. Crear `src/app/(dashboard)/layout.tsx` - renderiza sidebar + header + contenido
  - [x] 5.6. Crear `src/components/shared/notification-bell.tsx`, `empty-state.tsx`, `loading-skeleton.tsx`, `data-table.tsx`
  > **Requirements addressed:** R10

- [x] 6. Implementar Dashboard con métricas y gráficos
  - [x] 6.1. Crear `src/components/dashboard/circular-progress.tsx` - SVG circular con porcentaje verde mint
  - [x] 6.2. Crear `src/components/dashboard/metric-card.tsx` - card con borde redondeado 8-12px, sombra sutil, valor principal
  - [x] 6.3. Crear `src/components/dashboard/line-chart.tsx` - Recharts LineChart con estilo verde y tooltips
  - [x] 6.4. Crear `src/components/dashboard/bar-chart.tsx` - Recharts BarChart para rendimiento de agentes
  - [x] 6.5. Crear `src/app/api/dashboard/metrics/route.ts` - conversaciones activas, leads nuevos, tasa conversión, tiempo respuesta, score promedio
  - [x] 6.6. Crear `src/app/api/dashboard/charts/route.ts` - series temporales según período (día/semana/mes), max 31 puntos
  - [x] 6.7. Crear `src/app/api/dashboard/agents-performance/route.ts` - rendimiento por agente humano, max 50
  - [x] 6.8. Crear `src/app/(dashboard)/page.tsx` - Dashboard con metric-cards, gráficos, selector de período, auto-refresh 60s, empty/error states
  > **Requirements addressed:** R9

- [x] 7. Implementar conexión WhatsApp Business API y webhook
  - [x] 7.1. Crear `src/lib/whatsapp/types.ts` - tipos para Meta Cloud API
  - [x] 7.2. Crear `src/lib/whatsapp/client.ts` - sendTextMessage, sendTemplateMessage, markAsRead
  - [x] 7.3. Crear `src/lib/whatsapp/webhook-verify.ts` - verificación HMAC-SHA256 con timingSafeEqual
  - [x] 7.4. Crear `src/app/api/whatsapp/webhook/route.ts` - GET: challenge verification. POST: verificar firma, procesar mensajes
  - [x] 7.5. Implementar procesamiento de mensaje: identify session → buscar/crear lead → buscar/crear conversación → guardar mensaje → trigger AI o notificar humano
  - [x] 7.6. Crear `src/app/api/whatsapp/sessions/route.ts` - POST crear sesión (validar, cifrar token), GET listar
  - [x] 7.7. Crear `src/app/api/whatsapp/sessions/[id]/route.ts` y `[id]/test/route.ts` - DELETE y test conexión
  - [x] 7.8. Crear `src/app/(dashboard)/settings/whatsapp/page.tsx` - UI gestión sesiones con status badges
  - [x] 7.9. Crear `src/app/api/cron/session-health/route.ts` - verificar sesiones activas, marcar desconectadas, notificar
  > **Requirements addressed:** R2

- [x] 8. Implementar sistema de Agentes IA con router multi-proveedor
  - [x] 8.1. Crear adaptadores en `src/lib/ai/providers/`: openrouter.ts, openai.ts, anthropic.ts
  - [x] 8.2. Crear `src/lib/ai/router.ts` - generateResponse() con dispatch por providerType y retry exponential backoff
  - [x] 8.3. Crear `src/lib/ai/handoff-detector.ts` - analiza respuesta AI y keywords para determinar handoff
  - [x] 8.4. Crear API routes para agentes: POST/GET `/api/agents`, PATCH/DELETE `/api/agents/[id]`, POST `/api/agents/[id]/assign`
  - [x] 8.5. Crear API routes para proveedor IA: POST `/api/integrations/ai-provider` y `/ai-provider/test`
  - [x] 8.6. Crear componentes: `provider-selector.tsx`, `agent-form.tsx`
  - [x] 8.7. Crear páginas: `agents/page.tsx` (lista), `agents/new/page.tsx` (crear), `agents/[id]/page.tsx` (editar + KB + asignar)
  > **Requirements addressed:** R3, R13

- [x] 9. Implementar Base de Conocimiento (RAG) con PDF y Google Sheets
  - [x] 9.1. Crear `src/lib/pdf-parser.ts` - extractTextFromPDF usando pdf-parse
  - [x] 9.2. Crear `src/lib/embeddings.ts` - generateEmbeddings usando proveedor configurado
  - [x] 9.3. Crear `src/lib/ai/rag.ts` - chunkText (500-1000 tokens, overlap 100), search (pgvector cosine, top 5, threshold 0.7), indexDocument, deleteDocumentChunks
  - [x] 9.4. Crear `/api/agents/[id]/knowledge/route.ts` - POST upload PDF (max 10MB) o Google Sheets URL, validar límite 50MB/tenant, procesar chunks y embeddings
  - [x] 9.5. Crear `/api/agents/[id]/knowledge/[docId]/route.ts` - DELETE documento y chunks
  - [x] 9.6. Crear `src/components/agents/knowledge-upload.tsx` - drag & drop PDF, URL input, progress, lista docs
  - [x] 9.7. Crear `src/lib/gdrive/client.ts` - OAuth (getAuthUrl, exchangeCode), listFiles, getFileContent
  - [x] 9.8. Crear `src/lib/gdrive/parser.ts` y `sync.ts` - parse Sheets a texto, sincronización de carpetas
  - [x] 9.9. Crear `src/app/api/cron/gdrive-sync/route.ts` - sync cada 60min, retry 3x, error handling
  > **Requirements addressed:** R12, R3

- [x] 10. Implementar Panel de Conversaciones con Realtime
  - [x] 10.1. Crear `src/hooks/use-realtime.ts` - suscripción Supabase Realtime filtrada por tenant_id
  - [x] 10.2. Crear `src/hooks/use-conversations.ts` - gestión de lista con filtros, paginación y realtime updates
  - [x] 10.3. Crear `src/components/conversations/conversation-list.tsx` - tabs por estado, items con lead name, último msg, unread badge, indicador AI/Human, paginación 50
  - [x] 10.4. Crear `src/components/conversations/message-bubble.tsx` - estilos diferenciados por sender_type, timestamp, status
  - [x] 10.5. Crear `src/components/conversations/chat-window.tsx` - header con info lead + handoff buttons, scroll infinito, input texto, realtime
  - [x] 10.6. Crear `src/components/conversations/handoff-banner.tsx` - banner para aceptar/devolver handoff
  - [x] 10.7. Crear API routes: GET `/api/conversations` con filtros y paginación, GET/POST `/api/conversations/[id]/messages`, POST `handoff/accept` y `handoff/release`
  - [x] 10.8. Crear `src/app/(dashboard)/conversations/page.tsx` - layout 2 paneles: lista + chat
  > **Requirements addressed:** R4, R5

- [x] 11. Implementar Pipeline de Ventas (Kanban) con Drag & Drop
  - [x] 11.1. Crear API routes: GET/POST `/api/pipeline/stages`, PATCH/DELETE `/api/pipeline/stages/[id]`, PATCH `/api/pipeline/stages/reorder`
  - [x] 11.2. Crear API routes: GET `/api/leads`, GET/PATCH `/api/leads/[id]`, PATCH `/api/leads/[id]/stage`
  - [x] 11.3. Crear `src/components/pipeline/lead-card.tsx` - nombre, teléfono, score badge con color, tiempo en etapa
  - [x] 11.4. Crear `src/components/pipeline/kanban-column.tsx` - header con nombre + count + color, droppable area
  - [x] 11.5. Crear `src/components/pipeline/kanban-board.tsx` - @dnd-kit DndContext, scroll horizontal, optimistic update con rollback
  - [x] 11.6. Crear `src/app/(dashboard)/pipeline/page.tsx` - kanban-board + dialog gestión etapas
  - [x] 11.7. Crear `src/app/(dashboard)/leads/page.tsx` - data-table con filtros por etapa y score
  - [x] 11.8. Crear `src/app/(dashboard)/leads/[id]/page.tsx` - detalle lead, historial, timeline
  > **Requirements addressed:** R6

- [x] 12. Implementar Calificación Automática de Leads (Scoring)
  - [x] 12.1. Crear `src/lib/ai/scoring.ts` - calculateScore() que usa AI para extraer señales, calcula score ponderado 0-100, determina categoría
  - [x] 12.2. Crear `/api/scoring/config/route.ts` - GET/PUT config con validación de pesos (1-10), keywords (max 50), umbrales sin solapamiento
  - [x] 12.3. Crear `src/app/(dashboard)/settings/scoring/page.tsx` - UI config: criterios, pesos sliders, keywords tags, umbrales sliders
  - [x] 12.4. Integrar scoring en webhook: después de mensaje del lead, calcular score async, actualizar lead, notificar si cambia categoría
  - [x] 12.5. Crear `src/hooks/use-notifications.ts` - suscripción realtime a notificaciones del usuario
  > **Requirements addressed:** R7

- [x] 13. Implementar Follow-Up Automático
  - [x] 13.1. Crear API routes: GET/POST `/api/followup/sequences`, PATCH/DELETE `/api/followup/sequences/[id]`
  - [x] 13.2. Crear `src/app/(dashboard)/settings/followup/page.tsx` - UI secuencias: mensajes + delays + horario + stop conditions
  - [x] 13.3. Implementar activación de follow-up: al no recibir respuesta en tiempo configurado, crear task. Cancelar tasks previas (Property 7)
  - [x] 13.4. Crear `src/app/api/cron/followup/route.ts` - cada 5min: ejecutar tasks pendientes, verificar business hours, enviar por WA, retry 3x, programar siguiente step
  - [x] 13.5. Integrar parada en respuesta de lead: al recibir mensaje en webhook, cancelar follow_up_tasks pendientes del lead
  > **Requirements addressed:** R8

- [x] 14. Implementar Handoff completo (detección + notificación + timeout)
  - [x] 14.1. Integrar handoff-detector en webhook: después de respuesta IA, evaluar keywords y shouldHandoff flag
  - [x] 14.2. Al detectar handoff: actualizar conversation, crear notifications para agentes disponibles, enviar mensaje al lead
  - [x] 14.3. Implementar timeout: en cron, buscar handoffs > 3min sin aceptar → mensaje al lead + escalar a supervisor
  - [x] 14.4. Implementar "sin agentes disponibles": encolar, mensaje al lead con tiempo estimado, notificar supervisor
  - [x] 14.5. Al aceptar handoff: transacción atómica (controlled_by, assigned_to), eliminar notifications de otros agentes, broadcast Realtime
  > **Requirements addressed:** R4

- [x] 15. Implementar Módulo de Integraciones
  - [x] 15.1. Crear `src/components/integrations/integration-card.tsx` y `connection-status.tsx`
  - [x] 15.2. Crear `/api/integrations/route.ts` - GET listar integraciones con status
  - [x] 15.3. Crear `/api/integrations/dropi/route.ts` - POST configurar Dropi (validar key, cifrar, sync inicial)
  - [x] 15.4. Crear `/api/integrations/gdrive/route.ts` y `/gdrive/callback/route.ts` - OAuth flow completo
  - [x] 15.5. Crear `src/app/(dashboard)/integrations/page.tsx` - grid de cards: Proveedor IA, WhatsApp, Dropi, Google Drive con status y config
  > **Requirements addressed:** R13

- [x] 16. Implementar Inventario y Pedidos (Dropi)
  - [x] 16.1. Crear `src/lib/dropi/client.ts` y `types.ts` - getProducts, createOrder, getOrderStatus con timeout 60s
  - [x] 16.2. Crear `src/app/api/cron/dropi-sync/route.ts` - sync cada 30min, max 10,000 productos, mantener datos previos si falla
  - [x] 16.3. Crear `/api/inventory/products/route.ts` y `/api/inventory/orders/route.ts` - CRUD con paginación
  - [x] 16.4. Crear `src/app/(dashboard)/inventory/page.tsx` - tabs Productos/Pedidos con tablas y búsqueda
  - [x] 16.5. Integrar consulta de productos en AI agent y creación de pedidos en conversación
  > **Requirements addressed:** R14

- [x] 17. Implementar Notificaciones en Tiempo Real
  - [x] 17.1. Crear `/api/notifications/route.ts` - GET listar, PATCH marcar leída
  - [x] 17.2. Actualizar notification-bell con suscripción Realtime y dropdown de notificaciones
  - [x] 17.3. Crear `src/lib/notifications.ts` helper para crear notificaciones desde cualquier endpoint
  - [x] 17.4. Integrar notificaciones en todos los flujos: handoff, scoring, follow-up, desconexión, error integración
  > **Requirements addressed:** R4, R7, R8, R2

- [x] 18. Implementar configuración del Tenant y Team Management
  - [x] 18.1. Crear `src/app/(dashboard)/settings/page.tsx` - nombre empresa, timezone, horario laboral, metas
  - [x] 18.2. Crear `src/app/(dashboard)/settings/team/page.tsx` - tabla miembros, cambio de rol, invitaciones
  - [x] 18.3. Crear `/api/tenant/settings/route.ts` - GET/PUT settings del tenant
  - [x] 18.4. Implementar cambio de status usuario (available/busy/offline) en header
  - [x] 18.4. Implementar cambio de status usuario (available/busy/offline) en header
  > **Requirements addressed:** R1, R8, R9

- [x] 19. Implementar Audit Logs y Seguridad adicional
  - [x] 19.1. Crear `src/lib/audit.ts` helper para logging de acciones
  - [x] 19.2. Integrar audit logging en operaciones críticas: acceso denegado, cambios rol, eliminaciones, config integraciones
  - [x] 19.3. Implementar validación de permisos por rol con helper checkPermission() que retorna 403 + audit log
  - [x] 19.4. Implementar rate limiting por tenant (100 req/min, 429 con Retry-After)
  - [x] 19.5. Verificar que columnas *_encrypted nunca se retornan en API responses
  > **Requirements addressed:** R11, R1

- [x] 20. Testing, polish final y preparación para deployment
  - [x] 20.1. Verificar todas las páginas renderizan sin errores TypeScript y `next build` exitoso
  - [ ] 20.2. Verificar responsive en breakpoints 1024px y 768px
  - [ ] 20.3. Verificar contraste WCAG 4.5:1 en todos los textos
  - [x] 20.4. Crear README.md con descripción, setup, env vars, arquitectura
  - [x] 20.5. Verificar webhook retorna 200 aún si procesamiento falla
  - [x] 20.6. Verificar cron routes validan CRON_SECRET header
  > **Requirements addressed:** R10, R11, R2

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1]},
    {"tasks": [2]},
    {"tasks": [3]},
    {"tasks": [4]},
    {"tasks": [5]},
    {"tasks": [6, 7, 11, 18]},
    {"tasks": [8, 10]},
    {"tasks": [9, 12, 13, 14, 15]},
    {"tasks": [16, 17]},
    {"tasks": [19]},
    {"tasks": [20]}
  ]
}
```

### Explicación de Waves

- **Wave 1**: Inicializar proyecto Next.js
- **Wave 2**: Esquema de base de datos (depende de proyecto)
- **Wave 3**: Supabase clients y middleware (depende de DB)
- **Wave 4**: Autenticación (depende de clients)
- **Wave 5**: Layout del dashboard (depende de auth)
- **Wave 6**: Dashboard, WhatsApp API, Pipeline y Settings pueden hacerse en paralelo (dependen de layout)
- **Wave 7**: Agentes IA y Conversaciones (dependen de WhatsApp)
- **Wave 8**: RAG, Scoring, Follow-up, Handoff e Integraciones (dependen de agentes/conversaciones)
- **Wave 9**: Inventario y Notificaciones (dependen de integraciones y flujos previos)
- **Wave 10**: Seguridad transversal (después de todas las API routes)
- **Wave 11**: Testing y deployment final

## Notes

- Las tareas 1-5 son la base y deben completarse en orden secuencial.
- Las tareas 6-16 pueden paralelizarse parcialmente según el gráfico de dependencias.
- La tarea 17 (Notificaciones) integra con múltiples flujos y debe hacerse después de que existan los flujos principales.
- La tarea 19 (Seguridad) se implementa transversalmente pero conviene hacerla después de tener las API routes establecidas.
- La tarea 20 es la verificación final antes de deployment.
