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

export type BiologicalSex = 'male' | 'female' | 'unspecified';

export interface ProfileIdentity {
  /** Short alias / handle shown under the display name (e.g. "MiamiPulse"). */
  nickname: string;
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
  'unspecified',
] as const;

/**
 * Empty defaults so the card degrades to "no chip rendered" rather
 * than literal whitespace. Body-model fields default to null so the
 * UI can show an empty-state nudge ("Add your body model") instead
 * of guessing.
 */
export const DEFAULT_PROFILE_IDENTITY: ProfileIdentity = {
  nickname: '',
  city: '',
  country: '',
  teamCircle: '',
  territoryBadge: '',
  auraState: 'FLOW',
  bodyWeightLbs: null,
  heightCm: null,
  birthYear: null,
  biologicalSex: 'unspecified',
};

/** Hard cap so a runaway paste can't blow out the chip strip layout. */
const MAX_FIELD_LENGTH = 48;

// ── BODY MODEL ranges ─────────────────────────────────────────────
// Hard guardrails so a bad keypress or corrupted payload can't push
// physiologically impossible numbers into the engine. Choose ranges
// that comfortably cover real humans (incl. youth athletes and large
// linemen) without admitting obvious junk.
export const WEIGHT_LBS_MIN = 60;
export const WEIGHT_LBS_MAX = 500;
export const HEIGHT_CM_MIN = 120;
export const HEIGHT_CM_MAX = 230;
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
  return v === 'male' || v === 'female' || v === 'unspecified';
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
    nickname: asTrimmedString(r.nickname, DEFAULT_PROFILE_IDENTITY.nickname),
    city: asTrimmedString(r.city, DEFAULT_PROFILE_IDENTITY.city),
    country: asTrimmedString(r.country, DEFAULT_PROFILE_IDENTITY.country),
    teamCircle: asTrimmedString(r.teamCircle, DEFAULT_PROFILE_IDENTITY.teamCircle),
    territoryBadge: asTrimmedString(
      r.territoryBadge,
      DEFAULT_PROFILE_IDENTITY.territoryBadge,
    ),
    auraState: isAura(r.auraState) ? r.auraState : DEFAULT_PROFILE_IDENTITY.auraState,
    bodyWeightLbs: asClampedNumber(r.bodyWeightLbs, WEIGHT_LBS_MIN, WEIGHT_LBS_MAX),
    heightCm: asClampedNumber(r.heightCm, HEIGHT_CM_MIN, HEIGHT_CM_MAX),
    birthYear: asBirthYear(r.birthYear),
    biologicalSex: isBiologicalSex(r.biologicalSex)
      ? r.biologicalSex
      : DEFAULT_PROFILE_IDENTITY.biologicalSex,
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
