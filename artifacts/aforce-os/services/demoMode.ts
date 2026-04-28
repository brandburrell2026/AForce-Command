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
export const DEMO_MODE = false;
