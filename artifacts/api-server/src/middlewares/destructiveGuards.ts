/**
 * Guard stack for DESTRUCTIVE endpoints (provider disconnect + account
 * health-data deletion).
 *
 * Three gates, always applied together and always in this order:
 *
 *   1. `enforceAllowedOrigin` — server-side Origin allow-list.
 *   2. a per-route rate limiter  — abuse / mass-deletion shaping.
 *   3. `requireRealAuth`         — genuine identity, no dev fallback.
 *
 * They are exported as ONE composed array (`destructiveGuards()`) rather
 * than three separate imports specifically so a future route cannot
 * accidentally pick up two of the three.
 *
 * ── Why a route-level Origin check, on top of app.ts's CORS config ─────
 *
 * `app.ts` configures the `cors` package (`./corsPolicy.ts`) to reflect
 * any origin only when `CORS_ALLOWED_ORIGINS` is unset, AND
 * `NODE_ENV !== 'production'`, AND the operator has explicitly set
 * `CORS_DEV_REFLECT=1` — #504 tightened what used to be an unconditional
 * dev-mode reflect-all into that opt-in (see `./corsPolicy.ts` for the
 * full history and threat model). Even with that fix in place, two
 * separate problems remain with relying on that layer for destructive
 * routes:
 *
 *   a) `CORS_DEV_REFLECT=1` is set per-deployment, not per-route: an
 *      operator who needs it to serve the Expo web client from a hosted
 *      dev/preview environment gets reflect-all + `credentials: true`
 *      for EVERY route, including the five destructive endpoints. Any
 *      web page the user visits can then issue a credentialed
 *      cross-origin `DELETE /api/oura/disconnect` against that preview
 *      and the browser will happily complete the preflight. That is
 *      CSRF against an irreversible endpoint.
 *   b) More fundamentally, CORS is a BROWSER-side gate on reading the
 *      RESPONSE. It is not a server-side gate on EXECUTING the request.
 *      Even in production, a non-allow-listed origin's request still
 *      reaches the handler; the browser merely hides the reply. For a
 *      side-effecting endpoint, "the attacker can't read the response"
 *      is not a defense — the deletion already happened.
 *
 * The fix therefore has to REJECT the request server-side, which the
 * `cors` middleware does not do — reason (b) holds no matter how strict
 * `app.ts`'s CORS config is. #504 DID edit `app.ts`'s global CORS block
 * (that's what introduced the `CORS_DEV_REFLECT` gate); what's still
 * deliberately NOT done there is route-scoped enforcement — folding a
 * destructive-routes-only rule into the shared, every-route `cors()`
 * mount would mean either loosening it for reads (undoing #504's fix)
 * or blocking dev previews for read routes that have no destructive
 * surface. Enforcing at the five destructive routes instead is precisely
 * scoped, unit-testable in the route harness, and reads the SAME
 * `CORS_ALLOWED_ORIGINS` env var, so there is one allow-list to operate,
 * not two.
 *
 * Resolution rules (`enforceAllowedOrigin`):
 *
 *   - No `Origin` header            -> ALLOW. This is the production
 *     path: React Native `fetch` sends no Origin, nor does curl or a
 *     server-to-server call. Origin-based CSRF defense only applies to
 *     browsers, which always send it on cross-origin requests.
 *   - `CORS_ALLOWED_ORIGINS` set    -> exact match against the list, else 403.
 *   - Allow-list unset, same-origin -> ALLOW (Origin host === Host header).
 *   - Allow-list unset, loopback origin, NODE_ENV !== 'production'
 *                                   -> ALLOW (Expo web dev preview on
 *                                      another localhost port).
 *   - Anything else                 -> 403 cross_origin_forbidden.
 *
 * Net effect: the dev reflect-all hole is closed for destructive routes
 * (an `https://evil.example` origin is refused in dev too), while the
 * native app and legitimate local previews are unaffected.
 *
 * OPERATIONAL NOTE — set `CORS_ALLOWED_ORIGINS` in production. The
 * same-origin fallback compares `Origin` against the `Host` header, and
 * `Host` is only trustworthy behind a proxy that pins it. A browser
 * cannot forge either header (both are forbidden headers for fetch/XHR),
 * so this is not a browser-CSRF gap — but an explicit allow-list removes
 * the heuristic entirely and is the configuration this is designed for.
 */

import type { Request, RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireRealAuth } from "./requireRealAuth";

/** Parsed `CORS_ALLOWED_ORIGINS`, or `null` when unset/empty. Read per
 *  call (not cached at module load) so tests and a config reload see
 *  the current value. */
