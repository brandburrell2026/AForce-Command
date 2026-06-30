/**
 * Profile identity — user-editable fields that appear on the premium
 * profile card (Profile tab > top section).
 *
 * Why this lives next to `utils/units.ts` rather than `types/index.ts`:
 *   - It owns its own sanitiser used by the AsyncStorage hydration
 *     effect, identical to the unit-preferences pattern.
 *   - It owns the canonical aura-state list so both the modal editor
 *     and the chip-strip renderer pull from a single source.
 *   - Keeping the shape + defaults + sanitiser co-located makes the
 *     reducer test contract trivial.
 *
 * What's NOT here:
 *   - `name` — the display name comes from Clerk (see profile.tsx),
 *     so editing it would diverge from the auth source of truth.
 *   - `subscriptionTier` — Stripe-derived; mutating it from the
 *     client would create a paywall escape hatch.
 *   - `streakDays` — engine-computed from compliance history, not a
 *     vanity field the user gets to set.
 *
 * Slice 2 — BODY MODEL fields (bodyWeightLbs, heightCm, birthYear,
 * biologicalSex) are nullable because the user hasn't necessarily
 * filled them in yet. The HydroScan personalization helper reads
 * these to drive the "BODY MODEL" reason chip and (in future slices)
 * to refine sweat-rate and decay math.
 */

import type { AuraState } from '../types';

export type BiologicalSex = 'male' | 'female' | 'non-binary' | 'unspecified';

/**
 * Recovery goal — what the athlete is optimizing for. Drives chip copy
 * on the premium identity card and (in future slices) tunes the
 * recovery-window math and AI coach voice scope.
 *
 * Order is the on-screen order in the editor's segmented control —
 * keep PERFORMANCE first (most aggressive) through LONGEVITY (most
 * sustainable) so the gradient reads intuitively.
 */
export type RecoveryGoal =
  | 'PERFORMANCE'
  | 'RECOVERY'
  | 'ENDURANCE'
  | 'BALANCE'
  | 'LONGEVITY';

/**
 * Self-reported daily caffeine intake band. Feeds the hydration engine
 * as a diuretic / stimulant-load input. `'unspecified'` is the default
 * and is treated by the engine as "no caffeine adjustment" rather than
 * a hidden assumption.
 */
export type CaffeineHabit = 'none' | 'low' | 'moderate' | 'high' | 'unspecified';

/**
 * Occupation category — sets a hydration-demand floor (an outdoor /
 * labor job loses fluid even on a nominal "rest" day, a desk job does
 * not). `'unspecified'` = no occupation-based adjustment.
 */
export type OccupationType =
  | 'desk'
  | 'active'
  | 'outdoor'
  | 'shift'
  | 'other'
  | 'unspecified';

/**
 * Training Level (Performance Profile™, Section 19). Feeds Personal Baseline.
 * MAJOR variable — a change mints a new Profile Version™.
 */
export type TrainingLevel = 'Beginner' | 'Active' | 'Advanced' | 'Elite';

/**
 * Primary Goal (Section 19) — the seven canonical performance objectives.
 * MAJOR variable (maps to the snapshot's `performanceGoal` slot). This is the
 * §19 canonical goal; the older `recoveryGoal` is retained as a display-only
 * fallback (no engine consumes it) — see DEFAULT_PROFILE_IDENTITY.
 */
export type PrimaryGoal =
  | 'Fat Loss'
  | 'Lean Performance'
  | 'Strength & Muscle'
  | 'Performance Maintenance'
  | 'Endurance'
  | 'Recovery Optimization'
  | 'Everyday Energy';

/**
 * Typical Sweat Level (Section 19) — self-reported sweat VOLUME. MAJOR
 * variable. Deliberately distinct from the Sweat Calculator's per-session
 * `SodiumProfile` in types/sweat.ts, which classifies sweat SODIUM
 * concentration; same labels, different concern.
 */
export type SweatClassification = 'light' | 'moderate' | 'heavy' | 'very_heavy';

