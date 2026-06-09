# Technical Design Document

## Overview

Plataforma CRM SaaS multitenant para gestión de ventas y atención al cliente a través de WhatsApp. El sistema utiliza Next.js 16 (App Router) como framework frontend/backend, Supabase como base de datos y autenticación, WhatsApp Business Cloud API de Meta para mensajería, proveedores de IA configurables (OpenRouter, OpenAI, Anthropic) para agentes inteligentes, y Vercel para deployment. La arquitectura está diseñada para soportar múltiples tenants con aislamiento de datos, comunicación en tiempo real, y procesamiento asíncrono de tareas como follow-ups y sincronización de inventario.

### Technology Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Framework | Next.js 16 (App Router) | SSR, RSC, API Routes integradas, deploy en Vercel |
| UI Library | Tailwind CSS + shadcn/ui | Componentes accesibles, personalización total del tema verde/mint |
| Gráficos | Recharts | React-native, ligero, buen soporte SSR |
| Drag & Drop | @dnd-kit/core | Performante, accesible, framework-agnostic |
| Base de Datos | Supabase (PostgreSQL + pgvector) | RLS nativo, Realtime, Auth, Storage, embeddings vectoriales |
| Autenticación | Supabase Auth | JWT, refresh tokens, custom claims para tenant_id |
| Realtime | Supabase Realtime (WebSocket) | Cambios en DB propagados al frontend en vivo |
| File Storage | Supabase Storage | PDFs de knowledge base, organizado por tenant |
| Embeddings | pgvector (Supabase) | Búsqueda semántica para RAG sin servicio externo |
| PDF Parsing | pdf-parse (server-side) | Extracción de texto de PDFs |
| Cifrado | Node.js crypto (AES-256-GCM) | Cifrado de API keys en reposo |
| WhatsApp | Meta Cloud API v21.0 | Webhook + envío de mensajes |
| AI Providers | OpenRouter / OpenAI / Anthropic SDKs | Multi-proveedor configurable |
| Cron Jobs | Vercel Cron | Follow-ups, sincronización periódica |
| Deployment | Vercel | Edge functions, serverless, CDN global |
| State Management | Zustand (client) + React Query (server) | Ligero, compatible con RSC |

## Architecture

### Diagrama de Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTE (Browser)                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────────────┐   │
│  │  Dashboard   │  │ Conversaciones│  │ Pipeline │  │ Agentes/Config    │   │
│  └─────────────┘  └──────────────┘  └──────────┘  └───────────────────┘   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ HTTPS/WSS
┌─────────────────────────────────────▼───────────────────────────────────────┐
│                         NEXT.JS 16 (App Router) - Vercel                     │
│  ┌──────────────────┐  ┌───────────────────┐  ┌────────────────────────┐   │
│  │  Server Components │  │   API Routes       │  │   Middleware (Auth)    │   │
│  │  (RSC + Streaming) │  │   /api/webhook     │  │   RLS Tenant Check     │   │
│  └──────────────────┘  │   /api/whatsapp     │  └────────────────────────┘   │
│                          │   /api/ai           │                               │
│                          │   /api/cron         │                               │
│                          └───────────────────┘                               │
└──────┬──────────────────────────┬───────────────────────────┬───────────────┘
       │                          │                           │
       ▼                          ▼                           ▼
┌──────────────┐   ┌──────────────────────┐   ┌──────────────────────────────┐
│   Supabase   │   │   Servicios Externos  │   │     Cron Jobs (Vercel)       │
│  ┌────────┐  │   │  ┌────────────────┐  │   │  ┌────────────────────────┐  │
│  │PostgreSQL│ │   │  │WhatsApp Cloud  │  │   │  │ Follow-Up Scheduler    │  │
│  │+ pgvector│ │   │  │API (Meta)      │  │   │  │ Dropi Sync (30min)     │  │
│  ├────────┤  │   │  ├────────────────┤  │   │  │ GDrive Sync (60min)    │  │
│  │Realtime │  │   │  │Proveedores IA  │  │   │  │ Lead Scoring           │  │
│  │(WebSocket)│ │   │  │(OpenRouter,    │  │   │  └────────────────────────┘  │
│  ├────────┤  │   │  │ OpenAI, etc.)  │  │   └──────────────────────────────┘
│  │Auth     │  │   │  ├────────────────┤  │
│  ├────────┤  │   │  │Google Drive    │  │
│  │Storage  │  │   │  │(OAuth 2.0)    │  │
│  │(PDFs)   │  │   │  ├────────────────┤  │
│  └────────┘  │   │  │Dropi API       │  │
└──────────────┘   │  └────────────────┘  │
                   └──────────────────────┘
```

### Flujo de Datos Principal (Mensaje Entrante WhatsApp)

```
┌──────────┐    Webhook     ┌──────────────┐    Realtime    ┌──────────────┐
│ WhatsApp │ ──────────────▶│  API Route   │ ─────────────▶│   Browser    │
│  (Lead)  │                │  /webhook    │                │  (Agente)    │
└──────────┘                └──────┬───────┘                └──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     Message Processing      │
                    │  1. Verificar firma HMAC     │
                    │  2. Identify/Create Lead     │
                    │  3. Route to AI Agent        │
                    │  4. RAG (Knowledge Base)     │
                    │  5. Generate AI Response     │
                    │  6. Send via WhatsApp API    │
                    │  7. Update Lead Score        │
                    │  8. Check Handoff Triggers   │
                    └─────────────────────────────┘
