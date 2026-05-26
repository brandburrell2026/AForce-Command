/**
 * Server-side Hydration Demand input adapter.
 *
 * Mirrors `artifacts/aforce-os/services/hydrationDemandAdapter.ts`
 * but reads from the persisted `aforce_user_state` row instead of
 * the mobile in-memory `UserState`. Pure — no I/O, no Date.now() —
 * so it stays cheap to test.
 *
 * Sourcing rules (mirror the mobile architecture lock):
 *   - body weight  -> aforce_user_state.bodyWeightLbs (the single
 *                     server-persisted source of truth)
 *   - activity     -> aforce_user_state.activityLevel, clamped 0..10
 *   - heat / humidity -> aforce_user_state.weatherTempC /
 *                     weatherHumidity (real-world weather, written
 *                     by the OpenWeather proxy)
 *   - sleep hours  -> freshest non-null `sleepHoursLastNight`
 *                     across the multi-provider `biometrics` blob
 *                     PLUS the legacy `appleHealth` single column,
 *                     ranked by `fetchedAt` (epoch ms). Returns
 *                     `undefined` when no provider has data so the
 *                     engine applies its own documented default.
 *
 * Architecture lock alignment:
 *   - Never fabricates. Fields the row doesn't have are simply
 *     omitted from the returned inputs.
 *   - Caller-provided `overrides` win over derived values. Used by
 *     admin/debug callers to inject `sweatProfile`,
 *     `environmentProfile`, `recoveryScore`, `consumedOz`, and
 *     `completedCycles` — none of which have a single canonical
 *     server-persisted source today.
 *   - Hidden-infra: no visible surface consumes this module today.
 *     The Phase 1 callsite is `routes/adminDemandFromState.ts`.
 */

import type { HydrationDemandInputs } from "@workspace/demand-engine";

/**
 * Narrow projection of the columns we read from `aforce_user_state`.
 * Defined locally so this module doesn't have to import the full
 * Drizzle row type — keeps the adapter pure and easy to unit-test
 * with hand-rolled rows.
 */
export interface DemandSourceState {
  bodyWeightLbs: number | null;
  activityLevel: number | null;
  weatherTempC: number | null;
  weatherHumidity: number | null;
  appleHealth: AppleHealthSnapshot | null;
  biometrics: ProviderBiometricsBlob | null;
}

export interface AppleHealthSnapshot {
  sleepHoursLastNight?: number | null;
  fetchedAt: number;
}

export interface ProviderSnapshotBlob {
  providerId: string;
  sleepHoursLastNight?: number | null;
  fetchedAt: number;
}

export type ProviderBiometricsBlob = Record<string, ProviderSnapshotBlob>;

/** Same override surface as the mobile adapter so the two can stay
 *  shape-compatible if we later lift this to a shared lib. */
export interface DemandAdapterOverrides {
  consumedOz?: number;
  completedCycles?: number;
  sweatProfile?: HydrationDemandInputs["sweatProfile"];
  environmentProfile?: HydrationDemandInputs["environmentProfile"];
  recoveryScore?: number;
}

export interface FreshestSleepSource {
  /** Hours of sleep last night. */
  hours: number;
  /** Provider id the value came from (`apple_health`, `whoop`, etc). */
  source: string;
  /** When that snapshot was fetched (epoch ms). */
  fetchedAt: number;
}

export interface DemandAdapterTrace {
  /** Where sleep came from, or null when no provider had data. */
  sleepSource: FreshestSleepSource | null;
  /** True when bodyWeight came from the persisted column (not the default). */
  weightFromProfile: boolean;
}

export interface DemandAdapterResult {
  inputs: HydrationDemandInputs;
  trace: DemandAdapterTrace;
}

/** Engine default if the persisted column is null. Matches the mobile
 *  `BODY_MODEL_DEFAULTS.bodyWeightLbs` so server + mobile stay in
 *  parity for a brand-new user. */
