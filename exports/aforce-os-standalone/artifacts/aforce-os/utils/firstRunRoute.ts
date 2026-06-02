/**
 * First-run routing decision — pure, dependency-free so it can be
 * unit-tested without mocking AsyncStorage or expo-router.
 *
 * Two independent flags drive the gate (see SplashGate in
 * `app/_layout.tsx`):
 *   - `hasSeenWelcome`       — set when the user taps CONTINUE on the
 *                              welcome lobby (welcome.tsx).
 *   - `hasCompletedOnboarding` — set only when the onboarding wizard
 *                              finishes / is skipped (onboarding.tsx).
 *
 * Splitting them prevents the original bug where a single
 * "completed" flag was written *before* the wizard ran, so a cold
 * start mid-onboarding silently skipped setup. With two flags an
 * interrupted first run correctly resumes at `/onboarding`.
 */

export type FirstRunRoute = '/welcome' | '/onboarding' | null;

export interface FirstRunState {
  seenWelcome: boolean;
  completedOnboarding: boolean;
  /** DEMO_MODE replays the full intro every cold start (pitch builds). */
  demoMode?: boolean;
}

/**
 * Returns the route the gate should redirect to, or `null` to leave
 * the user in the normal app flow.
 */
export function firstRunRoute(state: FirstRunState): FirstRunRoute {
  if (state.demoMode) return '/welcome';
  if (!state.seenWelcome) return '/welcome';
  if (!state.completedOnboarding) return '/onboarding';
  return null;
}
