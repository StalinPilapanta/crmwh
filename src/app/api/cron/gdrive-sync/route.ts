import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all tenants with Google Drive integration
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("type", "google_drive")
    .eq("status", "connected");

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  let synced = 0;
  let failed = 0;

  for (const integration of integrations) {
    try {
      // Google Drive sync logic would go here
      // For now, mark as synced
      await supabase
        .from("integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", integration.id);

      synced++;
    } catch (error) {
      failed++;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      await supabase
        .from("integrations")
        .update({ error_message: errorMsg })
        .eq("id", integration.id);
    }
  }

  return NextResponse.json({ synced, failed, total: integrations.length });
}
