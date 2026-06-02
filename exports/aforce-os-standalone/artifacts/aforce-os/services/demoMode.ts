/**
 * Demo Mode Flag
 *
 * When true, bypasses Clerk auth gates so screens are reachable
 * without signing in. Used for marketing screenshots and pitch
 * demos. Set back to `false` for normal operation.
 *
 * Note: data fetches still 401 against the API; the app falls back
 * to its built-in default state (see realApi.fetchHome catch path),
 * which is sufficient for visual capture.
 */
export const DEMO_MODE = true;

// Hard guard: a production build with DEMO_MODE accidentally left on
// would bypass Clerk auth gates for every user. Refuse to start.
if (typeof __DEV__ !== 'undefined' && !__DEV__ && DEMO_MODE) {
  throw new Error('DEMO_MODE must not be enabled in production builds. Set DEMO_MODE to false.');
}
