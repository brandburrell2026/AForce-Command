/**
 * WHOOP refresh policy — WHEN to fetch, never WHAT is fetched.
 *
 * Founder decision 2026-08-19 (governance/WHOOP-SWEEP-REDESIGN.md). The
 * 60-second background sweep kept Neon compute awake 24/7 and retried two
 * dead tokens every minute forever — 2,880 doomed WHOOP POSTs a day for
 * zero value. This module is the deliberately pure center of the redesign:
 * every threshold and schedule lives here, unit-testable without a DB, and
 * nothing here touches snapshot values, normalization, or scoring.
 *
 * Ratified parameters:
 *   - freshness threshold 30 min: data younger than this is never re-fetched.
 *     No prior approved constant existed — blob `fetchedAt` was persisted but
 *     nothing read it for suppression. WHOOP recovery/sleep/strain are
 *     daily-granularity scores, so 30 min is conservative.
 *   - failed token refresh backs off 30m → 1h → 2h → 4h → 8h → 16h → 24h cap.
 *   - after 8 CONSECUTIVE failures the connection is marked `needs_reauth`
 *     and automatic refresh attempts STOP until a successful re-auth.
 *   - token rows are never deleted automatically; any successful refresh or
 *     re-auth clears the whole failure state.
 */

/** Data younger than this is fresh — no provider fetch. Founder-ratified. */
export const WHOOP_DATA_FRESH_MS = 30 * 60 * 1000;

/**
 * Exponential backoff after consecutive refresh failures. Index = failures-1;
 * beyond the last entry the cap holds. Founder-ratified schedule.
 */
export const WHOOP_BACKOFF_STEPS_MS: readonly number[] = [
  30 * 60 * 1000, // 1st failure  -> 30m
  60 * 60 * 1000, // 2nd          -> 1h
  2 * 60 * 60 * 1000, // 3rd      -> 2h
  4 * 60 * 60 * 1000, // 4th      -> 4h
  8 * 60 * 60 * 1000, // 5th      -> 8h
  16 * 60 * 60 * 1000, // 6th     -> 16h
  24 * 60 * 60 * 1000, // 7th+    -> 24h cap
];

/** Consecutive failures at which the connection needs member attention. */
export const WHOOP_NEEDS_REAUTH_AFTER = 8;

/** Backoff delay for the Nth consecutive failure (1-based). */
export function whoopBackoffDelayMs(consecutiveFailures: number): number {
  if (!Number.isFinite(consecutiveFailures) || consecutiveFailures < 1) {
    return WHOOP_BACKOFF_STEPS_MS[0]!;
  }
  const idx = Math.min(consecutiveFailures, WHOOP_BACKOFF_STEPS_MS.length) - 1;
  return WHOOP_BACKOFF_STEPS_MS[idx]!;
}

export interface WhoopRefreshFailureState {
  /** New consecutive-failure count to persist. */
  failureCount: number;
  /** Epoch ms before which automatic refresh must not retry. */
  backoffUntilMs: number;
  /** True once the member must re-authenticate; retries stop entirely. */
  needsReauth: boolean;
}

/**
 * The state to persist after one more refresh failure. Pure: previous count
 * in (null/undefined = no failure history), next state out.
 */
export function nextWhoopFailureState(
  prevFailureCount: number | null | undefined,
  nowMs: number,
): WhoopRefreshFailureState {
  const failureCount = (prevFailureCount ?? 0) + 1;
  return {
    failureCount,
    backoffUntilMs: nowMs + whoopBackoffDelayMs(failureCount),
    needsReauth: failureCount >= WHOOP_NEEDS_REAUTH_AFTER,
  };
}

/** Fresh = a fetch this recent makes another one pointless. */
export function isWhoopBlobFresh(
  blobFetchedAtMs: number | null | undefined,
  nowMs: number,
  freshMs: number = WHOOP_DATA_FRESH_MS,
): boolean {
  if (blobFetchedAtMs == null || !Number.isFinite(blobFetchedAtMs)) return false;
  return nowMs - blobFetchedAtMs < freshMs;
}

/** Everything eligibility needs to know about one connection. */
export interface WhoopEligibilityInput {
  /** biometrics.whoop.fetchedAt (epoch ms), or null when never fetched. */
  blobFetchedAtMs: number | null;
  failureCount: number | null;
  /** Epoch ms, or null when no backoff is armed. */
  backoffUntilMs: number | null;
  needsReauth: boolean | null;
}

export type WhoopEligibility =
  | "fetch"
  | "skipped_fresh"
  | "skipped_backoff"
  | "skipped_needs_reauth";

/**
 * Decide whether an automatic (sweep or foreground) refresh may run.
 * Order matters and is deliberate:
 *   needs_reauth  — hard stop; only member re-auth clears it, so it wins even
 *                   over "the data is stale".
 *   backoff       — a known-failing token must not be retried early just
 *                   because the blob aged out.
 *   fresh         — nothing to do.
 */
export function resolveWhoopEligibility(
  input: WhoopEligibilityInput,
  nowMs: number,
  freshMs: number = WHOOP_DATA_FRESH_MS,
): WhoopEligibility {
  if (input.needsReauth === true) return "skipped_needs_reauth";
  if (input.backoffUntilMs != null && input.backoffUntilMs > nowMs) {
    return "skipped_backoff";
  }
  if (isWhoopBlobFresh(input.blobFetchedAtMs, nowMs, freshMs)) {
    return "skipped_fresh";
  }
  return "fetch";
}
