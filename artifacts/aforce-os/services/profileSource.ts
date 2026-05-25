/**
 * Profile = Source of Truth — domain + unit manifests.
 *
 * Spec Rule #3:
 *   Profile controls: Language / Units / Coach / Sleep / Timeline /
 *                     Journal / Notifications / HydroScan / Social /
 *                     Cruise
 *   Support: °F / °C, lbs / kg, ft / cm, oz / mL
 *   Auto + override.
 *
 * Hidden architecture only this turn — no UI changes, no edits to
 * utils/units.ts, utils/profileIdentity.ts, app/(tabs)/profile.tsx,
 * or any store slice. Two manifests land here so a follow-up rule
 * pass can wire profile-as-source-of-truth into the existing
 * settings UI without inventing domain names or unit codes:
 *   1. PROFILE_DOMAINS — the ten surfaces the Profile owns
 *   2. UNIT_FAMILIES + UNIT_VARIANTS — the four supported unit
 *      families with their metric/imperial variants, plus an
 *      Auto + Override mode resolver
 *
 * Gate: `spec_profileSource` (default true — Profile is core;
 * only the formalized domain registry + auto/override resolver
 * are new).
 */
import { useFeatureFlags } from '@/store/useAppStore';

/** The ten Profile-owned domains, in spec order. */
export const PROFILE_DOMAINS = [
  'language',
  'units',
  'coach',
  'sleep',
  'timeline',
  'journal',
  'notifications',
  'hydroScan',
  'social',
  'cruise',
] as const;

export type ProfileDomain = (typeof PROFILE_DOMAINS)[number];

/** Verbatim spec display strings for the ten profile domains. */
export const PROFILE_DOMAIN_LABELS: Readonly<Record<ProfileDomain, string>> = {
  language: 'Language',
  units: 'Units',
  coach: 'Coach',
  sleep: 'Sleep',
  timeline: 'Timeline',
  journal: 'Journal',
  notifications: 'Notifications',
  hydroScan: 'HydroScan',
  social: 'Social',
  cruise: 'Cruise',
};

/** Pure: is `d` one of the ten profile domains? */
export function isProfileDomain(d: string): d is ProfileDomain {
  return (PROFILE_DOMAINS as readonly string[]).includes(d);
}

/** The four unit families the spec calls out. */
export const UNIT_FAMILIES = [
  'temperature',
  'weight',
  'height',
  'volume',
] as const;

export type UnitFamily = (typeof UNIT_FAMILIES)[number];

export type UnitSystem = 'metric' | 'imperial';

/** Per-family unit codes for each system. */
export const UNIT_VARIANTS: Readonly<
  Record<UnitFamily, Readonly<Record<UnitSystem, string>>>
> = {
  temperature: { metric: 'C', imperial: 'F' },
  weight: { metric: 'kg', imperial: 'lbs' },
  height: { metric: 'cm', imperial: 'ft' },
  volume: { metric: 'mL', imperial: 'oz' },
};

/** Verbatim spec display strings keyed by family + system. */
export const UNIT_LABELS: Readonly<
  Record<UnitFamily, Readonly<Record<UnitSystem, string>>>
> = {
  temperature: { metric: '°C', imperial: '°F' },
  weight: { metric: 'kg', imperial: 'lbs' },
  height: { metric: 'cm', imperial: 'ft' },
  volume: { metric: 'mL', imperial: 'oz' },
};

/** Unit mode: Auto (resolve from locale) or Override (explicit). */
export type UnitMode =
  | { kind: 'auto' }
  | { kind: 'override'; system: UnitSystem };

/**
 * Imperial-by-default regions per ISO 3166-1 alpha-2. The three
 * countries that haven't fully adopted metric: US, Liberia, Myanmar.
 */
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM']);

/**
 * Pure: resolve a UnitMode + locale region into a concrete
 * UnitSystem. Override always wins. Auto returns 'imperial' for
 * the three imperial-by-default regions, 'metric' otherwise.
 * Region matching is case-insensitive; null / empty region falls
 * back to metric.
 */
export function resolveUnitSystem(
  mode: UnitMode,
  localeRegion: string | null | undefined,
): UnitSystem {
  if (mode.kind === 'override') return mode.system;
  const region = (localeRegion ?? '').trim().toUpperCase();
  return IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric';
}

/** Pure: look up the display string for a given family + system. */
export function unitLabelFor(family: UnitFamily, system: UnitSystem): string {
  return UNIT_LABELS[family][system];
}

export interface ProfileSourceState {
  enabled: boolean;
  domains: typeof PROFILE_DOMAINS;
  domainLabels: typeof PROFILE_DOMAIN_LABELS;
  unitFamilies: typeof UNIT_FAMILIES;
  unitVariants: typeof UNIT_VARIANTS;
  unitLabels: typeof UNIT_LABELS;
}

/**
 * Hidden hook. Returns the domain + unit manifests plus an
 * `enabled` boolean gated on `spec_profileSource`. Not consumed
 * by any UI this turn — the existing Profile screen + unit
 * preferences keep their current behavior.
 */
export function useHiddenProfileSource(): ProfileSourceState {
  const flags = useFeatureFlags();
  return {
    enabled: !!flags.spec_profileSource,
    domains: PROFILE_DOMAINS,
    domainLabels: PROFILE_DOMAIN_LABELS,
    unitFamilies: UNIT_FAMILIES,
    unitVariants: UNIT_VARIANTS,
    unitLabels: UNIT_LABELS,
  };
}
