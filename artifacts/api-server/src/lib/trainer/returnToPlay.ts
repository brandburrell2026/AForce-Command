/**
 * Return-to-play — stage derivation and the coach projection.
 *
 * Phase 6 of `docs/TRAINER-DASHBOARD-BRIEF.md`. Pure functions. The two
 * acceptance criteria are both decided here, which is why neither needs a
 * database to prove:
 *
 *   "no code path can auto-advance a stage, and the coach payload is proven
 *    free of medical context by test."
 *
 * ON AUTO-ADVANCE. `deriveState` is a pure function of the sign-offs it is
 * handed. It takes no clock, no score, no elapsed time and no configuration:
 * there is no input it could advance on. The only way the current stage
 * changes is that a new sign-off row exists, and a sign-off row carries a
 * person's id. Nothing here can write one.
 *
 * ON THE COACH PAYLOAD. `coachView` builds a new object with four keys and
 * never touches the note, the stopped reason, or a stage description. Same
 * discipline as the Phase 1 redaction layer: construct upward, never delete
 * downward, so an added field cannot leak by being forgotten.
 */

export interface RtpStage {
  key: string;
  label: string;
  description?: string;
}

export interface RtpSignoff {
  stageIndex: number;
  stageKey: string;
  signedByUserId: string;
  signedAt: string;
  /** Staff-only. Present in the source, never in the coach projection. */
  note?: string | null;
}

export type RtpStatus = "active" | "completed" | "stopped";

export interface RtpSource {
  progressionId: string;
  athleteUserId: string;
  stages: RtpStage[];
  signoffs: RtpSignoff[];
  status: RtpStatus;
  /** Staff-only. */
  stoppedReason?: string | null;
  startedAt: string;
  /** The athlete's current availability, set separately by staff. */
  availabilityStatus?: string | null;
}

export interface RtpState {
  progressionId: string;
  /** Index of the stage awaiting sign-off, or null when every stage is done. */
  currentStageIndex: number | null;
  currentStage: RtpStage | null;
  completedCount: number;
  totalStages: number;
  status: RtpStatus;
  /** Every sign-off, oldest first, with attribution intact. */
  history: RtpSignoff[];
}

/**
 * Derive the current stage from sign-offs alone.
 *
 * Sign-offs are counted as a CONTIGUOUS RUN from stage 0. A gap means the run
 * stops there: if stages 0 and 2 are signed but 1 is not, the athlete is at
 * stage 1, not stage 3. A protocol that could be satisfied out of order is not
 * a progression, and treating the highest index as "current" would let one
 * mis-entered sign-off skip everything before it.
 */
export function deriveState(source: RtpSource): RtpState {
  const signed = new Map<number, RtpSignoff>();
  for (const s of source.signoffs) {
    // First writer wins, matching the database's unique index on
    // (progression, stageIndex).
    if (!signed.has(s.stageIndex)) signed.set(s.stageIndex, s);
  }

  let completed = 0;
  while (signed.has(completed) && completed < source.stages.length) completed += 1;

  const atEnd = completed >= source.stages.length;
  const history = [...source.signoffs].sort((a, b) => a.signedAt.localeCompare(b.signedAt));

  return {
    progressionId: source.progressionId,
    currentStageIndex: atEnd ? null : completed,
    currentStage: atEnd ? null : (source.stages[completed] ?? null),
    completedCount: completed,
    totalStages: source.stages.length,
    status: source.status,
    history,
  };
}

export type SignoffRefusal =
  | "progression_not_active"
  | "stage_out_of_range"
  | "stage_already_signed"
  | "stage_out_of_order";

/**
 * May this stage be signed right now?
 *
 * Refuses anything but the next stage in sequence. Skipping ahead is the
 * failure this check exists for: a progression whose stages can be signed in
 * any order is a checklist, not a protocol.
 */
export function canSignOff(
  source: RtpSource,
  stageIndex: number,
): { ok: true } | { ok: false; reason: SignoffRefusal } {
  if (source.status !== "active") return { ok: false, reason: "progression_not_active" };
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= source.stages.length) {
    return { ok: false, reason: "stage_out_of_range" };
  }
  if (source.signoffs.some((s) => s.stageIndex === stageIndex)) {
    return { ok: false, reason: "stage_already_signed" };
  }
  const state = deriveState(source);
  if (state.currentStageIndex !== stageIndex) return { ok: false, reason: "stage_out_of_order" };
  return { ok: true };
}

/** What staff see: everything, including notes and the stopped reason. */
export interface RtpStaffView extends RtpState {
  athleteUserId: string;
  stages: RtpStage[];
  stoppedReason: string | null;
  startedAt: string;
}

export function staffView(source: RtpSource): RtpStaffView {
  return {
    ...deriveState(source),
    athleteUserId: source.athleteUserId,
    stages: source.stages,
    stoppedReason: source.stoppedReason ?? null,
    startedAt: source.startedAt,
  };
}

/**
 * What a coach sees: the stage and the availability, and nothing else.
 *
 * The brief: "Coach view shows stage and availability only — never the
 * underlying reason."
 *
 * Built upward from four fields. No note, no stopped reason, no stage
 * description, no sign-off history, no author ids — knowing WHO signed a
 * medical stage and when is itself a medical disclosure.
 */
export interface RtpCoachView {
  athleteUserId: string;
  /** Stage label only, or null when the progression is finished. */
  stageLabel: string | null;
  /** "3 of 6", so a coach can see movement without seeing content. */
  stageProgress: string;
  availabilityStatus: string | null;
}

export function coachView(source: RtpSource): RtpCoachView {
  const state = deriveState(source);
  return {
    athleteUserId: source.athleteUserId,
    stageLabel: state.currentStage?.label ?? null,
    stageProgress: `${state.completedCount} of ${state.totalStages}`,
    availabilityStatus: source.availabilityStatus ?? null,
  };
}

/** Field names a coach payload must never contain. Shared with the tests. */
export const COACH_FORBIDDEN_FIELDS = [
  "note",
  "stoppedReason",
  "description",
  "history",
  "signoffs",
  "signedByUserId",
  "stages",
] as const;
