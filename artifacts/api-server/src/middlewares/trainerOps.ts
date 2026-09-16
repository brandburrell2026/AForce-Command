/**
 * Rate limiting and metrics for the whole trainer surface, in one place.
 *
 * Mounted once per router rather than per route, for the same reason the
 * consent gate and the subject check are: eighteen endpoints shipped without
 * any of this, and the way that happened was each route deciding for itself.
 * A nineteenth route added later inherits both.
 *
 * TWO THINGS THIS MUST NOT DO.
 *
 *   1. It must not put an athlete id in a metric name. `requests_total` keyed
 *      on the concrete path would create one series per athlete, which is
 *      both unbounded cardinality and a roster leaked into a metrics store
 *      with different retention and a different access list from the data.
 *      Keys come from the matched ROUTE PATTERN, and there is a test that
 *      fails if an id reaches one.
 *
 *   2. It must not change what any route returns. The limiter answers 429
 *      before the handler runs; the metrics layer only observes.
 */
import type { RequestHandler } from "express";

import { incCounter, observeLatency } from "../observability/metrics";
import {
  trainerExportLimiter,
  trainerReadLimiter,
  trainerWriteLimiter,
} from "./rateLimits";

/** Documents are the expensive tier wherever they appear. */
function isExport(path: string): boolean {
  return path.endsWith(".pdf") || path.endsWith("/chart.pdf") || path.includes("availability-report");
}

/**
 * Dispatch to the right limiter.
 *
 * Chosen from the request rather than declared per route, so a route added
 * later is limited by what it does — a new `.pdf` endpoint lands in the
 * export tier without anyone remembering to put it there.
 */
export const trainerRateLimit: RequestHandler = (req, res, next) => {
  const limiter =
    req.method === "GET"
      ? isExport(req.path)
        ? trainerExportLimiter
        : trainerReadLimiter
      : trainerWriteLimiter;
  limiter(req, res, next);
};

/**
 * Collapse a concrete path to its route pattern.
 *
 * `req.route` is populated once Express has matched, which is after this
 * middleware runs — so the pattern is read on `finish`, and this fallback
 * covers the cases where there is no match (a 404, a 429 refused before
 * routing). It replaces anything that looks like an identifier, so a
 * fallback key is still free of athlete ids.
 */
function routeKey(req: { route?: { path?: unknown }; path: string; baseUrl?: string }): string {
  const matched = req.route?.path;
  if (typeof matched === "string" && matched.length > 0) return matched;

  return req.path
    .split("/")
    .map((segment) => {
      if (segment.length === 0) return segment;
      // Anything with a digit, or long enough to be an opaque id, is one.
      if (/\d/.test(segment) || segment.length > 24) return ":id";
      return segment;
    })
    .join("/");
}

/** Latency and outcome per route pattern. Never per athlete. */
export const trainerMetrics: RequestHandler = (req, res, next) => {
  const started = performance.now();
  res.on("finish", () => {
    const key = routeKey(req as never);
    const flow = `trainer${key === "/" ? "" : key}`;
    observeLatency(flow, performance.now() - started);
    incCounter(`requests_total.trainer.${res.statusCode}`);
    if (res.statusCode === 429) incCounter("trainer.rate_limited");
    if (res.statusCode >= 500) incCounter("trainer.server_errors");
  });
  next();
};

/**
 * The counters the alerts in `docs/runbooks/trainer-dashboard.md` fire on.
 *
 * Named here rather than as loose strings at each call site so the runbook
 * and the code cannot drift apart, and so grepping for an alert's name finds
 * both ends of it.
 */
export const TRAINER_COUNTERS = {
  /** An audit row was written. Alert when this stops while reads continue. */
  auditRows: "trainer.audit_rows_written",
  /** A read was refused because consent was not granted. */
  consentDenied: "trainer.consent_denied",
  /** The Phase 8 inference guard refused to send a report. */
  inferenceGuardTripped: "trainer.inference_guard_tripped",
  /** A note write was refused for want of a usable encryption key. */
  noteEncryptionUnavailable: "trainer.note_encryption_unavailable",
  /** A consent or membership lookup failed, so the surface failed closed. */
  accessLookupFailed: "trainer.access_lookup_failed",
} as const;

export { incCounter };
