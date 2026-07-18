/**
 * config/hydroStateModel.ts — single source of truth for every AForce OS
 * threshold, formula constant, and recalibration parameter.
 *
 * Engine logic NEVER hardcodes numbers; it reads them from here
 * (Claude Code brief, hard-constraint #4). If a value the engine needs is
 * missing, add it HERE and reference it — do not inline it in the engine.
 *
 * This file grows ONE numbered section at a time (brief #3). Section 18
 * (Adaptive Profile Engine™) constants landed first; Section 20 adds the Body
 * Recalibration Engine™ math (daily target, electrolyte, recovery timing,
 * recheck intervals, environmental modifiers) at the bottom.
 */

import type {
  TrainingLevel,
  PrimaryGoal,
  SweatClassification,
} from '../utils/profileIdentity';

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

/* ─── Section 20 — Body Recalibration Engine™ ──────────────────────────────── */
/**
 * On a major profile change, the Body Recalibration Engine™ recomputes the
 * FIVE go-forward targets below from the user's §19 Performance Profile inputs.
 * Every coefficient lives here — services/bodyRecalibrationEngine.ts contains
 * arithmetic + clamps only, no literals (brief #4). These are reviewed starting
 * values; nothing consumes them in a live recommendation yet (Part B routes
 * them in), so they are safe to tune later with real product input.
 */

/* (1) Daily hydration target — oz. base = weight × oz/lb, scaled by training,
 *     plus a sweat adder and a goal modifier, clamped to a sane range. */
export const HYDRATION_BASE_OZ_PER_LB = 0.5;
export const TRAINING_LEVEL_HYDRATION_MULTIPLIER: Record<TrainingLevel, number> = {
  Beginner: 1.0,
  Active: 1.08,
  Advanced: 1.15,
  Elite: 1.22,
};
export const SWEAT_LEVEL_HYDRATION_ADDER_OZ: Record<SweatClassification, number> = {
  light: 0,
  moderate: 8,
  heavy: 16,
  very_heavy: 24,
};
export const GOAL_HYDRATION_MODIFIER_OZ: Record<PrimaryGoal, number> = {
  'Fat Loss': 8,
  'Lean Performance': 4,
  'Strength & Muscle': 4,
  'Performance Maintenance': 0,
  Endurance: 12,
  'Recovery Optimization': 6,
  'Everyday Energy': 0,
};
export const HYDRATION_TARGET_FLOOR_OZ = 64;
export const HYDRATION_TARGET_CEILING_OZ = 200;

/* (2) Electrolyte recommendation — sodium mg/day. base + per-workout-minute
 *     rate scaled by sweat volume. */
export const SODIUM_BASE_MG = 500;
export const SODIUM_MG_PER_WORKOUT_MIN_BY_SWEAT: Record<SweatClassification, number> = {
  light: 3,
  moderate: 6,
  heavy: 10,
  very_heavy: 14,
};

/* (3) Recovery timing — post-session rehydration window (min), by training
 *     level, with a goal modifier. */
export const RECOVERY_WINDOW_MIN_BY_TRAINING: Record<TrainingLevel, number> = {
  Beginner: 30,
  Active: 45,
  Advanced: 60,
  Elite: 90,
};
export const GOAL_RECOVERY_WINDOW_MODIFIER_MIN: Partial<Record<PrimaryGoal, number>> = {
  'Recovery Optimization': 30,
  Endurance: 15,
};

/* (4) Recheck interval — minutes between HydroState rechecks. base scaled down
 *     as sweat volume rises (heavier sweaters re-check sooner), floored. */
export const RECHECK_INTERVAL_BASE_MIN = 120;
export const RECHECK_INTERVAL_SWEAT_FACTOR: Record<SweatClassification, number> = {
  light: 1.0,
  moderate: 0.85,
  heavy: 0.7,
  very_heavy: 0.55,
};
export const RECHECK_INTERVAL_FLOOR_MIN = 45;

/* (5) Environmental Pressure™ sensitivity — multiplier applied to environmental
 *     modifiers, by sweat volume (home climate folds in once §Climate lands). */
export const ENV_PRESSURE_SENSITIVITY_BY_SWEAT: Record<SweatClassification, number> = {
  light: 0.9,
  moderate: 1.0,
  heavy: 1.15,
  very_heavy: 1.3,
};

/* ─── Section 59 — Adaptive Response Engine™ ───────────────────────────────────
 * Tunables for the Personal Response Library (What Worked / Confidence After
 * Action) and the recurring/severe-symptom physician-consultation trigger. The
 * engine reads these; it never hardcodes them (brief constraint #4). Every value
 * is observational — none reads into, awards, or mutates score. */

/** Rolling window for adaptive-response learning (30 days, ms). */
export const ADAPTIVE_RESPONSE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Minimum in-window observations before a category's response is 'ready'. */
export const ADAPTIVE_RESPONSE_MIN_SAMPLES = 5;

