/**
 * RC-2 Ruling A — internal-TestFlight elite-flag overlay.
 *
 * Founder ruling (orchestrating chat, RC-2 Ruling A): enable the four
 * `elite_*` flags plus `offline_intake_outbox_enabled` for the INTERNAL
 * TestFlight build only. Production defaults (`DEFAULT_FLAGS`) and the demo
 * profile (`DEMO_ALL_ON_FLAGS`) must stay byte-identical — this module never
 * edits either export. It is a pure, additive overlay applied at flag
 * *resolution* time, the same seam pattern `DEMO_MODE` uses in
 * `services/demoMode.ts`: an `EXPO_PUBLIC_*` env var, unset on every normal
 * build, gates a small ON-only patch.
 *
 * Contract, mirroring `applyInternalPreviewOverlay`
 * (`featureFlags/internalPreviewOverlay.ts` — a separate, server-driven,
 * per-user cohort mechanism; this module is build-time and global, so it does
 * NOT reuse that overlay's allow-list/TTL/contract-version machinery, only
 * its "union, never a merge" discipline):
 *   - ON-only: every key in `INTERNAL_TESTFLIGHT_OVERLAY_FLAGS` is patched to
 *     `true`. Nothing is ever set to `false` here.
 *   - Byte-identical when off: `resolveFeatureFlags` returns `base` BY
 *     REFERENCE (`result === base`) when the env gate is not engaged, so a
 *     production build's initial flag object is the exact `DEFAULT_FLAGS`
 *     export — no new allocation, no diff, nothing to audit away.
 *   - No restricted-flag interaction: none of the five overlay keys appear in
 *     `INTERNAL_PREVIEW_RESTRICTED_FLAGS` (`featureFlags/flags.ts`) — see the
 *     module-level test asserting the two lists are disjoint, so this overlay
 *     can never be used to backdoor Night Out or a future restricted flag.
 *
 * The env var itself, and the EAS build profile that sets it, are NOT part of
 * this module's authority — `eas.json` is flag-first per standing founder
 * rule (the profile landed via founder-approved PR #567). This module only
 * defines what happens IF that env var is ever set to `'true'`.
 */
import type { FeatureFlags } from '../types';

/**
 * The exact five keys RC-2 Ruling A grants to the internal-TestFlight build.
 * Order matches the ruling's own listing. Adding a key here is a product
 * decision (a new ruling), not a refactor — keep this list founder-traceable.
 */
export const INTERNAL_TESTFLIGHT_OVERLAY_FLAGS = [
  'elite_motion_enabled',
  'elite_home_experience_enabled',
  'elite_weekly_report_enabled',
  'elite_voice_coach_enabled',
  'offline_intake_outbox_enabled',
] as const satisfies readonly (keyof FeatureFlags)[];

export type InternalTestflightOverlayFlagKey = (typeof INTERNAL_TESTFLIGHT_OVERLAY_FLAGS)[number];

/**
 * CONTROLLED BY BUILD ENV — never hardcoded, mirroring `DEMO_MODE`. `true`
 * only when a build sets `EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true` (the proposed
 * `internal` EAS profile — applied to `eas.json` in PR #567). Every
 * other build (`development`, `preview`, `demo`, `production`) leaves the env
 * unset, so this is `false` and `resolveFeatureFlags` is a byte-identical
 * pass-through of `base`.
 */
export const INTERNAL_TESTFLIGHT_OVERLAY_ENABLED =
  process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true';

/**
 * Applies the RC-2 Ruling A overlay on top of `base` when `engaged`. Pure and
 * dependency-light (no React Native, no store) so it is unit-testable in
 * isolation, and the `engaged` param is injectable for tests instead of
 * re-reading `process.env` on every call.
 *
 * Contract: returns `base` BY REFERENCE whenever it would produce no change
 * (`engaged` is falsy) — never allocates a new object in that path. When
 * `engaged` is true, returns a new object with exactly the five overlay keys
 * set `true`; every other key is copied from `base` unchanged (a union, never
 * a merge — this function cannot turn a flag off).
 */
export function applyInternalTestflightOverlay(
  base: FeatureFlags,
  engaged: boolean = INTERNAL_TESTFLIGHT_OVERLAY_ENABLED,
): FeatureFlags {
  if (!engaged) return base;

  const patch = Object.fromEntries(
    INTERNAL_TESTFLIGHT_OVERLAY_FLAGS.map((key) => [key, true]),
  ) as Partial<FeatureFlags>;
  return { ...base, ...patch };
}

/**
 * The single sanctioned way to derive the flags an `AppProvider` should boot
 * with. `store/useAppStore.tsx`'s `initialState.featureFlags` calls this
 * instead of importing `DEFAULT_FLAGS` directly, so the internal-TestFlight
 * overlay has exactly one seam into the running app. `DEFAULT_FLAGS` itself
 * is never mutated and stays importable/byte-identical for every other
 * consumer (`app/_layout.tsx`, `services/appleHealth.ts`, the Profile
 * "unlock all" affordance, etc.) that reads it directly for non-store gates.
 */
export function resolveInitialFeatureFlags(base: FeatureFlags): FeatureFlags {
  return applyInternalTestflightOverlay(base);
}
