import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get all tenants with Dropi integration
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("type", "dropi")
    .eq("status", "connected");

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ synced: 0 });
  }

  let synced = 0;
  let failed = 0;

  for (const integration of integrations) {
    try {
      if (!integration.config_encrypted) continue;

      const config = JSON.parse(decrypt(integration.config_encrypted));
      const apiKey = config.api_key;
      const storeId = config.store_id;

      // Fetch products from Dropi
      const response = await fetch(
        `https://api.dropi.co/api/v1/stores/${storeId}/products?limit=500`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(60000),
        }
      );

      if (!response.ok) {
        throw new Error(`Dropi API error: ${response.status}`);
      }

      const data = await response.json();
      const products = data.data || data.products || [];

      // Upsert products (max 10,000)
      const limitedProducts = products.slice(0, 10000);

      for (const product of limitedProducts) {
        await supabase
          .from("products")
          .upsert(
            {
              tenant_id: integration.tenant_id,
              external_id: String(product.id),
              name: product.name || "Sin nombre",
              description: product.description || null,
              price: product.price || 0,
              stock: product.stock || 0,
              image_url: product.image_url || product.images?.[0] || null,
              category: product.category || null,
              is_active: product.active !== false,
            },
            { onConflict: "tenant_id,external_id", ignoreDuplicates: false }
          );
      }

      // Update integration sync time
      await supabase
        .from("integrations")
        .update({ last_sync_at: new Date().toISOString(), error_message: null })
        .eq("id", integration.id);

      synced++;
    } catch (error) {
      failed++;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      await supabase
        .from("integrations")
        .update({ error_message: errorMsg })
        .eq("id", integration.id);

      console.error(`Dropi sync failed for integration ${integration.id}:`, errorMsg);
    }
  }

  return NextResponse.json({ synced, failed, total: integrations.length });
}
