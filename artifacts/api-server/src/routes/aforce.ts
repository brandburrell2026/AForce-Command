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
import { db, aforceIntakeLogs, aforceConfirmations, aforceUserState } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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

export default router;
