/**
 * The SkinIA cohort gate decision, as a pure module (DR-015).
 *
 * Pure — no React, no Clerk, no network, no React Native. That is the whole
 * reason it exists separately from `skiniaCohortAccess.ts`, which holds the
 * hook that fetches the server decision.
 *
 * WHY THE SPLIT. The predicate and the hook lived in one file. When the hook
 * gained `import { useAuth } from '@clerk/expo'`, the unit test importing the
 * predicate started pulling Clerk in with it — and `@clerk/expo` does not
 * parse under the node test environment. The suite stopped COLLECTING:
 * `SyntaxError: Unexpected token 'typeof'`, "no tests". Not a failing test, a
 * test that no longer ran, while `tests-baseline` counted it as one more
 * tolerated file.
 *
 * A gate that reports nothing is worse than a gate that reports a failure, so
 * the decision this containment rests on now lives where a test can reach it
 * without a React Native dependency graph. This is the same convention the
 * rest of the repo already follows — see `utils/secureKV.ts`,
 * `utils/trainerSync.ts` — where the injectable core is split from its
 * framework binding precisely so the core can be proven.
 *
 * This module does not acquire, process, retain, or transmit images.
 */

export type SkinIACohortAccess =
  | { status: 'CHECKING' }
  | { status: 'DENIED'; reason: string }
  | { status: 'GRANTED'; reason: 'CONTROLLED_TESTFLIGHT_COHORT' };

/** The fail-closed starting state: unavailable until the server says otherwise. */
export const SKINIA_ACCESS_CHECKING: SkinIACohortAccess = Object.freeze({ status: 'CHECKING' });

export type SkinIARouteDecision = 'WAIT' | 'ALLOW' | 'DENY';

/**
 * A pending server decision must not open SkinIA, but it also must not be
 * mistaken for a denial. The route can show a camera-free waiting state until
 * the authenticated cohort check resolves.
 */
export function resolveSkinIARouteDecision(input: {
  featureEnabled: boolean;
  internalTestflight: boolean;
  cohort: SkinIACohortAccess;
}): SkinIARouteDecision {
  if (!input.featureEnabled || !input.internalTestflight) return 'DENY';
  if (input.cohort.status === 'CHECKING') return 'WAIT';
  return input.cohort.status === 'GRANTED' ? 'ALLOW' : 'DENY';
}

/**
 * Every gate must pass. A public build is never sufficient, a server grant is
 * never sufficient on its own, and the feature flag is never sufficient on its
 * own.
 */
export function isSkinIAAccessAllowed(input: {
  featureEnabled: boolean;
  internalTestflight: boolean;
  cohort: SkinIACohortAccess;
}): boolean {
  return resolveSkinIARouteDecision(input) === 'ALLOW';
}