```

### Estrategia Multitenant

- **Aislamiento por RLS (Row-Level Security)**: Todas las tablas incluyen `tenant_id` y políticas RLS en Supabase que garantizan que cada query solo accede a datos del tenant autenticado.
- **JWT Claims Personalizados**: El `tenant_id` y `role` se incluyen en los custom claims del JWT de Supabase Auth para verificación server-side sin queries adicionales.
- **Middleware de Validación**: Next.js middleware valida el tenant_id en cada request antes de llegar a la lógica de negocio.

### Deployment (Vercel)

```
┌─────────────────────────────────────────────────────┐
│                    Vercel                            │
│  ┌────────────────┐  ┌────────────────────────┐    │
│  │  Edge Network  │  │   Serverless Functions  │    │
│  │  (CDN + SSR)   │  │   (API Routes)          │    │
│  └────────────────┘  └────────────────────────┘    │
│  ┌────────────────┐  ┌────────────────────────┐    │
│  │  Edge Middleware│  │   Vercel Cron           │    │
│  │  (Auth check)  │  │   (Scheduled tasks)     │    │
│  └────────────────┘  └────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Variables de Entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
ENCRYPTION_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
```

## Components and Interfaces

### Estructura de Carpetas (App Router)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Sidebar + Header layout
│   │   ├── page.tsx                    # Dashboard principal
│   │   ├── conversations/
│   │   │   ├── page.tsx                # Panel de conversaciones
│   │   │   └── [id]/page.tsx           # Chat individual
│   │   ├── pipeline/
│   │   │   └── page.tsx                # Vista Kanban
│   │   ├── leads/
│   │   │   ├── page.tsx                # Lista de leads
│   │   │   └── [id]/page.tsx           # Detalle de lead
│   │   ├── inventory/
│   │   │   └── page.tsx                # Productos y pedidos
│   │   ├── agents/
│   │   │   ├── page.tsx                # Lista de agentes IA
│   │   │   ├── new/page.tsx            # Crear agente
│   │   │   └── [id]/page.tsx           # Editar agente + KB
│   │   ├── integrations/
│   │   │   └── page.tsx                # Módulo integraciones
│   │   └── settings/
│   │       ├── page.tsx                # Config general
│   │       ├── team/page.tsx           # Miembros y roles
│   │       ├── scoring/page.tsx        # Config calificación
│   │       ├── followup/page.tsx       # Secuencias follow-up
│   │       └── whatsapp/page.tsx       # Sesiones WhatsApp
│   └── api/
│       ├── auth/
│       ├── whatsapp/
│       ├── agents/
│       ├── conversations/
│       ├── pipeline/
│       ├── leads/
│       ├── scoring/
│       ├── followup/
│       ├── dashboard/
│       ├── integrations/
│       ├── inventory/
│       ├── notifications/
│       └── cron/
├── components/
│   ├── ui/                             # shadcn/ui base components
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── mobile-nav.tsx
│   ├── dashboard/
│   │   ├── metric-card.tsx
│   │   ├── line-chart.tsx
│   │   ├── bar-chart.tsx
│   │   └── circular-progress.tsx
│   ├── conversations/
│   │   ├── conversation-list.tsx
│   │   ├── chat-window.tsx
│   │   ├── message-bubble.tsx
│   │   └── handoff-banner.tsx
│   ├── pipeline/
│   │   ├── kanban-board.tsx
│   │   ├── kanban-column.tsx
│   │   └── lead-card.tsx
│   ├── agents/
│   │   ├── agent-form.tsx
│   │   ├── knowledge-upload.tsx
│   │   └── provider-selector.tsx
│   ├── integrations/
│   │   ├── integration-card.tsx
│   │   └── connection-status.tsx
│   └── shared/
│       ├── data-table.tsx
│       ├── empty-state.tsx
│       └── notification-bell.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser client
│   │   ├── server.ts                   # Server client (cookies)
│   │   ├── admin.ts                    # Service role client
│   │   └── types.ts                    # Generated DB types
│   ├── whatsapp/
│   │   ├── client.ts                   # Meta Cloud API wrapper
│   │   ├── webhook-verify.ts           # HMAC verification
│   │   └── types.ts
│   ├── ai/
│   │   ├── router.ts                   # Multi-provider router
│   │   ├── providers/
│   │   │   ├── openrouter.ts
│   │   │   ├── openai.ts
│   │   │   └── anthropic.ts
│   │   ├── rag.ts                      # Semantic search
│   │   ├── scoring.ts                  # Lead scoring logic
│   │   └── handoff-detector.ts         # Handoff trigger logic
│   ├── dropi/
│   │   ├── client.ts
│   │   └── types.ts
│   ├── gdrive/
│   │   ├── client.ts
│   │   ├── sync.ts
│   │   └── parser.ts
│   ├── encryption.ts                   # AES-256-GCM
│   ├── pdf-parser.ts
│   ├── embeddings.ts
│   └── utils.ts
├── hooks/
│   ├── use-realtime.ts
│   ├── use-conversations.ts
│   ├── use-notifications.ts
│   └── use-tenant.ts
├── middleware.ts
└── styles/
    └── globals.css
```

