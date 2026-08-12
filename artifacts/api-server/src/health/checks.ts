/**
 * Liveness vs readiness (Wave-3 PR7 — first wiring of this module):
 *   - /healthz       : PROCESS ALIVE — cheap, no deps (LB/monitor liveness)
 *   - /healthz/deep  : SERVICE READY — runs registered checks
 *
 * Check taxonomy (founder directive): a CRITICAL check failing means the
 * service is NOT READY (503 `unready`) — database reachability, critical
 * configuration. A NON-critical check failing degrades honestly (200
 * `degraded` with the failing check named) — an optional third-party
 * outage must not mark the whole application dead.
 *
 * On SIGTERM we flip `_draining = true` so /healthz/deep returns 503 and
 * the LB stops sending new requests; in-flight requests drain naturally.
 */

import type { RequestHandler } from 'express';

let _draining = false;
export function beginDrain(): void { _draining = true; }
/** TEST-ONLY. */
export function __resetDrainForTests(): void { _draining = false; }

export interface CheckResult {
  name: string;
  ok: boolean;
  latencyMs: number;
  /** false → failure degrades but does not unready the service. */
  critical: boolean;
  detail?: string;
}

export interface RegisteredCheck {
  name: string;
  /** Defaults to true (a failing check makes the service unready). */
  critical?: boolean;
  /** Resolve truthy detail string or throw/return false-ish on failure. */
  run: () => Promise<{ ok: boolean; detail?: string }>;
}

const checks: RegisteredCheck[] = [];
export function registerCheck(c: RegisteredCheck): void { checks.push(c); }
/** TEST-ONLY: clear registrations between cases. */
export function __resetChecksForTests(): void { checks.length = 0; }

export function livenessHandler(): RequestHandler {
  return (_req, res) => {
    if (_draining) {
      res.status(503).json({ status: 'draining' });
      return;
    }
    res.json({ status: 'ok' });
  };
}

async function runCheck(c: RegisteredCheck): Promise<CheckResult> {
  const start = Date.now();
  const critical = c.critical !== false;
  try {
    const r = await c.run();
    return {
      name: c.name,
      ok: r.ok,
      latencyMs: Date.now() - start,
      critical,
      ...(r.detail ? { detail: r.detail } : {}),
    };
  } catch (err) {
    return {
      name: c.name,
      ok: false,
      latencyMs: Date.now() - start,
      critical,
      detail: err instanceof Error ? err.message : 'error',
    };
  }
}

export function readinessHandler(): RequestHandler {
  return async (_req, res) => {
    if (_draining) {
      res.status(503).json({ status: 'draining', checks: [] });
      return;
    }
    const results = await Promise.all(checks.map(runCheck));
    const unready = results.some((r) => r.critical && !r.ok);
    const degraded = !unready && results.some((r) => !r.ok);
    const status = unready ? 'unready' : degraded ? 'degraded' : 'ok';
    res.status(unready ? 503 : 200).json({ status, checks: results });
  };
}
