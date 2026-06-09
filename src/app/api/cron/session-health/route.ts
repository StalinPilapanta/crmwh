import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { notifyTenantUsers } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all active sessions
  const { data: sessions } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("status", "active");

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ checked: 0 });
  }

  let healthy = 0;
  let unhealthy = 0;

  for (const session of sessions) {
    try {
      const accessToken = decrypt(session.access_token_encrypted);

      // Test the connection by fetching phone number info
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${session.phone_number_id}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (response.ok) {
        healthy++;
        await supabase
          .from("whatsapp_sessions")
          .update({ last_health_check: new Date().toISOString(), status: "active" })
          .eq("id", session.id);
      } else {
        unhealthy++;
        await supabase
          .from("whatsapp_sessions")
          .update({ status: "disconnected", last_health_check: new Date().toISOString() })
          .eq("id", session.id);

        // Notify admin
        await notifyTenantUsers(
          session.tenant_id,
          ["admin"],
          "session_disconnected",
          "Sesión WhatsApp desconectada",
          `El número ${session.display_phone} se ha desconectado`,
          { session_id: session.id }
        );
      }
    } catch {
      unhealthy++;
      await supabase
        .from("whatsapp_sessions")
        .update({ status: "error", last_health_check: new Date().toISOString() })
        .eq("id", session.id);
    }
  }

  return NextResponse.json({ checked: sessions.length, healthy, unhealthy });
}