### Interfaces de Componentes Clave

#### AI Provider Router (`lib/ai/router.ts`)

```typescript
interface AIProviderConfig {
  providerType: 'openrouter' | 'openai' | 'anthropic' | 'custom';
  apiKey: string; // Desencriptada en runtime
  modelName: string;
}

interface AIRequest {
  systemPrompt: string;
  messages: ChatMessage[];
  ragContext: string[]; // Chunks relevantes de KB
  maxTokens?: number;
}

interface AIResponse {
  content: string;
  tokensUsed: { prompt: number; completion: number };
  shouldHandoff: boolean;
  scoringSignals: ScoringSignal[];
}

// Router que despacha al proveedor correcto según config
async function generateResponse(config: AIProviderConfig, request: AIRequest): Promise<AIResponse>;
```

#### WhatsApp Client (`lib/whatsapp/client.ts`)

```typescript
interface WhatsAppClient {
  sendTextMessage(phoneNumberId: string, to: string, text: string, accessToken: string): Promise<WAMessageResponse>;
  sendTemplateMessage(phoneNumberId: string, to: string, template: WATemplate, accessToken: string): Promise<WAMessageResponse>;
  verifyWebhookSignature(body: string, signature: string, appSecret: string): boolean;
  getMessageStatus(messageId: string, accessToken: string): Promise<WAMessageStatus>;
}
```

#### RAG Service (`lib/ai/rag.ts`)

```typescript
interface RAGService {
  search(agentId: string, query: string, limit?: number, threshold?: number): Promise<KnowledgeChunk[]>;
  indexDocument(agentId: string, docId: string, chunks: TextChunk[]): Promise<void>;
  deleteDocumentChunks(docId: string): Promise<void>;
}

interface KnowledgeChunk {
  id: string;
  content: string;
  similarity: number;
  metadata: { docName: string; pageNumber?: number };
}
```

#### Lead Scoring (`lib/ai/scoring.ts`)

```typescript
interface ScoringConfig {
  criteria: ScoringCriterion[];
  thresholds: { cold: [number, number]; warm: [number, number]; hot: [number, number] };
  keywords: { word: string; weight: number }[];
}

interface ScoringCriterion {
  name: string;
  type: 'keyword' | 'intent' | 'budget' | 'urgency' | 'custom';
  weight: number; // 1-10
}

async function calculateScore(
  conversationMessages: Message[],
  config: ScoringConfig,
  aiProvider: AIProviderConfig
): Promise<{ score: number; category: 'cold' | 'warm' | 'hot'; signals: ScoringSignal[] }>;
```

#### Encryption (`lib/encryption.ts`)

```typescript
function encrypt(plaintext: string, secret: string): string; // Returns base64(iv + ciphertext + authTag)
function decrypt(ciphertext: string, secret: string): string; // Decrypts AES-256-GCM
```

### API Endpoints

#### Autenticación y Tenant

| Método | Ruta | Propósito | Req. |
|--------|------|-----------|------|
| POST | `/api/auth/register` | Registro de nuevo tenant + usuario admin | R1, R11 |
| POST | `/api/auth/login` | Login con email/password | R11 |
| POST | `/api/auth/refresh` | Renovar JWT token | R11 |
| POST | `/api/tenant/invite` | Invitar usuario al tenant | R1 |
| GET | `/api/tenant/members` | Listar miembros del tenant | R1 |
| PATCH | `/api/tenant/members/:id` | Actualizar rol de miembro | R1 |

#### WhatsApp Sessions

| Método | Ruta | Propósito | Req. |
|--------|------|-----------|------|
| POST | `/api/whatsapp/sessions` | Crear nueva sesión | R2 |
| GET | `/api/whatsapp/sessions` | Listar sesiones | R2 |
| DELETE | `/api/whatsapp/sessions/:id` | Eliminar sesión | R2 |
| POST | `/api/whatsapp/sessions/:id/test` | Verificar conexión | R2 |
| POST | `/api/whatsapp/webhook` | Webhook de Meta | R2 |

#### Agentes IA

| Método | Ruta | Propósito | Req. |
|--------|------|-----------|------|
| POST | `/api/agents` | Crear agente IA | R3 |
| GET | `/api/agents` | Listar agentes | R3 |
| PATCH | `/api/agents/:id` | Actualizar prompt/config | R3 |
| DELETE | `/api/agents/:id` | Eliminar agente | R3 |
| POST | `/api/agents/:id/assign` | Asignar a sesiones WA | R3 |
| POST | `/api/agents/:id/knowledge` | Subir documento KB | R3, R12 |
| DELETE | `/api/agents/:id/knowledge/:docId` | Eliminar documento | R12 |

