/**
 * Write-failure classification — one lost write, told truthfully.
 *
 * Through Build 63 every failed write raised the SAME pair of sentences
 * ("Not saved" / "That didn't reach the server — check your connection and try
 * again") whether the server answered 401, answered 500, refused the body, or
 * never answered at all. That sentence did real damage during the Build-60→63
 * investigation: ONE root cause (a Clerk instance mismatch answering 401 to
 * every authenticated write) presented as three unrelated broken features,
 * because the only signal anyone — member or founder reproducing it — ever saw
 * was "check your connection", pointing the search at the network instead of
 * at auth.
 *
 * The status was never missing. `services/realApi.ts` encodes every real
 * server rejection as `POST <path> → <status>`, and already treats that shape
 * as a contract rather than a log line: `isOfflineError` classifies by testing
 * for a 3-digit status, because "anything carrying a status is a genuine
 * rejection, not offline" is what decides whether an intake may be queued for
 * replay. This module reads that SAME convention and nothing else, so the
 * sentence a member reads can never disagree with the queue decision realApi
 * already made about the identical error.
 *
 * Deliberately pure — no React Native, no store, no realApi import — so the
 * shipped mapping is unit-testable directly instead of only through a mounted
 * component. `store/__tests__/writeFailure.test.ts` pins the pattern below to
 * realApi's own source text so the two cannot drift apart silently.
 *
 * Two judgement calls, recorded because neither is forced by the wire:
 *
 *   - 408 gets its own `timeout` class instead of folding into `invalid`.
 *     A 408 IS a server response (it carries a status, so it is never
 *     "offline"), but nothing about the member's entry was wrong and there is
 *     nothing for them to correct — the only honest instruction is "wait and
 *     try again", which is the opposite of what the 4xx copy tells them to do.
 *     504 deliberately stays in `server`: a gateway giving up is our
 *     infrastructure failing, not the member's request taking too long.
 *   - An error carrying NO parseable status — a transport gap, an aborted
 *     fetch, a thrown non-Error, an auth-token fetch that never returned — is
 *     classified `offline`, exactly as `isOfflineError` classifies it. A
 *     separate "unknown" class would let the alert and the outbox disagree
 *     about the same error, and the honest thing to say is identical either
 *     way: we never heard back, so nothing was recorded.
 */

/** The causes a member can act on differently. `kind` is the discriminant. */
export type WriteFailureKind =
  | 'offline'
  | 'auth'
  | 'forbidden'
  | 'conflict'
  | 'timeout'
  | 'rate_limited'
  | 'invalid'
  | 'server';

/**
 * A classified write failure. `status` is null if and only if the failure
 * carried no HTTP status — i.e. exactly the case realApi calls offline — so
 * the two fields can never contradict each other.
 */
export type WriteFailure =
  | { readonly kind: 'offline'; readonly status: null }
  | { readonly kind: Exclude<WriteFailureKind, 'offline'>; readonly status: number };

export const WRITE_FAILURE_KINDS: readonly WriteFailureKind[] = [
  'offline',
  'auth',
  'forbidden',
  'conflict',
  'timeout',
  'rate_limited',
  'invalid',
  'server',
];

/**
 * The status marker `realApi.postJson` / `getJson` write into every rejection
 * (`POST <path> → <status>`), with the status captured. Byte-identical to
 * `isOfflineError`'s test apart from the capture group — locked by test.
 */
const STATUS_PATTERN = /→\s*(\d{3})\b/;

/**
 * The error's message, without ever throwing. A hostile / exotic thrown value
 * (an object whose `toString` throws, a revoked proxy) must not take down the
 * failure path itself — this runs INSIDE a catch block whose entire job is to
 * make sure the member is told something.
 */
function messageOf(err: unknown): string {
  try {
    return err instanceof Error ? err.message : String(err);
  } catch {
    return '';
  }
}

/** Extracted status, or null when this failure never reached a server. */
function parseStatus(err: unknown): number | null {
  const match = STATUS_PATTERN.exec(messageOf(err));
  if (!match?.[1]) return null;
  return Number(match[1]);
}

/**
 * Classify an unknown thrown value from any AForce write. Total: every input
 * yields a class, and the offline class is reached only through the same
 * "no status present" test realApi uses.
 */
export function classifyWriteFailure(err: unknown): WriteFailure {
  const status = parseStatus(err);
  if (status === null) return { kind: 'offline', status: null };
  switch (status) {
    case 401:
      return { kind: 'auth', status };
    case 403:
      return { kind: 'forbidden', status };
    case 409:
      // The server could not line the write up with current state. Nothing was
      // wrong with the entry and no client update helps, so this must NOT fall
      // through to `invalid` — that copy tells the member to update the app.
      // The route pre-seeds state, so a retry usually resolves it.
      return { kind: 'conflict', status };
    case 408:
      return { kind: 'timeout', status };
    case 429:
      return { kind: 'rate_limited', status };
    default:
      break;
  }
  if (status >= 500) return { kind: 'server', status };
  if (status >= 400) return { kind: 'invalid', status };
  // A non-4xx/5xx status still means the server ANSWERED and the write was
  // refused (postJson only throws on !res.ok). Nothing here is the member's
  // doing, so it reads as our problem rather than their bad entry.
  return { kind: 'server', status };
}

/**
 * English source copy — the `defaultValue` every call site passes, and the
 * exact text `locales/en.json`'s `common.action_failed_title` /
 * `common.action_failed_body` carry (locked byte-for-byte by test, because a
 * silent drift here means the member reads one sentence in English and a
 * different one in every other locale).
 *
 * Rules these sentences are held to: say what happened, say what the member
 * can do next, and never leak a status code, URL, token, payload or stack —
 * the member cannot act on any of those and they are the founder's line.
 */
export const WRITE_FAILURE_COPY: Readonly<
  Record<WriteFailureKind, { readonly title: string; readonly body: string }>
> = {
  offline: {
    title: 'Not saved — no connection',
    body: "That didn't reach the server, so nothing was recorded. Check your connection and try again.",
  },
  auth: {
    title: 'Not saved — sign in again',
    body: 'Your session expired, so nothing was recorded. Sign in again, then log it one more time.',
  },
  forbidden: {
    title: 'Not saved — access denied',
    body: "Your account isn't allowed to make this change, so nothing was recorded. Contact support if that looks wrong.",
  },
  conflict: {
    title: 'Not saved — try that again',
    body: "We couldn't line that up with your current day, so nothing was recorded. Try again — it usually works straight away.",
  },
  timeout: {
    title: 'Not saved — timed out',
    body: 'The server took too long to answer, so nothing was recorded. Give it a moment and try again.',
  },
  rate_limited: {
    title: 'Not saved — too many attempts',
    body: 'Too many requests in a short window, so nothing was recorded. Wait a minute, then try again.',
  },
  invalid: {
    title: 'Not saved — entry rejected',
    body: "The server wouldn't accept this entry, so nothing was recorded. Try again, and update AForce if it keeps happening.",
  },
  server: {
    title: 'Not saved — server problem',
    body: 'Something broke on our end, so nothing was recorded. Wait a moment and try again.',
  },
};
