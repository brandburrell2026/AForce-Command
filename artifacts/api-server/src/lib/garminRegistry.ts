/**
 * Process-singleton GarminRefreshRegistry.
 *
 * Faithful mirror of `whoopRegistry.ts`. Sharing ONE registry across
 * all call sites (fetch sweep, admin trigger, future webhook handler)
 * collapses concurrent refreshes for the same userId into a single
 * in-flight Promise at the process level.
 *
 * DORMANT / hidden-infra: exports a lazy getter so test files that
 * don't touch the Garmin path never construct the registry.
 */

import {
  createGarminRefreshRegistry,
  type GarminRefreshRegistry,
} from "./garminRefreshRegistry";

let instance: GarminRefreshRegistry | null = null;

/** Return the process-wide singleton; constructs on first call. */
export function getGarminRefreshRegistry(): GarminRefreshRegistry {
  if (!instance) {
    instance = createGarminRefreshRegistry();
  }
  return instance;
}

/** Test-only: reset the singleton between tests that need isolation. */
export function __resetGarminRefreshRegistryForTests(): void {
  instance = null;
}
