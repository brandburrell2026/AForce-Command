import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, aforceIntakeLogs, aforceUserState } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { getUserState, ALL_FLUID_TYPES, isAforceFluid } from "../../lib/aforceState";
import { logger } from "../../lib/logger";
import { intakeLimiter } from "../../middlewares/rateLimits";
import { resolveUserId, broadcastState } from "./shared";
import { planIntakeCorrection, CORRECTION_REASONS } from "../../lib/intakeCorrection";

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
  // Idempotency key (the frozen client event id). Since RC-L12 slice 3 the
  // client sends it on the ONLINE path too, so a double-fired tap dedupes.
  // Still optional so legacy clients keep working unchanged.
  clientEventId: z.string().min(1).max(64).optional(),
  // §10 honesty (RC-L12) — record-only capture metadata, both optional.
  entrySource: z.enum(["tap", "scan_log", "voice", "offline_replay", "sensor"]).optional(),
  confirmationLevel: z.enum(["logged", "verified"]).optional(),
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
      // read-modify-write race on the JSONB array. The FOR UPDATE lock
      // also serializes per-user, making the keyed idempotency check below
      // race-safe (a concurrent replay of the same key waits, then sees the
      // first write's log row and returns it).
      const [current] = await tx
        .select({ intakeEvents: aforceUserState.intakeEvents })
        .from(aforceUserState)
        .where(eq(aforceUserState.userId, userId))
        .limit(1)
        .for('update');

      // ── Offline-outbox idempotency (keyed replays only) ──
      // Legacy/online writes OMIT `clientEventId`, so this block is skipped
      // and everything below is byte-identical to the pre-outbox behavior.
      // A keyed replay that already landed returns the current authoritative
      // state untouched — no double counters, no second log row, no duplicate
      // JSONB event (Score-Protection holds on replay).
      if (body.clientEventId) {
        const [existing] = await tx
          .select()
          .from(aforceIntakeLogs)
          .where(
            and(
              eq(aforceIntakeLogs.userId, userId),
              eq(aforceIntakeLogs.clientEventId, body.clientEventId),
            ),
          )
          .limit(1);
        if (existing) {
          const [row] = await tx
            .select()
            .from(aforceUserState)
            .where(eq(aforceUserState.userId, userId))
            .limit(1);
          if (!row) throw new Error("user_state_missing");
          return { updated: row, log: existing, replayed: true as const };
        }
      }

      type StoredEvent = NonNullable<typeof current>['intakeEvents'][number];
      const prevEvents: StoredEvent[] = current?.intakeEvents ?? [];
      const trimmed = prevEvents.filter((e) => {
        const t = new Date(e.loggedAt).getTime();
        return Number.isFinite(t) && now.getTime() - t < INTAKE_EVENT_MAX_AGE_MS;
      });

      // Stale-event guard: a keyed replay whose event has aged out of the
      // 24h scoring window must NOT inflate today's score/counters — we still
      // persist the historical log row below, but skip the live apply.
      // Legacy/online writes always carry a fresh `now` event, so
      // `applyToToday` is always true for them (no behavior change).
      const eventTs = body.event
        ? new Date(body.event.loggedAt).getTime()
        : now.getTime();
      const applyToToday =
        Number.isFinite(eventTs) &&
        now.getTime() - eventTs < INTAKE_EVENT_MAX_AGE_MS;

      // Defense-in-depth: never append the same event id twice. Only keyed
      // requests can collide (legacy events are minted fresh per request).
      const alreadyHasEvent =
        body.clientEventId && body.event
          ? trimmed.some((e) => e.id === body.event!.id)
          : false;
      const nextEvents: StoredEvent[] =
        body.event && applyToToday && !alreadyHasEvent
          ? [...trimmed, body.event]
          : trimmed;

      const [updated] = await tx
        .update(aforceUserState)
        .set({
          unitsConsumedToday: applyToToday
            ? sql`${aforceUserState.unitsConsumedToday} + 1`
            : aforceUserState.unitsConsumedToday,
          ozConsumedToday: applyToToday
            ? sql`${aforceUserState.ozConsumedToday} + ${body.ozAmount}`
            : aforceUserState.ozConsumedToday,
          aforceUnitsToday:
            applyToToday && isAforce
              ? sql`${aforceUserState.aforceUnitsToday} + 1`
              : aforceUserState.aforceUnitsToday,
          lastIntakeTime: applyToToday ? now : aforceUserState.lastIntakeTime,
          lastIntakeType: applyToToday
            ? body.fluidType
            : aforceUserState.lastIntakeType,
          isSnoozed: false,
          snoozeUntil: null,
          hasSeenMorningCommand: true,
          intakeEvents: nextEvents,
          updatedAt: now,
        })
        .where(eq(aforceUserState.userId, userId))
        .returning();
      if (!updated) throw new Error("user_state_missing");
      const [inserted] = await tx
        .insert(aforceIntakeLogs)
        .values({
          userId,
          fluidType: body.fluidType,
          ozAmount: body.ozAmount,
          scoreBefore: body.scoreBefore,
          scoreAfter: body.scoreAfter,
          ...(body.clientEventId ? { clientEventId: body.clientEventId } : {}),
          ...(body.entrySource ? { entrySource: body.entrySource } : {}),
          ...(body.confirmationLevel ? { confirmationLevel: body.confirmationLevel } : {}),
          // Keyed replays keep the original capture time for an accurate
          // historical log; legacy writes fall through to defaultNow().
          ...(body.event && body.clientEventId
            ? { loggedAt: new Date(body.event.loggedAt) }
            : {}),
        })
        .onConflictDoNothing({
          target: [aforceIntakeLogs.userId, aforceIntakeLogs.clientEventId],
        })
        .returning();
      // onConflictDoNothing returns nothing if a concurrent keyed insert won
      // the race; re-read so the response always carries a real log row.
      let log = inserted;
      if (!log && body.clientEventId) {
        const [existing] = await tx
          .select()
          .from(aforceIntakeLogs)
          .where(
            and(
              eq(aforceIntakeLogs.userId, userId),
              eq(aforceIntakeLogs.clientEventId, body.clientEventId),
            ),
          )
          .limit(1);
        log = existing;
      }
      if (!log) throw new Error("intake_log_insert_failed");
      return { updated, log, replayed: false as const };
    });
    // A pure replay changed nothing, so skip the redundant WS broadcast.
    if (!result.replayed) broadcastState(userId, result.updated);
    return res.json({ userState: result.updated, log: result.log });
  } catch (err) {
    logger.error({ err }, "POST /aforce/intake failed");
    return res.status(400).json({ error: "intake_failed" });
  }
});

