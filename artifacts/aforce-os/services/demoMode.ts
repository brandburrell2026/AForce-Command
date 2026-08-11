/**
 * Demo Mode Flag
 *
 * When true, bypasses Clerk auth gates so screens are reachable
 * without signing in. Used for marketing screenshots and pitch
 * demos. Off unless a build explicitly opts in.
 *
 * Note: data fetches still 401 against the API; the app falls back
 * to its built-in default state (see realApi.fetchHome catch path),
 * which is sufficient for a self-contained pitch/demo build with no
 * live backend.
 *
 * CONTROLLED BY BUILD ENV — never hardcoded. `DEMO_MODE` is true only
 * when a build sets `EXPO_PUBLIC_DEMO_MODE=true` (e.g. a dedicated
 * internal "demo" EAS profile). Every normal build leaves the env
 * unset, so demo mode is off by default and cannot be accidentally
 * shipped by editing this file.
 */
export const DEMO_MODE = process.env['EXPO_PUBLIC_DEMO_MODE'] === 'true';

/**
 * CAPTURE_MODE — dev-only screenshot bypass for before/after visual evidence.
 * When a Metro session sets `EXPO_PUBLIC_CAPTURE=1` in a __DEV__ build:
 *   - first-run routing skips the sign-in gate + onboarding (app/index.tsx,
 *     SplashGate) and the cold-launch cinematic/Welcome overlays (AppShell),
 *   - the store seeds the SAME clamped demo flag payload the Profile screen's
 *     "Unlock all demo features" control dispatches (`demoUnlockAllFlags()` —
 *     internal-preview-restricted flags stay OFF).
 * Double-gated on `__DEV__`, so it is compile-time inert in any production
 * bundle and cannot ship by accident.
 */
export const CAPTURE_MODE = __DEV__ && process.env['EXPO_PUBLIC_CAPTURE'] === '1';

// Safety: DEMO_MODE bypasses the sign-in gate, so it must only ever run
// in an INTERNAL pitch/demo build, never in one distributed to real
// users. This is loud but non-fatal: a fatal throw would crash the very
// demo build this flag exists to enable. The real protection is that the
// env var is unset on every non-demo profile, so this branch is
// unreachable outside a deliberate demo build.
if (typeof __DEV__ !== 'undefined' && !__DEV__ && DEMO_MODE) {
  console.warn(
    '[AForce] DEMO_MODE is ON in a release build. Auth gates are bypassed — ' +
      'this build is for INTERNAL pitch/demo distribution ONLY and must not ' +
      'reach real end users.',
  );
}
