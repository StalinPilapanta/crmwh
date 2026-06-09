import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";

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
  const { providerType, apiKey, model, isDefault } = body;

  if (!providerType || !apiKey || !model) {
    return NextResponse.json(
      { error: "Provider, API key y modelo son requeridos" },
      { status: 400 }
    );
  }

  if (!["openai", "anthropic", "openrouter"].includes(providerType)) {
    return NextResponse.json({ error: "Provider inválido" }, { status: 400 });
  }

  // If setting as default, unset others
  if (isDefault) {
    await supabase
      .from("ai_providers")
      .update({ is_default: false })
      .eq("tenant_id", user.app_metadata.tenant_id);
  }

  const { data, error } = await supabase
    .from("ai_providers")
    .insert({
      tenant_id: user.app_metadata.tenant_id,
      provider_type: providerType,
      api_key_encrypted: encrypt(apiKey),
      model,
      is_default: isDefault || false,
    })
    .select("id, provider_type, model, is_default, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al crear proveedor" }, { status: 500 });
  }

  return NextResponse.json({ provider: data }, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: providers, error } = await supabase
    .from("ai_providers")
    .select("id, provider_type, model, is_default, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Error al obtener proveedores" }, { status: 500 });
  }

  return NextResponse.json({ providers });
}
