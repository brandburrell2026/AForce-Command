/**
 * Profile = Source of Truth — BODY MODEL accessor + sleep selector.
 *
 * Pure helpers extracted from `profileSource.ts` so they can be
 * imported from engines and tests without traversing the
 * react-native store hook used by the domain-manifest hook.
 *
 * Spec Rule #3 / Architecture lock:
 *   Engines that need weight / height / age / sex go through ONE
 *   reader so default-substitution and "field is missing" semantics
 *   live in a single place. Two flavors:
 *     getRequiredBodyModel(p) — throws MissingProfileFieldError
 *       when a required field is null. Use in engines that genuinely
 *       can't produce a meaningful number without the input.
 *     getBodyModelOrDefaults(p) — returns the same shape with safe
 *       defaults filled in. Use in UI paths that must always render.
 *
 * Sleep selector: freshest-wins across Apple Health, Samsung Health,
 * and WHOOP — the three providers that explicitly report sleep
 * duration. Returns null when no connected sleep provider has data,
 * so the demand engine falls back to its own default rather than
 * fabricating a number.
 */

import type { BiologicalSex, ProfileIdentity } from '../utils/profileIdentity';
import type { ProviderBiometrics } from '../types/biometrics';
import type { HealthProviderId } from '../data/healthProviders';

export interface RequiredBodyModel {
  bodyWeightLbs: number;
  heightCm: number;
  birthYear: number;
  biologicalSex: BiologicalSex;
}

export type BodyModelField = keyof RequiredBodyModel;

export class MissingProfileFieldError extends Error {
  readonly field: BodyModelField;
  constructor(field: BodyModelField) {
    super(`Profile.bodyModel.${field} is required but missing`);
    this.name = 'MissingProfileFieldError';
    this.field = field;
  }
}

/**
 * Strict reader: throws if any of (weight, height, birthYear) is null.
 * `biologicalSex` is never null in ProfileIdentity (defaults to
 * 'unspecified') so it's always returned as-is.
 */
export function getRequiredBodyModel(p: ProfileIdentity): RequiredBodyModel {
  if (p.bodyWeightLbs == null) throw new MissingProfileFieldError('bodyWeightLbs');
  if (p.heightCm == null) throw new MissingProfileFieldError('heightCm');
  if (p.birthYear == null) throw new MissingProfileFieldError('birthYear');
  return {
    bodyWeightLbs: p.bodyWeightLbs,
    heightCm: p.heightCm,
    birthYear: p.birthYear,
    biologicalSex: p.biologicalSex,
  };
}

/** Defaults used when ProfileIdentity hasn't been filled in yet. */
export const BODY_MODEL_DEFAULTS: RequiredBodyModel = {
  bodyWeightLbs: 175,
  heightCm: 178,
  birthYear: 1990,
  biologicalSex: 'unspecified',
};

/**
 * Lenient reader: substitutes physiologically reasonable defaults for
 * any missing field. Use in UI surfaces that must always render.
 */
export function getBodyModelOrDefaults(p: ProfileIdentity): RequiredBodyModel {
  return {
    bodyWeightLbs: p.bodyWeightLbs ?? BODY_MODEL_DEFAULTS.bodyWeightLbs,
    heightCm: p.heightCm ?? BODY_MODEL_DEFAULTS.heightCm,
    birthYear: p.birthYear ?? BODY_MODEL_DEFAULTS.birthYear,
    biologicalSex: p.biologicalSex,
  };
}

/**
 * The three providers that AForce treats as authoritative sleep
 * sources per the architecture lock. Oura also reports sleep but is
 * folded in via `readinessScore`; this selector stays narrow.
 */
export const SLEEP_PROVIDERS: readonly HealthProviderId[] = [
  'apple_health',
  'samsung_health',
  'whoop',
] as const;

export interface FreshestSleep {
  hours: number;
  source: HealthProviderId;
  fetchedAt: number;
}

/**
 * Pure: pick the freshest non-null sleep reading from Apple Health,
 * Samsung Health, or WHOOP. Returns `null` if none are available.
 */
export function selectFreshestSleepHours(
  biometrics: ProviderBiometrics | undefined,
): FreshestSleep | null {
  if (!biometrics) return null;
  let best: FreshestSleep | null = null;
  for (const id of SLEEP_PROVIDERS) {
    const snap = biometrics[id];
    if (!snap) continue;
    const hours = snap.sleepHoursLastNight;
    if (hours == null) continue;
    if (best === null || snap.fetchedAt > best.fetchedAt) {
      best = { hours, source: id, fetchedAt: snap.fetchedAt };
    }
  }
  return best;
}
