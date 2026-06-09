// Auto-generated types placeholder
// Run `npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase/types.ts`
// to generate actual types from your Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          business_hours: Json;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          business_hours?: Json;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          timezone?: string;
          business_hours?: Json;
          settings?: Json;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          full_name: string;
          role: "admin" | "supervisor" | "agent";
          status: "available" | "busy" | "offline";
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          email: string;
          full_name: string;
          role?: "admin" | "supervisor" | "agent";
          status?: "available" | "busy" | "offline";
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          email?: string;
          full_name?: string;
          role?: "admin" | "supervisor" | "agent";
          status?: "available" | "busy" | "offline";
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          role: "admin" | "supervisor" | "agent";
          token: string;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          email: string;
          role?: "admin" | "supervisor" | "agent";
          token: string;
          invited_by: string;
          expires_at: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string;
          role?: "admin" | "supervisor" | "agent";
          expires_at?: string;
          accepted_at?: string | null;
        };
      };
      whatsapp_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          phone_number_id: string;
          display_phone: string;
          business_account_id: string;
          access_token_encrypted: string;
          status: "active" | "disconnected" | "error";
          last_health_check: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          phone_number_id: string;
          display_phone: string;
          business_account_id: string;
          access_token_encrypted: string;
          status?: "active" | "disconnected" | "error";
          last_health_check?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          phone_number_id?: string;
          display_phone?: string;
          business_account_id?: string;
          access_token_encrypted?: string;
          status?: "active" | "disconnected" | "error";
          last_health_check?: string | null;
          updated_at?: string;
        };
      };
      ai_providers: {
        Row: {
          id: string;
          tenant_id: string;
          provider_type: "openrouter" | "openai" | "anthropic";
          api_key_encrypted: string;
          model: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          provider_type: "openrouter" | "openai" | "anthropic";
          api_key_encrypted: string;
          model: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider_type?: "openrouter" | "openai" | "anthropic";
          api_key_encrypted?: string;
          model?: string;
          is_default?: boolean;
          updated_at?: string;
        };
      };
      ai_agents: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          system_prompt: string;
          provider_id: string | null;
          personality: string;
          temperature: number;
          max_tokens: number;
          is_active: boolean;
          handoff_keywords: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          system_prompt: string;
          provider_id?: string | null;
          personality?: string;
          temperature?: number;
          max_tokens?: number;
          is_active?: boolean;
          handoff_keywords?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          system_prompt?: string;
          provider_id?: string | null;
          personality?: string;
          temperature?: number;
          max_tokens?: number;
          is_active?: boolean;
          handoff_keywords?: string[];
          updated_at?: string;
        };
      };
      pipeline_stages: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          color: string;
          position: number;
          is_won: boolean;
          is_lost: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          color?: string;
          position: number;
          is_won?: boolean;
          is_lost?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          position?: number;
          is_won?: boolean;
          is_lost?: boolean;
          updated_at?: string;
        };
      };
      leads: {
        Row: {
          id: string;
          tenant_id: string;
          phone_number: string;
          name: string | null;
          email: string | null;
          company: string | null;
          notes: string | null;
          score: number;
          score_category: "cold" | "warm" | "hot";
          stage_id: string | null;
          assigned_to: string | null;
          source: string;
          metadata: Json;
          last_contact_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          phone_number: string;
          name?: string | null;
          email?: string | null;
          company?: string | null;
          notes?: string | null;
          score?: number;
          score_category?: "cold" | "warm" | "hot";
          stage_id?: string | null;
          assigned_to?: string | null;
          source?: string;
          metadata?: Json;
          last_contact_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          phone_number?: string;
          name?: string | null;
          email?: string | null;
          company?: string | null;
          notes?: string | null;
          score?: number;
          score_category?: "cold" | "warm" | "hot";
          stage_id?: string | null;
          assigned_to?: string | null;
          source?: string;
          metadata?: Json;
          last_contact_at?: string | null;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          tenant_id: string;
          lead_id: string;
          whatsapp_session_id: string | null;
          ai_agent_id: string | null;
          assigned_to: string | null;
          controlled_by: "ai" | "human";
          status: "active" | "waiting_handoff" | "closed";
          handoff_requested_at: string | null;
          last_message_at: string | null;
          unread_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          lead_id: string;
          whatsapp_session_id?: string | null;
          ai_agent_id?: string | null;
          assigned_to?: string | null;
          controlled_by?: "ai" | "human";
          status?: "active" | "waiting_handoff" | "closed";
          handoff_requested_at?: string | null;
          last_message_at?: string | null;
          unread_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          lead_id?: string;
          whatsapp_session_id?: string | null;
          ai_agent_id?: string | null;
          assigned_to?: string | null;
          controlled_by?: "ai" | "human";
          status?: "active" | "waiting_handoff" | "closed";
          handoff_requested_at?: string | null;
          last_message_at?: string | null;
          unread_count?: number;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          tenant_id: string;
          sender_type: "lead" | "ai" | "human";
          sender_id: string | null;
          content: string;
          message_type: "text" | "image" | "document" | "audio" | "video" | "template";
          whatsapp_message_id: string | null;
          status: "sent" | "delivered" | "read" | "failed";
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          tenant_id: string;
          sender_type: "lead" | "ai" | "human";
          sender_id?: string | null;
          content: string;
          message_type?: "text" | "image" | "document" | "audio" | "video" | "template";
          whatsapp_message_id?: string | null;
          status?: "sent" | "delivered" | "read" | "failed";
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          sender_type?: "lead" | "ai" | "human";
          content?: string;
          message_type?: "text" | "image" | "document" | "audio" | "video" | "template";
          whatsapp_message_id?: string | null;
          status?: "sent" | "delivered" | "read" | "failed";
          metadata?: Json;
        };
      };
      follow_up_sequences: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          steps: Json;
          trigger_condition: string;
          trigger_delay_minutes: number;
          business_hours_only: boolean;
          stop_on_reply: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          steps?: Json;
          trigger_condition?: string;
          trigger_delay_minutes?: number;
          business_hours_only?: boolean;
          stop_on_reply?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          steps?: Json;
          trigger_condition?: string;
          trigger_delay_minutes?: number;
          business_hours_only?: boolean;
          stop_on_reply?: boolean;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      follow_up_tasks: {
        Row: {
          id: string;
          tenant_id: string;
          sequence_id: string;
          lead_id: string;
          conversation_id: string;
          step_index: number;
          scheduled_at: string;
          executed_at: string | null;
          status: "pending" | "executed" | "cancelled" | "failed";
          retry_count: number;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          sequence_id: string;
          lead_id: string;
          conversation_id: string;
          step_index?: number;
          scheduled_at: string;
          executed_at?: string | null;
          status?: "pending" | "executed" | "cancelled" | "failed";
          retry_count?: number;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          step_index?: number;
          scheduled_at?: string;
          executed_at?: string | null;
          status?: "pending" | "executed" | "cancelled" | "failed";
          retry_count?: number;
          error_message?: string | null;
        };
      };
      knowledge_docs: {
        Row: {
          id: string;
          tenant_id: string;
          agent_id: string;
          name: string;
          source_type: "pdf" | "google_sheets" | "text";
          source_url: string | null;
          file_size: number | null;
          chunk_count: number;
          status: "processing" | "ready" | "error";
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          agent_id: string;
          name: string;
          source_type: "pdf" | "google_sheets" | "text";
          source_url?: string | null;
          file_size?: number | null;
          chunk_count?: number;
          status?: "processing" | "ready" | "error";
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          source_type?: "pdf" | "google_sheets" | "text";
          source_url?: string | null;
          file_size?: number | null;
          chunk_count?: number;
          status?: "processing" | "ready" | "error";
          error_message?: string | null;
          updated_at?: string;
        };
      };
      knowledge_chunks: {
        Row: {
          id: string;
          tenant_id: string;
          document_id: string;
          content: string;
          embedding: number[] | null;
          chunk_index: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          document_id: string;
          content: string;
          embedding?: number[] | null;
          chunk_index: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          content?: string;
          embedding?: number[] | null;
          chunk_index?: number;
          metadata?: Json;
        };
      };
      integrations: {
        Row: {
          id: string;
          tenant_id: string;
          type: "dropi" | "google_drive";
          config_encrypted: string | null;
          status: "connected" | "disconnected" | "error";
          last_sync_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          type: "dropi" | "google_drive";
          config_encrypted?: string | null;
          status?: "connected" | "disconnected" | "error";
          last_sync_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          type?: "dropi" | "google_drive";
          config_encrypted?: string | null;
          status?: "connected" | "disconnected" | "error";
          last_sync_at?: string | null;
          error_message?: string | null;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          external_id: string;
          name: string;
          description: string | null;
          price: number;
          stock: number;
          image_url: string | null;
          category: string | null;
          is_active: boolean;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          external_id: string;
          name: string;
          description?: string | null;
          price: number;
          stock?: number;
          image_url?: string | null;
          category?: string | null;
          is_active?: boolean;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          external_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          stock?: number;
          image_url?: string | null;
          category?: string | null;
          is_active?: boolean;
          metadata?: Json;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          tenant_id: string;
          lead_id: string | null;
          external_id: string | null;
          items: Json;
          total: number;
          status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
          shipping_address: Json | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          lead_id?: string | null;
          external_id?: string | null;
          items?: Json;
          total: number;
          status?: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
          shipping_address?: Json | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          lead_id?: string | null;
          external_id?: string | null;
          items?: Json;
          total?: number;
          status?: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
          shipping_address?: Json | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      scoring_config: {
        Row: {
          id: string;
          tenant_id: string;
          criteria: Json;
          keywords_positive: string[];
          keywords_negative: string[];
          thresholds: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          criteria?: Json;
          keywords_positive?: string[];
          keywords_negative?: string[];
          thresholds?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          criteria?: Json;
          keywords_positive?: string[];
          keywords_negative?: string[];
          thresholds?: Json;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          data: Json;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          data?: Json;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          type?: string;
          title?: string;
          body?: string | null;
          data?: Json;
          read?: boolean;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          details: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          action?: string;
          resource_type?: string;
          resource_id?: string | null;
          details?: Json;
          ip_address?: string | null;
        };
      };
    };
    Functions: {
      get_tenant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      match_knowledge_chunks: {
        Args: {
          query_embedding: number[];
          match_tenant_id: string;
          match_agent_id: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: { id: string; content: string; similarity: number }[];
      };
    };
  };
}
