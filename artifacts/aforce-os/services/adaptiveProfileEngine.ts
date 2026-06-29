/**
 * Adaptive Profile Engine™ (Section 18) — pure calibration logic.
 *
 * Framework-free and DB-free: this module decides WHAT a profile save means
 * (major vs minor change, which version/baseline/explanation results). The
 * transactional persistence lives in `@workspace/db` profileRepo. Keeping the
 * decision logic pure makes it runnable on the client (between syncs) and
 * trivially unit-testable.
 *
 * Every threshold, template, and label is read from
 * `../config/hydroStateModel` — no number or copy string is hardcoded here
 * (brief hard-constraint #4).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * CONTRACT A — ProfileIdentity (client) ↔ ProfileVersion (server) sync
 * ───────────────────────────────────────────────────────────────────────────
 * There are two stores of profile state and they have DISTINCT roles — this
 * is deliberate, not a duplication to be reconciled away:
 *
 *   • Client `ProfileIdentity` (AsyncStorage, utils/profileIdentity.ts) is
 *     authoritative for the CURRENT LIVE EDITABLE VALUES — what the user sees
 *     and edits, what drives the local engine between syncs. It is a draft.
 *   • Server Profile Version™ history (aforce_profile_versions et al.) is
 *     authoritative for the VERSIONED RECORD — append-only, immutable, the
 *     thing HydroState / Performance Memory stamp against. It is the audit
 *     truth.
 *
 * Sync path (on save): the client diffs the new major-variable snapshot
 * against the last-synced snapshot via `detectMajorChange`. On a major change
 * it POSTs the snapshot WITH a stable `clientChangeId`; the server mints the
 * version + appends the change-log + archives the prior active baseline +
 * opens a new baseline + advances the user-profile pointer, ALL IN ONE
 * TRANSACTION (profileRepo.recordProfileSave), and returns the new
 * {profileVersionId, baselineVersionId}. The client stores those ids so
 * subsequent HydroState / Performance Memory writes stamp them.
 *
 * Partial-write / offline handling:
 *   • Server atomicity — the mint is all-or-nothing (single db.transaction).
 *     Never a version with no baseline; never an archived baseline with no
 *     replacement.
 *   • Client wrote locally but the server confirm was lost / device offline —
 *     the client KEEPS the user's edit (rolling it back is hostile) but marks
 *     the snapshot pending-sync; the local engine keeps using the LAST
 *     CONFIRMED baseline and does NOT recalibrate on an unconfirmed change.
 *     Retried on reconnect.
 *   • Idempotent retry — the mint dedupes on (userId, clientChangeId) (UNIQUE
 *     index), so a replayed POST returns the existing ids instead of
 *     double-minting.
 *   • Multi-device conflict — server history wins as audit truth; the client
 *     reconciles by re-diffing live values against the latest server snapshot.
 *     FULL multi-device reconciliation is intentionally NOT built in Section
 *     18; only this contract is fixed so Section 19 onboarding cannot bake in
 *     a split-brain.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * CONTRACT B — Age bracket & passage of time
 * ───────────────────────────────────────────────────────────────────────────
 * The editable major variable is `birthYear`, NOT the derived age bracket.
 * Time crossing a bracket boundary (e.g. 29→30) does NOT mint a version: that
 * is no user action and no real physiological event, and auto-minting would
 * silently open a fresh baseline and LOWER the user's HydroState confidence
 * for zero action — exactly the "told you that you changed something you
 * didn't touch" failure the spec forbids. Instead the bracket is recomputed
 * at read time (`ageBracketForBirthYear`) so calibration always uses the
 * current bracket, while only a genuine `birthYear` correction mints a
 * version. No background birthday job and no time-advanced explanation
 * template are needed — every minted change is genuinely user-initiated.
 */

import {
  MAJOR_PROFILE_VARIABLES,
  PROFILE_VERSION_TRIGGER,
  AGE_BRACKETS,
  BASELINE_CONFIDENCE,
  RECALIBRATION_EXPLANATIONS,
  MAJOR_VARIABLE_LABELS,
  type MajorProfileVariable,
  type AgeBracketId,
} from '../config/hydroStateModel';

/**
 * The major-variable values captured in a Profile Version™ snapshot. All
 * fields are nullable because the user may not have filled them in yet;
 * `connectedWearables` is a (possibly empty) set of provider ids.
 */
export interface ProfileSnapshot {
  weightLbs: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: string | null;
  activityLevel: number | null;
  trainingLevel: string | null;
  performanceGoal: string | null;
  homeClimate: string | null;
  sleepSchedule: string | null;
  sweatClassification: string | null;
  connectedWearables: string[];
}

export interface MajorChangeResult {
  isMajor: boolean;
  changedFields: MajorProfileVariable[];
}

/**
 * Classification of one profile save:
 *   • 'major' — at least one major variable changed past its trigger; the
 *     server should mint a new version + recalibrate. `explanation` is the
 *     Evidence Engine™ string.
 *   • 'minor' — only preference-level edits; no version, no recalibration.
 */
