import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/whatsapp/sessions/[id]">
) {
  const supabase = await createClient();
  const { id } = await ctx.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const { error } = await supabase
    .from("whatsapp_sessions")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Error al eliminar sesión" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
