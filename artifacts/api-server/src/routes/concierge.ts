/**
 * AForce Concierge — HTTP surface (Section 64).
 *
 *   POST   /api/concierge/messages                  send a turn (creates the conversation if needed)
 *   POST   /api/concierge/briefing                  on-demand daily briefing (not stored)
 *   GET    /api/concierge/status                    { available, reason }
 *   GET    /api/concierge/conversations             history list
 *   GET    /api/concierge/conversations/:id         transcript
 *   DELETE /api/concierge/conversations/:id         delete one
 *   DELETE /api/concierge/conversations             delete all
 *   GET    /api/concierge/preferences               remembered preferences (null when none)
 *   PUT    /api/concierge/preferences               { consent: true, prefs }
 *   DELETE /api/concierge/preferences               forget everything
 *   DELETE /api/concierge/preferences/:key          forget one field (or one note by index: notes.N)
 *
 * Every route is behind requireAuth and keyed by the authenticated userId.
 * Provider credentials never reach the client. The OpenAI client is resolved
 * lazily per call so the unit lane can inject a fake.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { createConciergeRepo, db, type ConciergeStore } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { DEFAULT_USER_ID, getUserState } from "../lib/aforceState";
import { logger } from "../lib/logger";
import { createMemoryConciergeStore } from "../lib/concierge/memoryStore";
import { sendApiError } from "../lib/apiError";
import { incCounter } from "../observability/metrics";
import {
  CONCIERGE_HISTORY_LIST_LIMIT,
  CONCIERGE_PER_DAY_LIMIT,
  CONCIERGE_PER_MINUTE_LIMIT,
  CONCIERGE_TRANSCRIPT_PAGE,
  conciergeStoreDriver,
} from "../lib/concierge/config";
import { runConciergeTurn, type ChatCompletionsClient, type HistoryTurn } from "../lib/concierge/service";
import { createAvailabilityChecker, type AvailabilityChecker, type ModelsClient } from "../lib/concierge/availability";
import { serverFactsFromRow, type UserStateFactsRow } from "../lib/concierge/serverFacts";
import {
  BriefingRequestBody,
  MessageRequestBody,
  PreferencesSchema,
  PutPreferencesBody,
  type AssistantTurn,
  type ConciergePreferences,
} from "../lib/concierge/types";

export interface ConciergeRouterDeps {
  store: ConciergeStore;
  /** Resolves the OpenAI client; throws when the integration is not provisioned. */
  getClient: () => Promise<ChatCompletionsClient>;
  /** Reads the member's own user-state row for server facts; null when unavailable. */
  loadUserState: (userId: string) => Promise<UserStateFactsRow | null>;
  log?: { warn?: (o: unknown, msg?: string) => void; error?: (o: unknown, msg?: string) => void };
  now?: () => number;
  /** Injectable provider-availability checker (tests); default probes via getClient. */
  availability?: AvailabilityChecker;
}

const userKey = (req: Request): string => {
  const userId = (req as Request & { userId?: string }).userId;
  return userId ? `u:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "0.0.0.0")}`;
};
const SKIP_IN_TEST = (): boolean => process.env["NODE_ENV"] === "test";

/** Per-user daily cap — process-local (documented limitation; resets per pod). */
function makeDailyCap(limit: number, now: () => number) {
  const counts = new Map<string, { day: string; n: number }>();
  return (userId: string): boolean => {
    const day = new Date(now()).toISOString().slice(0, 10);
    const cur = counts.get(userId);
    if (!cur || cur.day !== day) {
      counts.set(userId, { day, n: 1 });
      return true;
    }
    if (cur.n >= limit) return false;
    cur.n += 1;
    return true;
  };
}

