/**
 * First-run routing decision — pure, dependency-free so it can be
 * unit-tested without mocking AsyncStorage or expo-router.
 *
 * A single flag drives the gate (see SplashGate in `app/_layout.tsx`):
 *   - `hasCompletedOnboarding` — set only when the onboarding wizard
 *                                finishes / is skipped (onboarding.tsx).
 *
 * The cinematic intro is the cold-launch OpeningSequence overlay
 * (app/_layout.tsx), so first-run users drop straight into onboarding —
 * there is no separate welcome lobby. A cold start before onboarding
 * completes correctly resumes at `/onboarding` rather than silently
 * skipping setup.
 */

export type FirstRunRoute = '/onboarding' | null;

export interface FirstRunState {
  completedOnboarding: boolean;
  /** DEMO_MODE replays onboarding every cold start (pitch builds). */
  demoMode?: boolean;
}

/**
 * Returns the route the gate should redirect to, or `null` to leave
 * the user in the normal app flow.
 */
export function firstRunRoute(state: FirstRunState): FirstRunRoute {
  if (state.demoMode) return '/onboarding';
  if (!state.completedOnboarding) return '/onboarding';
  return null;
}
