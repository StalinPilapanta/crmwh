import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: Retrieve tenant settings
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
  }

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, timezone, business_hours, settings, created_at")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ tenant });
}

// PUT: Update tenant settings
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = user.app_metadata?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
  }

  const body = await request.json();
  const { name, settings } = body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (settings !== undefined) updates.settings = settings;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { data: tenant, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", tenantId)
    .select("id, name, timezone, business_hours, settings, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al actualizar tenant" }, { status: 500 });
  }

  return NextResponse.json({ tenant });
}
