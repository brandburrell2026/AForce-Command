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

/* ─── HydroState model version (D-08 / DR-009) ─────────────────────────────── */

/**
 * The AUTHORITATIVE HydroState scoring-model version identifier. Stamped onto
 * every `aforce_score_snapshots` row by the central persistence boundary
 * (`lib/db/src/scoreSnapshotRepo.ts`) so any historical score can be traced to
 * the exact model that produced it.
 *
 * `hydrostate-v0` = the current pre-governance model (founder Decision 2,
 * Option C — DR-009). Format: `hydrostate-v<major>[.<minor>]`. Changing this
 * value requires Founder + Engineering approval (+ Scientific review where the
 * change is physiological) per DR-009 §3. The api-server keeps a hand-written
 * mirror (`src/lib/hydroStateModelVersion.ts`) guarded by a parity test —
 * update BOTH together.
 */
export const HYDROSTATE_MODEL_VERSION = 'hydrostate-v0';

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
/**
 * Hard ceiling on the surfaced daily electrolyte figure (mg). The per-minute
 * rate × a long very-heavy session runs open-ended (~5,540 mg at the 360-min
 * input cap); a standalone four-digit sodium number reads as dietary guidance.
 * 3,500 mg binds only past ~210 min at the very_heavy rate (14 mg/min) — lower
 * sweat rates bind later or never — and keeps the surfaced
 * value in a defensible athlete band. Defense-in-depth last line; performance-
 * scientist sign-off condition (BLOCK 1) for §20 going live.
 */
export const SODIUM_CEILING_MG = 3500;

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
  // Optical point-in-time hydration state — the most exertion-volatile signal,
  // and the freshness layer is activity-blind, so it carries the tightest fresh
  // window (PS sign-off: body-water turnover can span a hydration category by ~6h).
  hydration_verification: { freshUntilMs: 4 * FRESHNESS_HOUR_MS, staleAfterMs: 24 * FRESHNESS_HOUR_MS, expireAfterMs: 48 * FRESHNESS_HOUR_MS },
  // The body model changes slowly; old → prompt refresh, never absent.
  profile: { freshUntilMs: 90 * FRESHNESS_DAY_MS, staleAfterMs: 180 * FRESHNESS_DAY_MS },
  // Optical calibration drifts over weeks; stale → recalibration nudge, not a block.
  camera_baseline: { freshUntilMs: 30 * FRESHNESS_DAY_MS, staleAfterMs: 90 * FRESHNESS_DAY_MS },
  // Freshness of the last successful biometric pull; >72h the stream is dark.
  wearable_sync: { freshUntilMs: 6 * FRESHNESS_HOUR_MS, staleAfterMs: 24 * FRESHNESS_HOUR_MS, expireAfterMs: 72 * FRESHNESS_HOUR_MS },
};

/* ─── Sleep SESSION semantics (RC-2 sleep-window ruling, founder-ruled 2026-08-08) ──
 * ADDITIVE to §53 above, not a replacement for it — §53's `FRESHNESS_WINDOWS.sleep`
 * governs how long an already-computed `sleepHoursLastNight` VALUE stays usable
 * once observed (freshness, "usable into a second day"). These two constants
 * instead govern how `services/appleHealth.ts` turns the RAW HealthKit interval
 * set for that same 36h (`staleAfterMs`) lookback into a single "last night"
 * NUMBER in the first place, by clustering it into discrete sessions and
 * choosing one.
 *
 * Device evidence behind this ruling: a founder reading at 18:45 with a real
 * night spanning ~23:30–06:15 (5.6h asleep, with gaps) measured 4.696h from the
 * OLD fixed 18h-lookback query — HealthKit's date filter is overlap-matching
 * and returns a matching sample WHOLE, never truncated, so a stage segment
 * ending before the `[now−18h, now]` boundary was not clipped, it was dropped
 * outright, silently shrinking the front of the night. Widening the lookback
 * to 36h (done at the §53 `staleAfterMs` cap immediately above — one number,
 * reused, never re-hardcoded, per Claude-Code-Build-Rules rule 13) fixes the
 * dropped-segment defect, but is not sufficient BY ITSELF once the window can
 * span more than one calendar night: 36h can contain last night AND today's
 * nap, or (shift work) two legitimate, unrelated sleep sessions. The raw
 * selected interval set must therefore be split into discrete sessions before
 * any single one of them is reported as "last night" — these two constants
 * are the split/qualify thresholds that decision needs.
 *
 * RATIFICATION NOTE (flagged prominently, per this ruling's own PR body):
 * both values below are the founder's ruling on the MECHANISM, not
 * independently derived from a cited sleep-medicine source the way, say, §53's
 * windows carry PS-sign-off provenance. His merge of
 * `fix/rc2-sleep-session-window` ratifies these two specific numbers; either
 * is a one-line change here if real-world data argues for a different value.
 */