export interface ProfileIdentity {
  /**
   * Display name shown as the primary headline on the identity card.
   * EMPTY string means "use the Clerk-provided name". This is the
   * "real name OR nickname" toggle — users can override their Clerk
   * full name with something like "Coach Rock" or "SurgeKing".
   */
  displayName: string;
  /** Short alias / handle shown under the display name (e.g. "MiamiPulse"). */
  nickname: string;
  /**
   * Avatar image URI. Empty string means "fall back to the initial
   * bubble". Accepts http(s):// or data: URIs; other schemes are
   * dropped by the sanitiser so a hostile payload can't redirect the
   * `<Image>` source to file://, javascript:, etc.
   */
  avatarUri: string;
  /** City or territory the user reps (e.g. "Miami"). */
  city: string;
  /** Country (display name, e.g. "USA"). */
  country: string;
  /** Team / Circle affiliation shown as a chip. */
  teamCircle: string;
  /** Short territory badge label (e.g. "MIAMI HEAT ZONE"). */
  territoryBadge: string;
  /** User-selected aura mode — see `AURA_STATES` for the canonical set. */
  auraState: AuraState;
  /** What the athlete is optimizing for — see `RECOVERY_GOALS`. */
  recoveryGoal: RecoveryGoal;
  // ── BODY MODEL (Slice 2) ────────────────────────────────────────
  /** Body weight in lbs. `null` = not set; engine falls back to its default. */
  bodyWeightLbs: number | null;
  /** Standing height in centimeters. `null` = not set. */
  heightCm: number | null;
  /** Year of birth (e.g. 1990). `null` = not set. Stored as year only — no DOB precision. */
  birthYear: number | null;
  /**
   * Biological sex used by sweat-rate / decay math. `'unspecified'`
   * is the default and is treated by the engine as "no sex-specific
   * adjustment" rather than a hidden assumption.
   */
  biologicalSex: BiologicalSex;
  /**
   * Day-to-day activity level on a 0..10 scale (0 = mostly sedentary,
   * 10 = pro athlete). `null` = not set; the hydration-demand adapter
   * falls back to the server-derived `UserState.activityLevel`. Owned
   * by the onboarding wizard as the Profile-side override.
   */
  activityLevel: number | null;
  // ── LIFESTYLE (Slice 3) ─────────────────────────────────────────
  /** Self-reported daily caffeine intake band — see `CaffeineHabit`. */
  caffeineHabit: CaffeineHabit;
  /** Occupation category used as a hydration-demand floor — see `OccupationType`. */
  occupationType: OccupationType;
  /** True if the user flies / travels often (cabin-air + circadian load). */
  frequentTraveler: boolean;
  // ── PERFORMANCE PROFILE (Section 19) ────────────────────────────
  /** Training Level — `null` = unset. MAJOR variable (mints a version). */
  trainingLevel: TrainingLevel | null;
  /**
   * Primary Goal — the §19 canonical 7-value objective. MAJOR variable
   * (feeds the snapshot's `performanceGoal`). `null` = unset.
   */
  primaryGoal: PrimaryGoal | null;
  /** Typical self-reported sweat VOLUME. MAJOR variable. `null` = unset. */
  sweatClassification: SweatClassification | null;
  /**
   * Goal body weight in lbs. Baseline INPUT only — NOT a version trigger
   * (a target, not current physiology). `null` = unset.
   */
  goalWeightLbs: number | null;
  /**
   * Typical workout duration in minutes. Baseline INPUT only — NOT a version
   * trigger. `null` = unset.
   */
  typicalWorkoutDurationMin: number | null;
}

/**
 * Canonical aura list. Order is the on-screen order in the editor's
 * segmented control — keep IGNITE first (most energetic) through CALM
 * (most restful) so the gradient reads intuitively.
 */
export const AURA_STATES: readonly AuraState[] = [
  'IGNITE',
  'FLOW',
  'STORM',
  'CALM',
  'APEX',
] as const;

