import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, aforceIntakeLogs, aforceUserState } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUserState, ALL_FLUID_TYPES, isAforceFluid } from "../../lib/aforceState";
import { logger } from "../../lib/logger";
import { intakeLimiter } from "../../middlewares/rateLimits";
import { resolveUserId, broadcastState } from "./shared";

const router: IRouter = Router();

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

export default router;
