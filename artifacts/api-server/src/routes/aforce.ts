/**
 * AForce OS REST endpoints.
 *
 * Mounted under `/api/aforce`. The Expo client (`services/realApi.ts`)
 * is the only consumer; the scoring engine itself stays on the client
 * — these routes just persist state and publish change events over WS.
 *
 *   GET  /state               → current UserState row (auto-seeded)
 *   POST /intake              → log an intake; returns updated state
 *   POST /signals             → update active symptoms
 *   POST /urine               → update urine signal (1-8)
 *   POST /energy              → update energy state
 *   POST /checkin             → mark morning-command seen
 *   POST /confirm             → ±3 confirmation answer
 *   POST /flags               → mirror clutch_active flag from client
 *   GET  /weather?lat&lon     → cached OpenWeather snapshot
 */

import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import {
  db,
  aforceIntakeLogs, aforceConfirmations, aforceUserState, aforceScoreSnapshots,
  aforceAchievements,
} from "@workspace/db";
import { eq, sql, and, gte, asc, desc, inArray } from "drizzle-orm";
import { DEFAULT_USER_ID, getUserState, updateUserState, ALL_FLUID_TYPES, isAforceFluid } from "../lib/aforceState";
import { publish } from "../lib/aforceHub";
import { fetchWeather } from "../lib/openWeather";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";
import { intakeLimiter, weatherLimiter } from "../middlewares/rateLimits";

const router: IRouter = Router();

// Every aforce route is per-user; requireAuth attaches req.userId
// (Clerk session in production, DEFAULT_USER_ID in dev fallback).
router.use(requireAuth);

// Resolve the userId set by requireAuth, with a defensive fallback so a
// misconfigured deployment never crashes the route.
function resolveUserId(req: Request): string {
  return req.userId ?? DEFAULT_USER_ID;
}

function broadcastState(userId: string, row: unknown) {
  publish(userId, { type: "state", userState: row });
}

// ─── GET /state ────────────────────────────────────────────────────────────────
router.get("/state", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const row = await getUserState(userId);
    res.json({ userState: row, serverTime: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "GET /aforce/state failed");
    res.status(500).json({ error: "state_fetch_failed" });
  }
});

// ─── POST /intake ──────────────────────────────────────────────────────────────
// `event` carries the per-event impact decomposition computed client-
// side by `services/hydrationScoreService.ts`. The server stores it
// verbatim into the `intake_events` JSONB so the materialized score
// is reproducible across reloads / multi-device. Cap-trim to last 24h.
const flavorEnum = z.enum(["watermelon", "berry", "soursop", "unflavored"]);
const intakeEventSchema = z.object({
  id: z.string().min(1).max(64),
  fluidType: z.enum(ALL_FLUID_TYPES),
  flavor: flavorEnum.optional(),
  oz: z.number().positive(),
  loggedAt: z.string(),
  baseImpact: z.number(),
  capAdjusted: z.number(),
  immediate: z.number(),
  delayed: z.number(),
  delayedDurationMin: z.number().positive(),
  heatGuardActiveAtLog: z.boolean(),
  scoreBeforeAtLog: z.number(),
});
const intakeSchema = z.object({
  // Strict allow-list (mirrors client `FluidType`). Rejects arbitrary
  // strings like `aforce_fake` that would otherwise sneak past the
  // bonus gate.
  fluidType: z.enum(ALL_FLUID_TYPES),
  ozAmount: z.number().positive(),
  scoreBefore: z.number().int(),
  scoreAfter: z.number().int(),
  event: intakeEventSchema.optional(),
});

const INTAKE_EVENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

router.post("/intake", intakeLimiter, async (req, res) => {
  try {
    const body = intakeSchema.parse(req.body);
    const userId = resolveUserId(req);
    // Pre-seed (and apply day rollover) outside the transaction so the
    // UPDATE inside the tx is guaranteed to find a row. This collapses
    // the old "tx + fallback" two-path flow into a single atomic write,
    // eliminating the duplicate-log edge case where both paths inserted.
    await getUserState(userId);
    const isAforce = isAforceFluid(body.fluidType);
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      // Read current events, append + trim. We do this inside the tx
      // so concurrent intakes can't lose each other's events to a
      // read-modify-write race on the JSONB array.
      const [current] = await tx
        .select({ intakeEvents: aforceUserState.intakeEvents })
        .from(aforceUserState)
        .where(eq(aforceUserState.userId, userId))
        .limit(1)
        .for('update');
      type StoredEvent = NonNullable<typeof current>['intakeEvents'][number];
      const prevEvents: StoredEvent[] = current?.intakeEvents ?? [];
      const trimmed = prevEvents.filter((e) => {
        const t = new Date(e.loggedAt).getTime();
        return Number.isFinite(t) && now.getTime() - t < INTAKE_EVENT_MAX_AGE_MS;
      });
      const nextEvents: StoredEvent[] = body.event ? [...trimmed, body.event] : trimmed;

      const [updated] = await tx
        .update(aforceUserState)
        .set({
          unitsConsumedToday: sql`${aforceUserState.unitsConsumedToday} + 1`,
          ozConsumedToday: sql`${aforceUserState.ozConsumedToday} + ${body.ozAmount}`,
          aforceUnitsToday: isAforce
            ? sql`${aforceUserState.aforceUnitsToday} + 1`
            : aforceUserState.aforceUnitsToday,
          lastIntakeTime: now,
          lastIntakeType: body.fluidType,
          isSnoozed: false,
          snoozeUntil: null,
          hasSeenMorningCommand: true,
          intakeEvents: nextEvents,
          updatedAt: now,
        })
        .where(eq(aforceUserState.userId, userId))
        .returning();
      if (!updated) throw new Error("user_state_missing");
      const [log] = await tx
        .insert(aforceIntakeLogs)
        .values({
          userId,
          fluidType: body.fluidType,
          ozAmount: body.ozAmount,
          scoreBefore: body.scoreBefore,
          scoreAfter: body.scoreAfter,
        })
        .returning();
      return { updated, log };
    });
    broadcastState(userId, result.updated);
    return res.json({ userState: result.updated, log: result.log });
  } catch (err) {
    logger.error({ err }, "POST /aforce/intake failed");
    return res.status(400).json({ error: "intake_failed" });
  }
});

