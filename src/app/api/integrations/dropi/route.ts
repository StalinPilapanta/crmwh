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

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 400 });
  }

  const body = await request.json();
  const { apiKey, storeId } = body;

  if (!apiKey || !storeId) {
    return NextResponse.json(
      { error: "API key y Store ID son requeridos" },
      { status: 400 }
    );
  }

  // Validate API key by making a test request to Dropi
  try {
    const testResponse = await fetch(
      `https://api.dropi.co/api/v1/stores/${storeId}/products?limit=1`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!testResponse.ok) {
      return NextResponse.json(
        { error: "API key o Store ID inválido. Verificá tus credenciales de Dropi." },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con Dropi. Intentá de nuevo." },
      { status: 502 }
    );
  }

  // Encrypt config
  const configEncrypted = encrypt(JSON.stringify({ api_key: apiKey, store_id: storeId }));

  // Check if integration already exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("type", "dropi")
    .single();

  if (existing) {
    // Update existing
    const { data: integration, error } = await supabase
      .from("integrations")
      .update({
        config_encrypted: configEncrypted,
        status: "connected",
        error_message: null,
      })
      .eq("id", existing.id)
      .select("id, type, status, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Error al actualizar integración" }, { status: 500 });
    }

    return NextResponse.json({ integration });
  }

  // Create new integration
  const { data: integration, error } = await supabase
    .from("integrations")
    .insert({
      tenant_id: tenantId,
      type: "dropi",
      config_encrypted: configEncrypted,
      status: "connected",
    })
    .select("id, type, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Error al crear integración" }, { status: 500 });
  }

  return NextResponse.json({ integration }, { status: 201 });
}
