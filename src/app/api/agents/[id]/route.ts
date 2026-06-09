import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/agents/[id]">
) {
  const supabase = await createClient();
  const { id } = await ctx.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: agent, error } = await supabase
    .from("ai_agents")
    .select("*, ai_providers(provider_type, model)")
    .eq("id", id)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/agents/[id]">
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
  if (role !== "admin" && role !== "supervisor") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  const allowedFields = [
    "name", "system_prompt", "provider_id", "personality",
    "temperature", "max_tokens", "is_active", "handoff_keywords"
  ];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from("ai_agents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al actualizar agente" }, { status: 500 });
  }

  return NextResponse.json({ agent: data });
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/agents/[id]">
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
  if (role !== "admin" && role !== "supervisor") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { error } = await supabase
    .from("ai_agents")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Error al eliminar agente" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
