/**
 * Night Out Protocol — internal-preview access resolver (NO-a.1).
 *
 * Founder decision NO-10: Night Out is Founder/Internal Preview ONLY. The client
 * feature flag `night_out_enabled` is NECESSARY BUT NOT SUFFICIENT for access —
 * it is honored only inside an approved internal-preview context that a
 * production user cannot set. This is the enforcement layer that makes the
 * generic client "unlock all" (Phase-0 SS-01) unable to grant access even if it
 * flipped the flag: the approved context is env-driven (`DEMO_MODE`), not a
 * client toggle.
 *
 * Three distinct concepts, kept separate on purpose:
 *   1. Demo PRESENTATION capability — `DEMO_ALL_ON_FLAGS` / the demo build. Lights
 *      up presentation for previews. NOT authorization.
 *   2. Restricted INTERNAL-PREVIEW authorization — this module. Flag AND an
 *      approved internal context (DEMO_MODE) are both required.
 *   3. Future SERVER-SIDE authorization — the authoritative boundary. NOT yet
 *      implemented; when it lands it supersedes this client gate.
 *
 * Pure + dependency-light so it is unit-testable; `DEMO_MODE` is injectable.
 */

import type { FeatureFlags } from '@/types';
import { DEMO_MODE } from '@/services/demoMode';

export interface NightOutAccessContext {
  /**
   * Approved internal-preview context. Env-driven and NOT client-toggleable
   * (defaults to `DEMO_MODE` = `EXPO_PUBLIC_DEMO_MODE === 'true'`). A normal
   * production build is `false`, so no client flag state can grant access.
   */
  internalPreview?: boolean;
}

/** Resolve the approved internal-preview context (env-driven; injectable for tests). */
export function nightOutInternalPreviewContext(
  demoMode: boolean = DEMO_MODE,
): NightOutAccessContext {
  return { internalPreview: demoMode === true };
}

/**
 * The single sanctioned reader for "is Night Out enabled for this user?".
 * Consumers MUST call this rather than reading `flags.night_out_enabled`
 * directly. Returns true only when the flag is on AND an approved internal
 * context is present — so a client-flipped flag (unlock-all, a persisted
 * override) never grants access on its own.
 */
export function isNightOutEnabled(
  flags: Pick<FeatureFlags, 'night_out_enabled'>,
  ctx: NightOutAccessContext = {},
): boolean {
  return flags.night_out_enabled === true && ctx.internalPreview === true;
}

/**
 * The ONLY sanctioned way to turn the flag on — for an approved internal-preview
 * entry point (wired in a later slice, never the generic developer unlock).
 * Returns a new flags object; does not mutate.
 */
export function enableNightOutForInternalPreview(flags: FeatureFlags): FeatureFlags {
  return { ...flags, night_out_enabled: true };
}

/**
 * The sanctioned counterpart to disable Night Out internal-preview authorization
 * (NO-c native-evidence enabler). Modifies ONLY `night_out_enabled`; every
 * unrelated flag is preserved. Pure; does not mutate. Like the enabler, it is
 * only ever composed by the internal-preview service (which itself fails closed
 * outside the authorized internal build) — never a direct UI flag mutation.
 */
export function disableNightOutForInternalPreview(flags: FeatureFlags): FeatureFlags {
  return { ...flags, night_out_enabled: false };
}