/**
 * A gap this long between two already-selected sleep intervals
 * (`selectSleepIntervals`'s per-source-coverage output — UNCHANGED by this
 * ruling) ends one sleep session and starts the next
 * (`clusterSleepIntervalsIntoSessions`, `services/appleHealth.ts`). 3 hours:
 * comfortably longer than any physiologically normal WITHIN-a-session
 * wake-up (a bathroom trip, a brief awakening — `selectSleepIntervals`'s
 * existing awake(2) coverage already keeps those inside one continuous
 * per-source-covered run, never splitting them), and comfortably shorter
 * than the gap between a genuine nap and a genuine night, which is typically
 * many hours — the exact ambiguity this ruling exists to resolve.
 */
export const SLEEP_SESSION_SPLIT_GAP_MS = 3 * FRESHNESS_HOUR_MS;

/**
 * A session's own union-deduplicated duration must reach this floor to
 * qualify as "last night" under the primary-sleep rule
 * (`chooseSleepSession`, `services/appleHealth.ts`) — the guard that stops a
 * short afternoon nap from silently replacing a real night in
 * `sleepHoursLastNight`. 3 hours: below a typical real (if short) sleep
 * period's duration, comfortably above a catnap. Deliberate, documented
 * consequence (see the PR body for `fix/rc2-sleep-session-window`): a nap
 * LONGER than this threshold, if it is the MOST RECENT session, is chosen
 * over an earlier and possibly longer night — "most recent primary session"
 * is the literal rule, not "longest primary session." If the founder later
 * finds that reading counterintuitive, this one constant is the fix.
 */
export const SLEEP_PRIMARY_SESSION_MIN_MS = 3 * FRESHNESS_HOUR_MS;

/* ─── Intelligence retention + graph evidence (K-2 / DR-003 / DR-005) ─────── */
/* RESTORED 2026-07-26 after the reset-hard incident, from the authoritative
 * decision records: DR-005 (retention classes R0–R7) and DR-003 (evidence
 * gates: ≥5 comparable observations across ≥3 distinct days). Values are
 * verified by the intelligence test suites, which assert behavior. */

/** Retention days per class (DR-005). null = active-account lifetime;
 *  R7 = null pending counsel (minimum metadata only until then). */
export const RETENTION_CLASS_DAYS: Record<string, number | null> = {
  R0: 0, //      transient computation — memory/job lifetime only
  R1: 90, //     high-frequency raw signals
  R2: 730, //    normalized personal events (24 months)
  R3: 1095, //   daily/periodic derived features (36 months)
  R4: null, //   graph & model history — active account lifetime
  R5: 730, //    predictions & outcomes (24 months)
  R6: null, //   user-facing insight history — active account lifetime
  R7: null, //   privacy/consent/security — TBD, LEGAL REQUIRED (DR-005)
};

/** Superseded record retention (DR-005 R4/R6 rider): 24 months. */
export const SUPERSEDED_RECORD_RETENTION_DAYS = 730;

/** DR-003: emerging evidence floor — below this an edge is merely observed. */
export const GRAPH_MIN_SUPPORTING_OBSERVATIONS = 3;
/** DR-003: 'supported' requires ≥5 comparable observations… */
export const GRAPH_SUPPORTED_MIN_OBSERVATIONS = 5;
/** …across ≥3 distinct days. */
export const GRAPH_SUPPORTED_MIN_DISTINCT_DAYS = 3;
/** Contradiction gate: contradicting/(supporting+contradicting) ≥ this ⇒ contradicted. */
export const GRAPH_CONTRADICTION_RATIO = 0.5;

/** Query safety caps (defense-in-depth on the pure query layer). */
export const GRAPH_QUERY_MAX_DEPTH = 4;
export const GRAPH_QUERY_MAX_NODES = 500;
export const GRAPH_QUERY_MAX_EDGES = 1000;

/* ─── AForce Moments (Phases 1–2, founder approval 2026-08-12) ────────────── */
/* Preparation-window and action tunables for the flag-gated Moments feature
 * (`moments_enabled`, OFF in production). Manual/demo moments only in these
 * phases — no calendar access, no notification scheduling, no new raw data
 * collection (Phase 3 requires an explicit founder decision record; see
 * governance/proposals/PR-002-aforce-moments.md). Values follow the founder
 * comps (meeting: prep 60→30 min before, hydrate 14 oz best-before window
 * midpoint; training: 75→30, 16–20 oz; travel: 120→60, 12–16 oz).
 * Advisory-only by construction: nothing here feeds the score engine
 * (Score Protection, DR-001). */

