import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/encryption";

/**
 * Handles the WhatsApp Embedded Signup flow.
 * Receives the auth code from Facebook Login, exchanges for token,
 * and retrieves the phone number info automatically.
 */
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

  const { code } = await request.json();

  if (!code) {
    return NextResponse.json({ error: "Código de autorización requerido" }, { status: 400 });
  }

  try {
    // Step 1: Exchange code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
        new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_FB_APP_ID!,
          client_secret: process.env.WHATSAPP_APP_SECRET!,
          code,
        }),
      { method: "GET" }
    );

    if (!tokenResponse.ok) {
      const err = await tokenResponse.json().catch(() => ({}));
      console.error("Token exchange failed:", err);
      return NextResponse.json(
        { error: "Error al obtener token de Meta" },
        { status: 502 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Token no recibido de Meta" },
        { status: 502 }
      );
    }

    // Step 2: Get the shared WABA (WhatsApp Business Account) info
    // The Embedded Signup gives access to the user's WABA
    const debugResponse = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${accessToken}&access_token=${process.env.NEXT_PUBLIC_FB_APP_ID}|${process.env.WHATSAPP_APP_SECRET}`
    );

    let wabaId: string | null = null;

    if (debugResponse.ok) {
      const debugData = await debugResponse.json();
      const granularScopes = debugData.data?.granular_scopes || [];
      const wabaScope = granularScopes.find(
        (s: { scope: string; target_ids: string[] }) => s.scope === "whatsapp_business_management"
      );
      if (wabaScope?.target_ids?.length > 0) {
        wabaId = wabaScope.target_ids[0];
      }
    }

    // Step 3: If we have a WABA ID, get the phone numbers
    let phoneNumberId: string | null = null;
    let displayPhone: string | null = null;

    if (wabaId) {
      const phonesResponse = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (phonesResponse.ok) {
        const phonesData = await phonesResponse.json();
        const phones = phonesData.data || [];

        if (phones.length > 0) {
          phoneNumberId = phones[0].id;
          displayPhone = phones[0].display_phone_number || phones[0].verified_name || phoneNumberId;
        }
      }
    }

    // If we couldn't get phone details from WABA, try listing business accounts
    if (!phoneNumberId) {
      const businessResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/businesses`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (businessResponse.ok) {
        const bizData = await businessResponse.json();
        // Try to find WABA from business
        for (const biz of bizData.data || []) {
          const wabaResponse = await fetch(
            `https://graph.facebook.com/v21.0/${biz.id}/owned_whatsapp_business_accounts`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (wabaResponse.ok) {
            const wabaData = await wabaResponse.json();
            if (wabaData.data?.length > 0) {
              wabaId = wabaData.data[0].id;
              // Get phones from this WABA
              const phonesRes = await fetch(
                `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (phonesRes.ok) {
                const pData = await phonesRes.json();
                if (pData.data?.length > 0) {
                  phoneNumberId = pData.data[0].id;
                  displayPhone = pData.data[0].display_phone_number || phoneNumberId;
                }
              }
              break;
            }
          }
        }
      }
    }

    if (!phoneNumberId || !wabaId) {
      return NextResponse.json(
        { error: "No se encontró un número de WhatsApp Business asociado. Asegúrate de completar el proceso de registro en la ventana de Meta." },
        { status: 400 }
      );
    }

    // Step 4: Register the phone number for webhooks
    await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    // Step 5: Save the session in our DB
    const adminClient = createAdminClient();

    // Check if this phone number already exists for this tenant
    const { data: existing } = await adminClient
      .from("whatsapp_sessions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("phone_number_id", phoneNumberId)
      .single();

    if (existing) {
      // Update existing session
      const { data: session } = await adminClient
        .from("whatsapp_sessions")
        .update({
          access_token_encrypted: encrypt(accessToken),
          business_account_id: wabaId,
          display_phone: displayPhone || phoneNumberId,
          status: "active",
        })
        .eq("id", existing.id)
        .select("id, display_phone, phone_number_id, status, created_at")
        .single();

      return NextResponse.json({ session });
    }

    // Create new session
    const { data: session, error: dbError } = await adminClient
      .from("whatsapp_sessions")
      .insert({
        tenant_id: tenantId,
        phone_number_id: phoneNumberId,
        display_phone: displayPhone || phoneNumberId,
        business_account_id: wabaId,
        access_token_encrypted: encrypt(accessToken),
        status: "active",
      })
      .select("id, display_phone, phone_number_id, status, created_at")
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.json({ error: "Error al guardar sesión" }, { status: 500 });
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error("Embedded signup error:", error);
    return NextResponse.json(
      { error: "Error en el proceso de conexión" },
      { status: 500 }
    );
  }
}