function titleFrom(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 77)}…` : oneLine;
}

function isStorageError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  // 42P01 undefined_table — schema not pushed yet; 08xxx connection faults.
  return code === "42P01" || (typeof code === "string" && code.startsWith("08"));
}

export function buildConciergeRouter(deps: ConciergeRouterDeps): IRouter {
  const router: IRouter = Router();
  const now = deps.now ?? (() => Date.now());
  const dailyCap = makeDailyCap(CONCIERGE_PER_DAY_LIMIT, now);
  const log = deps.log ?? {};

  const minuteLimiter = rateLimit({
    windowMs: 60_000,
    limit: CONCIERGE_PER_MINUTE_LIMIT,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: userKey,
    skip: SKIP_IN_TEST,
    message: { error: "rate_limited", code: "rate_limited", scope: "concierge" },
  });

  router.use(requireAuth);

  const uid = (req: Request): string => req.userId ?? DEFAULT_USER_ID;

  const storageGuard = async <T>(req: Request, res: Response, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (err) {
      if (isStorageError(err)) {
        log.error?.({ err: (err as Error).message }, "concierge: storage unavailable");
        incCounter("concierge.storage_unavailable");
        sendApiError(req, res, 503, "concierge_storage_unavailable");
        return undefined;
      }
      throw err;
    }
  };

  // Availability = a cached probe of the provider, not env presence (the
  // placeholder-key and no-credits incidents of 2026-10-05 both passed the
  // old presence check). `?fresh=1` bypasses the cache for operators.
  const availability =
    deps.availability ??
    createAvailabilityChecker(async () => (await deps.getClient()) as unknown as ModelsClient);
  router.get("/status", async (req, res) => {
    if (req.query["fresh"] === "1") availability.reset();
    const r = await availability.check(now());
    if (!r.available) {
      incCounter(`concierge.status_unavailable.${r.reason ?? "unknown"}`);
      if (r.detail) log.warn?.({ reason: r.reason, detail: r.detail }, "concierge: provider unavailable");
    }
    res.json({ available: r.available, reason: r.reason, checkedAt: r.checkedAt, cached: r.cached });
  });

  router.post("/messages", minuteLimiter, async (req, res) => {
    const parsed = MessageRequestBody.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(req, res, 400, "invalid_body");
      return;
    }
    const userId = uid(req);
    if (!dailyCap(userId)) {
      incCounter("concierge.daily_cap");
      sendApiError(req, res, 429, "daily_limit_reached");
      return;
    }
    const body = parsed.data;

    await storageGuard(req, res, async () => {
      // Resolve / create the conversation — scoped to this member only.
      let conversation = body.conversationId
        ? await deps.store.getConversation(userId, body.conversationId)
        : null;
      if (body.conversationId && !conversation) {
        sendApiError(req, res, 404, "conversation_not_found");
        return;
      }
      if (!conversation) {
        conversation = await deps.store.createConversation(userId, randomUUID(), titleFrom(body.message));
      }

      // Duplicate-tap protection: the same clientTurnId replays the stored reply.
      // Only REAL replies (ok / urgent) are ever persisted — a failed turn
      // (unavailable / gated) is not, so a retry with the same clientTurnId
      // re-runs the model instead of replaying the failure, and the member's
      // message is stored exactly once.
      const existing = await deps.store.listMessages(userId, conversation.id, CONCIERGE_TRANSCRIPT_PAGE);
      const dupe = existing.find((m) => m.role === "user" && m.content["clientTurnId"] === body.clientTurnId);
      if (dupe) {
        const idx = existing.indexOf(dupe);
        const reply = existing.slice(idx + 1).find((m) => m.role === "assistant" || m.role === "notice");
        if (reply) {
          res.json({ conversationId: conversation.id, turn: reply.content, duplicate: true });
          return;
        }
      }

      const prefsRec = await deps.store.getPreferences(userId);
      const prefs: ConciergePreferences | null = prefsRec ? PreferencesSchema.parse(prefsRec.prefs) : null;

      let factsRow: UserStateFactsRow | null = null;
      try {
        factsRow = await deps.loadUserState(userId);
      } catch (err) {
        log.warn?.({ err: (err as Error).message }, "concierge: user state unavailable, continuing with client context");
      }
      const facts = serverFactsFromRow(factsRow, now());

      const history: HistoryTurn[] = existing
        .filter(
          (m) =>
            m.role === "user" ||
            (m.role === "assistant" && (m.content as unknown as AssistantTurn).status === "ok"),
        )
        .map((m) =>
          m.role === "user"
            ? { role: "user" as const, text: String(m.content["text"] ?? "") }
            : { role: "assistant" as const, text: String((m.content as unknown as AssistantTurn).answer ?? "") },
        );

      let client: ChatCompletionsClient;
      try {
        client = await deps.getClient();
      } catch (err) {
        log.error?.({ err: (err as Error).message }, "concierge: AI client unavailable");
        incCounter("concierge.ai_unavailable");
        const turn: AssistantTurn = {
          status: "unavailable",
          kind: "notice",
          answer: "",
          nextStep: null,
          why: null,
          action: null,
          remember: null,
          sources: [],
          code: "ai_not_configured",
          audit: { model: null, gatePolicy: "concierge-gate-v1.0", attempts: 0 },
        };
        res.status(200).json({ conversationId: conversation.id, turn, duplicate: false });
        return;
      }

      const turn = await runConciergeTurn({
        message: body.message,
        context: body.context,
        facts,
        prefs,
        history,
        client,
        log,
        now,
      });
      incCounter(`concierge.turn.${turn.status}`);

      const ts = new Date(now()).toISOString();
      if (!dupe) {
        await deps.store.appendMessage(userId, {
          id: randomUUID(),
          conversationId: conversation.id,
          role: "user",
          content: { text: body.message, clientTurnId: body.clientTurnId },
          createdAt: ts,
        });
      }
      if (turn.status === "ok" || turn.status === "urgent") {
        await deps.store.appendMessage(userId, {
          id: randomUUID(),
          conversationId: conversation.id,
          role: turn.status === "ok" ? "assistant" : "notice",
          content: turn as unknown as Record<string, unknown>,
          createdAt: new Date(now() + 1).toISOString(),
        });
      }
      await deps.store.touchConversation(userId, conversation.id);

      res.json({ conversationId: conversation.id, turn, duplicate: false });
    });
  });

  router.post("/briefing", minuteLimiter, async (req, res) => {
    const parsed = BriefingRequestBody.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(req, res, 400, "invalid_body");
      return;
    }
    const userId = uid(req);
    if (!dailyCap(userId)) {
      sendApiError(req, res, 429, "daily_limit_reached");
      return;
    }
    await storageGuard(req, res, async () => {
      const prefsRec = await deps.store.getPreferences(userId);
      const prefs = prefsRec ? PreferencesSchema.parse(prefsRec.prefs) : null;
      let factsRow: UserStateFactsRow | null = null;
      try {
        factsRow = await deps.loadUserState(userId);
      } catch {
        factsRow = null;
      }
      let client: ChatCompletionsClient;
      try {
        client = await deps.getClient();
      } catch {
        res.json({
          turn: {
            status: "unavailable",
            kind: "notice",
            answer: "",
            nextStep: null,
            why: null,
            action: null,
            remember: null,
            sources: [],
            code: "ai_not_configured",
            audit: { model: null, gatePolicy: "concierge-gate-v1.0", attempts: 0 },
          } satisfies AssistantTurn,
        });
        return;
      }
      const turn = await runConciergeTurn({
        message: "",
        context: parsed.data.context,
        facts: serverFactsFromRow(factsRow, now()),
        prefs,
        history: [],
        briefing: true,
        client,
        log,
        now,
      });
      incCounter(`concierge.briefing.${turn.status}`);
      res.json({ turn, generatedAt: new Date(now()).toISOString() });
    });
  });

  router.get("/conversations", async (req, res) => {
    const userId = uid(req);
    await storageGuard(req, res, async () => {
      const list = await deps.store.listConversations(userId, CONCIERGE_HISTORY_LIST_LIMIT);
      res.json({ conversations: list });
    });
  });

  router.get("/conversations/:id", async (req, res) => {
    const userId = uid(req);
    const id = String(req.params["id"] ?? "");
    await storageGuard(req, res, async () => {
      const conversation = await deps.store.getConversation(userId, id);
      if (!conversation) {
        sendApiError(req, res, 404, "conversation_not_found");
        return;
      }
      const messages = await deps.store.listMessages(userId, id, CONCIERGE_TRANSCRIPT_PAGE);
      res.json({ conversation, messages });
    });
  });

  router.delete("/conversations/:id", async (req, res) => {
    const userId = uid(req);
    const id = String(req.params["id"] ?? "");
    await storageGuard(req, res, async () => {
      const ok = await deps.store.deleteConversation(userId, id);
      if (!ok) {
        sendApiError(req, res, 404, "conversation_not_found");
        return;
      }
      res.json({ deleted: true });
    });
  });

  router.delete("/conversations", async (req, res) => {
    const userId = uid(req);
    await storageGuard(req, res, async () => {
      const n = await deps.store.deleteAllConversations(userId);
      res.json({ deleted: n });
    });
  });

  router.get("/preferences", async (req, res) => {
    const userId = uid(req);
    await storageGuard(req, res, async () => {
      const rec = await deps.store.getPreferences(userId);
      res.json({ preferences: rec });
    });
  });

  router.put("/preferences", async (req, res) => {
    const parsed = PutPreferencesBody.safeParse(req.body);
    if (!parsed.success) {
      // Missing `consent: true` lands here too — storing without consent is a 400, never a silent save.
      sendApiError(req, res, 400, "consent_required_or_invalid");
      return;
    }
    const userId = uid(req);
    await storageGuard(req, res, async () => {
      const prior = await deps.store.getPreferences(userId);
      const consentAt = prior?.consentAt ?? new Date(now()).toISOString();
      const priorPrefs = prior ? PreferencesSchema.parse(prior.prefs) : {};
      const merged: ConciergePreferences = { ...priorPrefs, ...parsed.data.prefs };
      const rec = await deps.store.setPreferences(userId, merged, consentAt);
      res.json({ preferences: rec });
    });
  });

  router.delete("/preferences", async (req, res) => {
    const userId = uid(req);
    await storageGuard(req, res, async () => {
      const had = await deps.store.deletePreferences(userId);
      res.json({ deleted: had });
    });
  });

  router.delete("/preferences/:key", async (req, res) => {
    const userId = uid(req);
    const key = String(req.params["key"] ?? "");
    await storageGuard(req, res, async () => {
      const prior = await deps.store.getPreferences(userId);
      if (!prior) {
        sendApiError(req, res, 404, "preferences_not_found");
        return;
      }
      const next: ConciergePreferences = { ...PreferencesSchema.parse(prior.prefs) };
      const noteMatch = /^notes\.(\d+)$/.exec(key);
      if (noteMatch) {
        const idx = Number(noteMatch[1]);
        const notes = [...(next.notes ?? [])];
        if (idx < 0 || idx >= notes.length) {
          sendApiError(req, res, 404, "preference_not_found");
          return;
        }
        notes.splice(idx, 1);
        next.notes = notes;
      } else if (key === "primaryGoal" || key === "routine" || key === "tone") {
        next[key] = null;
      } else if (key === "notes") {
        next.notes = [];
      } else {
        sendApiError(req, res, 404, "preference_not_found");
        return;
      }
      const rec = await deps.store.setPreferences(userId, next, prior.consentAt);
      res.json({ preferences: rec });
    });
  });

  return router;
}

/** Production wiring: Drizzle store (or memory by env), lazy OpenAI client, real user-state loader. */
export function buildDefaultConciergeDeps(): ConciergeRouterDeps {
  const store: ConciergeStore =
    conciergeStoreDriver() === "memory" ? createMemoryConciergeStore() : createConciergeRepo(db);
  return {
    store,
    getClient: async () => {
      // Lazy: the integration module throws at import when the AI env is absent,
      // so resolving it per call turns a missing credential into an honest
      // `ai_not_configured` turn instead of a boot failure for this router.
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      return openai as unknown as ChatCompletionsClient;
    },
    loadUserState: async (userId) => (await getUserState(userId)) as unknown as UserStateFactsRow,
    log: logger,
  };
}
