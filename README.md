# CRM WhatsApp SaaS

CRM multi-tenant con integración de WhatsApp Business API, agentes de IA conversacionales, pipeline de ventas, y gestión de inventario via Dropi. Diseñado para equipos de ventas que atienden leads por WhatsApp.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (CSS-only config)
- **Database**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **State**: Zustand + React Query
- **UI**: Lucide React, Recharts, dnd-kit
- **AI**: OpenAI / Anthropic / OpenRouter (configurable por tenant)
- **Mensajería**: WhatsApp Business Cloud API (Meta)
- **Inventario**: Dropi (dropshipping)

## Arquitectura

```
src/
├── app/
│   ├── (auth)/          # Login, registro, invitaciones
│   ├── (dashboard)/     # Panel principal (layout con sidebar)
│   │   ├── agents/      # Configuración de agentes IA
│   │   ├── conversations/ # Chat en tiempo real
│   │   ├── integrations/  # Dropi, AI providers
│   │   ├── inventory/     # Productos y órdenes
│   │   ├── leads/         # Gestión de leads
│   │   ├── pipeline/      # Kanban de ventas
│   │   └── settings/      # Config: equipo, scoring, followup, WhatsApp
│   └── api/
│       ├── agents/        # CRUD agentes + knowledge base
│       ├── conversations/ # Conversaciones + handoff
│       ├── cron/          # Jobs: followup, session-health, dropi-sync
│       ├── integrations/  # Dropi, AI provider config
│       ├── inventory/     # Productos y órdenes
│       ├── whatsapp/      # Webhook + sesiones
│       └── ...
├── components/
│   ├── agents/          # Knowledge upload
│   ├── conversations/   # Chat window, message bubble, handoff
│   ├── layout/          # Sidebar, header, user menu
│   ├── pipeline/        # Kanban board
│   └── shared/          # Empty state, skeleton
├── hooks/               # useRealtime, useConversations, useNotifications, useTenant
├── lib/
│   ├── ai/             # Router, RAG, scoring, handoff detector
│   ├── dropi/          # Client + types para Dropi API
│   ├── supabase/       # Server, client, admin clients
│   ├── whatsapp/       # Client + webhook verify
│   ├── encryption.ts   # AES-256-GCM encrypt/decrypt
│   ├── notifications.ts # Create notifications helpers
│   ├── permissions.ts  # Role-based permission checks
│   ├── rate-limit.ts   # In-memory rate limiter
│   └── utils.ts        # cn() utility
└── proxy.ts            # Middleware (Next.js 16 convention)
```

## Setup

### Requisitos

- Node.js 18+
- Cuenta de Supabase
- WhatsApp Business API (Meta Cloud)
- Cuenta de Dropi (opcional, para inventario)

### Instalación

```bash
# Clonar e instalar dependencias
git clone <repo-url>
cd crmwh
npm install

# Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales

# Ejecutar migraciones en Supabase
# (aplicar archivos en supabase/migrations/ en orden)

# Iniciar servidor de desarrollo
npm run dev
```

### Scripts

| Comando          | Descripción                    |
|-----------------|--------------------------------|
| `npm run dev`   | Servidor de desarrollo         |
| `npm run build` | Build de producción            |
| `npm run start` | Iniciar en modo producción     |
| `npm run lint`  | Ejecutar ESLint                |

## Variables de Entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin ops) | ✅ |
| `WHATSAPP_VERIFY_TOKEN` | Token para verificar webhook de Meta | ✅ |
| `WHATSAPP_APP_SECRET` | App secret para validar HMAC | ✅ |
| `ENCRYPTION_KEY` | Key hex de 32 bytes para AES-256-GCM | ✅ |
| `CRON_SECRET` | Bearer token para proteger cron endpoints | ✅ |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app | ✅ |
| `OPENAI_API_KEY` | API key de OpenAI | Opcional |
| `ANTHROPIC_API_KEY` | API key de Anthropic | Opcional |
| `OPENROUTER_API_KEY` | API key de OpenRouter | Opcional |
| `GOOGLE_CLIENT_ID` | OAuth client ID para Google Drive | Opcional |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Opcional |
| `GOOGLE_REDIRECT_URI` | Redirect URI para OAuth | Opcional |

## Características Principales

- **Multi-tenant**: Aislamiento completo por organización via RLS
- **Agentes IA**: Respuesta automática con RAG sobre documentos del negocio
- **Handoff inteligente**: Detección de intención de hablar con humano + timeout automático
- **Pipeline de ventas**: Kanban drag & drop con etapas configurables
- **Lead scoring**: Scoring automático basado en comportamiento
- **Follow-up automático**: Secuencias programables con horario laboral
- **Inventario Dropi**: Sincronización de productos y creación de órdenes
- **Tiempo real**: Actualizaciones instantáneas via Supabase Realtime
- **Roles**: Admin, Supervisor, Agente con permisos granulares
- **Rate limiting**: Protección por tenant contra abuso