// ─── POST /signals ─────────────────────────────────────────────────────────────
const signalsSchema = z.object({ symptoms: z.array(z.string()) });

router.post("/signals", async (req, res) => {
  try {
    const { symptoms } = signalsSchema.parse(req.body);
    const symptomState =
      symptoms.length === 0 ? "none" :
      symptoms.length <= 1 ? "mild" :
      symptoms.length <= 3 ? "moderate" : "severe";
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { symptoms, symptomState });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/signals failed");
    res.status(400).json({ error: "signals_failed" });
  }
});

// ─── POST /urine ───────────────────────────────────────────────────────────────
const urineSchema = z.object({ urineSignal: z.number().int().min(1).max(8) });

router.post("/urine", async (req, res) => {
  try {
    const { urineSignal } = urineSchema.parse(req.body);
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { urineSignal });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/urine failed");
    res.status(400).json({ error: "urine_failed" });
  }
});

// ─── POST /energy ──────────────────────────────────────────────────────────────
const energySchema = z.object({ energyState: z.enum(["peak", "steady", "low", "crashed"]) });

router.post("/energy", async (req, res) => {
  try {
    const { energyState } = energySchema.parse(req.body);
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { energyState });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/energy failed");
    res.status(400).json({ error: "energy_failed" });
  }
});

// ─── POST /checkin ─────────────────────────────────────────────────────────────
router.post("/checkin", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { hasSeenMorningCommand: true });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/checkin failed");
    res.status(500).json({ error: "checkin_failed" });
  }
});

// ─── POST /confirm ─────────────────────────────────────────────────────────────
const confirmSchema = z.object({ followed: z.boolean(), inClutch: z.boolean().optional() });

router.post("/confirm", async (req, res) => {
  try {
    const { followed, inClutch: clientInClutch = false } = confirmSchema.parse(req.body);
    const userId = resolveUserId(req);
    // Ensure row exists before opening the tx (avoids the seed dance
    // inside the transaction callback).
    await getUserState(userId);
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      // Read current row inside tx to authoritatively decide whether
      // we're really in Clutch (server is source of truth post-T6;
      // client `inClutch` is just a hint).
      const [current] = await tx.select().from(aforceUserState).where(eq(aforceUserState.userId, userId)).limit(1);
      if (!current) throw new Error("user_state_missing");
      const inClutch = current.clutchActive || clientInClutch;
      const patch: Partial<typeof aforceUserState.$inferInsert> = {
        confirmationDelta: followed ? 3 : -3,
        confirmationDeltaSetAt: now,
        updatedAt: now,
      };
      if (!followed && inClutch) {
        patch.clutchDecayBoostUntil = new Date(now.getTime() + 10 * 60 * 1000);
      }
      const [updated] = await tx
        .update(aforceUserState)
        .set(patch)
        .where(eq(aforceUserState.userId, userId))
        .returning();
      await tx.insert(aforceConfirmations).values({ userId, followed, inClutch });
      return updated;
    });
    broadcastState(userId, result);
    res.json({ userState: result });
  } catch (err) {
    logger.error({ err }, "POST /aforce/confirm failed");
    res.status(400).json({ error: "confirm_failed" });
  }
});

// ─── POST /flags ───────────────────────────────────────────────────────────────
const flagsSchema = z.object({ clutchActive: z.boolean() });

router.post("/flags", async (req, res) => {
  try {
    const { clutchActive } = flagsSchema.parse(req.body);
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { clutchActive });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/flags failed");
    res.status(400).json({ error: "flags_failed" });
  }
});

// ─── POST /language ────────────────────────────────────────────────────────────
// Persists the user's UI-language preference. Strict allow-list so a
// typo'd code can't poison the i18n bootstrap on next reload.
const languageSchema = z.object({
  language: z.enum(["en", "es", "fr", "de", "pt", "it"]),
});

