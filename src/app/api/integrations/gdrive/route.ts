import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/gdrive/client";

/**
 * GET: Returns the Google OAuth authorization URL to initiate the connection.
 */
export async function GET() {
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

  // State includes tenant_id for the callback to associate
  const state = Buffer.from(JSON.stringify({ tenant_id: tenantId })).toString("base64url");
  const authUrl = getAuthUrl(state);

  return NextResponse.json({ authUrl });
}