import type { MomentType, MomentImportance } from '../types/moments';

/** Prep-window offsets per Moment type: minutes BEFORE the moment start. */
export const MOMENT_PREP_WINDOW_MIN: Record<
  MomentType,
  { startBefore: number; endBefore: number }
> = {
  work: { startBefore: 60, endBefore: 30 },
  performance: { startBefore: 75, endBefore: 30 },
  training: { startBefore: 75, endBefore: 30 },
  travel: { startBefore: 120, endBefore: 60 },
  recovery: { startBefore: 30, endBefore: 0 },
  personal: { startBefore: 30, endBefore: 0 },
};

/** Low-importance moments widen the window less aggressively. */
export const MOMENT_IMPORTANCE_WINDOW_SCALE: Record<MomentImportance, number> = {
  high: 1,
  moderate: 1,
  low: 0.5,
};

/** Hydrate primary-action ounce ranges per Moment type ([min, max]). */
export const MOMENT_HYDRATE_OZ: Record<MomentType, [number, number]> = {
  work: [14, 14],
  performance: [14, 16],
  training: [16, 20],
  travel: [12, 16],
  recovery: [8, 12],
  personal: [8, 12],
};

/** LOCK IN lead: minutes before the moment start. */
export const MOMENT_LOCK_IN_BEFORE_MIN = 15;

/** PAUSE reset length (seconds) — the ritual's opening reset. */
export const MOMENT_PAUSE_SECONDS = 60;

/** Hydrate "best before": fraction of the way through the prep window. */
export const MOMENT_HYDRATE_BEST_BEFORE_FRACTION = 0.5;

/** Upcoming-moment surfacing horizon (hours ahead) for Today lists. */
export const MOMENT_SURFACE_HORIZON_HOURS = 24;

/* ─── AForce Moments Phase 3a — prep notifications (DR-010) ──────────────── */
/* Interruption-budget constants for the Moments notification planner
 * (services/momentNotifications.ts). DR-010 constraint 2: quiet hours +
 * minimum gap + a daily cap BELOW the global 6/day reminder ceiling;
 * high/moderate importance only by default. Behavioral copy only — no
 * prediction values ever appear in a notification (PT-1 stays prohibited). */

/** Max Moments prep notifications per calendar day (< GUARDRAIL_MAX_PER_DAY_CEIL). */
export const MOMENT_NOTIFY_MAX_PER_DAY = 3;

/** Minimum gap between two Moments notifications (minutes). */
export const MOMENT_NOTIFY_MIN_GAP_MIN = 60;

/** Quiet hours (local): no Moments notification fires inside this window. */
export const MOMENT_NOTIFY_QUIET_START_HOUR = 22;
export const MOMENT_NOTIFY_QUIET_END_HOUR = 7;

/** Selectable lead-time presets (minutes before the moment start). null =
 *  fire at the prep-window start (the default "do this now" timing).
 *  'Adaptive' is EXCLUDED until PR-002 5.6 is approved (DR-010). */
export const MOMENT_NOTIFY_LEAD_PRESETS_MIN = [15, 30, 60, 90, 120] as const;

/* ─── AForce Moments Phase 3b — calendar core (DR-011) ───────────────────── */
/* Calendar-derived Moments: read horizon, classification confidence, and the
 * per-category defaults. Least-privilege by construction: the bridge reads
 * titles + times from user-SELECTED calendars only, holds events in memory
 * only (never persisted — data-minimization commitment in PR-002 Appendix A),
 * and unclassifiable events are skipped or masked, never guessed
 * ("do not pretend certainty" — founder spec). */

/** How far ahead the calendar bridge reads (days). */
export const MOMENT_CALENDAR_HORIZON_DAYS = 2;

/** Minimum keyword-match confidence to surface a calendar event as a Moment.
 *  Below this the event is skipped (neutral-or-skip rule). */
export const MOMENT_CLASSIFY_MIN_CONFIDENCE = 0.6;

/** Default importance per classified category (user can't edit v1). */
export const MOMENT_CALENDAR_DEFAULT_IMPORTANCE: Record<
  'work' | 'training' | 'travel' | 'recovery' | 'personal' | 'performance',
  'high' | 'moderate' | 'low'
> = {
  work: 'high',
  performance: 'high',
  training: 'high',
  travel: 'moderate',
  recovery: 'moderate',
  personal: 'moderate',
};
