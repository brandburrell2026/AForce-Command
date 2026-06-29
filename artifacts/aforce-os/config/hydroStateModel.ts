/**
 * config/hydroStateModel.ts — single source of truth for every AForce OS
 * threshold, formula constant, and recalibration parameter.
 *
 * Engine logic NEVER hardcodes numbers; it reads them from here
 * (Claude Code brief, hard-constraint #4). If a value the engine needs is
 * missing, add it HERE and reference it — do not inline it in the engine.
 *
 * This file grows ONE numbered section at a time (brief #3). Section 18
 * (Adaptive Profile Engine™) constants land first; the Section 19/20
 * hydration-recalc constants (daily target, electrolyte timing, recheck
 * intervals, environmental modifiers) are appended when those sections are
 * implemented — they are intentionally absent for now.
 */

/* ─── Section 18 — Adaptive Profile Engine™ / Profile Versioning™ ──────────── */

/**
 * The profile fields whose change mints a new Profile Version™ (spec §18,
 * "Major Profile Variables"). These are the *editable inputs* the user can
 * change — the engine compares two snapshots over exactly these keys.
 *
 * NOTE on age (see contract B in services/adaptiveProfileEngine.ts):
 * the spec lists "Age Bracket" as a major variable, but the editable field
 * is `birthYear`. The bracket is DERIVED (see AGE_BRACKETS) and recomputed
 * at read time, so the passage of time never mints a phantom version. Only a
 * user-initiated `birthYear` correction triggers a version.
 */
export const MAJOR_PROFILE_VARIABLES = [
  'weightLbs',
  'heightCm',
  'birthYear',
  'sex',
  'activityLevel',
  'trainingLevel',
  'performanceGoal',
  'homeClimate',
  'sleepSchedule',
  'sweatClassification',
  'connectedWearables',
] as const;
export type MajorProfileVariable = (typeof MAJOR_PROFILE_VARIABLES)[number];

/**
 * Minimum change magnitude before a NUMERIC major variable is treated as a
 * new version. Stops a 0.3 lb scale fluctuation from spawning a version while
 * a real shift does. Any major variable NOT listed here is compared by exact
 * inequality (categorical fields, and `birthYear` — a correction is exact).
 */
export const PROFILE_VERSION_TRIGGER: Partial<Record<MajorProfileVariable, number>> = {
  /** lbs of body-weight change required to mint a new version. */
  weightLbs: 3,
  /** cm of height change (rare; covers data correction / youth growth). */
  heightCm: 2,
};

/**
 * Age-bracket boundaries (years), DERIVED from `birthYear` at read time.
 * Calibration (Section 20) reads the current bracket from here; the bracket
 * is never stored as an editable field and never mints a version on its own.
 */
export const AGE_BRACKETS = [
  { id: 'under_18', min: 0, max: 17 },
  { id: '18_29', min: 18, max: 29 },
  { id: '30_39', min: 30, max: 39 },
  { id: '40_49', min: 40, max: 49 },
  { id: '50_59', min: 50, max: 59 },
  { id: '60_plus', min: 60, max: 200 },
] as const;
export type AgeBracketId = (typeof AGE_BRACKETS)[number]['id'];

/**
 * Baseline confidence lifecycle (spec §18, "Baseline Recalibration"):
 * on recalibration confidence drops, then ramps up as observations
 * accumulate. Confidence is a 0..1 scalar.
 */
export const BASELINE_CONFIDENCE = {
  /** Confidence a baseline opens at right after a recalibration. */
  initialAfterRecalibration: 0.35,
  /** A first-ever baseline (no prior profile) opens higher — no transition risk. */
  initialFirstBaseline: 0.5,
  /** Confidence gained per recorded observation. */
  perObservationGain: 0.05,
  /** Upper bound; confidence never exceeds this. */
  fullConfidenceCeiling: 1.0,
} as const;

/**
 * Evidence Engine™ explanation templates. `{from}` / `{to}` / `{field}` /
 * `{delta}` are interpolated by the engine. Phrasing mirrors the spec
 * examples verbatim. Every template frames change as performance
 * calibration — never correction, never comparison (spec §18 rules).
 */
export const RECALIBRATION_EXPLANATIONS = {
  weightChange:
    'Your hydration targets were recalibrated because your body weight changed from {from} lbs to {to} lbs. Future recommendations now use your updated profile.',
  baselineTransition:
    'Your Performance Profile has changed. HydroState is building your updated baseline. Confidence will increase as more observations are collected.',
  weightJourney:
    'You are {delta} pounds below your original baseline. Your hydration profile has been recalibrated to match your current physiology.',
  generic:
    'Your {field} changed. Future recommendations now use your updated profile while preserving your performance history.',
} as const;

/**
 * Human-readable labels for each major variable, used by the `generic`
 * explanation template ("Your {field} changed…"). Centralized here so all
 * user-facing recalibration copy lives in one place. Phrased as the user
 * would read them — never as a system field name.
 */
export const MAJOR_VARIABLE_LABELS: Record<MajorProfileVariable, string> = {
  weightLbs: 'body weight',
  heightCm: 'height',
  birthYear: 'date of birth',
  sex: 'biological sex',
  activityLevel: 'activity level',
  trainingLevel: 'training level',
  performanceGoal: 'performance goal',
  homeClimate: 'home climate',
  sleepSchedule: 'sleep schedule',
  sweatClassification: 'sweat classification',
  connectedWearables: 'connected wearables',
};

/** Confirmation copy shown on profile save (spec §18, "On Save"). */
export const PROFILE_SAVE_CONFIRMATION =
  'Your Performance Profile has been updated. Future recommendations will use your new baseline while preserving your performance history.';
