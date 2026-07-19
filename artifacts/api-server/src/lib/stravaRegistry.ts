/**
 * Process-singleton StravaRefreshRegistry.
 *
 * Faithful mirror of `ouraRegistry.ts` / `whoopRegistry.ts` /
 * `garminRegistry.ts`. Sharing ONE registry across all call sites
 * (fetch sync route, future admin trigger, future webhook handler)
 * collapses concurrent refreshes for the same userId into a single
 * in-flight Promise at the process level.
 *
 * Hidden-infra: exports a lazy getter so test files that don't touch
 * the Strava path never construct the registry.
 */

import {
  createStravaRefreshRegistry,
  type StravaRefreshRegistry,
} from "./stravaRefreshRegistry";

let instance: StravaRefreshRegistry | null = null;

/** Return the process-wide singleton; constructs on first call. */
export function getStravaRefreshRegistry(): StravaRefreshRegistry {
  if (!instance) {
    instance = createStravaRefreshRegistry();
  }
  return instance;
}

/** Test-only: reset the singleton between tests that need isolation. */
export function __resetStravaRefreshRegistryForTests(): void {
  instance = null;
}