router.post("/language", async (req, res) => {
  try {
    const { language } = languageSchema.parse(req.body);
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { language });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/language failed");
    res.status(400).json({ error: "language_failed" });
  }
});

// ─── Social Mode ─────────────────────────────────────────────────────────────
// All four endpoints persist `social_mode` JSONB and broadcast.
// Date fields are stored as ISO strings so the JSONB column is round-
// trippable; the client `normalizeUserState` converts them back.

const drinkTypeEnum = z.enum(["beer", "wine", "cocktail", "liquor", "hard_seltzer", "custom"]);
const DRINK_MULTIPLIERS: Record<string, number> = {
  beer: 1.15, wine: 1.20, cocktail: 1.30, liquor: 1.35, hard_seltzer: 1.15, custom: 1.25,
};

interface PersistedDrink {
  id: string;
  type: string;
  loggedAt: string;
  multiplier: number;
  hydrated: boolean | null;
  abv?: number;
  oz?: number;
}
interface PersistedSocialMode {
  active: boolean;
  startedAt: string;
  drinks: PersistedDrink[];
  lastHydrationPromptAt?: string;
  endedAt?: string;
  sex?: "male" | "female" | "unspecified";
  ateRecently?: boolean;
}

async function readSocial(userId: string): Promise<PersistedSocialMode | null> {
  const row = await getUserState(userId);
  return (row.socialMode ?? null) as PersistedSocialMode | null;
}

router.post("/social/activate", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const now = new Date().toISOString();
    const next: PersistedSocialMode = {
      active: true,
      startedAt: now,
      drinks: [],
    };
    const updated = await updateUserState(userId, { socialMode: next });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/social/activate failed");
    res.status(500).json({ error: "social_activate_failed" });
  }
});

const drinkSchema = z.object({
  type: drinkTypeEnum,
  abv: z.number().min(0).max(100).optional(),
  oz: z.number().min(0).max(64).optional(),
});
router.post("/social/drink", async (req, res) => {
  try {
    const { type, abv, oz } = drinkSchema.parse(req.body);
    const userId = resolveUserId(req);
    const now = new Date().toISOString();
    const current = (await readSocial(userId)) ?? {
      active: true,
      startedAt: now,
      drinks: [],
    };
    if (!current.active) {
      // User logged a drink without explicitly re-activating — treat
      // as a fresh session rather than rejecting (protective default).
      current.active = true;
      current.startedAt = now;
      current.drinks = [];
      delete current.endedAt;
    }
    const drink: PersistedDrink = {
      id: `drink-${Date.now()}`,
      type,
      loggedAt: now,
      multiplier: DRINK_MULTIPLIERS[type] ?? 1.25,
      hydrated: null,
      ...(abv != null ? { abv } : {}),
      ...(oz != null ? { oz } : {}),
    };
    const next: PersistedSocialMode = { ...current, drinks: [...current.drinks, drink] };
    const updated = await updateUserState(userId, { socialMode: next });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/social/drink failed");
    res.status(400).json({ error: "social_drink_failed" });
  }
});

const hydrateSchema = z.object({ confirmed: z.boolean() });
router.post("/social/hydrate", async (req, res) => {
  try {
    const { confirmed } = hydrateSchema.parse(req.body);
    const userId = resolveUserId(req);
    const current = await readSocial(userId);
    if (!current) {
      return res.status(400).json({ error: "social_not_active" });
    }
    // Mark the most recent pending drink as hydrated/skipped.
    const drinks = [...current.drinks];
    for (let i = drinks.length - 1; i >= 0; i -= 1) {
      if (drinks[i].hydrated == null) {
        drinks[i] = { ...drinks[i], hydrated: confirmed };
        break;
      }
    }
    const next: PersistedSocialMode = {
      ...current,
      drinks,
      lastHydrationPromptAt: new Date().toISOString(),
    };
    const updated = await updateUserState(userId, { socialMode: next });
    broadcastState(userId, updated);
    return res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/social/hydrate failed");
    return res.status(400).json({ error: "social_hydrate_failed" });
  }
});

const contextSchema = z.object({
  sex: z.enum(["male", "female", "unspecified"]).optional(),
  ateRecently: z.boolean().optional(),
});
router.post("/social/context", async (req, res) => {
  try {
    const patch = contextSchema.parse(req.body);
    const userId = resolveUserId(req);
    const current = (await readSocial(userId)) ?? {
      active: false,
      startedAt: new Date().toISOString(),
      drinks: [],
    };
    const next: PersistedSocialMode = {
      ...current,
      ...(patch.sex !== undefined ? { sex: patch.sex } : {}),
      ...(patch.ateRecently !== undefined ? { ateRecently: patch.ateRecently } : {}),
    };
    const updated = await updateUserState(userId, { socialMode: next });
    broadcastState(userId, updated);
    return res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/social/context failed");
    return res.status(400).json({ error: "social_context_failed" });
  }
});

