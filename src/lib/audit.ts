import { createAdminClient } from "@/lib/supabase/admin";

interface AuditLogParams {
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Logs an action to the audit_logs table
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: params.tenantId,
    user_id: params.userId || null,
    action: params.action,
    resource_type: params.resourceType,
    resource_id: params.resourceId || null,
    details: params.details || {},
    ip_address: params.ipAddress || null,
  });

  if (error) {
    console.error("Audit log error:", error);
  }
}

/**
 * Common audit actions
 */
export const AuditActions = {
  ACCESS_DENIED: "access_denied",
  ROLE_CHANGED: "role_changed",
  MEMBER_INVITED: "member_invited",
  MEMBER_REMOVED: "member_removed",
  INTEGRATION_CONFIGURED: "integration_configured",
  INTEGRATION_DISCONNECTED: "integration_disconnected",
  AGENT_CREATED: "agent_created",
  AGENT_DELETED: "agent_deleted",
  SESSION_CREATED: "session_created",
  SESSION_DELETED: "session_deleted",
  DATA_EXPORTED: "data_exported",
  SETTINGS_UPDATED: "settings_updated",
} as const;