/** Sample size at which Confidence After Action reaches its ceiling of 1.0. */
export const ADAPTIVE_RESPONSE_CONFIDENCE_FULL_SAMPLES = 10;

/** Energy delta (1–5 self-report) needed to call an outcome improved/declined
 *  rather than steady — the cause-and-effect threshold for "What Worked". */
export const ADAPTIVE_RESPONSE_OUTCOME_ENERGY_DELTA = 0.5;

/** Recurring/severe symptom trigger: the same symptom category this many times… */
export const RECURRING_SYMPTOM_MIN_OCCURRENCES = 3;

/** …within this window (14 days, ms) prompts a physician-consultation nudge. */
export const RECURRING_SYMPTOM_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/* ─── Section 60 — Response Timeline™ ──────────────────────────────────────────
 * Tunables for the Phase-2 query layer that buckets response activity over time.
 * The query reads these; it never hardcodes them (brief constraint #4). All are
 * observational — none reads into, awards, or mutates score. */

/** Trailing window the timeline spans (90 days, ms). */
export const RESPONSE_TIMELINE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/** Bucket width within the timeline (7 days = weekly, ms). */
export const RESPONSE_TIMELINE_BUCKET_MS = 7 * 24 * 60 * 60 * 1000;

/** Days of personal history required before the timeline is shown (spec: 60–90).
 *  A consumer surfaces it only when the feature flag is ON *and* this is met. */
export const RESPONSE_TIMELINE_MIN_DATA_DAYS = 60;

/* ─── Section 61 — Living Performance Model™ ───────────────────────────────────
 * Tunable for the daily lesson. Observational — reads a category's Confidence
 * After Action only; never reads into, awards, or mutates score. */

/** Minimum Confidence After Action (0–1) a category needs to become the day's
 *  lesson. Below this the model stays on the Silent Intelligence on-track state
 *  rather than surfacing a low-confidence takeaway (no fabrication). */
export const LIVING_PERFORMANCE_MIN_LESSON_CONFIDENCE = 0.6;

/* ─── Section 53 — Data Freshness™ (per-signal recency windows) ─────────────────
 * How current a signal's supporting data must be. Pure recency — never source
 * quality (§54) or completeness (§55). `freshUntilMs ≤ staleAfterMs ≤
 * expireAfterMs`. `expireAfterMs` omitted → the signal degrades to `stale` and
 * stays present (offline-first: old context beats none). Bias conservative:
 * too-loose windows read stale data as fresh (the dangerous direction).
 * PENDING performance-scientist sign-off on each window's physiological currency. */

const FRESHNESS_HOUR_MS = 3_600_000;
const FRESHNESS_DAY_MS = 86_400_000;

/** The §53 signals. `weather`/`sleep`/`hydration_verification` share names with
 *  §54 QualitySignalKind so freshness composes onto the matching source rating. */
export type FreshnessSignalKind =
  | 'weather'
  | 'sleep'
  | 'hydration_verification'
  | 'profile'
  | 'camera_baseline'
  | 'wearable_sync';

export interface FreshnessWindows {
  freshUntilMs: number;
  staleAfterMs: number;
  /** Absent → never expires to `unavailable`; a slowly-changing signal stays `stale`. */
  expireAfterMs?: number;
}

export const FRESHNESS_WINDOWS: Record<FreshnessSignalKind, FreshnessWindows> = {
  // Heat/humidity drive today's demand and shift within hours; >12h is noise.
  weather: { freshUntilMs: 1 * FRESHNESS_HOUR_MS, staleAfterMs: 3 * FRESHNESS_HOUR_MS, expireAfterMs: 12 * FRESHNESS_HOUR_MS },
  // "Last night"; usable into a second day as the best proxy; never expired.
  sleep: { freshUntilMs: 12 * FRESHNESS_HOUR_MS, staleAfterMs: 36 * FRESHNESS_HOUR_MS },
  // Optical point-in-time hydration state drifts over hours; >48h drop it.
  hydration_verification: { freshUntilMs: 6 * FRESHNESS_HOUR_MS, staleAfterMs: 24 * FRESHNESS_HOUR_MS, expireAfterMs: 48 * FRESHNESS_HOUR_MS },
  // The body model changes slowly; old → prompt refresh, never absent.
  profile: { freshUntilMs: 90 * FRESHNESS_DAY_MS, staleAfterMs: 180 * FRESHNESS_DAY_MS },
  // Optical calibration drifts over weeks; stale → recalibration nudge, not a block.
  camera_baseline: { freshUntilMs: 30 * FRESHNESS_DAY_MS, staleAfterMs: 90 * FRESHNESS_DAY_MS },
  // Freshness of the last successful biometric pull; >72h the stream is dark.
  wearable_sync: { freshUntilMs: 6 * FRESHNESS_HOUR_MS, staleAfterMs: 24 * FRESHNESS_HOUR_MS, expireAfterMs: 72 * FRESHNESS_HOUR_MS },
};
