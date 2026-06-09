import { createAdminClient } from "@/lib/supabase/admin";

interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

/**
 * Creates a notification for a specific user.
 * Uses admin client to bypass RLS.
 */
export async function createNotification(params: CreateNotificationParams) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("notifications").insert({
    tenant_id: params.tenantId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body || null,
    data: params.data || {},
  });

  if (error) {
    console.error("Error creating notification:", error);
  }
}

/**
 * Creates notifications for multiple users (e.g., all agents in a tenant)
 */
export async function notifyTenantUsers(
  tenantId: string,
  roles: string[],
  type: string,
  title: string,
  body?: string,
  data?: Record<string, unknown>
) {
  const supabase = createAdminClient();

  // Get users with matching roles
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("role", roles)
    .eq("status", "available");

  if (!users || users.length === 0) return;

  const notifications = users.map((user) => ({
    tenant_id: tenantId,
    user_id: user.id,
    type,
    title,
    body: body || null,
    data: data || {},
  }));

  const { error } = await supabase.from("notifications").insert(notifications);
  if (error) {
    console.error("Error creating bulk notifications:", error);
  }
}
