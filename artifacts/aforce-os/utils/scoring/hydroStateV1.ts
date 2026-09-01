/**
 * HydroState v1.0 — physiological evidence, eligibility and confidence.
 *
 * Founder rulings 1–7, 2026-09-01. This module owns the three things that
 * separate v1.0 from v0, and it owns them in one place so no surface can
 * invent its own version:
 *
 *   1. URINE is observed-only. A value outside the range production can emit
 *      is not a reading, and unknown never reads as favourable.
 *   2. PEAK ELIGIBILITY requires at least one eligible POSITIVE physiological
 *      corroboration and no material contradiction. The absence of symptoms is
 *      not a measurement and can never supply that corroboration.
 *   3. CONFIDENCE is a separate concept from band eligibility. It describes how
 *      well-evidenced the estimate is. It contributes ZERO points, and a member
 *      without a wearable is never pushed down the band ladder for lacking one.
 *
 * The scoring math this file supports is asserted end-to-end in
 * `utils/__tests__/hydroStateV1Candidate.test.ts`, which is the model contract.
 */
import {
  URINE_PTS_PER_STEP,
  URINE_NEUTRAL_SIGNAL,
  URINE_OBSERVED_MIN,
  URINE_OBSERVED_MAX,
  URINE_MIN_POINTS,
  URINE_MAX_POINTS,
  URINE_CORROBORATING_AT_OR_BELOW,
  URINE_CONTRADICTING_AT_OR_ABOVE,
  INTAKE_RECENCY_WINDOW_MIN,
  HYDROSTATE_PEAK_THRESHOLD,
} from '../../config/hydroStateModel';

/* ─── Urine ───────────────────────────────────────────────────────────────── */

export interface UrineObservation {
  /** Points contributed to HydroState. Zero when nothing was observed. */
  points: number;
  /** True only for a value the production API could actually have produced. */
  observed: boolean;
  /** Eligible POSITIVE physiological corroboration. */
  corroborates: boolean;
  /** Material contradiction of a strong hydration state. */
  contradicts: boolean;
}

/**
 * Is this a canonical physiological observation?
 *
 * The production write path accepts integers 1..8 and rejects everything else
 * (`api-server/src/routes/aforce/status.ts`), and the column is NOT NULL
 * DEFAULT 3. `urineSignal = 0` therefore cannot originate from a member; it
 * appears only in demo and test fixtures, where the one self-documenting use
 * describes it as "no urine signal". It means UNOBSERVED.
 *
 * This matters because v1.0 adds a positive urine term. Under v0 the term was a
 * penalty only, so 0 scored as neutral and was harmless. Ungated, the same 0
 * would score +12 here — strictly better than the best real reading a member
 * can ever record. UNKNOWN must not read as FAVOURABLE.
 */
export function isObservedUrine(signal: number | null | undefined): boolean {
  return signal != null
    && Number.isInteger(signal)
    && signal >= URINE_OBSERVED_MIN
    && signal <= URINE_OBSERVED_MAX;
}

/**
 * Variant C, symmetric around neutral, clamped, and gated on observation.
 *
 *     points = observed ? clamp(-20, +8, 4 * (3 - signal)) : 0
 *
 * Symmetric because the v0 slope is simply read in both directions rather than
 * a new favourable constant being invented — the magnitude remains PROVISIONAL
 * in both directions (see `URINE_PTS_PER_STEP`).
 */
export function urineContribution(signal: number | null | undefined): UrineObservation {
  if (!isObservedUrine(signal)) {
    return { points: 0, observed: false, corroborates: false, contradicts: false };
  }
  const s = signal as number;
  const raw = URINE_PTS_PER_STEP * (URINE_NEUTRAL_SIGNAL - s);
  return {
    points: Math.max(URINE_MIN_POINTS, Math.min(URINE_MAX_POINTS, raw)),
    observed: true,
    corroborates: s <= URINE_CORROBORATING_AT_OR_BELOW,
    contradicts: s >= URINE_CONTRADICTING_AT_OR_ABOVE,
  };
}

