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

import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, aforceIntakeLogs, aforceConfirmations, aforceUserState } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_USER_ID, getUserState, updateUserState, incrementIntake } from "../lib/aforceState";
import { publish } from "../lib/aforceHub";
import { fetchWeather } from "../lib/openWeather";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// All routes operate on the single-user row for V1. Once auth lands,
// resolve userId from the session/cookie here.
function resolveUserId(): string {
  return DEFAULT_USER_ID;
}

function broadcastState(userId: string, row: unknown) {
  publish(userId, { type: "state", userState: row });
}

// ─── GET /state ────────────────────────────────────────────────────────────────
router.get("/state", async (_req, res) => {
  try {
    const userId = resolveUserId();
    const row = await getUserState(userId);
    res.json({ userState: row, serverTime: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "GET /aforce/state failed");
    res.status(500).json({ error: "state_fetch_failed" });
  }
});

// ─── POST /intake ──────────────────────────────────────────────────────────────
const intakeSchema = z.object({
  fluidType: z.string().min(1),
  ozAmount: z.number().positive(),
  scoreBefore: z.number().int(),
  scoreAfter: z.number().int(),
});

router.post("/intake", async (req, res) => {
  try {
    const body = intakeSchema.parse(req.body);
    const userId = resolveUserId();
    // Single transaction: atomic counter increment + log insert. If
    // either fails the whole thing rolls back, so a client retry won't
    // double-apply and we can never have a log without its state bump
    // (or vice-versa).
    const result = await db.transaction(async (tx) => {
      const updated = await tx
        .update(aforceUserState)
        .set({
          unitsConsumedToday: sql`${aforceUserState.unitsConsumedToday} + 1`,
          ozConsumedToday: sql`${aforceUserState.ozConsumedToday} + ${body.ozAmount}`,
          lastIntakeTime: new Date(),
          lastIntakeType: body.fluidType,
          isSnoozed: false,
          snoozeUntil: null,
          hasSeenMorningCommand: true,
          updatedAt: new Date(),
        })
        .where(eq(aforceUserState.userId, userId))
        .returning();
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
      return { updated: updated[0], log };
    });
    if (!result.updated) {
      // First-touch case: row didn't exist yet. Seed and retry once
      // outside the transaction (atomic via incrementIntake).
      await getUserState(userId);
      const updated = await incrementIntake(userId, body.ozAmount, body.fluidType, new Date());
      const [log] = await db.insert(aforceIntakeLogs).values({
        userId, fluidType: body.fluidType, ozAmount: body.ozAmount,
        scoreBefore: body.scoreBefore, scoreAfter: body.scoreAfter,
      }).returning();
      broadcastState(userId, updated);
      return res.json({ userState: updated, log });
    }
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
    const userId = resolveUserId();
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
    const userId = resolveUserId();
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
    const userId = resolveUserId();
    const updated = await updateUserState(userId, { energyState });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/energy failed");
    res.status(400).json({ error: "energy_failed" });
  }
});

// ─── POST /checkin ─────────────────────────────────────────────────────────────
router.post("/checkin", async (_req, res) => {
  try {
    const userId = resolveUserId();
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
    const userId = resolveUserId();
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
    const userId = resolveUserId();
    const updated = await updateUserState(userId, { clutchActive });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err }, "POST /aforce/flags failed");
    res.status(400).json({ error: "flags_failed" });
  }
});

// ─── GET /weather?lat&lon ──────────────────────────────────────────────────────
const weatherQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

router.get("/weather", async (req, res) => {
  try {
    const { lat, lon } = weatherQuery.parse(req.query);
    const snapshot = await fetchWeather(lat, lon);
    if (!snapshot) {
      return res.status(503).json({ error: "weather_unavailable" });
    }
    // Persist into user state so the engine can read it on next score
    // calculation, and the next /state fetch picks it up automatically.
    const userId = resolveUserId();
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
