import { Router, type IRouter } from "express";
import { serializeError } from "../../lib/serializeError";
import { z } from "zod";
import { getUserState, updateUserState } from "../../lib/aforceState";
import { logger } from "../../lib/logger";
import { resolveUserId, broadcastState } from "./shared";
import { sendApiError } from "../../lib/apiError";
import { requireEntitlement } from "../../middlewares/requireEntitlement";

const router: IRouter = Router();

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
  /** Chunk #4: Recovery preset pre-biases environmental stress. */
  preset?: "travel" | "heat" | "hard_block" | null;
  /** Chunk #5: Cruise Mode end timestamp (ISO 8601). Extends window 8h→24h. */
  cruiseUntil?: string;
  /** Chunk #5: Voyage Shield end timestamp (ISO 8601). Floors score at 60 for 12h. */
  voyageShieldUntil?: string;
}

async function readSocial(userId: string): Promise<PersistedSocialMode | null> {
  const row = await getUserState(userId);
  return (row.socialMode ?? null) as PersistedSocialMode | null;
}

const activateSchema = z.object({
  preset: z.enum(["travel", "heat", "hard_block"]).nullable().optional(),
});
router.post("/social/activate", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = activateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "social_activate_failed");
    return;
  }
  const { preset } = parsed.data;
  try {
    const userId = resolveUserId(req);
    const now = new Date().toISOString();
    const next: PersistedSocialMode = {
      active: true,
      startedAt: now,
      drinks: [],
      ...(preset ? { preset } : {}),
    };
    const updated = await updateUserState(userId, { socialMode: next });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/social/activate failed");
    sendApiError(req, res, 500, "social_activate_failed");
  }
});

const drinkSchema = z.object({
  type: drinkTypeEnum,
  abv: z.number().min(0).max(100).optional(),
  oz: z.number().min(0).max(64).optional(),
});
router.post("/social/drink", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = drinkSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "social_drink_failed");
    return;
  }
  const { type, abv, oz } = parsed.data;
  try {
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
    logger.error({ err: serializeError(err) }, "POST /aforce/social/drink failed");
    sendApiError(req, res, 500, "social_drink_failed");
  }
});

const hydrateSchema = z.object({ confirmed: z.boolean() });
router.post("/social/hydrate", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = hydrateSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "social_hydrate_failed");
    return;
  }
  const { confirmed } = parsed.data;
  try {
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
    logger.error({ err: serializeError(err) }, "POST /aforce/social/hydrate failed");
    sendApiError(req, res, 500, "social_hydrate_failed");
    return;
  }
});

const contextSchema = z.object({
  sex: z.enum(["male", "female", "unspecified"]).optional(),
  ateRecently: z.boolean().optional(),
});
router.post("/social/context", async (req, res) => {
  // Validation runs BEFORE the try, so a bad body is answered 400 by a
  // separate path and can never be confused with an operation failure.
  const parsed = contextSchema.safeParse(req.body);
  if (!parsed.success) {
    sendApiError(req, res, 400, "invalid_body", "social_context_failed");
    return;
  }
  const patch = parsed.data;
  try {
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
    logger.error({ err: serializeError(err) }, "POST /aforce/social/context failed");
    sendApiError(req, res, 500, "social_context_failed");
    return;
  }
});

// ─── Chunk #5: Cruise Mode + Voyage Shield ────────────────────────
// Both routes accept no body — engagement starts a fixed-duration
// timer relative to "now". Re-engagement extends/resets the timer.
// The Voyage Shield gate on the client is the source of truth for
// the premium check; the server stays permissive so feature-flag
// rollout and admin overrides remain trivial.

const CRUISE_DURATION_MS = 24 * 60 * 60 * 1000;
const VOYAGE_SHIELD_DURATION_MS = 12 * 60 * 60 * 1000;

router.post("/social/cruise", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const current = await readSocial(userId);
    const nowMs = Date.now();
    const cruiseUntil = new Date(nowMs + CRUISE_DURATION_MS).toISOString();
    const next: PersistedSocialMode = current
      ? { ...current, cruiseUntil }
      : { active: false, startedAt: new Date(nowMs).toISOString(), drinks: [], cruiseUntil };
    const updated = await updateUserState(userId, { socialMode: next });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/social/cruise failed");
    res.status(500).json({ error: "social_cruise_failed" });
  }
});

// Voyage Shield is a Recovery Mode capability — plan-gated in the client
// (SocialModeSheet gates on recovery_mode_enabled). Wave-2 PR1: the
// server now enforces the same entitlement so client state alone can
// never authorize it.
router.post("/social/shield", requireEntitlement("recovery_mode_enabled"), async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const current = await readSocial(userId);
    const nowMs = Date.now();
    const voyageShieldUntil = new Date(nowMs + VOYAGE_SHIELD_DURATION_MS).toISOString();
    const next: PersistedSocialMode = current
      ? { ...current, voyageShieldUntil }
      : { active: false, startedAt: new Date(nowMs).toISOString(), drinks: [], voyageShieldUntil };
    const updated = await updateUserState(userId, { socialMode: next });
    broadcastState(userId, updated);
    res.json({ userState: updated });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/social/shield failed");
    res.status(500).json({ error: "social_shield_failed" });
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
    logger.error({ err: serializeError(err) }, "POST /aforce/social/deactivate failed");
    res.status(500).json({ error: "social_deactivate_failed" });
  }
});

export default router;