#### Conversaciones

| Método | Ruta | Propósito | Req. |
|--------|------|-----------|------|
| GET | `/api/conversations` | Listar (paginado, filtros) | R5 |
| GET | `/api/conversations/:id/messages` | Obtener mensajes | R5 |
| POST | `/api/conversations/:id/messages` | Enviar mensaje humano | R4, R5 |
| POST | `/api/conversations/:id/handoff/accept` | Aceptar handoff | R4 |
| POST | `/api/conversations/:id/handoff/release` | Devolver a IA | R4 |

#### Pipeline y Leads

| Método | Ruta | Propósito | Req. |
|--------|------|-----------|------|
| GET | `/api/pipeline/stages` | Obtener etapas | R6 |
| POST | `/api/pipeline/stages` | Crear etapa | R6 |
| PATCH | `/api/pipeline/stages/:id` | Editar etapa | R6 |
| DELETE | `/api/pipeline/stages/:id` | Eliminar (con migración) | R6 |
| PATCH | `/api/pipeline/stages/reorder` | Reordenar | R6 |
| GET | `/api/leads` | Listar leads | R6 |
| PATCH | `/api/leads/:id/stage` | Mover lead de etapa | R6 |

#### Scoring, Follow-Up, Dashboard

| Método | Ruta | Propósito | Req. |
|--------|------|-----------|------|
| GET | `/api/scoring/config` | Obtener config scoring | R7 |
| PUT | `/api/scoring/config` | Actualizar config | R7 |
| GET | `/api/followup/sequences` | Listar secuencias | R8 |
| POST | `/api/followup/sequences` | Crear secuencia | R8 |
| GET | `/api/dashboard/metrics` | Métricas principales | R9 |
| GET | `/api/dashboard/charts` | Datos de gráficos | R9 |

#### Integraciones e Inventario

| Método | Ruta | Propósito | Req. |
|--------|------|-----------|------|
| GET | `/api/integrations` | Listar integraciones | R13 |
| POST | `/api/integrations/ai-provider` | Configurar proveedor IA | R13 |
| POST | `/api/integrations/ai-provider/test` | Validar API key | R13 |
| POST | `/api/integrations/dropi` | Configurar Dropi | R13 |
| POST | `/api/integrations/gdrive` | Iniciar OAuth GDrive | R13 |
| GET | `/api/inventory/products` | Listar productos | R14 |
| GET | `/api/inventory/orders` | Listar pedidos | R14 |

#### Cron Jobs (Vercel Cron)

| Método | Ruta | Propósito | Req. |
|--------|------|-----------|------|
| POST | `/api/cron/followup` | Ejecutar follow-ups | R8 |
| POST | `/api/cron/dropi-sync` | Sincronizar Dropi | R14 |
| POST | `/api/cron/gdrive-sync` | Sincronizar GDrive | R12 |
| POST | `/api/cron/session-health` | Verificar sesiones WA | R2 |

### Webhook WhatsApp (Flujo Detallado)

```typescript
// POST /api/whatsapp/webhook
// 1. Verificar firma HMAC-SHA256 del webhook (app_secret)
// 2. Extraer mensaje del payload de Meta
// 3. Identificar session por phone_number_id
// 4. Buscar/crear Lead por número del remitente
// 5. Buscar/crear Conversación activa
// 6. Guardar mensaje en DB (triggers Realtime broadcast)
// 7. IF conversación controlada por IA:
//    a. Buscar contexto RAG en knowledge_chunks (pgvector similarity)
//    b. Construir prompt: system_prompt + RAG context + últimos 10 mensajes
//    c. Llamar al proveedor IA configurado via router
//    d. Evaluar si requiere handoff (handoff-detector)
//    e. Enviar respuesta vía WhatsApp Cloud API
//    f. Recalcular lead scoring (async, no bloquea respuesta)
// 8. IF conversación controlada por humano:
//    a. Solo notificar al agente asignado vía Realtime
```

## Data Models

### Esquema de Base de Datos (Supabase/PostgreSQL)

#### Tabla: `tenants`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Identificador único |
| name | varchar(255) | NOT NULL | Nombre de la empresa |
| plan | varchar(50) | DEFAULT 'free' | Plan de suscripción |
| settings | jsonb | DEFAULT '{}' | Configuración general (timezone, business_hours) |
| created_at | timestamptz | DEFAULT now() | Fecha de creación |

#### Tabla: `users`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id, NOT NULL | Tenant al que pertenece |
| auth_user_id | uuid | UNIQUE, NOT NULL | ID de Supabase Auth |
| email | varchar(255) | NOT NULL | Correo electrónico |
| name | varchar(255) | NOT NULL | Nombre completo |
| role | varchar(20) | NOT NULL, CHECK IN ('admin','supervisor','agent') | Rol del usuario |
| status | varchar(20) | DEFAULT 'available' | Estado: available, busy, offline |
| created_at | timestamptz | DEFAULT now() | Fecha de creación |