/** Canonical biological-sex options, in display order for the segmented control. */
export const BIOLOGICAL_SEX_OPTIONS: readonly BiologicalSex[] = [
  'male',
  'female',
  'non-binary',
  'unspecified',
] as const;

/** Canonical recovery-goal options, in display order. */
export const RECOVERY_GOALS: readonly RecoveryGoal[] = [
  'PERFORMANCE',
  'RECOVERY',
  'ENDURANCE',
  'BALANCE',
  'LONGEVITY',
] as const;

/** Canonical caffeine-habit options, in display order (lightest → heaviest). */
export const CAFFEINE_HABIT_OPTIONS: readonly CaffeineHabit[] = [
  'none',
  'low',
  'moderate',
  'high',
  'unspecified',
] as const;

/** Canonical occupation-type options, in display order. */
export const OCCUPATION_TYPE_OPTIONS: readonly OccupationType[] = [
  'desk',
  'active',
  'outdoor',
  'shift',
  'other',
  'unspecified',
] as const;

/** Canonical Training Level options (Section 19), in display order. */
export const TRAINING_LEVELS: readonly TrainingLevel[] = [
  'Beginner',
  'Active',
  'Advanced',
  'Elite',
] as const;

/** Canonical Primary Goal options (Section 19), in display order. */
export const PRIMARY_GOALS: readonly PrimaryGoal[] = [
  'Fat Loss',
  'Lean Performance',
  'Strength & Muscle',
  'Performance Maintenance',
  'Endurance',
  'Recovery Optimization',
  'Everyday Energy',
] as const;

/** Canonical Typical Sweat Level options (Section 19), lightest → heaviest. */
export const SWEAT_CLASSIFICATIONS: readonly SweatClassification[] = [
  'light',
  'moderate',
  'heavy',
  'very_heavy',
] as const;

/**
 * Empty defaults so the card degrades to "no chip rendered" rather
 * than literal whitespace. Body-model fields default to null so the
 * UI can show an empty-state nudge ("Add your body model") instead
 * of guessing.
 */
export const DEFAULT_PROFILE_IDENTITY: ProfileIdentity = {
  displayName: '',
  nickname: '',
  avatarUri: '',
  city: '',
  country: '',
  teamCircle: '',
  territoryBadge: '',
  auraState: 'FLOW',
  recoveryGoal: 'BALANCE',
  bodyWeightLbs: null,
  heightCm: null,
  birthYear: null,
  biologicalSex: 'unspecified',
  activityLevel: null,
  caffeineHabit: 'unspecified',
  occupationType: 'unspecified',
  frequentTraveler: false,
  trainingLevel: null,
  primaryGoal: null,
  sweatClassification: null,
  goalWeightLbs: null,
  typicalWorkoutDurationMin: null,
};

/** Hard cap so a runaway paste can't blow out the chip strip layout. */
const MAX_FIELD_LENGTH = 48;
/** Avatar URIs can legitimately be long (data: URIs, signed URLs). */
const MAX_AVATAR_URI_LENGTH = 2048;

// ── BODY MODEL ranges ─────────────────────────────────────────────
// Hard guardrails so a bad keypress or corrupted payload can't push
// physiologically impossible numbers into the engine. Choose ranges
// that comfortably cover real humans (incl. youth athletes and large
// linemen) without admitting obvious junk.
export const WEIGHT_LBS_MIN = 60;
export const WEIGHT_LBS_MAX = 500;
export const HEIGHT_CM_MIN = 120;
export const HEIGHT_CM_MAX = 230;
/** Activity level scale used by the hydration-demand engine. */
export const ACTIVITY_LEVEL_MIN = 0;
export const ACTIVITY_LEVEL_MAX = 10;
// ── PERFORMANCE PROFILE ranges (Section 19) ───────────────────────
/** Goal weight reuses the same physiological guardrails as current weight. */
export const GOAL_WEIGHT_LBS_MIN = WEIGHT_LBS_MIN;
export const GOAL_WEIGHT_LBS_MAX = WEIGHT_LBS_MAX;
/** Typical workout duration in minutes — 0 to a generous 6-hour cap. */
export const WORKOUT_DURATION_MIN = 0;
export const WORKOUT_DURATION_MAX = 360;
const BIRTH_YEAR_MIN = 1900;
/** Computed lazily so tests / fixtures aren't tied to the wall clock. */
function birthYearMaxFor(now: Date): number {
  // Allow current year (newborn) so we never reject a valid recent date.
  return now.getFullYear();
}

