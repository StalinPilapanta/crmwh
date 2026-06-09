-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Conversations
CREATE INDEX idx_conversations_tenant_status ON conversations(tenant_id, status);
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);

-- Leads
CREATE INDEX idx_leads_tenant_stage ON leads(tenant_id, stage_id);
CREATE INDEX idx_leads_tenant_score ON leads(tenant_id, score DESC);
CREATE INDEX idx_leads_phone ON leads(tenant_id, phone_number);

-- Follow-up tasks
CREATE INDEX idx_follow_up_tasks_scheduled ON follow_up_tasks(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_follow_up_tasks_lead ON follow_up_tasks(lead_id, status);

-- Notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;

-- Knowledge chunks - Vector index (IVFFlat for cosine similarity)
CREATE INDEX idx_knowledge_chunks_embedding ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_knowledge_chunks_document ON knowledge_chunks(document_id);

-- Audit logs
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);

-- WhatsApp sessions
CREATE INDEX idx_whatsapp_sessions_tenant ON whatsapp_sessions(tenant_id);

-- Products
CREATE INDEX idx_products_tenant ON products(tenant_id, is_active);

-- Orders
CREATE INDEX idx_orders_tenant ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_lead ON orders(lead_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Helper function to get tenant_id from JWT
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper function to get user role from JWT
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ===== TENANTS =====
CREATE POLICY "tenants_select" ON tenants
  FOR SELECT USING (id = get_tenant_id());

CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (id = get_tenant_id() AND get_user_role() = 'admin');

-- ===== USERS =====
CREATE POLICY "users_select" ON users
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (tenant_id = get_tenant_id());

-- ===== INVITATIONS =====
CREATE POLICY "invitations_select" ON invitations
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "invitations_delete" ON invitations
  FOR DELETE USING (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

-- ===== WHATSAPP SESSIONS =====
CREATE POLICY "whatsapp_sessions_select" ON whatsapp_sessions
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "whatsapp_sessions_insert" ON whatsapp_sessions
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

CREATE POLICY "whatsapp_sessions_update" ON whatsapp_sessions
  FOR UPDATE USING (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

CREATE POLICY "whatsapp_sessions_delete" ON whatsapp_sessions
  FOR DELETE USING (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

-- ===== AI PROVIDERS =====
CREATE POLICY "ai_providers_select" ON ai_providers
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "ai_providers_insert" ON ai_providers
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

CREATE POLICY "ai_providers_update" ON ai_providers
  FOR UPDATE USING (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

CREATE POLICY "ai_providers_delete" ON ai_providers
  FOR DELETE USING (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

-- ===== AI AGENTS =====
CREATE POLICY "ai_agents_select" ON ai_agents
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "ai_agents_insert" ON ai_agents
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "ai_agents_update" ON ai_agents
  FOR UPDATE USING (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "ai_agents_delete" ON ai_agents
  FOR DELETE USING (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

-- ===== PIPELINE STAGES =====
CREATE POLICY "pipeline_stages_select" ON pipeline_stages
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "pipeline_stages_insert" ON pipeline_stages
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "pipeline_stages_update" ON pipeline_stages
  FOR UPDATE USING (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "pipeline_stages_delete" ON pipeline_stages
  FOR DELETE USING (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

-- ===== LEADS =====
CREATE POLICY "leads_select" ON leads
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "leads_insert" ON leads
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "leads_update" ON leads
  FOR UPDATE USING (tenant_id = get_tenant_id());

-- ===== CONVERSATIONS =====
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (tenant_id = get_tenant_id());

-- ===== MESSAGES =====
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

-- ===== FOLLOW-UP SEQUENCES =====
CREATE POLICY "follow_up_sequences_select" ON follow_up_sequences
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "follow_up_sequences_insert" ON follow_up_sequences
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "follow_up_sequences_update" ON follow_up_sequences
  FOR UPDATE USING (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

CREATE POLICY "follow_up_sequences_delete" ON follow_up_sequences
  FOR DELETE USING (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

-- ===== FOLLOW-UP TASKS =====
CREATE POLICY "follow_up_tasks_select" ON follow_up_tasks
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "follow_up_tasks_insert" ON follow_up_tasks
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "follow_up_tasks_update" ON follow_up_tasks
  FOR UPDATE USING (tenant_id = get_tenant_id());

-- ===== KNOWLEDGE DOCS =====
CREATE POLICY "knowledge_docs_select" ON knowledge_docs
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "knowledge_docs_insert" ON knowledge_docs
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "knowledge_docs_delete" ON knowledge_docs
  FOR DELETE USING (tenant_id = get_tenant_id());

-- ===== KNOWLEDGE CHUNKS =====
CREATE POLICY "knowledge_chunks_select" ON knowledge_chunks
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "knowledge_chunks_insert" ON knowledge_chunks
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "knowledge_chunks_delete" ON knowledge_chunks
  FOR DELETE USING (tenant_id = get_tenant_id());

-- ===== INTEGRATIONS =====
CREATE POLICY "integrations_select" ON integrations
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "integrations_insert" ON integrations
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

CREATE POLICY "integrations_update" ON integrations
  FOR UPDATE USING (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

CREATE POLICY "integrations_delete" ON integrations
  FOR DELETE USING (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

-- ===== PRODUCTS =====
CREATE POLICY "products_select" ON products
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "products_update" ON products
  FOR UPDATE USING (tenant_id = get_tenant_id());

-- ===== ORDERS =====
CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());

CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (tenant_id = get_tenant_id());

-- ===== SCORING CONFIG =====
CREATE POLICY "scoring_config_select" ON scoring_config
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "scoring_config_insert" ON scoring_config
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

CREATE POLICY "scoring_config_update" ON scoring_config
  FOR UPDATE USING (tenant_id = get_tenant_id() AND get_user_role() IN ('admin', 'supervisor'));

-- ===== NOTIFICATIONS =====
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ===== AUDIT LOGS =====
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (tenant_id = get_tenant_id() AND get_user_role() = 'admin');

CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = get_tenant_id());