#### Tabla: `whatsapp_sessions`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| phone_number_id | varchar(100) | NOT NULL | Phone Number ID de Meta |
| waba_id | varchar(100) | NOT NULL | WhatsApp Business Account ID |
| access_token_encrypted | text | NOT NULL | Token cifrado AES-256 |
| display_name | varchar(100) | | Nombre visible |
| status | varchar(20) | DEFAULT 'connected' | connected, reconnecting, disconnected |
| ai_agent_id | uuid | FK → ai_agents.id, NULLABLE | Agente IA asignado |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `ai_providers`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| provider_type | varchar(50) | NOT NULL | openrouter, openai, anthropic, custom |
| api_key_encrypted | text | NOT NULL | API key cifrada |
| model_name | varchar(100) | | Modelo preferido |
| is_valid | boolean | DEFAULT false | Última validación exitosa |
| last_validated_at | timestamptz | | Fecha última validación |

#### Tabla: `ai_agents`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| name | varchar(100) | NOT NULL | Nombre del agente |
| system_prompt | text | NOT NULL, max 4000 chars | Prompt de sistema |
| provider_id | uuid | FK → ai_providers.id | Proveedor IA a usar |
| status | varchar(20) | DEFAULT 'active' | active, inactive |
| handoff_keywords | jsonb | DEFAULT '[]' | Palabras que disparan handoff |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `leads`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| phone_number | varchar(20) | NOT NULL | Número de WhatsApp |
| name | varchar(255) | | Nombre del lead |
| email | varchar(255) | | Email (si disponible) |
| stage_id | uuid | FK → pipeline_stages.id | Etapa actual del pipeline |
| score | integer | DEFAULT 0, CHECK 0-100 | Puntuación de calificación |
| score_category | varchar(10) | DEFAULT 'cold' | cold, warm, hot |
| stage_entered_at | timestamptz | DEFAULT now() | Cuándo entró a la etapa actual |
| metadata | jsonb | DEFAULT '{}' | Datos adicionales (ciudad, etc.) |
| converted | boolean | DEFAULT false | Si ya fue convertido |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `conversations`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| lead_id | uuid | FK → leads.id | Lead asociado |
| session_id | uuid | FK → whatsapp_sessions.id | Sesión WA asociada |
| status | varchar(20) | DEFAULT 'pending' | pending, active, resolved |
| controlled_by | varchar(10) | DEFAULT 'ai' | 'ai' o 'human' |
| assigned_to | uuid | FK → users.id, NULLABLE | Agente humano asignado |
| ai_agent_id | uuid | FK → ai_agents.id | Agente IA de la conversación |
| handoff_requested_at | timestamptz | NULLABLE | Momento del request de handoff |
| last_message_at | timestamptz | | Último mensaje recibido |
| unread_count | integer | DEFAULT 0 | Mensajes no leídos |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `messages`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| conversation_id | uuid | FK → conversations.id | Conversación padre |
| tenant_id | uuid | FK → tenants.id | Tenant (para RLS) |
| sender_type | varchar(10) | NOT NULL | 'lead', 'ai', 'human' |
| sender_id | uuid | NULLABLE | user_id si es humano |
| content | text | NOT NULL | Contenido del mensaje |
| media_url | text | NULLABLE | URL de media (imagen, etc.) |
| wa_message_id | varchar(100) | NULLABLE | ID del mensaje en WhatsApp |
| status | varchar(20) | DEFAULT 'sent' | sent, delivered, read, failed |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `pipeline_stages`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| name | varchar(100) | NOT NULL | Nombre de la etapa |
| position | integer | NOT NULL | Orden en el pipeline |
| color | varchar(7) | | Color hex para la UI |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `follow_up_sequences`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| name | varchar(100) | NOT NULL | Nombre de la secuencia |
| messages | jsonb | NOT NULL | Array de mensajes [{content, delay_hours}] |
| stop_conditions | jsonb | DEFAULT '[]' | Condiciones de parada |
| business_hours | jsonb | | Ventana horaria {start, end, timezone, days} |
| is_active | boolean | DEFAULT true | Si está activa |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `follow_up_tasks`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant (para RLS) |
| sequence_id | uuid | FK → follow_up_sequences.id | Secuencia padre |
| lead_id | uuid | FK → leads.id | Lead objetivo |
| conversation_id | uuid | FK → conversations.id | Conversación asociada |
| step_index | integer | NOT NULL | Paso actual (0-based) |
| scheduled_at | timestamptz | NOT NULL | Momento programado de envío |
| status | varchar(20) | DEFAULT 'pending' | pending, sent, failed, cancelled |
| attempts | integer | DEFAULT 0 | Intentos de envío |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `knowledge_docs`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| agent_id | uuid | FK → ai_agents.id | Agente asociado |
| filename | varchar(255) | NOT NULL | Nombre del archivo |
| source_type | varchar(20) | NOT NULL | 'pdf', 'google_sheets', 'gdrive_pdf' |
| size_bytes | integer | NOT NULL | Tamaño en bytes |
| status | varchar(20) | DEFAULT 'processing' | processing, ready, error |
| gdrive_file_id | varchar(255) | NULLABLE | ID del archivo en GDrive |
| storage_path | text | NULLABLE | Path en Supabase Storage |
| last_synced_at | timestamptz | | Última sincronización |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `knowledge_chunks`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| doc_id | uuid | FK → knowledge_docs.id, ON DELETE CASCADE | Documento padre |
| tenant_id | uuid | FK → tenants.id | Tenant (para RLS) |
| content | text | NOT NULL | Texto del fragmento |
| embedding | vector(1536) | NOT NULL | Embedding vectorial |
| metadata | jsonb | DEFAULT '{}' | {page_number, chunk_index} |
| content_hash | varchar(64) | | SHA-256 del contenido (cache) |

