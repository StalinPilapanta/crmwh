type Role = "admin" | "supervisor" | "agent";

/**
 * Define which roles can access each permission.
 * More restrictive permissions list fewer roles.
 */
const PERMISSION_MAP: Record<string, Role[]> = {
  // Tenant management
  "tenant:manage": ["admin"],
  "tenant:view": ["admin", "supervisor", "agent"],

  // Team management
  "team:invite": ["admin"],
  "team:manage": ["admin"],
  "team:view": ["admin", "supervisor"],

  // Conversations
  "conversations:view_all": ["admin", "supervisor"],
  "conversations:view_assigned": ["admin", "supervisor", "agent"],
  "conversations:assign": ["admin", "supervisor"],
  "conversations:handoff_accept": ["admin", "supervisor", "agent"],

  // Leads
  "leads:create": ["admin", "supervisor", "agent"],
  "leads:edit": ["admin", "supervisor", "agent"],
  "leads:delete": ["admin", "supervisor"],
  "leads:view": ["admin", "supervisor", "agent"],

  // Agents (AI)
  "agents:create": ["admin", "supervisor"],
  "agents:edit": ["admin", "supervisor"],
  "agents:delete": ["admin"],
  "agents:view": ["admin", "supervisor", "agent"],

  // Knowledge base
  "knowledge:upload": ["admin", "supervisor"],
  "knowledge:delete": ["admin", "supervisor"],
  "knowledge:view": ["admin", "supervisor", "agent"],

  // Integrations
  "integrations:manage": ["admin"],
  "integrations:view": ["admin", "supervisor"],

  // Settings
  "settings:manage": ["admin"],
  "settings:view": ["admin", "supervisor"],

  // Pipeline
  "pipeline:manage": ["admin", "supervisor"],
  "pipeline:view": ["admin", "supervisor", "agent"],

  // Follow-ups
  "followup:manage": ["admin", "supervisor"],
  "followup:view": ["admin", "supervisor", "agent"],

  // Scoring
  "scoring:manage": ["admin"],
  "scoring:view": ["admin", "supervisor"],

  // Notifications
  "notifications:view": ["admin", "supervisor", "agent"],

  // Inventory / Orders
  "inventory:view": ["admin", "supervisor", "agent"],
  "orders:create": ["admin", "supervisor", "agent"],
  "orders:view": ["admin", "supervisor", "agent"],
};

/**
 * Checks if a user role has permission to perform an action.
 *
 * @param role - The user's role
 * @param permission - The permission key to check
 * @returns true if the role has the permission, false otherwise
 */
export function checkPermission(
  role: string | null | undefined,
  permission: string
): boolean {
  if (!role) return false;

  const allowedRoles = PERMISSION_MAP[permission];
  if (!allowedRoles) {
    // Unknown permission - deny by default
    return false;
  }

  return allowedRoles.includes(role as Role);
}

/**
 * Returns all permissions for a given role.
 */
export function getPermissionsForRole(role: string): string[] {
  return Object.entries(PERMISSION_MAP)
    .filter(([, roles]) => roles.includes(role as Role))
    .map(([permission]) => permission);
}
