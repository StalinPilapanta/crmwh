import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit, AuditActions } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/tenant/members/[id]">
) {
  const supabase = await createClient();
  const { id } = await ctx.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = user.app_metadata?.role;
  const tenantId = user.app_metadata?.tenant_id;

  if (role !== "admin") {
    if (tenantId) {
      logAudit({
        tenantId,
        userId: user.id,
        action: AuditActions.ACCESS_DENIED,
        resourceType: "user",
        resourceId: id,
        details: { attempted: "change_role" },
      });
    }
    return NextResponse.json({ error: "Solo admins pueden modificar miembros" }, { status: 403 });
  }

  const body = await request.json();
  const { role: newRole } = body;

  if (newRole && !["admin", "supervisor", "agent"].includes(newRole)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  // Can't change own role
  if (id === user.id) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al actualizar miembro" }, { status: 500 });
  }

  // Audit log
  if (tenantId) {
    logAudit({
      tenantId,
      userId: user.id,
      action: AuditActions.ROLE_CHANGED,
      resourceType: "user",
      resourceId: id,
      details: { new_role: newRole },
    });
  }

  return NextResponse.json({ member: data });
}
