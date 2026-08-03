import { describe, it, expect } from 'vitest';
import { resolveProviderPresentation } from '../providerPresentation';
import type { HealthProviderStatus } from '@/utils/health/healthProviderStatus';

const NOW = 1_754_000_000_000;
const H = 3_600_000;

const connected: HealthProviderStatus = { status: 'connected', connectable: false, live: true, showDemo: false };
const disconnected: HealthProviderStatus = { status: 'connect', connectable: true, live: false, showDemo: false };
const comingSoon: HealthProviderStatus = { status: 'coming_soon', connectable: false, live: false, showDemo: false };
const approval: HealthProviderStatus = { status: 'approval_pending', connectable: false, live: false, showDemo: false };
const viaHc: HealthProviderStatus = { status: 'available_through_health_connect', connectable: false, live: false, showDemo: false };
const syncing: HealthProviderStatus = { status: 'syncing', connectable: false, live: true, showDemo: false };

describe('freshness boundaries (§53 wearable_sync: stale >24h, expired >72h)', () => {
  it('connected + fresh data (≤24h) → connected, live', () => {
    const p = resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 6 * H, nowMs: NOW });
    expect(p).toEqual({ state: 'connected', live: true, dataAgeMs: 6 * H });
  });

  it('connected + stale data (>24h) → stale, NOT live — a stale snapshot is never presented as connected/live', () => {
    const p = resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 30 * H, nowMs: NOW });
    expect(p.state).toBe('stale');
    expect(p.live).toBe(false);
  });

  it('connected + expired data (>72h) → no_recent_data, NOT live', () => {
    const p = resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 100 * H, nowMs: NOW });
    expect(p.state).toBe('no_recent_data');
    expect(p.live).toBe(false);
  });

  it('boundary exactness: 24h is not yet stale; 72h is not yet expired', () => {
    expect(resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 24 * H, nowMs: NOW }).live).toBe(true);
    expect(resolveProviderPresentation({ status: connected, latestFetchedAtMs: NOW - 72 * H, nowMs: NOW }).state).toBe('stale');
  });

  it('syncing with no snapshot yet stays honest first-pull (live syncing, no age)', () => {
    const p = resolveProviderPresentation({ status: syncing, latestFetchedAtMs: null, nowMs: NOW });
    expect(p).toEqual({ state: 'syncing', live: true, dataAgeMs: null });
  });
});

describe('freshness never UPGRADES a status', () => {
  it('disconnected with a fresh leftover snapshot stays disconnected, never live', () => {
    const p = resolveProviderPresentation({ status: disconnected, latestFetchedAtMs: NOW - 1 * H, nowMs: NOW });
    expect(p.state).toBe('disconnected');
    expect(p.live).toBe(false);
  });
});

describe('vocabulary mapping to canonical presentation states', () => {
  it('coming_soon → dormant; approval_pending → requires_external_approval; HC routing preserved', () => {
    expect(resolveProviderPresentation({ status: comingSoon, latestFetchedAtMs: null, nowMs: NOW }).state).toBe('dormant');
    expect(resolveProviderPresentation({ status: approval, latestFetchedAtMs: null, nowMs: NOW }).state).toBe('requires_external_approval');
    expect(resolveProviderPresentation({ status: viaHc, latestFetchedAtMs: null, nowMs: NOW }).state).toBe('via_health_connect');
  });
});
