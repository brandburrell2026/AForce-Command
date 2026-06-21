/**
 * Body-measurement helpers — the pure, RN-free logic behind the shared
 * height/weight input components (`components/bodyModel/*`).
 *
 * Why this exists:
 *   Before this module, height/weight entry was implemented three
 *   different ways (onboarding's half-inch stepper, EditProfile's
 *   cm-only TextInput, SweatCalculator's float-feet field) with no
 *   shared contract. This module is the single source of truth for
 *   parsing / clamping / formatting body measurements so every surface
 *   behaves identically and writes the SAME canonical values.
 *
 * Canonical storage (matches `utils/profileIdentity.ts`):
 *   - body weight → integer POUNDS  (ProfileIdentity.bodyWeightLbs)
 *   - height      → integer CENTIMETRES (ProfileIdentity.heightCm)
 *
 * Note on units.ts: the generic `formatWeight()` there is kg-canonical
 * because it formats arbitrary weight quantities. The BODY MODEL,
 * however, is stored in pounds (the value the server `userState` and the
 * profile card both use), so these helpers convert at the lbs boundary.
 *
 * Pure functions only — no React, no AsyncStorage, no side effects — so
 * they can be unit-tested without the React Native runtime (the repo's
 * vitest cannot parse `react-native` imports).
 */

import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  WEIGHT_LBS_MAX,
  WEIGHT_LBS_MIN,
} from './profileIdentity';
import {
  cmToNearestHalfInches,
  formatHalfInches,
  halfInchesToCm,
  kgToLbs,
  lbsToKg,
  type HeightUnit,
  type WeightUnit,
} from './units';

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/**
 * Seed value the height stepper lands on for an unset field (≈5'10" /
 * 178 cm) — a sensible mid-range default so the first tap is useful
 * regardless of unit system.
 */
export const DEFAULT_HEIGHT_CM = 178;

/** Imperial stepper bounds, derived from the canonical cm range so the
 * stepper can never produce an out-of-range value. */
export const MIN_HALF_INCHES = cmToNearestHalfInches(HEIGHT_CM_MIN);
export const MAX_HALF_INCHES = cmToNearestHalfInches(HEIGHT_CM_MAX);

// ─── Weight (display unit text ↔ canonical integer lbs) ──────────────

/**
 * Parse free-typed weight text in the user's chosen unit into canonical
 * integer pounds. Returns `null` for empty / non-numeric / out-of-range
 * input — `null` is the canonical "unset" value, matching the profile
 * sanitiser, so a partially-typed or invalid value simply clears the
 * stored body weight rather than persisting junk.
 */
export function parseWeightToLbs(text: string, unit: WeightUnit): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  const lbs = Math.round(unit === 'kg' ? kgToLbs(n) : n);
  if (lbs < WEIGHT_LBS_MIN || lbs > WEIGHT_LBS_MAX) return null;
  return lbs;
}

/**
 * Format canonical pounds as the whole-number string shown inside the
 * weight TextInput, converted into the user's chosen unit. `null` →
 * empty string so the field renders its placeholder.
 */
export function formatWeightInputValue(
  lbs: number | null,
  unit: WeightUnit,
): string {
  if (lbs == null) return '';
  const value = unit === 'kg' ? lbsToKg(lbs) : lbs;
  return String(Math.round(value));
}

// ─── Height (canonical integer cm via unit-aware stepper) ────────────

/**
 * Compute the next canonical height (cm) for a single stepper tap.
 *
 *   - Metric steps by 1 cm.
 *   - Imperial steps by a half-inch, modelled as an integer half-inch
 *     count so the math stays exact, then re-derived to canonical cm.
 *   - An unset field (`null`) lands on `DEFAULT_HEIGHT_CM` on first tap
 *     regardless of direction, so the user starts from a sane value.
 *
 * Always returns a valid in-range cm value (never null) — height is set
 * by stepping, so there is no "clear" path.
 */
export function stepHeightCm(
  currentCm: number | null,
  direction: 1 | -1,
  unit: HeightUnit,
): number {
  if (currentCm == null) return DEFAULT_HEIGHT_CM;
  if (unit === 'cm') {
    return clamp(currentCm + direction, HEIGHT_CM_MIN, HEIGHT_CM_MAX);
  }
  const halfInches = clamp(
    cmToNearestHalfInches(currentCm) + direction,
    MIN_HALF_INCHES,
    MAX_HALF_INCHES,
  );
  return clamp(halfInchesToCm(halfInches), HEIGHT_CM_MIN, HEIGHT_CM_MAX);
}

/**
 * Format a canonical cm value for display in the stepper, in the user's
 * chosen unit. Metric → `180 cm`; imperial → nearest half-inch, e.g.
 * `5'10.5"`. Callers handle the `null` (unset) case with their own
 * placeholder copy.
 */
export function formatHeightValue(cm: number, unit: HeightUnit): string {
  return unit === 'cm'
    ? `${Math.round(cm)} cm`
    : formatHalfInches(cmToNearestHalfInches(cm));
}
