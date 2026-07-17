/**
 * PROFILE COMPLETENESS → DATA CONFIDENCE (Section 55, Step 2).
 *
 * Folds the Step-1 Profile Completeness measure into the Data Confidence Layer
 * as ONE input signal a consumer can opt into. The spec: "Completeness
 * naturally improves HydroState Confidence over time." Mechanically, a consumer
 * concatenates this signal into its own signal array before calling
 * `assessDataConfidence`, so completeness is weighed AGAINST the real sensor
 * signals — it can add context (lift low → medium) but never manufacture the
 * verified signals a `high` band demands.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SCIENCE GUARDRAIL — PROFILE COMPLETENESS IS SELF-REPORT, NOT MEASUREMENT.
 *
 * Every ProfileIdentity field this signal reflects (weight, height, age, sex,
 * activity, training level, goal, sweat, goal weight) is TYPED BY THE USER.
 * Completeness measures how much the athlete has TOLD us about themselves —
 * never how much we have MEASURED or CONFIRMED. A "rich" profile is a complete
 * self-report, not a verified reading.
 *
 * Therefore this signal is CAPPED AT `partial` and MUST NEVER emit `verified`,
 * exactly like performanceMemoryDataConfidence (voice check-ins) and the
 * activity sub-score in performanceAgeDataConfidence. `verified` in this layer
 * means a real reading from a trusted source (the ≥ VERIFIED_CONFIDENCE_THRESHOLD
 * / wearable line); a filled-in form does not clear that bar no matter how
 * complete it is. Because HIGH requires ≥ HIGH_MIN_VERIFIED (2) verified signals,
 * this cap structurally guarantees completeness alone can NEVER lift a read to
 * `high` — its ceiling is `medium`.
 *
 * DO NOT surface, log, or interpret this signal as a physiological measurement,
 * health assessment, readiness score, or diagnostic/medical confidence. It is an
 * internal qualifier only. A complete profile means "we know what you told us,"
 * never "we have confirmed your physiological state." Raising this cap to
 * `verified` is a brand + legal violation (a measurement claim we did not make),
 * not a tuning decision — it requires Performance Scientist + counsel sign-off.
 * Basis: docs/science/section-55-profile-completeness-confidence.md.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Pure module — no React Native, no I/O. Score-Protection: emits only a signal
 * QUALIFIER; it never awards, inflates, or mutates a score, band, or color.
 */

import type { DataSignalInput, SignalQuality } from '../confidence/dataConfidence';
import type { ProfileIdentity } from '../profileIdentity';
import {
  assessProfileCompleteness,
  type ProfileCompletenessLevel,
  type ProfileCompletenessResult,
  type ProfileFieldDescriptor,
} from './profileCompleteness';

/** Stable signal id (debug trace / consumer concat key). */
export const PROFILE_COMPLETENESS_SIGNAL_KEY = 'profileCompleteness';

/**
 * Band → signal quality. Band-based by design (NOT ratio-based): a ratio gate
 * invites a future `ratio >= 0.9 → verified`, which the guardrail forbids.
 *   - sparse → estimated : near-empty profile ⇒ the engine runs on population
 *                          defaults for most fields (no real self-report yet).
 *   - partial → partial  : real self-reported profile data present.
 *   - rich   → partial   : STILL self-report. The cap holds — richness is
 *                          completeness of self-report, not verification.
 * Never returns `verified` (see the SCIENCE GUARDRAIL above).
 */
export function profileCompletenessQuality(
  level: ProfileCompletenessLevel,
): SignalQuality {
  switch (level) {
    case 'sparse':
      return 'estimated';
    case 'partial':
    case 'rich':
      return 'partial';
  }
}

/**
 * The profile-completeness contribution to a consumer's data confidence, as one
 * `DataSignalInput`. Consumers CONCATENATE this into their own signal array —
 * they do not treat it as a standalone confidence verdict.
 */
export function profileCompletenessSignal(
  profile: ProfileIdentity,
  descriptors?: readonly ProfileFieldDescriptor[],
): DataSignalInput {
  const result: ProfileCompletenessResult = assessProfileCompleteness(profile, descriptors);
  return {
    key: PROFILE_COMPLETENESS_SIGNAL_KEY,
    quality: profileCompletenessQuality(result.level),
  };
}

/**
 * Opt-in composition helper: append the profile-completeness signal to an
 * existing signal set (pure — the input array is not mutated). A consumer that
 * wants completeness to factor into its `assessDataConfidence` read calls this
 * on its own signals immediately before assessing.
 */
export function withProfileCompleteness(
  signals: readonly DataSignalInput[],
  profile: ProfileIdentity,
  descriptors?: readonly ProfileFieldDescriptor[],
): DataSignalInput[] {
  return [...signals, profileCompletenessSignal(profile, descriptors)];
}
