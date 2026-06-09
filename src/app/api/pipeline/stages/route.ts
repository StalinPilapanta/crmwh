import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: stages, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Error al obtener etapas" }, { status: 500 });
  }

  return NextResponse.json({ stages });
}

export async function POST(request: Request) {
  const supabase = await createClient();

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
  const { name, color } = body;

  if (!name) {
    return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
  }

  // Get next position
  const { data: lastStage } = await supabase
    .from("pipeline_stages")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (lastStage?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({
      tenant_id: user.app_metadata.tenant_id,
      name,
      color: color || "#0D9488",
      position,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al crear etapa" }, { status: 500 });
  }

  return NextResponse.json({ stage: data }, { status: 201 });
}
