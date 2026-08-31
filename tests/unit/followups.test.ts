import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Barrido de seguimiento (runFollowups): envía UN recordatorio de texto libre a
 * leads inactivos dentro de la ventana de 24h. Claves: respeta filtros
 * (handoff/aiEnabled/isTest/stage/quién habló último), umbral de tiempo,
 * ventana abierta, e idempotencia (no reenvía si stage ya avanzó).
 */

const { sendText, profiles, candidates, updates, selectState } = vi.hoisted(
  () => ({
    sendText: vi.fn(),
    profiles: [] as unknown[],
    candidates: [] as unknown[],
    updates: [] as { id: string; values: Record<string, unknown> }[],
    selectState: { call: 0 },
  })
);

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ FOLLOWUP_REMINDER_AFTER_H: 20, FOLLOWUP_BATCH_LIMIT: 200 }),
}));

vi.mock("@/server/inbox/send", () => ({ sendText }));

// isWindowOpen real (queremos su lógica de 24h de verdad).
vi.mock("@/server/inbox/window", async (importOriginal) => {
  return await importOriginal<typeof import("@/server/inbox/window")>();
});

vi.mock("@/lib/db", () => {
  // El primer select() del código devuelve perfiles; el resto, candidatas.
  function makeSelectChain() {
    const isFirst = selectState.call === 0;
    selectState.call++;
    const rows = isFirst ? profiles : candidates;
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.limit = () => Promise.resolve(rows);
    // El select de perfiles termina en .where() (thenable).
    (chain as { then?: unknown }).then = (resolve: (v: unknown) => void) =>
      Promise.resolve(rows).then(resolve);
    return chain;
  }
  return {
    getDb: () => ({
      select: () => makeSelectChain(),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: (cond: { id?: string }) => {
            updates.push({ id: cond?.id ?? "?", values });
            return Promise.resolve();
          },
        }),
      }),
    }),
    schema: {
      agentProfile: { followupEnabled: "followupEnabled" },
      conversation: new Proxy(
        {},
        { get: (_t, col) => `conversation.${String(col)}` }
      ),
    },
  };
});

// Como el where() de update no expone el id fácilmente, capturamos por orden.
// Simplificamos: el test verifica el número de updates y sus values.

const HOURS = 60 * 60 * 1000;

beforeEach(() => {
  sendText.mockReset();
  profiles.length = 0;
  candidates.length = 0;
  updates.length = 0;
  selectState.call = 0;
});

afterEach(() => vi.clearAllMocks());

async function load() {
  return import("@/server/followups/run");
}

function conv(over: Record<string, unknown> = {}) {
  return {
    id: "cv_1",
    organizationId: "org_1",
    isTest: false,
    handoffAt: null,
    aiEnabled: true,
    followupStage: 0,
    lastInboundAt: new Date(Date.now() - 21 * HOURS),
    lastMessageAt: new Date(Date.now() - 21 * HOURS),
    ...over,
  };
}

describe("runFollowups", () => {
  it("sin organizaciones con seguimiento → no hace nada", async () => {
    const { runFollowups } = await load();
    const s = await runFollowups();
    expect(s).toEqual({ reminders: 0, skipped: 0, errors: 0 });
    expect(sendText).not.toHaveBeenCalled();
  });

  it("candidata dentro de ventana → envía recordatorio y avanza stage", async () => {
    profiles.push({
      organizationId: "org_1",
      followupEnabled: true,
      followupReminderText: "¿Sigues ahí?",
    });
    // lastInboundAt hace 21h (ventana de 24h aún abierta), último mensaje 21h.
    candidates.push(conv());
    sendText.mockResolvedValue({ messageId: "m1" });

    const { runFollowups } = await load();
    const s = await runFollowups(new Date());

    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "cv_1",
        text: "¿Sigues ahí?",
        aiGenerated: true,
      })
    );
    expect(s.reminders).toBe(1);
    expect(updates[0]?.values.followupStage).toBe(1);
  });

  it("ventana cerrada (último inbound hace 30h) → omite, no envía", async () => {
    profiles.push({ organizationId: "org_1", followupEnabled: true });
    candidates.push(
      conv({
        lastInboundAt: new Date(Date.now() - 30 * HOURS),
        lastMessageAt: new Date(Date.now() - 25 * HOURS),
      })
    );

    const { runFollowups } = await load();
    const s = await runFollowups(new Date());

    expect(sendText).not.toHaveBeenCalled();
    expect(s.skipped).toBe(1);
    expect(s.reminders).toBe(0);
  });

  it("usa el texto default si no hay followupReminderText", async () => {
    profiles.push({ organizationId: "org_1", followupEnabled: true, followupReminderText: null });
    candidates.push(conv());
    sendText.mockResolvedValue({ messageId: "m1" });

    const { runFollowups } = await load();
    await runFollowups(new Date());

    const arg = sendText.mock.calls[0]?.[0] as { text: string };
    expect(arg.text.length).toBeGreaterThan(0);
    expect(arg.text).toContain("interesado");
  });

  it("error de envío → cuenta error y NO avanza stage (reintenta luego)", async () => {
    profiles.push({ organizationId: "org_1", followupEnabled: true });
    candidates.push(conv());
    sendText.mockRejectedValue(new Error("meta caído"));

    const { runFollowups } = await load();
    const s = await runFollowups(new Date());

    expect(s.errors).toBe(1);
    expect(s.reminders).toBe(0);
    expect(updates.length).toBe(0);
  });
});
