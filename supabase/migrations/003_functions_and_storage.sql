-- =============================================
-- FUNCTION: handle_new_user()
-- Trigger on auth.users creation to assign tenant_id and role
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _tenant_id UUID;
  _role TEXT;
BEGIN
  _tenant_id := (NEW.raw_app_meta_data ->> 'tenant_id')::UUID;
  _role := COALESCE(NEW.raw_app_meta_data ->> 'role', 'agent');

  -- Update the JWT claims
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'tenant_id', _tenant_id::TEXT,
    'role', _role
  )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- =============================================
-- FUNCTION: create_default_pipeline(tenant_uuid)
-- Inserts 5 default pipeline stages
-- =============================================
CREATE OR REPLACE FUNCTION create_default_pipeline(tenant_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO pipeline_stages (tenant_id, name, color, position) VALUES
    (tenant_uuid, 'Nuevo', '#6366F1', 0),
    (tenant_uuid, 'Contactado', '#F59E0B', 1),
    (tenant_uuid, 'Calificado', '#0D9488', 2),
    (tenant_uuid, 'Propuesta', '#8B5CF6', 3),
    (tenant_uuid, 'Cierre', '#10B981', 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNCTION: create_default_scoring_config(tenant_uuid)
-- Creates default scoring configuration
-- =============================================
CREATE OR REPLACE FUNCTION create_default_scoring_config(tenant_uuid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO scoring_config (tenant_id, criteria, keywords_positive, keywords_negative, thresholds)
  VALUES (
    tenant_uuid,
    '[{"name":"engagement","weight":5},{"name":"intent","weight":7},{"name":"budget","weight":6},{"name":"timeline","weight":4}]'::JSONB,
    ARRAY['comprar','precio','cotización','interesado','necesito','urgente','presupuesto'],
    ARRAY['no gracias','no me interesa','cancelar','después'],
    '{"cold":{"min":0,"max":33},"warm":{"min":34,"max":66},"hot":{"min":67,"max":100}}'::JSONB
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNCTION: match_knowledge_chunks (vector search)
-- =============================================
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_tenant_id UUID,
  match_agent_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_docs kd ON kd.id = kc.document_id
  WHERE kc.tenant_id = match_tenant_id
    AND kd.agent_id = match_agent_id
    AND kd.status = 'ready'
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================
-- SUPABASE STORAGE: Knowledge Base bucket
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-base',
  'knowledge-base',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "knowledge_base_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'knowledge-base'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

CREATE POLICY "knowledge_base_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'knowledge-base'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

CREATE POLICY "knowledge_base_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'knowledge-base'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pipeline_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON follow_up_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON knowledge_docs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON scoring_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
