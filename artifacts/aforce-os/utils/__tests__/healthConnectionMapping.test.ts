/**
 * Health connection /status probe → resolver-signal mapping.
 * Pins the honesty rule: a provider is only reported connected on a real 200
 * `connected:true`; 404 (not credentialed), errors, and `connected:false` never
 * fabricate a link.
 */
import { describe, it, expect } from 'vitest';
import {
  probeFromStatusResult,
  mapHealthConnectionProbe,
} from '../health/healthConnectionMapping';

const NOW = 1_700_000_000_000;

describe('probeFromStatusResult', () => {
  it('404 → not_configured (credentials missing on the backend)', () => {
    expect(probeFromStatusResult({ ok: false, status: 404 })).toEqual({ kind: 'not_configured' });
  });

  it('non-404 error (401/500/0) → unavailable (indeterminate)', () => {
    for (const status of [401, 500, 0, 503]) {
      expect(probeFromStatusResult({ ok: false, status })).toEqual({ kind: 'unavailable' });
    }
  });

  it('200 connected:true → configured+connected', () => {
    expect(probeFromStatusResult({ ok: true, body: { credentialsConfigured: true, connected: true } }))
      .toEqual({ kind: 'configured', connected: true, expired: false });
  });

  it('200 connected:false → configured, not connected', () => {
    expect(probeFromStatusResult({ ok: true, body: { credentialsConfigured: true, connected: false } }))
      .toEqual({ kind: 'configured', connected: false, expired: false });
  });

  it('missing/garbage connected field defaults to NOT connected (never assume connected)', () => {
    expect(probeFromStatusResult({ ok: true, body: {} })).toMatchObject({ connected: false });
    expect(probeFromStatusResult({ ok: true, body: { connected: 'yes' as unknown as boolean } })).toMatchObject({ connected: false });
  });

  it('connected + past expiresAt + now → expired; future expiry → not expired', () => {
    expect(probeFromStatusResult({ ok: true, body: { connected: true, expiresAt: NOW - 1 } }, NOW)).toMatchObject({ expired: true });
    expect(probeFromStatusResult({ ok: true, body: { connected: true, expiresAt: NOW + 1 } }, NOW)).toMatchObject({ expired: false });
    // no `now` → expiry not evaluated
    expect(probeFromStatusResult({ ok: true, body: { connected: true, expiresAt: NOW - 1 } })).toMatchObject({ expired: false });
    // not connected → never "expired"
    expect(probeFromStatusResult({ ok: true, body: { connected: false, expiresAt: NOW - 1 } }, NOW)).toMatchObject({ expired: false });
  });
});

describe('mapHealthConnectionProbe', () => {
  it('not_configured / unavailable → not ready, no link (never connected)', () => {
    expect(mapHealthConnectionProbe({ kind: 'not_configured' })).toEqual({ integrationReady: false, link: 'none' });
    expect(mapHealthConnectionProbe({ kind: 'unavailable' })).toEqual({ integrationReady: false, link: 'none' });
  });

  it('configured + connected → ready, link connected', () => {
    expect(mapHealthConnectionProbe({ kind: 'configured', connected: true })).toEqual({ integrationReady: true, link: 'connected' });
  });

  it('configured + connected + expired → ready, link expired (needs attention)', () => {
    expect(mapHealthConnectionProbe({ kind: 'configured', connected: true, expired: true })).toEqual({ integrationReady: true, link: 'expired' });
  });

  it('configured + NOT connected → ready, no link (actionable Connect)', () => {
    expect(mapHealthConnectionProbe({ kind: 'configured', connected: false })).toEqual({ integrationReady: true, link: 'none' });
  });

  it('honesty: no probe outcome yields a connected link without a real 200 connected:true', () => {
    const nonConnecting = [
      probeFromStatusResult({ ok: false, status: 404 }),
      probeFromStatusResult({ ok: false, status: 500 }),
      probeFromStatusResult({ ok: true, body: { connected: false } }),
      probeFromStatusResult({ ok: true, body: {} }),
    ];
    for (const p of nonConnecting) {
      expect(mapHealthConnectionProbe(p).link).not.toBe('connected');
    }
  });
});