#### Tabla: `integrations`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| type | varchar(50) | NOT NULL | 'dropi', 'gdrive' |
| config_encrypted | text | NOT NULL | Config cifrada (tokens, keys) |
| status | varchar(20) | DEFAULT 'inactive' | active, inactive, error |
| last_sync_at | timestamptz | | Última sincronización exitosa |
| error_message | text | NULLABLE | Último error |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `products`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| dropi_id | varchar(100) | | ID en Dropi |
| name | varchar(255) | NOT NULL | Nombre del producto |
| price | decimal(10,2) | NOT NULL | Precio |
| stock | integer | DEFAULT 0 | Stock disponible |
| variants | jsonb | DEFAULT '[]' | Variantes del producto |
| last_synced_at | timestamptz | | Última sincronización |

#### Tabla: `orders`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| lead_id | uuid | FK → leads.id | Lead que realizó el pedido |
| conversation_id | uuid | FK → conversations.id | Conversación donde se creó |
| dropi_order_id | varchar(100) | NULLABLE | ID del pedido en Dropi |
| items | jsonb | NOT NULL | Array de productos [{product_id, qty, price}] |
| shipping_address | jsonb | NOT NULL | {name, address, city, phone} |
| status | varchar(20) | DEFAULT 'pending' | pending, created, failed |
| error_message | text | NULLABLE | Mensaje de error si falló |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `scoring_config`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id, UNIQUE | Tenant propietario (1 config por tenant) |
| criteria | jsonb | NOT NULL | [{name, type, weight}] |
| thresholds | jsonb | NOT NULL | {cold: [0,33], warm: [34,66], hot: [67,100]} |
| keywords | jsonb | DEFAULT '[]' | [{word, weight}] |
| updated_at | timestamptz | DEFAULT now() | |

#### Tabla: `notifications`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| user_id | uuid | FK → users.id | Usuario destinatario |
| type | varchar(50) | NOT NULL | handoff_request, score_change, followup_failed, etc. |
| title | varchar(255) | NOT NULL | Título |
| body | text | | Cuerpo del mensaje |
| read | boolean | DEFAULT false | Si fue leída |
| metadata | jsonb | DEFAULT '{}' | Datos adicionales |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `audit_logs`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant propietario |
| user_id | uuid | FK → users.id, NULLABLE | Usuario que ejecutó la acción |
| action | varchar(50) | NOT NULL | create, update, delete, access_denied |
| resource_type | varchar(50) | NOT NULL | Tipo de recurso afectado |
| resource_id | uuid | | ID del recurso |
| metadata | jsonb | DEFAULT '{}' | Detalles adicionales |
| created_at | timestamptz | DEFAULT now() | |

#### Tabla: `invitations`

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| id | uuid | PK | Identificador único |
| tenant_id | uuid | FK → tenants.id | Tenant que invita |
| email | varchar(255) | NOT NULL | Email del invitado |
| role | varchar(20) | NOT NULL | Rol a asignar |
| token | varchar(100) | UNIQUE, NOT NULL | Token de invitación |
| accepted | boolean | DEFAULT false | Si fue aceptada |
| expires_at | timestamptz | NOT NULL | Expiración (72h desde creación) |
| created_at | timestamptz | DEFAULT now() | |

### Índices Clave

```sql
-- Performance crítica
CREATE INDEX idx_conversations_tenant_status ON conversations(tenant_id, status);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_leads_tenant_stage ON leads(tenant_id, stage_id);
CREATE INDEX idx_leads_tenant_score ON leads(tenant_id, score DESC);
CREATE INDEX idx_follow_up_tasks_scheduled ON follow_up_tasks(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;

-- Búsqueda vectorial (pgvector)
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Row-Level Security (RLS)

```sql
-- Política aplicada a TODAS las tablas con tenant_id
-- Ejemplo para 'leads':
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON leads
  FOR ALL
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Política para messages (via conversation tenant_id)
CREATE POLICY "tenant_isolation" ON messages
  FOR ALL
  USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);
