/**
 * Process-singleton OuraRefreshRegistry.
 *
 * Faithful mirror of `whoopRegistry.ts` / `garminRegistry.ts`. Sharing
 * ONE registry across all call sites (fetch sync route, future admin
 * trigger, future webhook handler) collapses concurrent refreshes for
 * the same userId into a single in-flight Promise at the process level.
 *
 * Hidden-infra: exports a lazy getter so test files that don't touch
 * the Oura path never construct the registry.
 */

import {
  createOuraRefreshRegistry,
  type OuraRefreshRegistry,
} from "./ouraRefreshRegistry";

let instance: OuraRefreshRegistry | null = null;

/** Return the process-wide singleton; constructs on first call. */
export function getOuraRefreshRegistry(): OuraRefreshRegistry {
  if (!instance) {
    instance = createOuraRefreshRegistry();
  }
  return instance;
}

/** Test-only: reset the singleton between tests that need isolation. */
export function __resetOuraRefreshRegistryForTests(): void {
  instance = null;
}
