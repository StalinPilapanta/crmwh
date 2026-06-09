import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: sessions, error } = await supabase
    .from("whatsapp_sessions")
    .select("id, phone_number_id, display_phone, business_account_id, status, last_health_check, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Error al obtener sesiones" }, { status: 500 });
  }

  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Solo admins" }, { status: 403 });
  }

  const body = await request.json();
  const { phoneNumberId, displayPhone, businessAccountId, accessToken } = body;

  if (!phoneNumberId || !displayPhone || !businessAccountId || !accessToken) {
    return NextResponse.json(
      { error: "Todos los campos son requeridos" },
      { status: 400 }
    );
  }

  // Encrypt the access token
  const accessTokenEncrypted = encrypt(accessToken);

  const { data, error } = await supabase
    .from("whatsapp_sessions")
    .insert({
      tenant_id: user.app_metadata.tenant_id,
      phone_number_id: phoneNumberId,
      display_phone: displayPhone,
      business_account_id: businessAccountId,
      access_token_encrypted: accessTokenEncrypted,
      status: "active",
    })
    .select("id, phone_number_id, display_phone, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al crear sesión" }, { status: 500 });
  }

  return NextResponse.json({ session: data }, { status: 201 });
}