```

## Error Handling

### Estrategia General

| Tipo de Error | Manejo | Ejemplo |
|--------------|--------|---------|
| Validación de entrada | Retorno inmediato con 400 + mensaje descriptivo | API key vacía, archivo > 10MB |
| Autenticación | 401 + redirect a login | JWT expirado |
| Autorización | 403 + log en audit_logs | Agente intenta config de admin |
| Recurso no encontrado | 404 | Lead no existe en el tenant |
| Error de servicio externo | Retry con backoff + notificación | WhatsApp API caída, Dropi timeout |
| Error interno | 500 + log detallado (sin exponer internals al user) | Query fallida |
| Rate limiting | 429 + Retry-After header | Exceso de requests por tenant |

### Retry Policies

| Servicio | Max Retries | Backoff | Timeout |
|----------|-------------|---------|---------|
| WhatsApp Cloud API | 3 | Exponential (1s, 2s, 4s) | 15s |
| AI Providers | 2 | Exponential (1s, 3s) | 30s |
| Dropi API | 3 | Fixed (5s) | 60s |
| Google Drive | 3 | Exponential (5s, 15s, 30s) | 30s |
| Follow-up envío | 3 | Fixed (5min) | 15s |

### Manejo de Errores en Webhook WhatsApp

```typescript
// Si el procesamiento del webhook falla:
// 1. Siempre retornar 200 a Meta (evitar re-envíos infinitos)
// 2. Guardar el mensaje raw en una tabla de "dead_letter" para reprocesamiento
// 3. Loguear el error con contexto completo
// 4. Notificar al admin si es un error recurrente (>3 fallos en 5 min)
```

### Circuit Breaker para Integraciones

```typescript
// Si una integración falla 3 veces consecutivas:
// 1. Marcar status = 'error' en tabla integrations
// 2. Notificar al administrador
// 3. No reintentar hasta que el admin re-configure o pase 1 hora
// 4. Las operaciones dependientes (AI responses, orders) usan fallback graceful
```

## Correctness Properties

### Property 1: Aislamiento de Tenant

Ninguna operación de lectura o escritura puede acceder a datos de un `tenant_id` diferente al del usuario autenticado. Garantizado por RLS de PostgreSQL y middleware de Next.js. Toda tabla con `tenant_id` tiene política RLS que compara contra `auth.jwt() -> 'app_metadata' ->> 'tenant_id'`.

**Validates: Requirements 1.2, 1.4, 11.4**

### Property 2: Consistencia de Handoff

Una conversación solo puede estar controlada por IA o por un humano, nunca ambos simultáneamente. El campo `controlled_by` es atómico (enum: 'ai' | 'human') y las operaciones de handoff usan transacciones para actualizar `controlled_by`, `assigned_to` y `handoff_requested_at` de forma atómica.

**Validates: Requirements 4.2, 4.3, 4.7**

### Property 3: Unicidad de Lead por Teléfono

Dentro de un tenant, un número de teléfono corresponde a exactamente un lead. Garantizado por índice UNIQUE en `(tenant_id, phone_number)`. Las operaciones de creación usan `ON CONFLICT DO NOTHING` para evitar duplicados en condiciones de concurrencia.

**Validates: Requirements 2.4, 2.5**

### Property 4: Integridad del Pipeline

Un tenant siempre tiene entre 2 y 20 etapas en su pipeline. Validado en la capa de aplicación antes de INSERT/DELETE. Las operaciones de eliminación requieren migración de leads a otra etapa antes de completarse. Un nuevo tenant siempre se crea con 5 etapas por defecto.

**Validates: Requirements 6.4, 6.5, 6.8**

### Property 5: Cifrado de Secrets

Ninguna API key o token de acceso se almacena en texto plano en la base de datos. Todo secreto pasa por `encrypt()` (AES-256-GCM) antes del INSERT y `decrypt()` solo ocurre en server-side runtime. Las columnas `*_encrypted` nunca se retornan en respuestas de API.

**Validates: Requirements 11.3**

### Property 6: Scoring dentro de Rango

La Calificación_Lead es siempre un entero entre 0 y 100. La categoría ('cold', 'warm', 'hot') siempre corresponde a los umbrales configurados en `scoring_config`. Validado por CHECK constraint `score >= 0 AND score <= 100` en la tabla `leads` y por la función `calculateScore()`.

**Validates: Requirements 7.3, 7.7**

### Property 7: Follow-up No Duplicado

Un lead solo puede tener una secuencia de follow-up activa (`status = 'pending'`) a la vez. Si se activa una nueva secuencia, todas las tasks pendientes de la anterior se marcan como `cancelled`. Validado en la lógica de creación de follow-up tasks.

**Validates: Requirements 8.3, 8.6**

### Property 8: Orden del Pipeline

Las etapas del pipeline siempre tienen posiciones únicas y consecutivas (1, 2, 3...) dentro del tenant. Las operaciones de reorden son atómicas: se ejecutan dentro de una transacción que actualiza todas las posiciones en un solo batch. UNIQUE constraint en `(tenant_id, position)` con deferrable initial deferred.

**Validates: Requirements 6.4**

### Precondiciones y Postcondiciones Clave

| Operación | Precondición | Postcondición |
|-----------|--------------|---------------|
| Aceptar Handoff | Conversación con `handoff_requested_at` != null, user con status "available" | `controlled_by` = 'human', `assigned_to` = user_id, otros agentes no ven el handoff |
| Enviar Follow-Up | Task con status 'pending', scheduled_at <= now(), dentro de business_hours | Mensaje enviado vía WA API, task status = 'sent', step_index no cambia |
| Crear Pedido | Lead con datos completos, stock suficiente, integración Dropi activa | Order creado en Dropi, registro en tabla orders, stock actualizado en próxima sync |
| Subir PDF KB | Archivo ≤ 10MB, total tenant ≤ 50MB, formato PDF válido con texto extraíble | Documento en Storage, chunks con embeddings en knowledge_chunks, status = 'ready' |

## Testing Strategy

### Niveles de Testing

| Nivel | Herramienta | Alcance | Requisitos Cubiertos |
|-------|------------|---------|---------------------|
| Unit Tests | Vitest | lib/ (encryption, scoring, rag, parsers) | R7, R11, R12 |
| Integration Tests | Vitest + Supabase local | API Routes con DB real | R1-R14 |
| E2E Tests | Playwright | Flujos completos de usuario | R5, R6, R9, R10 |
| Component Tests | Vitest + Testing Library | Componentes React aislados | R10 |

### Casos de Test Críticos

1. **Multitenant isolation**: Crear 2 tenants, verificar que queries de tenant A nunca retornan datos de tenant B.
2. **Webhook processing**: Simular payload de Meta, verificar creación de lead + message + trigger de AI.
3. **Handoff flow**: Simular IA que detecta handoff → notificación → aceptación → suspensión de IA → release.
4. **Pipeline drag-and-drop**: Mover lead entre etapas, verificar persistencia y rollback en caso de error.
5. **Scoring calculation**: Enviar mensajes con keywords, verificar recálculo de score y cambio de categoría.
6. **Follow-up scheduling**: Crear secuencia, verificar que cron ejecuta en horario correcto y respeta parada.
7. **RAG retrieval**: Subir PDF, verificar chunking + embedding, luego query semántica retorna chunks relevantes.
8. **Encryption roundtrip**: Cifrar API key → almacenar → recuperar → descifrar → verificar igualdad.
9. **Rate limiting**: Enviar >100 requests/min desde un tenant, verificar respuesta 429.
10. **Session health**: Simular desconexión de sesión WA, verificar retry + notificación + status change.

### Mocking de Servicios Externos

```typescript
// En tests, los servicios externos se mockean:
// - WhatsApp API: MSW (Mock Service Worker) intercepta llamadas a graph.facebook.com
// - AI Providers: Mock responses con latencia simulada
// - Dropi: Mock de catálogo y creación de pedidos
// - Google Drive: Mock de OAuth flow y listado de archivos
```

## Traceability Matrix

| Requisito | Componentes de Diseño |
|-----------|----------------------|
| R1: Gestión Multitenant | `tenants` + `users` + `invitations` tables, RLS policies, JWT claims, `middleware.ts`, `/api/auth/register`, `/api/tenant/invite` |
| R2: WhatsApp Business API | `whatsapp_sessions` table, `/api/whatsapp/webhook`, `lib/whatsapp/client.ts`, `/api/cron/session-health` |
| R3: Agentes IA | `ai_agents` + `ai_providers` tables, `/api/agents/*`, `lib/ai/router.ts`, `agent-form.tsx`, `provider-selector.tsx` |
| R4: Handoff | `conversations.controlled_by`, `/api/conversations/:id/handoff/*`, `handoff-banner.tsx`, Realtime notifications |
| R5: Panel Conversaciones | `conversations` + `messages` tables, `/api/conversations/*`, `conversation-list.tsx`, `chat-window.tsx`, Realtime |
| R6: Pipeline | `pipeline_stages` + `leads.stage_id`, `/api/pipeline/*`, `kanban-board.tsx`, @dnd-kit, optimistic updates |
| R7: Calificación Leads | `scoring_config` + `leads.score/score_category`, `/api/scoring/*`, `lib/ai/scoring.ts`, notifications |
| R8: Follow-Up | `follow_up_sequences` + `follow_up_tasks`, `/api/followup/*`, `/api/cron/followup`, business_hours logic |
| R9: Dashboard | `/api/dashboard/*`, `metric-card.tsx`, `line-chart.tsx`, `bar-chart.tsx`, `circular-progress.tsx`, Recharts |
| R10: UI/UX | `sidebar.tsx` (verde/teal), Tailwind theme, shadcn/ui, responsive breakpoints, WCAG 4.5:1 contrast |
| R11: Autenticación | Supabase Auth, `middleware.ts`, `lib/encryption.ts`, RLS, `audit_logs` table, role-based access |
| R12: Base Conocimiento | `knowledge_docs` + `knowledge_chunks` (pgvector), `lib/rag.ts`, `lib/pdf-parser.ts`, `/api/cron/gdrive-sync` |
| R13: Integraciones | `integrations` table, `/api/integrations/*`, `integration-card.tsx`, status monitoring, circuit breaker |
| R14: Inventario/Pedidos | `products` + `orders` tables, `/api/inventory/*`, `lib/dropi/client.ts`, `/api/cron/dropi-sync` |