export interface ProfileSaveDecision {
  changeType: 'major' | 'minor';
  changedFields: MajorProfileVariable[];
  explanation: string;
  /** The full snapshot to persist as the new version (major only). */
  snapshot: ProfileSnapshot;
}

function numbersDifferBeyond(
  prev: number | null,
  next: number | null,
  threshold: number,
): boolean {
  // A transition between "unset" (null) and any concrete value is always a
  // change; two nulls are equal; otherwise compare the magnitude of the delta.
  if (prev == null && next == null) return false;
  if (prev == null || next == null) return true;
  return Math.abs(next - prev) >= threshold;
}

function arraysDifferAsSet(prev: string[], next: string[]): boolean {
  if (prev.length !== next.length) return true;
  const a = new Set(prev);
  for (const item of next) if (!a.has(item)) return true;
  return false;
}

function fieldChanged(
  field: MajorProfileVariable,
  prev: ProfileSnapshot,
  next: ProfileSnapshot,
): boolean {
  if (field === 'connectedWearables') {
    return arraysDifferAsSet(prev.connectedWearables, next.connectedWearables);
  }
  const threshold = PROFILE_VERSION_TRIGGER[field];
  if (typeof threshold === 'number') {
    return numbersDifferBeyond(
      prev[field] as number | null,
      next[field] as number | null,
      threshold,
    );
  }
  // Categorical / exact fields (incl. `birthYear`: a correction is exact).
  return prev[field] !== next[field];
}

/**
 * Compare two snapshots over exactly the major variables. Numeric fields with
 * a configured trigger use a delta threshold; everything else is exact.
 */
export function detectMajorChange(
  prev: ProfileSnapshot,
  next: ProfileSnapshot,
): MajorChangeResult {
  const changedFields = MAJOR_PROFILE_VARIABLES.filter((f) =>
    fieldChanged(f, prev, next),
  );
  return { isMajor: changedFields.length > 0, changedFields };
}

/**
 * Derive the age bracket from `birthYear` at read time (contract B). Returns
 * null when the year is missing or yields an implausible age.
 */
export function ageBracketForBirthYear(
  birthYear: number | null | undefined,
  now: Date = new Date(),
): AgeBracketId | null {
  if (typeof birthYear !== 'number' || !Number.isFinite(birthYear)) return null;
  const age = now.getFullYear() - birthYear;
  if (age < 0 || age > 130) return null;
  const bracket = AGE_BRACKETS.find((b) => age >= b.min && age <= b.max);
  return bracket ? bracket.id : null;
}

/** Confidence a freshly-opened baseline starts at. */
export function initialConfidence(isFirstBaseline: boolean): number {
  return isFirstBaseline
    ? BASELINE_CONFIDENCE.initialFirstBaseline
    : BASELINE_CONFIDENCE.initialAfterRecalibration;
}

/**
 * Confidence after `observationCount` observations on a baseline. Ramps from
 * the opening value by `perObservationGain` each, clamped to the ceiling.
 */
export function confidenceForObservations(
  observationCount: number,
  isFirstBaseline: boolean,
): number {
  const base = initialConfidence(isFirstBaseline);
  const n = Math.max(0, Math.floor(observationCount));
  const raised = base + n * BASELINE_CONFIDENCE.perObservationGain;
  return Math.min(BASELINE_CONFIDENCE.fullConfidenceCeiling, raised);
}

function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  );
}

/**
 * The Evidence Engine™ explanation for a major change. Prefers the specific
 * weight-change template when weight moved (it reads most naturally and is the
 * spec's headline example); otherwise the generic template with a humanized
 * field label. Always framed as performance calibration — never correction,
 * never comparison (spec §18 rules).
 */
export function explainMajorChange(
  changedFields: MajorProfileVariable[],
  prev: ProfileSnapshot,
  next: ProfileSnapshot,
): string {
  if (
    changedFields.includes('weightLbs') &&
    prev.weightLbs != null &&
    next.weightLbs != null
  ) {
    return interpolate(RECALIBRATION_EXPLANATIONS.weightChange, {
      from: prev.weightLbs,
      to: next.weightLbs,
    });
  }
  const primary = changedFields[0];
  const label = primary ? MAJOR_VARIABLE_LABELS[primary] : 'profile';
  return interpolate(RECALIBRATION_EXPLANATIONS.generic, { field: label });
}

/**
 * Classify one profile save into a major (version-minting) or minor decision.
 * Pure — the caller (route/repo) persists the result transactionally.
 */
export function classifyProfileSave(
  prev: ProfileSnapshot,
  next: ProfileSnapshot,
): ProfileSaveDecision {
  const { isMajor, changedFields } = detectMajorChange(prev, next);
  if (!isMajor) {
    return {
      changeType: 'minor',
      changedFields: [],
      explanation: '',
      snapshot: next,
    };
  }
  return {
    changeType: 'major',
    changedFields,
    explanation: explainMajorChange(changedFields, prev, next),
    snapshot: next,
  };
}

/** The baseline-transition copy shown while a new baseline is building. */
export function baselineTransitionMessage(): string {
  return RECALIBRATION_EXPLANATIONS.baselineTransition;
}
