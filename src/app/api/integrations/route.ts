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

  const { data: integrations, error } = await supabase
    .from("integrations")
    .select("id, type, status, last_sync_at, error_message, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Error al obtener integraciones" }, { status: 500 });
  }

  return NextResponse.json({ integrations });
}
