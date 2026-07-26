/**
 * intakeCorrection — pure planning logic for §10 intake corrections (RC-L12).
 *
 * A correction is an APPEND-ONLY row referencing the original log; the
 * original is never mutated or deleted (ledger integrity). This module only
 * decides whether a correction is allowed and what it must reverse — the
 * route applies the plan transactionally.
 */

export const CORRECTION_REASONS = ["mistake", "spill", "wrong_product", "duplicate"] as const;
export type CorrectionReason = (typeof CORRECTION_REASONS)[number];

/** Mirror of the 24h live-scoring window in POST /intake. */
export const CORRECTION_LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface CorrectableLog {
  id: number;
  userId: string;
  fluidType: string;
  ozAmount: number;
  clientEventId: string | null;
  correctsIntakeId: number | null;
  loggedAt: Date;
}

export type CorrectionRejection =
  | "not_found"
  | "not_owner"
  | "is_a_correction"
  | "already_corrected";

export interface CorrectionPlan {
  ok: true;
  /** Reverse today's counters only when the original applied to them. */
  reverseCounters: boolean;
  /** Remove this event id from the intake_events JSONB (null = no linkage —
   *  legacy keyless row; counters reverse but the stored event, if any,
   *  cannot be precisely identified. Documented §10 residual). */
  removeEventId: string | null;
  ozToReverse: number;
  isAforce: boolean;
}

export function planIntakeCorrection(args: {
  log: CorrectableLog | null;
  requestUserId: string;
  alreadyCorrected: boolean;
  isAforceFluid: boolean;
  nowMs: number;
}): CorrectionPlan | { ok: false; reason: CorrectionRejection } {
  const { log } = args;
  if (!log) return { ok: false, reason: "not_found" };
  if (log.userId !== args.requestUserId) return { ok: false, reason: "not_owner" };
  // A correction row can never itself be corrected (no correction chains).
  if (log.correctsIntakeId != null) return { ok: false, reason: "is_a_correction" };
  if (args.alreadyCorrected) return { ok: false, reason: "already_corrected" };

  const age = args.nowMs - log.loggedAt.getTime();
  const reverseCounters = Number.isFinite(age) && age >= 0 && age < CORRECTION_LIVE_WINDOW_MS;
  return {
    ok: true,
    reverseCounters,
    removeEventId: log.clientEventId,
    ozToReverse: log.ozAmount,
    isAforce: args.isAforceFluid,
  };
}