const BODY_WEIGHT_DEFAULT_LBS = 175;

function clampActivity(v: number | null | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, v));
}

/**
 * Freshest-wins selector across the multi-provider biometrics blob
 * PLUS the legacy single-column `appleHealth`. Mirrors
 * `selectFreshestSleepHours` in `services/profileBodyModel.ts` but
 * scoped to the persisted shape.
 */
export function selectFreshestSleep(
  state: Pick<DemandSourceState, "appleHealth" | "biometrics">,
): FreshestSleepSource | null {
  let best: FreshestSleepSource | null = null;

  const consider = (
    providerId: string,
    snap: { sleepHoursLastNight?: number | null; fetchedAt: number } | null,
  ): void => {
    if (!snap) return;
    const hours = snap.sleepHoursLastNight;
    if (typeof hours !== "number" || !Number.isFinite(hours)) return;
    // Guard against malformed persisted snapshots: a NaN / +-Infinity
    // `fetchedAt` would short-circuit `>` comparisons and let one bad
    // record poison the selection forever after.
    const fetchedAt = snap.fetchedAt;
    if (typeof fetchedAt !== "number" || !Number.isFinite(fetchedAt)) return;
    if (best === null || fetchedAt > best.fetchedAt) {
      best = { hours, source: providerId, fetchedAt };
    }
  };

  // Legacy single column. Stays in the rotation so users who only
  // have Apple Health linked still feed the engine.
  consider("apple_health", state.appleHealth);

  // Multi-provider blob. The blob's key SHOULD match `providerId`
  // but we trust `providerId` for the source label so a stale key
  // can't lie about which provider supplied the reading.
  const blob = state.biometrics;
  if (blob) {
    for (const [key, snap] of Object.entries(blob)) {
      if (!snap) continue;
      const providerId = snap.providerId || key;
      // Don't double-count Apple Health if both the legacy column
      // AND the new blob have an entry — `consider` already keeps
      // the freshest, so this is safe.
      consider(providerId, snap);
    }
  }

  return best;
}

/**
 * Pure: derive `HydrationDemandInputs` from a persisted user-state
 * row, with optional overrides for fields without a canonical
 * server source.
 */
export function buildHydrationDemandInputsFromState(
  state: DemandSourceState,
  overrides: DemandAdapterOverrides = {},
): DemandAdapterResult {
  const inputs: HydrationDemandInputs = {
    weightLbs:
      typeof state.bodyWeightLbs === "number" &&
      Number.isFinite(state.bodyWeightLbs)
        ? state.bodyWeightLbs
        : BODY_WEIGHT_DEFAULT_LBS,
    activityLevel: clampActivity(state.activityLevel),
  };

  const sleepSource = selectFreshestSleep(state);
  if (sleepSource) inputs.sleepHours = sleepSource.hours;
  if (
    typeof state.weatherTempC === "number" &&
    Number.isFinite(state.weatherTempC)
  ) {
    inputs.heatC = state.weatherTempC;
  }
  if (
    typeof state.weatherHumidity === "number" &&
    Number.isFinite(state.weatherHumidity)
  ) {
    inputs.humidityPct = state.weatherHumidity;
  }
  if (overrides.sweatProfile) inputs.sweatProfile = overrides.sweatProfile;
  if (overrides.environmentProfile) {
    inputs.environmentProfile = overrides.environmentProfile;
  }
  if (typeof overrides.recoveryScore === "number") {
    inputs.recoveryScore = overrides.recoveryScore;
  }
  if (typeof overrides.consumedOz === "number") {
    inputs.consumedOz = overrides.consumedOz;
  }
  if (typeof overrides.completedCycles === "number") {
    inputs.completedCycles = overrides.completedCycles;
  }

  return {
    inputs,
    trace: {
      sleepSource,
      weightFromProfile:
        typeof state.bodyWeightLbs === "number" &&
        Number.isFinite(state.bodyWeightLbs),
    },
  };
}
