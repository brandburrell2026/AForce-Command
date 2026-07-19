/**
 * HEALTH CONNECTION MAPPING — bridge a cloud provider's /status probe into the
 * inputs `resolveHealthProviderStatus` needs (integrationReady + real link).
 *
 * The backend design this consumes: each cloud provider's OAuth router is mounted
 * ONLY when its credentials are configured, and exposes GET /api/<provider>/status
 * → { credentialsConfigured: true, connected: boolean }. So from the client:
 *   - 404              → the integration isn't credentialed on the backend
 *                        (integrationReady = false → the screen shows Coming Soon /
 *                        Approval Pending, never a Connect that fails after the tap).
 *   - 200 connected    → a real, verified connection (link = 'connected').
 *   - 200 !connected   → credentialed + available, user not linked (link = 'none'
 *                        → an actionable Connect).
 *   - network/error    → can't determine; treat as not-ready (never fabricate a link).
 *
 * Pure · no React Native · no I/O. Unit-testable. The thin fetch wrapper lives in
 * services/healthConnections.ts.
 */
import type { HealthLinkState } from './healthProviderStatus';

/** The outcome of probing a provider's /status endpoint. */
export type HealthConnectionProbe =
  | { kind: 'configured'; connected: boolean; expired?: boolean }
  | { kind: 'not_configured' } // 404 — provider not credentialed on the backend
  | { kind: 'unavailable' }; //   network/error — indeterminate

export interface HealthConnectionSignals {
  /** Feeds resolveHealthProviderStatus(input).integrationReady. */
  integrationReady: boolean;
  /** Feeds resolveHealthProviderStatus(input).link — never fabricated. */
  link: HealthLinkState;
}

/** Raw shape returned by a provider's GET /status (fields optional/defensive). */
export interface HealthStatusResponse {
  credentialsConfigured?: boolean;
  connected?: boolean;
  /** Access-token expiry (epoch ms), when the route reports it. */
  expiresAt?: number | null;
}

/**
 * Turn a raw /status HTTP outcome into a HealthConnectionProbe. Pure — the caller
 * supplies the result of the fetch (success body or the HTTP status on failure)
 * so this is testable without any network. `now` lets a past `expiresAt` map to a
 * needs-attention (expired) link; omit it to skip expiry evaluation.
 */
export function probeFromStatusResult(
  result: { ok: true; body: HealthStatusResponse } | { ok: false; status: number },
  now?: number,
): HealthConnectionProbe {
  if (!result.ok) {
    // 404 = router not mounted = credentials missing. Anything else = indeterminate.
    return result.status === 404 ? { kind: 'not_configured' } : { kind: 'unavailable' };
  }
  const connected = result.body.connected === true;
  const exp = result.body.expiresAt;
  const expired = connected && typeof now === 'number' && typeof exp === 'number' && exp <= now;
  return { kind: 'configured', connected, expired };
}

/** Map a probe to the resolver's (integrationReady, link) signals. Never fabricates a link. */
export function mapHealthConnectionProbe(probe: HealthConnectionProbe): HealthConnectionSignals {
  switch (probe.kind) {
    case 'not_configured':
    case 'unavailable':
      // Not credentialed / can't tell → not ready, no link. The provider shows an
      // honest non-connectable status; it is NEVER reported connected.
      return { integrationReady: false, link: 'none' };
    case 'configured':
      if (probe.connected) {
        return { integrationReady: true, link: probe.expired ? 'expired' : 'connected' };
      }
      return { integrationReady: true, link: 'none' };
  }
}
