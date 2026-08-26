/**
 * Pure request/domain schemas for the intake write path (Wave-2 PR2
 * extraction, mirroring journalSchema.ts): kept free of any
 * `@workspace/db` import so the app<->backend contract — including the
 * Score Protection value bounds and the two-sided freshness window —
 * can be unit-tested without DATABASE_URL.
 */
import { z } from "zod";
import { ALL_FLUID_TYPES } from "../../lib/aforceState";

// `event` carries the per-event impact decomposition computed client-
// side by `services/hydrationScoreService.ts`. The server stores it
// verbatim into the `intake_events` JSONB so the materialized score
// is reproducible across reloads / multi-device. Cap-trim to last 24h.
export const flavorEnum = z.enum(["watermelon", "berry", "soursop", "unflavored"]);
// Wave-2 PR2 bounds: the impact decomposition is score POINTS that the
// client (and every other device of the same user) will re-materialize
// into score. Legit values are oz-derived and small (client UI max is
// 64oz; water points scale linearly with oz), so the full score scale
// (±100) is a generous envelope that only forged writes can exceed.
export const intakeEventSchema = z.object({
  id: z.string().min(1).max(64),
  fluidType: z.enum(ALL_FLUID_TYPES),
  flavor: flavorEnum.optional(),
  oz: z.number().positive().max(200),
  loggedAt: z.string().datetime({ offset: true }),
  baseImpact: z.number().min(-100).max(100),
  capAdjusted: z.number().min(-100).max(100),
  immediate: z.number().min(-100).max(100),
  delayed: z.number().min(-100).max(100),
  delayedDurationMin: z.number().positive().max(1440),
  heatGuardActiveAtLog: z.boolean(),
  scoreBeforeAtLog: z.number().min(0).max(100),
});
export const intakeSchema = z.object({
  // Strict allow-list (mirrors client `FluidType`). Rejects arbitrary
  // strings like `aforce_fake` that would otherwise sneak past the
  // bonus gate.
  fluidType: z.enum(ALL_FLUID_TYPES),
  ozAmount: z.number().positive().max(200),
  scoreBefore: z.number().int().min(0).max(100),
  scoreAfter: z.number().int().min(0).max(100),
  event: intakeEventSchema.optional(),
  // Idempotency key (the frozen client event id). Since RC-L12 slice 3 the
  // client sends it on the ONLINE path too, so a double-fired tap dedupes.
  // Still optional so legacy clients keep working unchanged.
  clientEventId: z.string().min(1).max(64).optional(),
  // §10 honesty (RC-L12) — record-only capture metadata, both optional.
  // Provenance — which SURFACE created this intake. Widened from the original
  // capture-mode list (tap/scan_log/voice/offline_replay/sensor), which could
  // not tell Home from Hydration from Protocol because all three are "tap".
  // Legacy values are retained verbatim so historical rows stay valid and older
  // clients keep working. Must stay in sync with the client's canonical
  // `services/intakeSource.ts`; a contract test fails if they drift.
  // Record-only: never affects scoring, dedupe or persistence, and the closed
  // enum means the field cannot become a free-text/PII channel.
  entrySource: z
    .enum([
      "home",
      "hydration",
      "scan",
      "protocol",
      "recovery",
      "voice",
      "manual",
      "tap",
      "scan_log",
      "offline_replay",
      "sensor",
    ])
    .optional(),
  confirmationLevel: z.enum(["logged", "verified"]).optional(),
});

export const INTAKE_EVENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Wave-2 PR2: the freshness checks below were one-sided (`now - t < MAX_AGE`),
// so a FUTURE-dated event was always "fresh" — it never aged out of the trim
// and always passed applyToToday. Two-sided now: allow a small clock-skew
// grace, reject anything further in the future.
export const INTAKE_EVENT_FUTURE_SKEW_MS = 5 * 60 * 1000;
export function intakeEventTsWithinWindow(eventTsMs: number, nowMs: number): boolean {
  return (
    Number.isFinite(eventTsMs) &&
    nowMs - eventTsMs < INTAKE_EVENT_MAX_AGE_MS &&
    eventTsMs - nowMs < INTAKE_EVENT_FUTURE_SKEW_MS
  );
}
