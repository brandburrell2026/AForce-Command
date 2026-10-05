/**
 * AForce Concierge routes — adversarial lane (DB-less, memory store, fake model).
 *
 *  1. Production + no session → 401 before anything else runs; the model is never called.
 *  2. Cross-account isolation: user B cannot read, continue, or delete user A's
 *     conversation (404, never 403 — the id's existence is not confirmed).
 *  3. Duplicate-tap protection: the same clientTurnId replays the stored turn
 *     instead of calling the model again.
 *  4. Preferences require explicit consent; edit, forget-one, forget-all work;
 *     prefs never bleed across accounts.
 *  5. Conversation deletion (one / all) is per account.
 *  6. AI not configured → honest `ai_not_configured` turn, HTTP 200, nothing stored as "ok".
 *  7. Storage fault (undefined table) → 503 concierge_storage_unavailable, not 500.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import { randomUUID } from "node:crypto";

vi.mock("../../lib/aforceState", () => ({
  DEFAULT_USER_ID: "default",
  getUserState: async () => null,
}));
vi.mock("@workspace/db", () => ({
  db: {},
  createConciergeRepo: () => {
    throw new Error("drizzle repo must not be used in the unit lane");
  },
}));

const { authHolder } = vi.hoisted(() => ({
  authHolder: { value: { userId: null as string | null, sessionClaims: null as unknown } },
}));
vi.mock("@clerk/express", () => ({ getAuth: () => authHolder.value }));

const ENV_KEYS = ["NODE_ENV", "CLERK_SECRET_KEY"] as const;
let prevEnv: Record<string, string | undefined> = {};

const okReply = JSON.stringify({
  kind: "answer",
  answer: "You are 40 oz into a 96 oz day; the engine's next move is 16 oz of water.",
  nextStep: "Drink 16 oz water now.",
  why: null,
  action: { type: "log_hydration", fluidType: "water", oz: 16, label: "Log 16 oz water" },
  remember: null,
  sources: ["intake"],
});

let modelCalls = 0;
let clientMode: "ok" | "missing" | "fail" = "ok";
let server: http.Server;
let baseUrl: string;
let storeRef: import("@workspace/db").ConciergeStore;

async function buildApp(): Promise<Express> {
  process.env["NODE_ENV"] = "production";
  process.env["CLERK_SECRET_KEY"] = "sk_test_fake";
  vi.resetModules();
  const { buildConciergeRouter } = await import("../concierge");
  const { createMemoryConciergeStore } = await import("../../lib/concierge/memoryStore");
  storeRef = createMemoryConciergeStore();
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use(
    "/api/concierge",
    buildConciergeRouter({
      store: storeRef,
      getClient: async () => {
        if (clientMode === "missing") throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY must be set");
        return {
          chat: {
            completions: {
              create: async () => {
                modelCalls += 1;
                if (clientMode === "fail") throw new Error("upstream down");
                return { choices: [{ message: { content: okReply } }] };
              },
            },
          },
        };
      },
      loadUserState: async () => null,
      log: { warn: () => {}, error: () => {} },
    }),
  );
  return app;
}

function asUser(userId: string | null) {
  authHolder.value = { userId, sessionClaims: userId ? { sub: userId } : null };
}

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json: json as Record<string, unknown> };
}

function context(over: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    localTime: { iso: "2026-10-05T14:05:00-04:00", timeZone: "America/New_York", hour: 14 },
    locale: "en",
    demoMode: false,
    hydroState: null,
    command: { action: "Drink 16 oz water now.", explanation: "Behind pace.", urgencyLevel: "medium", guard: "approved" },
    intake: { ozToday: 40, ozTarget: 96, unitsToday: 3, unitsTarget: 8, lastIntakeMinutesAgo: 60, provenance: "logged" },
    signals: [],
    providers: [],
    recentDays: [],
    capabilities: ["log_hydration", "open_screen"],
    screens: ["home", "hydration"],
    ...over,
  };
}

beforeAll(async () => {
  prevEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const app = await buildApp();
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  for (const k of ENV_KEYS) {
    if (prevEnv[k] === undefined) delete process.env[k];
    else process.env[k] = prevEnv[k];
  }
});

beforeEach(() => {
  modelCalls = 0;
  clientMode = "ok";
});

describe("1. authentication", () => {
  it("rejects an anonymous caller in production with 401 and never calls the model", async () => {
    asUser(null);
    const r = await call("POST", "/api/concierge/messages", {
      clientTurnId: randomUUID(),
      message: "hi",
      context: context(),
    });
    expect(r.status).toBe(401);
    expect(modelCalls).toBe(0);
    const s = await call("GET", "/api/concierge/conversations");
    expect(s.status).toBe(401);
  });
});

describe("2–5. per-account isolation, duplicates, preferences, deletion", () => {
  let convA = "";

  it("user A starts a conversation and gets a gated turn", async () => {
    asUser("user_A");
    const turnId = randomUUID();
    const r = await call("POST", "/api/concierge/messages", {
      clientTurnId: turnId,
      message: "What should I focus on today?",
      context: context(),
    });
    expect(r.status).toBe(200);
    convA = String(r.json["conversationId"]);
    const turn = r.json["turn"] as Record<string, unknown>;
    expect(turn["status"]).toBe("ok");
    expect(modelCalls).toBe(1);

    // Duplicate tap — same clientTurnId — replays, no second model call.
    const again = await call("POST", "/api/concierge/messages", {
      conversationId: convA,
      clientTurnId: turnId,
      message: "What should I focus on today?",
      context: context(),
    });
    expect(again.status).toBe(200);
    expect(again.json["duplicate"]).toBe(true);
    expect(modelCalls).toBe(1);
  });

  it("user B cannot read, continue, or delete user A's conversation", async () => {
    asUser("user_B");
    expect((await call("GET", `/api/concierge/conversations/${convA}`)).status).toBe(404);
    const cont = await call("POST", "/api/concierge/messages", {
      conversationId: convA,
      clientTurnId: randomUUID(),
      message: "continue",
      context: context(),
    });
    expect(cont.status).toBe(404);
    expect(modelCalls).toBe(0);
    expect((await call("DELETE", `/api/concierge/conversations/${convA}`)).status).toBe(404);
    const list = await call("GET", "/api/concierge/conversations");
    expect(list.json["conversations"]).toEqual([]);
  });

  it("user A still sees the transcript with both turns", async () => {
    asUser("user_A");
    const r = await call("GET", `/api/concierge/conversations/${convA}`);
    expect(r.status).toBe(200);
    const messages = r.json["messages"] as Array<Record<string, unknown>>;
    expect(messages.map((m) => m["role"])).toEqual(["user", "assistant"]);
  });

  it("preferences: saving without consent is refused; with consent it stores; edits merge; forget works", async () => {
    asUser("user_A");
    expect((await call("GET", "/api/concierge/preferences")).json["preferences"]).toBeNull();

    const noConsent = await call("PUT", "/api/concierge/preferences", { prefs: { primaryGoal: "Train better" } });
    expect(noConsent.status).toBe(400);

    const saved = await call("PUT", "/api/concierge/preferences", {
      consent: true,
      prefs: { primaryGoal: "Train better", tone: "sage", notes: ["No caffeine after 2pm"] },
    });
    expect(saved.status).toBe(200);
    const prefs = (saved.json["preferences"] as Record<string, unknown>)["prefs"] as Record<string, unknown>;
    expect(prefs).toEqual({ primaryGoal: "Train better", tone: "sage", notes: ["No caffeine after 2pm"] });
    expect((saved.json["preferences"] as Record<string, unknown>)["consentAt"]).toBeTruthy();

    const edited = await call("PUT", "/api/concierge/preferences", { consent: true, prefs: { routine: "Gym at 6am" } });
    const p2 = (edited.json["preferences"] as Record<string, unknown>)["prefs"] as Record<string, unknown>;
    expect(p2["primaryGoal"]).toBe("Train better");
    expect(p2["routine"]).toBe("Gym at 6am");

    const forgotOne = await call("DELETE", "/api/concierge/preferences/notes.0");
    expect(((forgotOne.json["preferences"] as Record<string, unknown>)["prefs"] as Record<string, unknown>)["notes"]).toEqual([]);
    const forgotTone = await call("DELETE", "/api/concierge/preferences/tone");
    expect(((forgotTone.json["preferences"] as Record<string, unknown>)["prefs"] as Record<string, unknown>)["tone"]).toBeNull();

    asUser("user_B");
    expect((await call("GET", "/api/concierge/preferences")).json["preferences"]).toBeNull();

    asUser("user_A");
    expect((await call("DELETE", "/api/concierge/preferences")).json["deleted"]).toBe(true);
    expect((await call("GET", "/api/concierge/preferences")).json["preferences"]).toBeNull();
  });

  it("user A deletes one conversation, then all", async () => {
    asUser("user_A");
    const second = await call("POST", "/api/concierge/messages", {
      clientTurnId: randomUUID(),
      message: "Explain my hydration target.",
      context: context(),
    });
    expect(second.status).toBe(200);
    expect((await call("DELETE", `/api/concierge/conversations/${convA}`)).json["deleted"]).toBe(true);
    expect((await call("GET", `/api/concierge/conversations/${convA}`)).status).toBe(404);
    const all = await call("DELETE", "/api/concierge/conversations");
    expect(all.json["deleted"]).toBe(1);
    expect((await call("GET", "/api/concierge/conversations")).json["conversations"]).toEqual([]);
  });
});

describe("6. AI unavailable", () => {
  it("returns an honest ai_not_configured turn and stores no 'ok' assistant text", async () => {
    asUser("user_C");
    clientMode = "missing";
    const r = await call("POST", "/api/concierge/messages", {
      clientTurnId: randomUUID(),
      message: "Help me prepare for my workout.",
      context: context(),
    });
    expect(r.status).toBe(200);
    const turn = r.json["turn"] as Record<string, unknown>;
    expect(turn["status"]).toBe("unavailable");
    expect(turn["code"]).toBe("ai_not_configured");
    expect(turn["answer"]).toBe("");
    const status = await call("GET", "/api/concierge/status");
    expect(status.json).toHaveProperty("available");
  });
});

describe("6b. retry after an upstream failure", () => {
  it("does not persist the failed turn, re-runs the model on the same clientTurnId, stores the member message once", async () => {
    asUser("user_F");
    clientMode = "fail";
    const turnId = randomUUID();
    const first = await call("POST", "/api/concierge/messages", {
      clientTurnId: turnId,
      message: "Explain my hydration target.",
      context: context(),
    });
    expect((first.json["turn"] as Record<string, unknown>)["status"]).toBe("unavailable");
    const conv = String(first.json["conversationId"]);
    expect(modelCalls).toBe(1);

    clientMode = "ok";
    const second = await call("POST", "/api/concierge/messages", {
      conversationId: conv,
      clientTurnId: turnId,
      message: "Explain my hydration target.",
      context: context(),
    });
    expect(second.json["duplicate"]).toBe(false);
    expect((second.json["turn"] as Record<string, unknown>)["status"]).toBe("ok");
    expect(modelCalls).toBe(2);

    const transcript = await call("GET", `/api/concierge/conversations/${conv}`);
    const roles = (transcript.json["messages"] as Array<Record<string, unknown>>).map((m) => m["role"]);
    expect(roles).toEqual(["user", "assistant"]);
  });
});

describe("7. storage fault", () => {
  it("maps an undefined-table error to 503 concierge_storage_unavailable", async () => {
    asUser("user_D");
    const original = storeRef.listConversations;
    storeRef.listConversations = async () => {
      const err = new Error('relation "aforce_concierge_conversations" does not exist') as Error & { code?: string };
      err.code = "42P01";
      throw err;
    };
    try {
      const r = await call("GET", "/api/concierge/conversations");
      expect(r.status).toBe(503);
      expect(r.json["code"]).toBe("concierge_storage_unavailable");
    } finally {
      storeRef.listConversations = original;
    }
  });
});

describe("validation", () => {
  it("rejects an oversize or malformed body with 400", async () => {
    asUser("user_E");
    const r = await call("POST", "/api/concierge/messages", { clientTurnId: "nope", message: "", context: {} });
    expect(r.status).toBe(400);
    expect(modelCalls).toBe(0);
  });
});
