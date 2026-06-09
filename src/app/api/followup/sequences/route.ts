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

  const { data: sequences, error } = await supabase
    .from("follow_up_sequences")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Error al obtener secuencias" }, { status: 500 });
  }

  return NextResponse.json({ sequences });
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
  const { name, steps, triggerDelayMinutes, businessHoursOnly, stopOnReply } = body;

  if (!name || !steps || steps.length === 0) {
    return NextResponse.json(
      { error: "Nombre y al menos un paso son requeridos" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("follow_up_sequences")
    .insert({
      tenant_id: user.app_metadata.tenant_id,
      name,
      steps,
      trigger_delay_minutes: triggerDelayMinutes || 60,
      business_hours_only: businessHoursOnly ?? true,
      stop_on_reply: stopOnReply ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al crear secuencia" }, { status: 500 });
  }

  return NextResponse.json({ sequence: data }, { status: 201 });
}
