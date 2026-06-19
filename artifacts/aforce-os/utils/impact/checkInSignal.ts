/**
 * Check-In Signal Quality — pure, additive (NEW).
 *
 * The Impact Engine (impactEngine.ts) scales its Command Confidence by a
 * `signalConfidence` (0..1) from the Verification Layer. A completed morning
 * Voice Check-In is itself a fresh, high-quality self-report signal, so this
 * module derives the confidence CONTRIBUTION of the check-in that callers can
 * blend into that `signalConfidence` input.
 *
 * Hard rule: this module is ADDITIVE. It does NOT import or modify the locked
 * impactEngine — it only produces a value impactEngine already knows how to
 * consume. Pure: no React Native, no clock, no I/O.
 */

export interface CheckInSignalInput {
  /** Did the user complete a morning check-in for the current day? */
  completedToday: boolean;
  /** Minutes since the check-in completed (freshness), or null when unknown. */
  ageMinutes?: number | null;
  /** How many of the 3 questions were answered (0–3). Defaults to 3. */
  answeredCount?: number;
}

export interface CheckInSignalQuality {
  /** 0..1 confidence contribution from the morning check-in. */
  signalConfidence: number;
  /** Plain freshness read. */
  freshness: 'fresh' | 'stale' | 'none';
}

/** A fresh check-in is one completed within this many minutes. */
export const CHECKIN_FRESH_MINUTES = 240; // 4h
/** Past this age the freshness contribution bottoms out. */
export const CHECKIN_STALE_MINUTES = 720; // 12h
/** Freshness floor multiplier once fully stale. */
const STALE_FLOOR = 0.4;
/** Confidence when a full check-in is fresh (3/3, recent). */
const MAX_BASE = 0.9;
/** Confidence for a completed-but-empty check-in (0 answers). */
const MIN_BASE = 0.4;

/**
 * Derive the check-in's signal-quality contribution. Pure + deterministic.
 *
 * No check-in today ⇒ zero contribution (the check-in adds nothing; callers
 * fall back to the phone/wearable floor). A completed check-in scales with
 * how many questions were answered and how recently it was taken.
 */
export function deriveCheckInSignalQuality(
  input: CheckInSignalInput,
): CheckInSignalQuality {
  if (!input.completedToday) {
    return { signalConfidence: 0, freshness: 'none' };
  }

  const answered = clamp(input.answeredCount ?? 3, 0, 3);
  const completeness = answered / 3;
  const base = MIN_BASE + (MAX_BASE - MIN_BASE) * completeness;

  let freshnessFactor = 1;
  const age = input.ageMinutes;
  if (isFiniteNumber(age)) {
    if (age <= CHECKIN_FRESH_MINUTES) freshnessFactor = 1;
    else if (age >= CHECKIN_STALE_MINUTES) freshnessFactor = STALE_FLOOR;
    else {
      const t = (age - CHECKIN_FRESH_MINUTES) / (CHECKIN_STALE_MINUTES - CHECKIN_FRESH_MINUTES);
      freshnessFactor = 1 - (1 - STALE_FLOOR) * t;
    }
  }

  const signalConfidence = round2(clamp(base * freshnessFactor, 0, 1));
  const freshness: CheckInSignalQuality['freshness'] =
    isFiniteNumber(age) && age > CHECKIN_FRESH_MINUTES ? 'stale' : 'fresh';

  return { signalConfidence, freshness };
}

// ─── internals ────────────────────────────────────────────────────────

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
