import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCode } from "@/lib/gdrive/client";
import { encrypt } from "@/lib/encryption";

/**
 * GET: OAuth callback from Google.
 * Exchanges the authorization code for tokens and stores the integration.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    // User denied access or other OAuth error
    return NextResponse.redirect(
      new URL("/integrations?error=gdrive_denied", request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/integrations?error=gdrive_invalid", request.url)
    );
  }

  // Decode state to get tenant_id
  let tenantId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    tenantId = decoded.tenant_id;
  } catch {
    return NextResponse.redirect(
      new URL("/integrations?error=gdrive_invalid_state", request.url)
    );
  }

  if (!tenantId) {
    return NextResponse.redirect(
      new URL("/integrations?error=gdrive_no_tenant", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    const supabase = createAdminClient();

    // Encrypt the config
    const configEncrypted = encrypt(
      JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      })
    );

    // Check if integration already exists
    const { data: existing } = await supabase
      .from("integrations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("type", "google_drive")
      .single();

    if (existing) {
      await supabase
        .from("integrations")
        .update({
          config_encrypted: configEncrypted,
          status: "connected",
          error_message: null,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("integrations").insert({
        tenant_id: tenantId,
        type: "google_drive",
        config_encrypted: configEncrypted,
        status: "connected",
      });
    }

    return NextResponse.redirect(
      new URL("/integrations?success=gdrive_connected", request.url)
    );
  } catch (err) {
    console.error("Google Drive OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/integrations?error=gdrive_exchange_failed", request.url)
    );
  }
}
