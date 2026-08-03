/**
 * providerKit — retry classification + backoff, provider-agnostic.
 *
 * Nothing in the WHOOP/Oura/Garmin/Strava stacks currently classifies
 * errors this way — this is new shared plumbing for future callers
 * (e.g. a fetch worker that wants to distinguish "back off and retry
 * later" from "the connection is dead, stop trying"), not a rename of
 * existing behavior. Kept intentionally minimal: classification and
 * backoff math only, no retry LOOP (callers own their own retry
 * orchestration / job-queue policy — see `queues/jobs.ts`'s
 * `JobPolicy` for the existing exponential/fixed retry-loop pattern
 * this composes with).
 */

/**
 * Coarse bucket for "what should the caller do next" given an HTTP
 * status and/or a caught error from a provider API call:
 *   - `auth`      — 401/403. The access token is invalid/expired in a
 *                   way a bare refresh won't fix (e.g. revoked grant).
 *                   Caller should treat this like a failed refresh —
 *                   do not hot-loop retries.
 *   - `rate_limit`— 429. Caller should back off (see `backoffMs`) and
 *                   retry; the request itself was valid.
 *   - `transient` — 5xx, or no HTTP status at all (network error,
 *                   timeout, DNS failure, thrown non-HTTP error).
 *                   Likely to succeed on retry with backoff.
 *   - `permanent` — any other 4xx (400, 404, 422, ...). Retrying the
 *                   same request will not help; the request itself is
 *                   invalid.
 */
export type ProviderErrorClass = "auth" | "rate_limit" | "transient" | "permanent";

/**
 * Classify a provider API failure from its HTTP status (when known)
 * and/or the thrown error. Status takes precedence when present —
 * it's the ground truth from the provider. When no status is
 * available (network-level failure: fetch rejected before a response
 * was received), the failure is `transient` regardless of the error's
 * shape, since a thrown network error and a 5xx respond to retry the
 * same way.
 */
export function classifyProviderError(
  status?: number,
  err?: unknown,
): ProviderErrorClass {
  if (typeof status === "number" && Number.isFinite(status)) {
    if (status === 401 || status === 403) return "auth";
    if (status === 429) return "rate_limit";
    if (status >= 500 && status < 600) return "transient";
    if (status >= 400 && status < 500) return "permanent";
  }
  // No usable status: a thrown network/timeout error, or a status
  // outside the standard ranges above. Treat as transient — the
  // conservative choice, since permanent would give up on a request
  // that never actually reached the provider.
  void err;
  return "transient";
}

export interface BackoffMsOptions {
  /** Hard ceiling on the returned delay, in ms. Default 30_000. */
  capMs?: number;
}

/**
 * Deterministic exponential backoff: `baseMs * 2^(attempt - 1)`,
 * capped at `capMs` (default 30s). `attempt` is 1-indexed (the first
 * retry is `attempt=1`). No jitter — jitter is a randomized spread
 * that real traffic wants (to avoid a thundering herd) but that a
 * unit test cannot assert on; callers that need jitter add it on top
 * of this deterministic base (e.g. `backoffMs(attempt, base) *
 * (0.5 + Math.random() * 0.5)`), keeping this function itself
 * seed-free and exactly reproducible in tests.
 *
 * Matches the exponential formula already used by
 * `queues/jobs.ts`'s `JobPolicy` (`baseMs * Math.pow(2, attempt - 1)`)
 * so callers that migrate between the two get identical delay
 * sequences for the same `baseMs`.
 */
export function backoffMs(
  attempt: number,
  baseMs: number,
  opts: BackoffMsOptions = {},
): number {
  if (!Number.isFinite(attempt) || attempt < 1) {
    throw new Error(`backoffMs: attempt must be >= 1, got ${attempt}`);
  }
  if (!Number.isFinite(baseMs) || baseMs < 0) {
    throw new Error(`backoffMs: baseMs must be >= 0, got ${baseMs}`);
  }
  const capMs = opts.capMs ?? 30_000;
  const raw = baseMs * Math.pow(2, attempt - 1);
  return Math.min(raw, capMs);
}
