/**
 * apiError — the one place an /api error body is built.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * Before this, there was no shared error helper at all: 213 hand-rolled
 * `res.status(n).json({ error })` call sites, no code registry, and no way for
 * a caller to tell one failure from another except by string-matching English.
 * Two consequences were live in production:
 *
 *   1. Unmatched /api paths fell through to Express's default HTML error page,
 *      so a version-skew call got an HTML body where a client expected JSON.
 *   2. Several handlers reported a DATABASE fault as 400 — see
 *      routes/aforce/status.ts, `catch { res.status(400) }` — so a retry policy
 *      keyed on 4xx-vs-5xx made exactly the wrong decision on an outage.
 *
 * ── WHY THE SHAPE IS SAFE TO CHANGE ────────────────────────────────────────
 *
 * Measured, not assumed. The Expo client's `readJsonOrThrow`
 * (aforce-os/services/aforceApiClient.ts:34-44) reads a failed response with
 * `res.text()`, NEVER `res.json()` — it keeps only `res.status` and stringifies
 * whatever text arrived. A repo-wide sweep found no consumer that parses the
 * `error` field at all. The only client dependencies are on STATUS CODES:
 * `err.status === 404` (garmin.ts:86, whoopConnect.ts:80,
 * healthConnectionMapping.ts:54) and `=== 409` (garmin.ts:170,
 * whoopConnect.ts:164).
 *
 * So: adding keys is free, and CHANGING A STATUS is the only thing that can
 * break a client. That asymmetry is the whole design.
 *
 * ── LEAK PREVENTION IS THE SIGNATURE, NOT A CONVENTION ─────────────────────
 *
 * This helper accepts a number and two strings. It has no parameter of type
 * `unknown`, no object spread, and no error argument — so there is no
 * expression a caller can write that puts a stack trace, a driver message, a
 * token or a request body into the response. A route that needs to attach
 * structured detail (zod `issues`, and similar) keeps its existing hand-rolled
 * call and is recorded as inventoried debt; it does not get a back door here.
 */
import type { Request, Response } from "express";

/**
 * The wire shape. `error` is the ORIGINAL field and keeps its original
 * meaning — this is the compatibility guarantee. `code` and `requestId` are
 * strictly additive.
 */
export interface ApiErrorBody {
  /** Unchanged contract. Existing callers have always received this. */
  readonly error: string;
  /** Stable, machine-readable, snake_case. Safe to switch on. */
  readonly code: string;
  /**
   * pino-http's per-request id (logger.js:141), echoed so a member can quote
   * it in support and it can be found in the logs.
   *
   * HONEST LIMIT: the default generator is a per-PROCESS counter, so ids are
   * NOT globally unique — two replicas both emit `id:7`. It is a correlation
   * aid to be used together with the log's `hostname` and timestamp, not a
   * globally unique trace id. Omitted entirely if absent rather than faked.
   */
  readonly requestId?: string;
}

/**
 * Builds the body. Exported separately from `sendApiError` so the shape can be
 * asserted without a live response object.
 */
export function buildApiErrorBody(
  req: Pick<Request, "id">,
  code: string,
  error?: string,
): ApiErrorBody {
  // `error` defaults to `code`: 194 of the 213 existing call sites already put
  // a snake_case code in `error`, so this preserves the dominant convention
  // rather than inventing one. The override exists for the ~19 sites whose
  // `error` is deliberately member-facing English (Smart Capture's messages are
  // rendered in the app) — those keep their prose AND gain a stable code.
  const body: { error: string; code: string; requestId?: string } = {
    error: error ?? code,
    code,
  };
  const id = (req as { id?: unknown }).id;
  if (typeof id === "string" || typeof id === "number") {
    body.requestId = String(id);
  }
  return body;
}

/**
 * Sends a JSON error. Does nothing if headers are already sent — a late error
 * after a partial write must not throw a second time inside the error path.
 */
export function sendApiError(
  req: Pick<Request, "id">,
  res: Response,
  status: number,
  code: string,
  error?: string,
): void {
  if (res.headersSent) return;
  res.status(status).json(buildApiErrorBody(req, code, error));
}

/**
 * Client-fault classification for the terminal error handler.
 *
 * DELIBERATELY A CLOSED ALLOWLIST, not `err.status ?? 500`. Trusting an
 * arbitrary `status`/`statusCode` property would let any thrown object — a
 * driver error, an SDK error, an attacker-influenced value — choose its own
 * response code. Only the body-parser faults below are known to be the
 * caller's fault, and only they are reclassified.
 *
 * Everything else stays 500. An unrecognised throw is a server fault until
 * proven otherwise; that is the safe direction for this decision.
 */
export function classifyThrown(err: unknown): { status: number; code: string } {
  const type = (err as { type?: unknown } | null)?.type;

  // body-parser / raw-body errors (express.json, express.raw)
  if (type === "entity.too.large") return { status: 413, code: "payload_too_large" };
  if (type === "entity.parse.failed") return { status: 400, code: "invalid_json" };
  if (type === "entity.verify.failed") return { status: 400, code: "invalid_body" };
  if (type === "encoding.unsupported") return { status: 415, code: "unsupported_encoding" };
  if (type === "request.aborted") return { status: 400, code: "request_aborted" };
  if (type === "parameters.too.many") return { status: 413, code: "too_many_parameters" };

  return { status: 500, code: "internal_error" };
}
