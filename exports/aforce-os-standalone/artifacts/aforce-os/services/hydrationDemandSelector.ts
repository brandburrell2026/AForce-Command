/**
 * Hydration Demand Engine — flag-gated read path.
 *
 * Pure selector that returns the Demand Engine snapshot for the
 * current store state, or `null` when `spec_demand_engine` is off.
 *
 * Architecture lock alignment (Phase 1):
 *   - This selector is intentionally *not* consumed by any visible
 *     surface today. It exists so future surfaces, dev panels, and
 *     debug tooling have a single canonical read path that already
 *     honours the flag.
 *   - The flag is the single gate. When OFF the engine and adapter
 *     are not invoked at all, so no work is wasted on the hot path.
 *   - No mutation, no I/O, no Date.now(). Same inputs → same output.
 */

import type { AppState } from '../store/appStoreTypes';
import type { FeatureFlags } from '../types';
import { isFlagEnabled } from '../featureFlags/flags';
import { buildHydrationDemandInputs, type AdapterOverrides, type AdapterTrace } from './hydrationDemandAdapter';
import {
  computeHydrationDemand,
  type HydrationDemandInputs,
  type HydrationDemandOutputs,
} from './hydrationDemandEngine';

export interface HydrationDemandSnapshot {
  inputs: HydrationDemandInputs;
  outputs: HydrationDemandOutputs;
  trace: AdapterTrace;
}

/**
 * Returns the engine snapshot for the current app state, or `null`
 * when the `spec_demand_engine` flag is OFF. Callers MUST treat a
 * null return as "feature unavailable" rather than substituting any
 * other hydration target — the existing scoring engine remains the
 * source of truth for visible surfaces in Phase 1.
 */
export function selectHydrationDemandSnapshot(
  state: AppState,
  flags: FeatureFlags,
  overrides: AdapterOverrides = {},
): HydrationDemandSnapshot | null {
  if (!isFlagEnabled(flags, 'spec_demand_engine')) return null;

  const { inputs, trace } = buildHydrationDemandInputs(
    state.userState,
    state.profileIdentity,
    overrides,
  );
  const outputs = computeHydrationDemand(inputs);
  return { inputs, outputs, trace };
}
