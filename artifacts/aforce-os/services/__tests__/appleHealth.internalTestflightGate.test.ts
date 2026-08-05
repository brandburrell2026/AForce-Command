/**
 * RC-2 Track-A unblock — internal-TestFlight HealthKit gate.
 *
 * `isAppleHealthSupported()` (services/appleHealth.ts) used to read only
 * `DEFAULT_FLAGS.healthkit_native_enabled` — a compile-time constant that is
 * `false` and has no runtime mechanism to flip, so "Apple Health" was
 * unreachable in every build including internal TestFlight (build 44). It is
 * now `Platform.OS === 'ios' && (INTERNAL_TESTFLIGHT_OVERLAY_ENABLED ||
 * DEFAULT_FLAGS.healthkit_native_enabled)`, reusing the exact env seam Ruling
 * A already proved (`featureFlags/internalTestflightOverlay.ts`,
 * `EXPO_PUBLIC_INTERNAL_TESTFLIGHT`, inlined at build time by
 * babel-preset-expo).
 *
 * `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED` is a module-level constant evaluated
 * once at import time (mirroring the build-time inlining it gets in a real
 * bundle). A static top-of-file import would freeze to whichever value was
 * read on the very first import in this whole test run, so every test here
 * sets the env var, calls `vi.resetModules()`, then dynamically re-imports
 * both `../appleHealth` and its `react-native` mock so the module graph is
 * re-evaluated against the new env value. `react-native` is re-mocked with
 * `vi.doMock` per load (not a static `vi.mock`) so `Platform.OS` can vary
 * between iOS/Android/web across tests in this same file — the same
 * `vi.mock('react-native', () => ({ Platform: { OS: '...' } }))` shape
 * `analytics/__tests__/event_dispatcher.territory.test.ts` already uses,
 * just applied per-load instead of once for the whole file.
 *
 * The fifth regression the ticket calls for — write scopes stay empty — is
 * already locked by `appleHealth.healthKitScopes.test.ts` (RULING H) and is
 * untouched by this change; it is not duplicated here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

type PlatformOS = 'ios' | 'android' | 'web';

async function loadAppleHealth(platformOS: PlatformOS, internalTestflight: string | undefined) {
  if (internalTestflight === undefined) {
    delete process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT;
  } else {
    vi.stubEnv('EXPO_PUBLIC_INTERNAL_TESTFLIGHT', internalTestflight);
  }
  vi.resetModules();
  vi.doMock('react-native', () => ({ Platform: { OS: platformOS } }));
  return import('../appleHealth');
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT;
  vi.doUnmock('react-native');
  vi.resetModules();
});

describe('isAppleHealthSupported — internal-TestFlight gate (RC-2 Track-A)', () => {
  it('production build (EXPO_PUBLIC_INTERNAL_TESTFLIGHT unset) on iOS → unavailable', async () => {
    const { isAppleHealthSupported } = await loadAppleHealth('ios', undefined);
    expect(isAppleHealthSupported()).toBe(false);
  });

  it('ordinary preview build (EXPO_PUBLIC_INTERNAL_TESTFLIGHT unset) on iOS → unavailable', async () => {
    // Preview and production both leave the env unset — they are
    // behaviorally identical from this gate's point of view — but the
    // ticket calls out both build profiles explicitly, so both are pinned
    // as their own case rather than assumed from one.
    const { isAppleHealthSupported } = await loadAppleHealth('ios', undefined);
    expect(isAppleHealthSupported()).toBe(false);
  });

  it("internal TestFlight on iOS (EXPO_PUBLIC_INTERNAL_TESTFLIGHT='true') → AVAILABLE", async () => {
    const { isAppleHealthSupported } = await loadAppleHealth('ios', 'true');
    expect(isAppleHealthSupported()).toBe(true);
  });

  it("Android with the internal-TestFlight env engaged ('true') → still unavailable (Platform.OS gate wins)", async () => {
    const { isAppleHealthSupported } = await loadAppleHealth('android', 'true');
    expect(isAppleHealthSupported()).toBe(false);
  });

  it("web with the internal-TestFlight env engaged ('true') → still unavailable (Platform.OS gate wins)", async () => {
    const { isAppleHealthSupported } = await loadAppleHealth('web', 'true');
    expect(isAppleHealthSupported()).toBe(false);
  });
});
