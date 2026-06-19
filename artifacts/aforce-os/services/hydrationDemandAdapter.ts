/**
 * Hydration Demand Engine — input adapter.
 *
 * Pure mapper from the app's existing `UserState` + `ProfileIdentity`
 * onto the engine's `HydrationDemandInputs` shape. Routes every
 * profile/biometric read through the canonical accessors:
 *   - body weight  → getBodyModelOrDefaults (Profile is source of truth)
 *   - sleep hours  → selectFreshestSleepHours (Apple / Samsung / WHOOP,
 *                    freshest non-null wins; null = engine uses its
 *                    own internal default rather than fabricating)
 *
 * Architecture lock alignment:
 *   - Phase 1 — pure module, no visible surface consumes it.
 *   - Gated upstream by `spec_demand_engine` (default OFF in prod, ON
 *     in DEMO_ALL_ON). The adapter itself is unconditional so the
 *     engine flag is the single gate.
 *   - Never fabricates: only fields that have a real source in
 *     UserState / ProfileIdentity / biometrics are emitted. Anything
 *     missing is left undefined so the engine applies its own
 *     documented defaults.
 */

import type { UserState } from '../types';
import type { ProfileIdentity } from '../utils/profileIdentity';
import {
  getBodyModelOrDefaults,
  selectFreshestSleepHours,
  type FreshestSleep,
} from './profileBodyModel';
import { selectSleepByHierarchy } from '../utils/signalHierarchy';
import { calculateLifestyleDemandAdderOz } from './hydrationDemandEngine';
import type { HydrationDemandInputs } from './hydrationDemandEngine';

/**
 * Optional caller-provided overrides for fields that don't have a
 * single canonical source in UserState today. Kept narrow so the
 * adapter never silently fabricates: pass only what you have.
 */
export interface AdapterOverrides {
  /** Oz already consumed today from any tracked source. */
  consumedOz?: number;
  /** Completed Water Cycles today. */
  completedCycles?: number;
  /** Sweat profile, if known on Profile (not yet a typed field). */
  sweatProfile?: HydrationDemandInputs['sweatProfile'];
  /** Environment profile, if known on Profile (not yet a typed field). */
  environmentProfile?: HydrationDemandInputs['environmentProfile'];
  /** Recovery score override (0..100). */
  recoveryScore?: number;
  /**
   * Pre-computed environmental (Location Intelligence) demand adder in oz.
   * Additive, capped internally by the engine. Score-Protection: this is a
   * target-side adder only. Callers MUST gate this on
   * `location_intelligence_enabled` before passing it; the adapter forwards
   * it verbatim and emits nothing when it is absent (byte-identical).
   */
  environmentalAdderOz?: number;
  /**
   * When true, the sleep value is selected by SIGNAL HIERARCHY™
   * (deterministic per-source priority: WHOOP over Apple over Samsung
   * over Garmin over Google) instead of freshest-wins. Callers MUST gate
   * this on `signal_hierarchy_enabled` before passing it; when absent or
   * false the adapter uses `selectFreshestSleepHours` exactly as before
   * (byte-identical). Score-Protection: this only changes WHICH source
   * feeds `sleepHours` — never the score.
   */
  signalHierarchyEnabled?: boolean;
}

/** Diagnostic detail returned alongside the engine input. */
export interface AdapterTrace {
  /** Source the sleep value came from, or null if no provider had data. */
  sleepSource: FreshestSleep | null;
  /** True when bodyWeight came from ProfileIdentity (not the default). */
  weightFromProfile: boolean;
  /** Combined lifestyle demand adder (oz) carried from ProfileIdentity. */
  lifestyleAdderOz: number;
}

export interface AdapterResult {
  inputs: HydrationDemandInputs;
  trace: AdapterTrace;
}

/**
 * Build engine inputs from app state. Pure — no Date.now(), no I/O.
 */
export function buildHydrationDemandInputs(
  user: UserState,
  profile: ProfileIdentity,
  overrides: AdapterOverrides = {},
): AdapterResult {
  const body = getBodyModelOrDefaults(profile);
  // Source SELECTION: SIGNAL HIERARCHY™ (deterministic priority) when the
  // flag is forwarded, else the legacy freshest-wins path. Both return the
  // same `FreshestSleep` shape, so the trace and downstream stay identical.
  const sleepSource: FreshestSleep | null = overrides.signalHierarchyEnabled
    ? selectSleepByHierarchy(user.biometrics)
    : selectFreshestSleepHours(user.biometrics);

  const inputs: HydrationDemandInputs = {
    weightLbs: body.bodyWeightLbs,
    // Profile is the source of truth when the user set their activity
    // level (onboarding / editor); otherwise fall back to the
    // server-derived UserState value. Mirrors the body-weight rule.
    activityLevel: clampActivity(profile.activityLevel ?? user.activityLevel),
  };

  if (sleepSource) inputs.sleepHours = sleepSource.hours;
  if (typeof user.weatherTempC === 'number') inputs.heatC = user.weatherTempC;
  if (typeof user.weatherHumidity === 'number') inputs.humidityPct = user.weatherHumidity;
  if (overrides.sweatProfile) inputs.sweatProfile = overrides.sweatProfile;
  if (overrides.environmentProfile) inputs.environmentProfile = overrides.environmentProfile;
  if (typeof overrides.recoveryScore === 'number') inputs.recoveryScore = overrides.recoveryScore;
  if (typeof overrides.environmentalAdderOz === 'number') {
    inputs.environmentalAdderOz = overrides.environmentalAdderOz;
  }
  if (typeof overrides.consumedOz === 'number') inputs.consumedOz = overrides.consumedOz;
  if (typeof overrides.completedCycles === 'number') {
    inputs.completedCycles = overrides.completedCycles;
  }

  // Lifestyle demand fields — always present on ProfileIdentity (default
  // 'unspecified' / false = no-op), so Profile is the source of truth and
  // we pass them straight through. The engine union matches ProfileIdentity.
  inputs.caffeineHabit = profile.caffeineHabit;
  inputs.occupationType = profile.occupationType;
  inputs.frequentTraveler = profile.frequentTraveler;

  return {
    inputs,
    trace: {
      sleepSource,
      weightFromProfile: profile.bodyWeightLbs != null,
      lifestyleAdderOz: calculateLifestyleDemandAdderOz(
        profile.caffeineHabit,
        profile.occupationType,
        profile.frequentTraveler,
      ),
    },
  };
}

function clampActivity(v: number | null | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, v));
}