router.post("/social/deactivate", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const current = await readSocial(userId);
    const now = new Date().toISOString();
    const next: PersistedSocialMode = current
      ? { ...current, active: false, endedAt: now }
      : { active: false, startedAt: now, endedAt: now, drinks: [] };
    const updated = await updateUserState(userId, { socialMode: next });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/social/deactivate failed");
    res.status(500).json({ error: "social_deactivate_failed" });
  }
});

// ─── Hydration Journal ─────────────────────────────────────────────────────────
// Longitudinal score / intake / sodium / sessions history.
//   POST /journal/snapshot  → persist a single score snapshot row
//   GET  /journal/timeline  → chronological interleave of snapshots + intake_logs
//   GET  /journal/rollups   → per-day aggregates (avg/min/max score, % time per band, totals)

const LEVELS = ["PEAK", "BALANCED", "RECOVERING", "DEPLETED"] as const;
const snapshotSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(LEVELS),
  ozConsumedToday: z.number().min(0).default(0),
  aforceUnitsToday: z.number().int().min(0).default(0),
  unitsConsumedToday: z.number().int().min(0).default(0),
  sodiumDeliveredMg: z.number().min(0).default(0),
  sodiumLostMg: z.number().min(0).default(0),
  deficitPct: z.number().min(0).default(0),
  clutchActive: z.boolean().default(false),
  socialActive: z.boolean().default(false),
  autopilotActive: z.boolean().default(false),
  reason: z.string().max(280).default(""),
});

router.post("/journal/snapshot", async (req, res) => {
  try {
    const body = snapshotSchema.parse(req.body);
    const userId = resolveUserId(req);
    const [row] = await db
      .insert(aforceScoreSnapshots)
      .values({ userId, ...body })
      .returning();
    return res.json({ snapshot: row });
  } catch (err) {
    logger.error({ err }, "POST /aforce/journal/snapshot failed");
    return res.status(400).json({ error: "snapshot_failed" });
  }
});

const daysQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
});

