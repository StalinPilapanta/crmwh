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

  const { data: members, error } = await supabase
    .from("users")
    .select("id, email, full_name, role, status, avatar_url, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Error al obtener miembros" }, { status: 500 });
  }

  return NextResponse.json({ members });
}
