import { getEnv, isFollowupCronConfigured } from "@/lib/env";
import { runReengage } from "@/server/reengage/run";

export const dynamic = "force-dynamic";

/**
 * Re-enganche contextual: barrido corto para retomar conversaciones donde el
 * agente pidió datos y el cliente no respondió (~45 min).
 * Protegido con la misma FOLLOWUP_CRON_KEY del seguimiento de 20h.
 */
export async function POST(req: Request): Promise<Response> {
  if (!isFollowupCronConfigured()) {
    return json(401, { ok: false, error: "not_configured" });
  }
  const expected = getEnv().FOLLOWUP_CRON_KEY;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!expected || token !== expected) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  try {
    const summary = await runReengage();
    return json(200, { ok: true, summary });
  } catch (err) {
    console.error(
      `[reengage] barrido falló: ${err instanceof Error ? err.message : String(err)}`
    );
    return json(500, { ok: false, error: "internal_error" });
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