function isAura(v: unknown): v is AuraState {
  return (
    v === 'IGNITE' ||
    v === 'FLOW' ||
    v === 'STORM' ||
    v === 'CALM' ||
    v === 'APEX'
  );
}

function isBiologicalSex(v: unknown): v is BiologicalSex {
  return (
    v === 'male' || v === 'female' || v === 'non-binary' || v === 'unspecified'
  );
}

function isRecoveryGoal(v: unknown): v is RecoveryGoal {
  return (
    v === 'PERFORMANCE' ||
    v === 'RECOVERY' ||
    v === 'ENDURANCE' ||
    v === 'BALANCE' ||
    v === 'LONGEVITY'
  );
}

function isCaffeineHabit(v: unknown): v is CaffeineHabit {
  return (
    v === 'none' ||
    v === 'low' ||
    v === 'moderate' ||
    v === 'high' ||
    v === 'unspecified'
  );
}

function isOccupationType(v: unknown): v is OccupationType {
  return (
    v === 'desk' ||
    v === 'active' ||
    v === 'outdoor' ||
    v === 'shift' ||
    v === 'other' ||
    v === 'unspecified'
  );
}

function isTrainingLevel(v: unknown): v is TrainingLevel {
  return v === 'Beginner' || v === 'Active' || v === 'Advanced' || v === 'Elite';
}

function isPrimaryGoal(v: unknown): v is PrimaryGoal {
  return (
    v === 'Fat Loss' ||
    v === 'Lean Performance' ||
    v === 'Strength & Muscle' ||
    v === 'Performance Maintenance' ||
    v === 'Endurance' ||
    v === 'Recovery Optimization' ||
    v === 'Everyday Energy'
  );
}

function isSweatClassification(v: unknown): v is SweatClassification {
  return (
    v === 'light' || v === 'moderate' || v === 'heavy' || v === 'very_heavy'
  );
}

/**
 * Whitelist avatar URI schemes. Only http(s):// and data: image URIs
 * are accepted; anything else (file://, javascript:, ftp:, etc.) is
 * dropped to empty so a hostile payload can't redirect the avatar
 * <Image> source. Empty string = "no avatar, fall back to initial".
 */
function asAvatarUri(v: unknown): string {
  if (typeof v !== 'string') return '';
  const cleaned = v.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (cleaned.length === 0 || cleaned.length > MAX_AVATAR_URI_LENGTH) return '';
  const lower = cleaned.toLowerCase();
  const okScheme =
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('data:image/');
  return okScheme ? cleaned : '';
}

function asTrimmedString(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  // Strip control chars + trim, then cap. We keep emoji + extended
  // unicode so handles like "@miami☀️" survive the round-trip.
  const cleaned = v.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return cleaned.slice(0, MAX_FIELD_LENGTH);
}

/**
 * Clamps a raw payload value into [min, max] when it's a finite
 * number, otherwise returns `null`. `null` is the canonical "unset"
 * value for body-model fields.
 */
function asClampedNumber(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return Math.round(v);
}

function asBirthYear(v: unknown, now: Date = new Date()): number | null {
  return asClampedNumber(v, BIRTH_YEAR_MIN, birthYearMaxFor(now));
}

/**
 * Per-field sanitiser used by the AsyncStorage hydration path. Tolerates
 * a partial / corrupt payload by falling back to defaults per-field —
 * identical to `sanitizeUnitPreferences`.
 */
