/**
 * I/O-path tests for Location Intelligence™ persistence — the no-fabrication
 * guarantees that the pure `buildSnapshot` tests cannot prove on their own:
 *   1. A mock-fallback snapshot must NOT persist an anchor (so a synthetic
 *      location never becomes a future travel-comparison baseline).
 *   2. A legacy anchor saved under the pre-fix storage key must be IGNORED
 *      (the v1→v2 key bump retires stale mock baselines).
 *
 * AsyncStorage + expo-location are mocked so the service deterministically
 * takes the offline (source: 'mock') path in the node test environment.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    setItem: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    getItem: vi.fn(async (k: string) => (store.has(k) ? (store.get(k) as string) : null)),
    removeItem: vi.fn(async (k: string) => {
      store.delete(k);
    }),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { setItem: h.setItem, getItem: h.getItem, removeItem: h.removeItem },
}));

// Force the offline path: permission denied → no live reading → source 'mock'.
vi.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: vi.fn(async () => ({ status: 'denied' })),
  getCurrentPositionAsync: vi.fn(async () => {
    throw new Error('no gps in test');
  }),
  Accuracy: { Balanced: 3 },
}));

import {
  getLocationSnapshot,
  readLastAnchor,
  __resetLocationCache,
} from '../locationIntelligenceService';

const LEGACY_KEY = 'aforce.location.anchor.v1';

beforeEach(() => {
  h.store.clear();
  h.setItem.mockClear();
  h.getItem.mockClear();
  __resetLocationCache();
});

describe('getLocationSnapshot — mock-fallback persistence gating', () => {
  it('falls back to a mock snapshot with an inert travel signal', async () => {
    const snap = await getLocationSnapshot(true);
    expect(snap.source).toBe('mock');
    expect(snap.travel.isTraveling).toBe(false);
    expect(snap.travel.protocolKey).toBeNull();
  });

  it('does NOT persist an anchor for a mock snapshot', async () => {
    await getLocationSnapshot(true);
    // A mock anchor must never be written — it could become a synthetic
    // baseline that a later live reading diffs against (fabricated travel).
    expect(h.setItem).not.toHaveBeenCalled();
    expect(h.store.size).toBe(0);
  });
});

describe('readLastAnchor — legacy (pre-fix) anchor is retired by the key bump', () => {
  it('ignores an anchor stored under the old v1 key', async () => {
    // Simulate a synthetic mock anchor persisted by the pre-fix behavior.
    h.store.set(
      LEGACY_KEY,
      JSON.stringify({
        latitude: 25.7617,
        longitude: -80.1918,
        timezone: 'America/New_York',
        capturedAt: '2026-06-18T12:00:00.000Z',
      }),
    );
    const anchor = await readLastAnchor();
    // The v2 namespace is empty, so the stale baseline is never read and a
    // later live reading has nothing to fabricate a trip against.
    expect(anchor).toBeNull();
  });
});
