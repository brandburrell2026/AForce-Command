import { Router, type IRouter } from "express";
import { serializeError } from "../../lib/serializeError";
import { z } from "zod";
import { db, aforceConfirmations, aforceUserState, type SafeUserStatePatch } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUserState, updateUserState } from "../../lib/aforceState";
import { fetchWeather } from "../../lib/openWeather";
import { logger } from "../../lib/logger";
import { weatherLimiter } from "../../middlewares/rateLimits";
import { resolveUserId, broadcastState } from "./shared";
import { sendApiError } from "../../lib/apiError";

const router: IRouter = Router();

// ─── POST /signals ─────────────────────────────────────────────────────────────
const signalsSchema = z.object({ symptoms: z.array(z.string()) });

router.post("/signals", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = signalsSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "signals_failed");
    return;
  }
  const { symptoms } = parsed.data;
  try {
    const symptomState =
      symptoms.length === 0 ? "none" :
      symptoms.length <= 1 ? "mild" :
      symptoms.length <= 3 ? "moderate" : "severe";
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { symptoms, symptomState });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/signals failed");
    sendApiError(req, res, 500, "signals_failed");
  }
});

// ─── POST /urine ───────────────────────────────────────────────────────────────
const urineSchema = z.object({ urineSignal: z.number().int().min(1).max(8) });

router.post("/urine", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = urineSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "urine_failed");
    return;
  }
  const { urineSignal } = parsed.data;
  try {
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { urineSignal });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/urine failed");
    sendApiError(req, res, 500, "urine_failed");
  }
});

// ─── POST /energy ──────────────────────────────────────────────────────────────
const energySchema = z.object({ energyState: z.enum(["peak", "steady", "low", "crashed"]) });

router.post("/energy", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = energySchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "energy_failed");
    return;
  }
  const { energyState } = parsed.data;
  try {
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { energyState });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/energy failed");
    sendApiError(req, res, 500, "energy_failed");
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
    logger.error({ err: serializeError(err) }, "POST /aforce/checkin failed");
    res.status(500).json({ error: "checkin_failed" });
  }
});

// ─── POST /confirm ─────────────────────────────────────────────────────────────
const confirmSchema = z.object({ followed: z.boolean(), inClutch: z.boolean().optional() });

router.post("/confirm", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "confirm_failed");
    return;
  }
  const { followed, inClutch: clientInClutch = false } = parsed.data;
  try {
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
      const patch: SafeUserStatePatch = {
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
    logger.error({ err: serializeError(err) }, "POST /aforce/confirm failed");
    sendApiError(req, res, 500, "confirm_failed");
  }
});

// ─── POST /flags ───────────────────────────────────────────────────────────────
const flagsSchema = z.object({ clutchActive: z.boolean() });

router.post("/flags", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = flagsSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "flags_failed");
    return;
  }
  const { clutchActive } = parsed.data;
  try {
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { clutchActive });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/flags failed");
    sendApiError(req, res, 500, "flags_failed");
  }
});

// ─── POST /language ────────────────────────────────────────────────────────────
// Persists the user's UI-language preference. Strict allow-list so a
// typo'd code can't poison the i18n bootstrap on next reload.
const languageSchema = z.object({
  language: z.enum(["en", "es", "fr", "de", "pt", "it"]),
});

router.post("/language", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = languageSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "language_failed");
    return;
  }
  const { language } = parsed.data;
  try {
    const userId = resolveUserId(req);
    const updated = await updateUserState(userId, { language });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/language failed");
    sendApiError(req, res, 500, "language_failed");
  }
});

// ─── GET /weather?lat&lon ──────────────────────────────────────────────────────
const weatherQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

router.get("/weather", weatherLimiter, async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = weatherQuery.safeParse(req.query);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "weather_failed");
    return;
  }
  const { lat, lon } = parsed.data;
  try {
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
    logger.error({ err: serializeError(err) }, "GET /aforce/weather failed");
    sendApiError(req, res, 500, "weather_failed");
    return;
  }
});

export default router;