export function resolveAllowedOrigins(): string[] | null {
  const raw = process.env["CORS_ALLOWED_ORIGINS"];
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

const LOOPBACK_ORIGIN =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

export const enforceAllowedOrigin: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  // Non-browser client (native app, curl, server-to-server). Browsers
  // ALWAYS attach Origin to cross-origin requests, so the absence of the
  // header cannot be a cross-site request.
  if (!origin) {
    next();
    return;
  }

  const allowList = resolveAllowedOrigins();
  if (allowList) {
    if (allowList.includes(origin)) {
      next();
      return;
    }
    reject(req, res, origin, "not_in_allowlist");
    return;
  }

  // No allow-list configured. Same-origin is still unambiguously fine.
  const host = req.headers.host;
  if (host) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost && originHost === host) {
      next();
      return;
    }
  }

  // Dev affordance: Expo web previews run on a different localhost port
  // than the api-server. Loopback only, and never in production.
  if (
    process.env["NODE_ENV"] !== "production" &&
    LOOPBACK_ORIGIN.test(origin)
  ) {
    next();
    return;
  }

  reject(req, res, origin, "no_allowlist_configured");
};

function reject(
  req: Request,
  res: Parameters<RequestHandler>[1],
  origin: string,
  reason: string,
): void {
  (
    req as Request & { log?: { warn?: (o: unknown, m: string) => void } }
  ).log?.warn?.(
    { origin, reason, path: req.path, method: req.method },
    "destructiveGuards: cross-origin request refused",
  );
  res.status(403).json({ error: "cross_origin_forbidden" });
}

/* ─── Rate limiting ───────────────────────────────────────────────────────── */

/** Per-user key once auth has run; IPv6-safe IP key otherwise. Mirrors
 *  `middlewares/rateLimits.ts`'s `userOrIpKey`. The destructive limiter
 *  runs BEFORE auth (see `destructiveGuards`), so in practice this keys
 *  on IP — deliberate, so an UNAUTHENTICATED flood is shaped too. */
function userOrIpKey(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId;
  if (userId) return `u:${userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "0.0.0.0")}`;
}

export interface DestructiveLimitOptions {
  /** Logical bucket name, surfaced in the 429 body. */
  scope: string;
  /** Requests per window. Default 10. */
  limit?: number;
  /** Window length in ms. Default 60_000. */
  windowMs?: number;
}

/**
 * Rate limiter for a destructive endpoint.
 *
 * Unlike `middlewares/rateLimits.ts`, this deliberately does NOT
 * `skip` when NODE_ENV === 'test'. Two reasons: the 429-on-exhaustion
 * behavior is itself a security control that must be provable in the
 * adversarial suite, and a limiter that silently no-ops under a flag is
 * exactly the kind of control that rots. Each call returns a limiter
 * with its OWN in-memory store, so a router built per test gets a fresh
 * bucket and suites cannot poison each other.
 *
 * Store caveat, inherited from the house pattern: express-rate-limit's
 * default store is per-process. With multiple api-server replicas the
 * effective limit is `limit x replicas`. Acceptable here — this is
 * abuse shaping on an authenticated, idempotent operation, not a
 * spend gate. Bind a shared store before horizontal scale-out.
 */
export function createDestructiveLimiter(
  opts: DestructiveLimitOptions,
): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs ?? 60_000,
    limit: opts.limit ?? 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: userOrIpKey,
    message: { error: "rate_limited", scope: opts.scope },
  });
}

/* ─── Composed stack ──────────────────────────────────────────────────────── */

export interface DestructiveGuardOptions extends DestructiveLimitOptions {
  /**
   * Auth middleware override. Defaults to `requireRealAuth` — production
   * mounts never pass this. It exists so route-level test harnesses can
   * drive a known identity (including "user A cannot touch user B")
   * without standing up Clerk. Fail-closed by construction: omitting it
   * yields the strict gate, so a forgotten wiring is secure, not open.
   */
  auth?: RequestHandler;
}

/**
 * Test-only seams every router owning a destructive endpoint accepts.
 * Production mounts pass NEITHER field — the defaults are the strict
 * gate and the production limit.
 */
export interface DestructiveRouteDeps {
  /** See `DestructiveGuardOptions.auth`. */
  destructiveAuth?: RequestHandler;
  /** Override the limiter's window/limit so the adversarial suite can
   *  exhaust a bucket in a couple of requests instead of eleven. */
  destructiveRateLimit?: { limit?: number; windowMs?: number };
}

/**
 * The full guard stack, in order: origin -> rate limit -> real auth.
 *
 * Origin and rate limiting run BEFORE auth on purpose. Both are cheap
 * and both are the gates that matter against UNAUTHENTICATED abuse; auth
 * is the expensive one and there is no reason to spend it on a request
 * we have already decided to refuse.
 */
export function destructiveGuards(
  opts: DestructiveGuardOptions,
): RequestHandler[] {
  return [
    enforceAllowedOrigin,
    createDestructiveLimiter(opts),
    opts.auth ?? requireRealAuth,
  ];
}