router.get("/journal/timeline", async (req, res) => {
  try {
    const { days } = daysQuery.parse(req.query);
    const userId = resolveUserId(req);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [snapshots, intakes] = await Promise.all([
      db
        .select()
        .from(aforceScoreSnapshots)
        .where(and(eq(aforceScoreSnapshots.userId, userId), gte(aforceScoreSnapshots.capturedAt, since)))
        .orderBy(asc(aforceScoreSnapshots.capturedAt)),
      db
        .select()
        .from(aforceIntakeLogs)
        .where(and(eq(aforceIntakeLogs.userId, userId), gte(aforceIntakeLogs.loggedAt, since)))
        .orderBy(asc(aforceIntakeLogs.loggedAt)),
    ]);

    type SnapshotLevel = (typeof LEVELS)[number];
    const validLevels = new Set<string>(LEVELS);
    type Entry =
      | {
          type: "snapshot";
          at: string;
          score: number;
          level: SnapshotLevel;
          ozConsumedToday: number;
          aforceUnitsToday: number;
          unitsConsumedToday: number;
          sodiumDeliveredMg: number;
          sodiumLostMg: number;
          deficitPct: number;
          clutchActive: boolean;
          socialActive: boolean;
          autopilotActive: boolean;
          reason: string;
        }
      | {
          type: "intake";
          at: string;
          fluidType: string;
          ozAmount: number;
          scoreBefore: number;
          scoreAfter: number;
        };

    const entries: Entry[] = [
      ...snapshots
        // Drop legacy / corrupted rows whose `level` doesn't match the
        // expected union — keeps the client's PerformanceLevel type
        // honest without crashing the request.
        .filter((s) => validLevels.has(s.level))
        .map<Entry>((s) => ({
        type: "snapshot",
        at: s.capturedAt.toISOString(),
        score: s.score,
        level: s.level as SnapshotLevel,
        ozConsumedToday: s.ozConsumedToday,
        aforceUnitsToday: s.aforceUnitsToday,
        unitsConsumedToday: s.unitsConsumedToday,
        sodiumDeliveredMg: s.sodiumDeliveredMg,
        sodiumLostMg: s.sodiumLostMg,
        deficitPct: s.deficitPct,
        clutchActive: s.clutchActive,
        socialActive: s.socialActive,
        autopilotActive: s.autopilotActive,
        reason: s.reason,
      })),
      ...intakes.map<Entry>((i) => ({
        type: "intake",
        at: i.loggedAt.toISOString(),
        fluidType: i.fluidType,
        ozAmount: i.ozAmount,
        scoreBefore: i.scoreBefore,
        scoreAfter: i.scoreAfter,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    return res.json({ entries, days });
  } catch (err) {
    logger.error({ err }, "GET /aforce/journal/timeline failed");
    return res.status(400).json({ error: "timeline_failed" });
  }
});

router.get("/journal/rollups", async (req, res) => {
  try {
    const { days } = daysQuery.parse(req.query);
    const userId = resolveUserId(req);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [snapshots, intakes] = await Promise.all([
      db
        .select()
        .from(aforceScoreSnapshots)
        .where(and(eq(aforceScoreSnapshots.userId, userId), gte(aforceScoreSnapshots.capturedAt, since)))
        .orderBy(asc(aforceScoreSnapshots.capturedAt)),
      db
        .select()
        .from(aforceIntakeLogs)
        .where(and(eq(aforceIntakeLogs.userId, userId), gte(aforceIntakeLogs.loggedAt, since)))
        .orderBy(asc(aforceIntakeLogs.loggedAt)),
    ]);

    function dayKey(d: Date): string {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }

    interface DayAcc {
      date: string;
      snapshotsCount: number;
      sumScore: number;
      minScore: number;
      maxScore: number;
      lastOzConsumed: number;
      lastAforceUnits: number;
      lastUnitsConsumed: number;
      lastSodiumDelivered: number;
      lastSodiumLost: number;
      lastDeficitPct: number;
      bandMillis: { PEAK: number; BALANCED: number; RECOVERING: number; DEPLETED: number };
      intakeCount: number;
      autopilotSessions: number;
      socialSessions: number;
      autopilotPrev: boolean;
      socialPrev: boolean;
    }

    const acc = new Map<string, DayAcc>();
    function ensure(date: string): DayAcc {
      let d = acc.get(date);
      if (!d) {
        d = {
          date,
          snapshotsCount: 0,
          sumScore: 0,
          minScore: Number.POSITIVE_INFINITY,
          maxScore: Number.NEGATIVE_INFINITY,
          lastOzConsumed: 0,
          lastAforceUnits: 0,
          lastUnitsConsumed: 0,
          lastSodiumDelivered: 0,
          lastSodiumLost: 0,
          lastDeficitPct: 0,
          bandMillis: { PEAK: 0, BALANCED: 0, RECOVERING: 0, DEPLETED: 0 },
          intakeCount: 0,
          autopilotSessions: 0,
          socialSessions: 0,
          autopilotPrev: false,
          socialPrev: false,
        };
        acc.set(date, d);
      }
      return d;
    }

    /**
     * Attribute a half-open interval `[fromMs, toMs)` to a single level,
     * splitting at UTC day boundaries so each calendar day gets the
     * portion that fell within it. Caller is responsible for capping
     * the interval length (gap policy).
     */
    function attributeInterval(fromMs: number, toMs: number, level: string) {
      if (toMs <= fromMs) return;
      const k = level as keyof DayAcc["bandMillis"];
      let cursor = fromMs;
      while (cursor < toMs) {
        const cursorDate = new Date(cursor);
        const nextMidnight = Date.UTC(
          cursorDate.getUTCFullYear(),
          cursorDate.getUTCMonth(),
          cursorDate.getUTCDate() + 1,
        );
        const segEnd = Math.min(toMs, nextMidnight);
        const dt = segEnd - cursor;
        if (dt > 0) {
          const d = ensure(dayKey(cursorDate));
          if (k in d.bandMillis) d.bandMillis[k] += dt;
        }
        cursor = segEnd;
      }
    }

    // First pass: per-day stats (avg / min / max / end-of-day totals,
    // session edge counts).
    for (const s of snapshots) {
      const date = dayKey(s.capturedAt);
      const d = ensure(date);
      d.snapshotsCount += 1;
      d.sumScore += s.score;
      d.minScore = Math.min(d.minScore, s.score);
      d.maxScore = Math.max(d.maxScore, s.score);
      d.lastOzConsumed = s.ozConsumedToday;
      d.lastAforceUnits = s.aforceUnitsToday;
      d.lastUnitsConsumed = s.unitsConsumedToday;
      d.lastSodiumDelivered = s.sodiumDeliveredMg;
      d.lastSodiumLost = s.sodiumLostMg;
      d.lastDeficitPct = s.deficitPct;
      if (s.autopilotActive && !d.autopilotPrev) d.autopilotSessions += 1;
      if (s.socialActive && !d.socialPrev) d.socialSessions += 1;
      d.autopilotPrev = s.autopilotActive;
      d.socialPrev = s.socialActive;
    }

    // Second pass: continuous band-time attribution across the whole
    // window. Each segment between consecutive samples is held at the
    // previous sample's level, capped at 1 h (to avoid attributing
    // overnight idle time as "still in this band"), and split at UTC
    // day boundaries so single-snapshot days still get their share.
    const GAP_CAP_MS = 60 * 60 * 1000;
    for (let i = 0; i < snapshots.length - 1; i++) {
      const cur = snapshots[i]!;
      const next = snapshots[i + 1]!;
      const fromMs = cur.capturedAt.getTime();
      const toMs = Math.min(next.capturedAt.getTime(), fromMs + GAP_CAP_MS);
      attributeInterval(fromMs, toMs, cur.level);
    }
    if (snapshots.length > 0) {
      const last = snapshots[snapshots.length - 1]!;
      const lastTs = last.capturedAt.getTime();
      const tailEnd = Math.min(Date.now(), lastTs + GAP_CAP_MS);
      attributeInterval(lastTs, tailEnd, last.level);
    }

    for (const i of intakes) {
      const date = dayKey(i.loggedAt);
      const d = ensure(date);
      d.intakeCount += 1;
    }

    const rollups = Array.from(acc.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        const totalBand = d.bandMillis.PEAK + d.bandMillis.BALANCED + d.bandMillis.RECOVERING + d.bandMillis.DEPLETED;
        const pct = (n: number) => (totalBand > 0 ? Math.round((n / totalBand) * 100) : 0);
        return {
          date: d.date,
          snapshotsCount: d.snapshotsCount,
          avgScore: d.snapshotsCount > 0 ? Math.round(d.sumScore / d.snapshotsCount) : 0,
          minScore: d.snapshotsCount > 0 ? d.minScore : 0,
          maxScore: d.snapshotsCount > 0 ? d.maxScore : 0,
          endOzConsumed: d.lastOzConsumed,
          endAforceUnits: d.lastAforceUnits,
          endUnitsConsumed: d.lastUnitsConsumed,
          endSodiumDelivered: d.lastSodiumDelivered,
          endSodiumLost: d.lastSodiumLost,
          endDeficitPct: d.lastDeficitPct,
          pctTimePeak: pct(d.bandMillis.PEAK),
          pctTimeBalanced: pct(d.bandMillis.BALANCED),
          pctTimeRecovering: pct(d.bandMillis.RECOVERING),
          pctTimeDepleted: pct(d.bandMillis.DEPLETED),
          intakeCount: d.intakeCount,
          autopilotSessions: d.autopilotSessions,
          socialSessions: d.socialSessions,
        };
      });

    return res.json({ rollups, days });
  } catch (err) {
    logger.error({ err }, "GET /aforce/journal/rollups failed");
    return res.status(400).json({ error: "rollups_failed" });
  }
});

// ─── GET /weather?lat&lon ──────────────────────────────────────────────────────
const weatherQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

router.get("/weather", weatherLimiter, async (req, res) => {
  try {
    const { lat, lon } = weatherQuery.parse(req.query);
    const snapshot = await fetchWeather(lat, lon);
    if (!snapshot) {
      return res.status(503).json({ error: "weather_unavailable" });
    }
    // Persist into user state so the engine can read it on next score
    // calculation, and the next /state fetch picks it up automatically.
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, {
      weatherTempC: snapshot.tempC,
      weatherHumidity: snapshot.humidity,
      weatherCity: snapshot.city,
      weatherFetchedAt: new Date(snapshot.fetchedAt),
    });
    broadcastState(userId, updated);
    return res.json({ weather: snapshot, userState: updated });
  } catch (err) {
    logger.error({ err }, "GET /aforce/weather failed");
    return res.status(400).json({ error: "weather_failed" });
  }
});

// ─── Sweat-sensor import ───────────────────────────────────────────────────────
// Accepts parsed rows from a third-party patch (hDrop / Nix / Gx).
// Each row creates an intake_log + a score_snapshot tagged with
// `reason='sensor:<source>'`. We approximate the intake side as a
// water-equivalent rehydration: 1 oz per 30 mL replaced (= a ~30 mL
// AForce stick converts back to 1 oz, the user's drinking unit). The
// snapshot deficit_pct stores the actual sweat loss / sodium loss so
// the journal still reflects the raw sensor data.

const SENSOR_SOURCES = ["hdrop", "nix", "gatorade_gx"] as const;

const sensorRowSchema = z.object({
  timestamp: z.string().min(1),
  sweatLossMl: z.number().nonnegative(),
  sodiumMg: z.number().nonnegative().default(0),
  potassiumMg: z.number().nonnegative().optional(),
});

const sensorImportSchema = z.object({
  source: z.enum(SENSOR_SOURCES),
  rows: z.array(sensorRowSchema).min(1).max(2000),
});

router.post("/sensors/import", async (req, res) => {
  try {
    const body = sensorImportSchema.parse(req.body);
    const userId = resolveUserId(req);
    await getUserState(userId);
    const reason = `sensor:${body.source}`;

    let lastTs = 0;
    const intakes: Array<typeof aforceIntakeLogs.$inferInsert> = [];
    const snapshots: Array<typeof aforceScoreSnapshots.$inferInsert> = [];

    for (const row of body.rows) {
      const ts = new Date(row.timestamp);
      if (Number.isNaN(ts.getTime())) continue;
      lastTs = Math.max(lastTs, ts.getTime());
      // Approximate water-equivalent rehydration: 30 mL ≈ 1 oz.
      const ozEquivalent = Math.max(0, row.sweatLossMl / 30);
      intakes.push({
        userId,
        fluidType: "water",
        ozAmount: ozEquivalent,
        // Score before/after on a sensor-derived row are placeholders;
        // the engine recomputes the displayed score on the next /state
        // fetch. We just need a non-null pair that the timeline can
        // render.
        scoreBefore: 70,
        scoreAfter: 70,
        loggedAt: ts,
      });
      // Use deficit_pct as the carrier for "sodium-loss vs delivered"
      // ratio for this interval — bounded 0–100 to match the column
      // semantics elsewhere.
      const sodiumLost = row.sodiumMg;
      const deficitPct = Math.min(100, sodiumLost / 50); // rough %: 5g lost ≈ 100
      snapshots.push({
        userId,
        score: 70,
        level: "BALANCED",
        ozConsumedToday: ozEquivalent,
        aforceUnitsToday: 0,
        unitsConsumedToday: 1,
        sodiumDeliveredMg: 0,
        sodiumLostMg: sodiumLost,
        deficitPct,
        clutchActive: false,
        socialActive: false,
        autopilotActive: false,
        reason,
        capturedAt: ts,
      });
    }

    if (intakes.length === 0) {
      return res.status(400).json({ error: "no_valid_rows" });
    }

    // Defensive guard against client-side timestamp parsing bugs
    // (e.g. unix-seconds misread as unix-ms producing 1970 dates, or
    // future-dated samples from clock-skewed sensors). Only allow
    // `lastIntakeTime` to advance into a plausible window.
    const TS_MIN = Date.UTC(2015, 0, 1);
    const TS_MAX = Date.now() + 24 * 60 * 60 * 1000; // +1 day grace
    const safeLastTs = lastTs > TS_MIN && lastTs < TS_MAX ? lastTs : 0;

    await db.transaction(async (tx) => {
      await tx.insert(aforceIntakeLogs).values(intakes);
      await tx.insert(aforceScoreSnapshots).values(snapshots);
      // Bump lastIntakeTime to the most recent valid sensor sample so
      // the engine's recency-aware terms reflect the import.
      if (safeLastTs > 0) {
        await tx
          .update(aforceUserState)
          .set({ lastIntakeTime: new Date(safeLastTs), updatedAt: new Date() })
          .where(eq(aforceUserState.userId, userId));
      }
    });

    // Auto-unlock Sensor Sync on first successful import (idempotent).
    await unlockAchievementCode(userId, "sensor_sync");

    return res.json({ imported: intakes.length, source: body.source, reason });
  } catch (err) {
    logger.error({ err }, "POST /aforce/sensors/import failed");
    return res.status(400).json({ error: "sensor_import_failed" });
  }
});

// ─── Achievements ──────────────────────────────────────────────────────────────
// Catalog lives client-side (services/achievementsCatalog.ts); the
// server only persists which codes a user has unlocked + computes
// progress on the fly from snapshots + intake_logs.

const ACH_CODES = [
  "first_sip", "streak_3", "streak_7", "streak_30",
  "sodium_master", "heat_survivor", "recovery_rookie", "social_sentinel",
  "aforce_convert", "hydration_engineer", "pdf_pioneer", "sensor_sync",
] as const;
type AchCode = (typeof ACH_CODES)[number];

const unlockSchema = z.object({ code: z.enum(ACH_CODES) });

/**
 * Insert an unlock row, ignoring duplicates. Returns true if this call
 * was the one that actually persisted the unlock (used to drive the
 * client's haptic / toast).
 */
async function unlockAchievementCode(userId: string, code: AchCode): Promise<boolean> {
  // Atomic upsert: relies on the (user_id, code) UNIQUE index. If a
  // concurrent request already inserted, ON CONFLICT swallows it and
  // returning() yields zero rows, which we surface as newlyUnlocked=false.
  const inserted = await db
    .insert(aforceAchievements)
    .values({ userId, code })
    .onConflictDoNothing({ target: [aforceAchievements.userId, aforceAchievements.code] })
    .returning({ id: aforceAchievements.id });
  return inserted.length > 0;
}

router.post("/achievements/unlock", async (req, res) => {
  try {
    const { code } = unlockSchema.parse(req.body);
    const userId = resolveUserId(req);
    const newlyUnlocked = await unlockAchievementCode(userId, code);
    return res.json({ code, unlocked: true, newlyUnlocked });
  } catch (err) {
    logger.error({ err }, "POST /aforce/achievements/unlock failed");
    return res.status(400).json({ error: "unlock_failed" });
  }
});

router.get("/achievements", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    // Pull the snapshots + intakes window we need to compute progress.
    // 60 days is plenty for the longest streak (30) plus headroom.
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const [snapshots, intakes, persisted] = await Promise.all([
      db
        .select()
        .from(aforceScoreSnapshots)
        .where(and(eq(aforceScoreSnapshots.userId, userId), gte(aforceScoreSnapshots.capturedAt, since)))
        .orderBy(asc(aforceScoreSnapshots.capturedAt)),
      db
        .select({ id: aforceIntakeLogs.id, loggedAt: aforceIntakeLogs.loggedAt, fluidType: aforceIntakeLogs.fluidType })
        .from(aforceIntakeLogs)
        .where(and(eq(aforceIntakeLogs.userId, userId), gte(aforceIntakeLogs.loggedAt, since)))
        .orderBy(asc(aforceIntakeLogs.loggedAt)),
      db
        .select()
        .from(aforceAchievements)
        .where(and(eq(aforceAchievements.userId, userId), inArray(aforceAchievements.code, ACH_CODES as unknown as string[])))
        .orderBy(desc(aforceAchievements.unlockedAt)),
    ]);

    // ─── Day buckets for streak / sodium-master / heat-survivor ────────
    function dayKey(d: Date): string {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }

    const intakeDays = new Set<string>();
    for (const i of intakes) intakeDays.add(dayKey(i.loggedAt));

    // Longest current trailing streak (back from today).
    function trailingStreak(): number {
      let n = 0;
      const cursor = new Date();
      // Walk backward day by day until we hit a day with no intake.
      for (let safety = 0; safety < 60; safety += 1) {
        if (intakeDays.has(dayKey(cursor))) {
          n += 1;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else {
          break;
        }
      }
      return n;
    }
    const streak = trailingStreak();

    // Day-grouped snapshot stats.
    const dayStats = new Map<string, {
      lastDeficit: number;
      hadHeatPeak: boolean;
      hadAutopilot: boolean;
      hadSocial: boolean;
      maxAforceUnits: number;
    }>();
    for (const s of snapshots) {
      const k = dayKey(s.capturedAt);
      const cur = dayStats.get(k) ?? {
        lastDeficit: 100, hadHeatPeak: false, hadAutopilot: false,
        hadSocial: false, maxAforceUnits: 0,
      };
      cur.lastDeficit = s.deficitPct;
      // Heat Survivor: PEAK while a Heat Guard reason snapshot landed on
      // the same day. We approximate "heat guard active" via the reason
      // string flag — engine writes "heat_guard:..." prefixes.
      if (s.level === "PEAK" && /heat/i.test(s.reason)) cur.hadHeatPeak = true;
      if (s.autopilotActive) cur.hadAutopilot = true;
      if (s.socialActive) cur.hadSocial = true;
      if (s.aforceUnitsToday > cur.maxAforceUnits) cur.maxAforceUnits = s.aforceUnitsToday;
      dayStats.set(k, cur);
    }

    const sodiumMasterDays = Array.from(dayStats.values()).filter((d) => d.lastDeficit <= 5).length;
    const heatSurvivor = Array.from(dayStats.values()).some((d) => d.hadHeatPeak);
    const recoveryRookie = snapshots.some((s) => s.autopilotActive);
    const socialSentinel = snapshots.some((s) => s.socialActive);
    const aforceConvert = snapshots.some((s) => s.aforceUnitsToday >= 10);
    const hydrationEngineerCount = snapshots.length;

    const persistedMap = new Map<string, Date>();
    for (const p of persisted) persistedMap.set(p.code, p.unlockedAt);

    // Compute the live unlock state. A code may be "earned now" without
    // a persisted row yet (e.g. user hit the criterion on the most
    // recent snapshot). We persist on read so the unlock time is
    // anchored to the first time the criterion was satisfied.
    const liveUnlocked: Record<AchCode, boolean> = {
      first_sip:           intakes.length >= 1,
      streak_3:            streak >= 3,
      streak_7:            streak >= 7,
      streak_30:           streak >= 30,
      sodium_master:       sodiumMasterDays >= 4,
      heat_survivor:       heatSurvivor,
      recovery_rookie:     recoveryRookie,
      social_sentinel:     socialSentinel,
      aforce_convert:      aforceConvert,
      hydration_engineer:  hydrationEngineerCount >= 30,
      // pdf_pioneer + sensor_sync are persisted-only — they have no
      // recomputable on-the-fly criterion.
      pdf_pioneer:         persistedMap.has("pdf_pioneer"),
      sensor_sync:         persistedMap.has("sensor_sync"),
    };

    // Persist any newly-satisfied unlocks so the unlock date sticks.
    for (const code of ACH_CODES) {
      if (liveUnlocked[code] && !persistedMap.has(code)) {
        await unlockAchievementCode(userId, code);
        persistedMap.set(code, new Date());
      }
    }

    const progress: Partial<Record<AchCode, number>> = {
      streak_3:            Math.min(1, streak / 3),
      streak_7:            Math.min(1, streak / 7),
      streak_30:           Math.min(1, streak / 30),
      sodium_master:       Math.min(1, sodiumMasterDays / 4),
      hydration_engineer:  Math.min(1, hydrationEngineerCount / 30),
      aforce_convert:      Math.min(
        1,
        Math.max(0, ...Array.from(dayStats.values()).map((d) => d.maxAforceUnits)) / 10,
      ),
    };

    const unlocks = ACH_CODES.map((code) => {
      const unlockedAt = persistedMap.get(code);
      return {
        code,
        unlocked: liveUnlocked[code],
        ...(unlockedAt ? { unlockedAt: unlockedAt.toISOString() } : {}),
        ...(progress[code] != null ? { progress: progress[code] } : {}),
      };
    });

    return res.json({ unlocks });
  } catch (err) {
    logger.error({ err }, "GET /aforce/achievements failed");
    return res.status(500).json({ error: "achievements_failed" });
  }
});

export default router;
