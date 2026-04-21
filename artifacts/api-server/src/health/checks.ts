/**
 * Liveness vs readiness:
 *   - /healthz       : am I up at all? (cheap, no deps) — used by k8s liveness
 *   - /healthz/deep  : am I ready to serve? (checks DB, cache, AI router)
 *
 * The deep check is what the LB uses to decide whether to send traffic. On
 * SIGTERM we flip `_draining = true` so /healthz/deep returns 503 and the
 * LB stops sending new requests; in-flight requests drain naturally.
 */

import type { RequestHandler } from 'express';

let _draining = false;
export function beginDrain(): void { _draining = true; }

export type CheckResult = { name: string; ok: boolean; latencyMs: number; detail?: string };
export type Check = () => Promise<CheckResult>;

const checks: Check[] = [];
export function registerCheck(c: Check): void { checks.push(c); }

export function livenessHandler(): RequestHandler {
  return (_req, res) => res.json({ status: _draining ? 'draining' : 'ok' });
}

export function readinessHandler(): RequestHandler {
  return async (_req, res) => {
    if (_draining) {
      res.status(503).json({ status: 'draining', checks: [] });
      return;
    }
    const results = await Promise.all(checks.map(async (c) => {
      const start = Date.now();
      try {
        const r = await c();
        return { ...r, latencyMs: Date.now() - start };
      } catch (err) {
        return { name: 'unknown', ok: false, latencyMs: Date.now() - start, detail: err instanceof Error ? err.message : 'error' };
      }
    }));
    const ok = results.every(r => r.ok);
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', checks: results });
  };
}

// Register a default check so /healthz/deep returns something useful out of
// the box. Production registers DB ping, Redis ping, AI router ping, etc.
registerCheck(async () => ({ name: 'self', ok: true, latencyMs: 0 }));
