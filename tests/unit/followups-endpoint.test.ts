import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Endpoint POST /api/followups/run: seguridad por Bearer FOLLOWUP_CRON_KEY.
 * 401 sin clave o con clave incorrecta (sin ejecutar el barrido); 200 con la
 * clave correcta.
 */

const { runFollowups } = vi.hoisted(() => ({ runFollowups: vi.fn() }));
const cfg = { key: "secret-cron-key" };

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ FOLLOWUP_CRON_KEY: cfg.key }),
  isFollowupCronConfigured: () => Boolean(cfg.key),
}));

vi.mock("@/server/followups/run", () => ({ runFollowups }));

function req(auth?: string) {
  return new Request("https://x/api/followups/run", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });
}

beforeEach(() => {
  cfg.key = "secret-cron-key";
  runFollowups.mockReset();
});

afterEach(() => vi.clearAllMocks());

async function load() {
  return import("@/app/api/followups/run/route");
}

describe("POST /api/followups/run", () => {
  it("sin header Authorization → 401, no ejecuta", async () => {
    const { POST } = await load();
    const res = await POST(req());
    expect(res.status).toBe(401);
    expect(runFollowups).not.toHaveBeenCalled();
  });

  it("con Bearer incorrecto → 401, no ejecuta", async () => {
    const { POST } = await load();
    const res = await POST(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(runFollowups).not.toHaveBeenCalled();
  });

  it("sin FOLLOWUP_CRON_KEY configurada → 401", async () => {
    cfg.key = "";
    const { POST } = await load();
    const res = await POST(req("Bearer whatever"));
    expect(res.status).toBe(401);
    expect(runFollowups).not.toHaveBeenCalled();
  });

  it("con Bearer correcto → 200 y ejecuta el barrido", async () => {
    runFollowups.mockResolvedValue({ reminders: 2, skipped: 1, errors: 0 });
    const { POST } = await load();
    const res = await POST(req("Bearer secret-cron-key"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.summary.reminders).toBe(2);
    expect(runFollowups).toHaveBeenCalledTimes(1);
  });

  it("si el barrido lanza → 500 sin filtrar el error", async () => {
    runFollowups.mockRejectedValue(new Error("boom"));
    const { POST } = await load();
    const res = await POST(req("Bearer secret-cron-key"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
