import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit, AuditActions } from "@/lib/audit";

// POST /api/conversations/[id]/handoff/accept
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/conversations/[id]/handoff">
) {
  const supabase = await createClient();
  const { id } = await ctx.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body; // "accept" or "release"

  const tenantId = user.app_metadata?.tenant_id;

  if (action === "accept") {
    const { error } = await supabase
      .from("conversations")
      .update({
        controlled_by: "human",
        assigned_to: user.id,
        status: "active",
        handoff_requested_at: null,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Error al aceptar handoff" }, { status: 500 });
    }

    // Remove handoff notifications for other agents
    await supabase
      .from("notifications")
      .delete()
      .eq("type", "handoff_request")
      .neq("user_id", user.id)
      .filter("data->>conversation_id", "eq", id);

    // Audit log
    if (tenantId) {
      logAudit({
        tenantId,
        userId: user.id,
        action: "handoff_accepted",
        resourceType: "conversation",
        resourceId: id,
      });
    }

    return NextResponse.json({ success: true, controlled_by: "human" });
  }

  if (action === "release") {
    const { error } = await supabase
      .from("conversations")
      .update({
        controlled_by: "ai",
        assigned_to: null,
        status: "active",
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Error al liberar handoff" }, { status: 500 });
    }

    if (tenantId) {
      logAudit({
        tenantId,
        userId: user.id,
        action: "handoff_released",
        resourceType: "conversation",
        resourceId: id,
      });
    }

    return NextResponse.json({ success: true, controlled_by: "ai" });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