export function sanitizeProfileIdentity(raw: unknown): ProfileIdentity {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PROFILE_IDENTITY };
  const r = raw as Record<string, unknown>;
  return {
    displayName: asTrimmedString(r.displayName, DEFAULT_PROFILE_IDENTITY.displayName),
    nickname: asTrimmedString(r.nickname, DEFAULT_PROFILE_IDENTITY.nickname),
    avatarUri: asAvatarUri(r.avatarUri),
    city: asTrimmedString(r.city, DEFAULT_PROFILE_IDENTITY.city),
    country: asTrimmedString(r.country, DEFAULT_PROFILE_IDENTITY.country),
    teamCircle: asTrimmedString(r.teamCircle, DEFAULT_PROFILE_IDENTITY.teamCircle),
    territoryBadge: asTrimmedString(
      r.territoryBadge,
      DEFAULT_PROFILE_IDENTITY.territoryBadge,
    ),
    auraState: isAura(r.auraState) ? r.auraState : DEFAULT_PROFILE_IDENTITY.auraState,
    recoveryGoal: isRecoveryGoal(r.recoveryGoal)
      ? r.recoveryGoal
      : DEFAULT_PROFILE_IDENTITY.recoveryGoal,
    bodyWeightLbs: asClampedNumber(r.bodyWeightLbs, WEIGHT_LBS_MIN, WEIGHT_LBS_MAX),
    heightCm: asClampedNumber(r.heightCm, HEIGHT_CM_MIN, HEIGHT_CM_MAX),
    birthYear: asBirthYear(r.birthYear),
    biologicalSex: isBiologicalSex(r.biologicalSex)
      ? r.biologicalSex
      : DEFAULT_PROFILE_IDENTITY.biologicalSex,
    activityLevel: asClampedNumber(
      r.activityLevel,
      ACTIVITY_LEVEL_MIN,
      ACTIVITY_LEVEL_MAX,
    ),
    caffeineHabit: isCaffeineHabit(r.caffeineHabit)
      ? r.caffeineHabit
      : DEFAULT_PROFILE_IDENTITY.caffeineHabit,
    occupationType: isOccupationType(r.occupationType)
      ? r.occupationType
      : DEFAULT_PROFILE_IDENTITY.occupationType,
    frequentTraveler:
      typeof r.frequentTraveler === 'boolean'
        ? r.frequentTraveler
        : DEFAULT_PROFILE_IDENTITY.frequentTraveler,
    trainingLevel: isTrainingLevel(r.trainingLevel)
      ? r.trainingLevel
      : DEFAULT_PROFILE_IDENTITY.trainingLevel,
    primaryGoal: isPrimaryGoal(r.primaryGoal)
      ? r.primaryGoal
      : DEFAULT_PROFILE_IDENTITY.primaryGoal,
    sweatClassification: isSweatClassification(r.sweatClassification)
      ? r.sweatClassification
      : DEFAULT_PROFILE_IDENTITY.sweatClassification,
    goalWeightLbs: asClampedNumber(
      r.goalWeightLbs,
      GOAL_WEIGHT_LBS_MIN,
      GOAL_WEIGHT_LBS_MAX,
    ),
    typicalWorkoutDurationMin: asClampedNumber(
      r.typicalWorkoutDurationMin,
      WORKOUT_DURATION_MIN,
      WORKOUT_DURATION_MAX,
    ),
  };
}

/**
 * Derive age in whole years from `birthYear`. Returns `null` if the
 * year is missing or in the future. Used by the personalization
 * helper and the profile card chip.
 */
export function ageFromBirthYear(
  birthYear: number | null | undefined,
  now: Date = new Date(),
): number | null {
  if (typeof birthYear !== 'number' || !Number.isFinite(birthYear)) return null;
  const age = now.getFullYear() - birthYear;
  if (age < 0 || age > 130) return null;
  return age;
}