// ─── POST /intake/correction ───────────────────────────────────────────────────
// §10 (RC-L12): auditable, append-only correction of a mistaken intake. The
// original row is NEVER mutated or deleted — a correction row references it
// (corrects_intake_id + reason) and, when the original applied to today's
// counters (24h window), reverses those counters and removes the linked
// scoring event so the materialized score no longer includes it. Floor-0
// guards make a replayed/racing correction safe.
const correctionSchema = z.object({
  intakeLogId: z.number().int().positive(),
  reason: z.enum(CORRECTION_REASONS),
});

router.post("/intake/correction", intakeLimiter, async (req, res) => {
  try {
    const body = correctionSchema.parse(req.body);
    const userId = resolveUserId(req);
    await getUserState(userId);
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // Serialize per-user (same lock as /intake) so a double-tapped Undo
      // can't reverse counters twice.
      await tx
        .select({ userId: aforceUserState.userId })
        .from(aforceUserState)
        .where(eq(aforceUserState.userId, userId))
        .limit(1)
        .for("update");

      const [log] = await tx
        .select()
        .from(aforceIntakeLogs)
        .where(eq(aforceIntakeLogs.id, body.intakeLogId))
        .limit(1);
      const [existingCorrection] = log
        ? await tx
            .select({ id: aforceIntakeLogs.id })
            .from(aforceIntakeLogs)
            .where(
              and(
                eq(aforceIntakeLogs.userId, userId),
                eq(aforceIntakeLogs.correctsIntakeId, body.intakeLogId),
              ),
            )
            .limit(1)
        : [undefined];

      const plan = planIntakeCorrection({
        log: log ?? null,
        requestUserId: userId,
        alreadyCorrected: existingCorrection != null,
        isAforceFluid: log ? isAforceFluid(log.fluidType as never) : false,
        nowMs: now.getTime(),
      });
      if (!plan.ok) return { rejected: plan.reason } as const;

      // Append the correction row (zero-impact scores: a correction is
      // bookkeeping, never score movement — Score Protection §9).
      const [correction] = await tx
        .insert(aforceIntakeLogs)
        .values({
          userId,
          fluidType: log!.fluidType,
          ozAmount: log!.ozAmount,
          scoreBefore: 0,
          scoreAfter: 0,
          correctsIntakeId: log!.id,
          correctionReason: body.reason,
          entrySource: "tap",
          confirmationLevel: "logged",
        })
        .returning();

      if (!plan.reverseCounters) {
        const [row] = await tx
          .select()
          .from(aforceUserState)
          .where(eq(aforceUserState.userId, userId))
          .limit(1);
        return { rejected: null, updated: row!, correction: correction! } as const;
      }

      // Reverse today's counters (floor 0) + drop the linked scoring event.
      const [current] = await tx
        .select({ intakeEvents: aforceUserState.intakeEvents })
        .from(aforceUserState)
        .where(eq(aforceUserState.userId, userId))
        .limit(1);
      const nextEvents = (current?.intakeEvents ?? []).filter(
        (e) => plan.removeEventId == null || e.id !== plan.removeEventId,
      );
      const [updated] = await tx
        .update(aforceUserState)
        .set({
          unitsConsumedToday: sql`GREATEST(${aforceUserState.unitsConsumedToday} - 1, 0)`,
          ozConsumedToday: sql`GREATEST(${aforceUserState.ozConsumedToday} - ${plan.ozToReverse}, 0)`,
          aforceUnitsToday: plan.isAforce
            ? sql`GREATEST(${aforceUserState.aforceUnitsToday} - 1, 0)`
            : aforceUserState.aforceUnitsToday,
          intakeEvents: nextEvents,
          updatedAt: now,
        })
        .where(eq(aforceUserState.userId, userId))
        .returning();
      if (!updated) throw new Error("user_state_missing");
      return { rejected: null, updated, correction: correction! } as const;
    });

    if (result.rejected) {
      const status = result.rejected === "not_found" || result.rejected === "not_owner" ? 404 : 409;
      return res.status(status).json({ error: result.rejected });
    }
    broadcastState(userId, result.updated);
    return res.json({ userState: result.updated, correction: result.correction });
  } catch (err) {
    logger.error({ err }, "POST /aforce/intake/correction failed");
    return res.status(400).json({ error: "correction_failed" });
  }
});

export default router;