/* ─── Evidence ────────────────────────────────────────────────────────────── */

export interface EvidenceInputs {
  urine: UrineObservation;
  /** A wearable/biometric source actually reported. */
  biometricsPresent: boolean;
  /** That source corroborates a strong state (positive aggregate signal). */
  biometricsFavourable: boolean;
  /** That source contradicts one. */
  biometricsAdverse: boolean;
  symptomState: 'none' | 'mild' | 'moderate' | 'severe';
  minutesSinceLastIntake: number;
}

export interface EvidenceVerdict {
  /** Count of eligible POSITIVE physiological corroborations actually observed. */
  positiveCorroborations: number;
  /** Distinct observed sources, positive or not — drives confidence, not eligibility. */
  observedSources: number;
  materialContradiction: boolean;
  /** Intake recency only. NOT the age of the urine or biometric observation. */
  intakeRecent: boolean;
  peakEligible: boolean;
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Founder ruling 3: the two-independent-signals rule is WITHDRAWN.
 *
 * It was withdrawn because measurement showed what it actually did: the third
 * counted "signal" was `symptomState === 'none'`, an absence every member who
 * feels fine receives for free. The rule read as two signals and behaved as
 * one observation plus not feeling bad. Rather than keep a threshold that is
 * true only by counting a non-measurement, eligibility now states the real
 * requirement directly.
 *
 * Absence of symptoms still matters — it is the absence of contradiction, which
 * is a precondition. It simply is not a positive measurement, and cannot be
 * the thing that carries a member into PEAK.
 */
export function evaluateEvidence(i: EvidenceInputs): EvidenceVerdict {
  const positiveCorroborations =
    (i.urine.corroborates ? 1 : 0) + (i.biometricsFavourable ? 1 : 0);

  // One device reporting several fields is ONE source. Independence is about
  // where the evidence came from, not how many numbers it carried.
  const observedSources = (i.urine.observed ? 1 : 0) + (i.biometricsPresent ? 1 : 0);

  // Missing evidence is NOT contradiction (founder ruling 6). Only a valid
  // observation that actually disagrees can contradict.
  const materialContradiction = i.urine.contradicts
    || i.biometricsAdverse
    || i.symptomState !== 'none';

  const intakeRecent = i.minutesSinceLastIntake <= INTAKE_RECENCY_WINDOW_MIN;

  const peakEligible = positiveCorroborations >= 1 && !materialContradiction;

  // Confidence describes evidence coverage and quality. It never moves the
  // score, and lacking a wearable lowers confidence — never HydroState.
  let confidence: 'low' | 'medium' | 'high';
  if (materialContradiction || !intakeRecent) confidence = 'low';
  else if (observedSources >= 2 && positiveCorroborations >= 1) confidence = 'high';
  else if (observedSources >= 1) confidence = 'medium';
  else confidence = 'low';

  return { positiveCorroborations, observedSources, materialContradiction,
    intakeRecent, peakEligible, confidence };
}

/**
 * Band assignment under v1.0.
 *
 * PEAK is the only band that consults evidence: it is a claim about the member's
 * physiology, and volume alone must never be able to assert it. The lower bands
 * are read straight off the score, so a member with no wearable and no urine
 * reading is never pushed DOWN for what they did not record — they simply do not
 * receive the top band without a positive observation.
 */
export function resolveStateV1(
  score: number,
  verdict: Pick<EvidenceVerdict, 'peakEligible'>,
): 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED' {
  if (score >= HYDROSTATE_PEAK_THRESHOLD && verdict.peakEligible) return 'PEAK';
  if (score >= 75 || score >= HYDROSTATE_PEAK_THRESHOLD) return 'BALANCED';
  if (score >= 60) return 'RECOVERING';
  return 'DEPLETED';
}
