/**
 * Orb — Score Reasons + Replay.
 *
 * Spec Rule #7:
 *   Keep visuals.
 *   Tap → Score Reasons
 *   Examples: Water +8 / Heat -3 / Sleep +4 / Correction +7
 *   Add replay.
 *
 * Hidden architecture only this turn — no UI changes, no edits to
 * StatusPulseOrb, OrbSection, ScoreBreakdownSheet, WhyThisScore,
 * WhyCompact, or scoringEngine. The canonical four-factor reason
 * vocabulary, signed-delta formatter, and replay frame builder
 * land here so a follow-up rule pass can wire a Score Reasons
 * sheet + scrubbable replay to the Orb tap handler without
 * inventing labels or math.
 *
 * Gate: `spec_orb` (default true — the Orb itself is core; only
 * the formalized reasons + replay are new).
 */
import { useFeatureFlags } from '@/store/useAppStore';

/** The four spec factor names that move the score. */
export const ORB_REASON_FACTORS = [
  'water',
  'heat',
  'sleep',
  'correction',
] as const;

export type OrbReasonFactor = (typeof ORB_REASON_FACTORS)[number];

/** Human display strings. Spec examples: "Water +8", "Heat -3", ... */
export const ORB_REASON_LABELS: Readonly<Record<OrbReasonFactor, string>> = {
  water: 'Water',
  heat: 'Heat',
  sleep: 'Sleep',
  correction: 'Correction',
};

/** One scoring event surfaced in the Score Reasons sheet. */
export interface ScoreReason {
  factor: OrbReasonFactor;
  /** Signed integer delta applied to the score (e.g. +8, -3). */
  delta: number;
  /** ISO-8601 instant the delta was applied. */
  atIso: string;
}

/**
 * Pure: format a delta the way the spec writes it.
 *   8  → "+8"
 *  -3  → "-3"
 *   0  → "+0" (still signed; spec examples are all non-zero but
 *              keep the formatter total so the UI never has to
 *              special-case zero)
 */
export function formatReasonDelta(delta: number): string {
  const n = Math.trunc(delta);
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Aggregate view of a list of reasons. Pure. */
export interface ReasonSummary {
  total: number;
  positive: number;
  negative: number;
  byFactor: Record<OrbReasonFactor, number>;
}

export function summarizeReasons(reasons: readonly ScoreReason[]): ReasonSummary {
  const byFactor: Record<OrbReasonFactor, number> = {
    water: 0,
    heat: 0,
    sleep: 0,
    correction: 0,
  };
  let total = 0;
  let positive = 0;
  let negative = 0;
  for (const r of reasons) {
    const d = Math.trunc(r.delta);
    byFactor[r.factor] += d;
    total += d;
    if (d > 0) positive += d;
    else if (d < 0) negative += d;
  }
  return { total, positive, negative, byFactor };
}

/** One step in the Orb replay timeline. */
export interface OrbReplayFrame {
  atIso: string;
  /** Score after applying this frame's reason (baseline + cumulative deltas). */
  runningScore: number;
  reason: ScoreReason;
}

/**
 * Pure: build an ordered replay from a baseline score and a list of
 * reasons. Frames are sorted ascending by `atIso`; each frame's
 * `runningScore` is the baseline plus all prior deltas plus this
 * frame's delta. Output length === input length.
 */
export function buildReplay(
  baselineScore: number,
  reasons: readonly ScoreReason[],
): OrbReplayFrame[] {
  const sorted = [...reasons].sort((a, b) => a.atIso.localeCompare(b.atIso));
  let running = baselineScore;
  const frames: OrbReplayFrame[] = [];
  for (const reason of sorted) {
    running += Math.trunc(reason.delta);
    frames.push({ atIso: reason.atIso, runningScore: running, reason });
  }
  return frames;
}

/**
 * Pure: which frame is "current" for a scrubber positioned at
 * `elapsedMs` along a `totalDurationMs` timeline.
 *
 *   - elapsedMs <= 0           → frame 0 (or null if no frames)
 *   - elapsedMs >= totalMs     → last frame
 *   - in between               → floor(progress * frames.length),
 *                                clamped to last index
 *
 * Used by a future replay scrubber UI; deterministic so it tests
 * cleanly without a real clock.
 */
export function replayFrameAt(
  frames: readonly OrbReplayFrame[],
  elapsedMs: number,
  totalDurationMs: number,
): OrbReplayFrame | null {
  if (frames.length === 0) return null;
  if (elapsedMs <= 0) return frames[0]!;
  if (totalDurationMs <= 0 || elapsedMs >= totalDurationMs) {
    return frames[frames.length - 1]!;
  }
  const idx = Math.min(
    frames.length - 1,
    Math.floor((elapsedMs / totalDurationMs) * frames.length),
  );
  return frames[idx]!;
}

export interface OrbReasonsState {
  enabled: boolean;
  factors: typeof ORB_REASON_FACTORS;
  labels: typeof ORB_REASON_LABELS;
}

/**
 * Hidden hook. Returns the canonical factor vocabulary plus an
 * `enabled` boolean gated on `spec_orb`. Not consumed by any UI
 * yet — the existing StatusPulseOrb / ScoreBreakdownSheet still
 * own the visible Orb surface.
 */
export function useHiddenOrbReasons(): OrbReasonsState {
  const flags = useFeatureFlags();
  return {
    enabled: !!flags.spec_orb,
    factors: ORB_REASON_FACTORS,
    labels: ORB_REASON_LABELS,
  };
}
