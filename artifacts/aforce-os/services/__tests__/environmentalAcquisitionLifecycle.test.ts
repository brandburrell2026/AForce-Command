/**
 * ACQUISITION LIFECYCLE — the producer's own behaviour, executed.
 *
 * The adapter-level laws prove what happens to an acquisition OUTCOME once it
 * exists. These prove the outcome itself is produced correctly, by driving the
 * real `getLocationSnapshot` against a mocked `expo-location`.
 *
 * Three of these are guarantees the founder named explicitly and which no
 * shape-level test can reach:
 *
 *   - permission is CHECKED, never REQUESTED (no prompt from a background
 *     tick or a component mounting);
 *   - a refusal is distinguished from never-having-asked;
 *   - coarse accuracy is sufficient, so we never ask for precision we do not
 *     use.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getPerms: vi.fn(async () => ({ status: 'granted', canAskAgain: true })),
  requestPerms: vi.fn(async () => ({ status: 'granted', canAskAgain: true })),
  getPosition: vi.fn(async () => ({ coords: { latitude: 39.74, longitude: -104.99 } })),
  setItem: vi.fn(async () => undefined),
  getItem: vi.fn(async () => null),
  removeItem: vi.fn(async () => undefined),
  lastAccuracy: { value: undefined as unknown },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { setItem: h.setItem, getItem: h.getItem, removeItem: h.removeItem },
}));

vi.mock('expo-location', () => ({
  getForegroundPermissionsAsync: h.getPerms,
  requestForegroundPermissionsAsync: h.requestPerms,
  getCurrentPositionAsync: vi.fn(async (opts: { accuracy?: unknown }) => {
    h.lastAccuracy.value = opts?.accuracy;
    return h.getPosition();
  }),
  // Numeric ladder mirroring expo-location: higher number = more precise.
  Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 4, Highest: 5 },
}));

import { getLocationSnapshot, __resetLocationCache } from '../locationIntelligenceService';

const OPEN_METEO_NOW = Math.floor(Date.UTC(2026, 8, 7, 12, 0, 0) / 1000);

/** A successful three-feed fetch. */
function stubFetchOk() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      if (url.includes('air-quality')) {
        return { current: { time: OPEN_METEO_NOW, us_aqi: 30 } };
      }
      if (url.includes('elevation')) return { elevation: [1609] };
      return {
        current: {
          time: OPEN_METEO_NOW, temperature_2m: 24,
          relative_humidity_2m: 55, uv_index: 6,
        },
      };
    },
  })));
}

beforeEach(() => {
  __resetLocationCache();
  h.getPerms.mockClear(); h.requestPerms.mockClear(); h.getPosition.mockClear();
  h.getPerms.mockResolvedValue({ status: 'granted', canAskAgain: true });
  h.lastAccuracy.value = undefined;
  stubFetchOk();
});

// ── 1 · permission is checked, never requested ──────────────────────────────

describe('LAW 1 — acquisition never raises an OS permission dialog', () => {
  it('checks the existing grant and does NOT request one', async () => {
    await getLocationSnapshot(true);
    expect(h.getPerms).toHaveBeenCalled();
    // THE GUARANTEE: a background tick, or a screen mounting, must never
    // produce a prompt the member did not ask for. The intentional ask lives
    // in onboarding, which explains itself first.
    expect(h.requestPerms).not.toHaveBeenCalled();
  });

  it('does not request even when permission is missing', async () => {
    // The tempting bug: "we need it, so ask". Re-prompting after a refusal is
    // exactly what must never happen.
    h.getPerms.mockResolvedValue({ status: 'denied', canAskAgain: false });
    await getLocationSnapshot(true);
    expect(h.requestPerms).not.toHaveBeenCalled();
  });
});

// ── 2 · the four outcomes are produced distinctly ───────────────────────────

describe('LAW 2 — the producer reports WHY, not just that it failed', () => {
  it('GRANTED + working provider → live, with all feeds healthy', async () => {
    const s = await getLocationSnapshot(true);
    expect(s.source).toBe('live');
    expect(s.acquisition).toEqual({
      kind: 'live', feeds: { forecast: true, airQuality: true, elevation: true },
    });
    expect(s.providerObservedAt).toBe(OPEN_METEO_NOW * 1000);
  });

  it('DENIED (cannot ask again) → permission_denied', async () => {
    h.getPerms.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const s = await getLocationSnapshot(true);
    expect(s.acquisition).toEqual({ kind: 'unavailable', reason: 'permission_denied' });
  });

  it('NEVER ASKED (can still ask) → permission_undetermined', async () => {
    h.getPerms.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    const s = await getLocationSnapshot(true);
    expect(s.acquisition).toEqual({ kind: 'unavailable', reason: 'permission_undetermined' });
  });

  it('the two permission states are NOT collapsed', async () => {
    h.getPerms.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const denied = (await getLocationSnapshot(true)).acquisition;
    __resetLocationCache();
    h.getPerms.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    const undetermined = (await getLocationSnapshot(true)).acquisition;
    expect(denied).not.toEqual(undetermined);
  });

  it('GRANTED but no position → position_unavailable, not a permission story', async () => {
    h.getPosition.mockRejectedValueOnce(new Error('no fix'));
    const s = await getLocationSnapshot(true);
    expect(s.acquisition).toEqual({ kind: 'unavailable', reason: 'position_unavailable' });
  });

  it('a failed acquisition carries NO provider anchor', async () => {
    h.getPerms.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const s = await getLocationSnapshot(true);
    expect(s.providerObservedAt).toBeNull();
  });
});

// ── 3 · partial feed failure ────────────────────────────────────────────────

describe('LAW 3 — one feed falling over costs only its own signals', () => {
  it('air quality down: still live, and only that feed is marked unhealthy', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('air-quality')) return { ok: false, json: async () => ({}) };
      if (url.includes('elevation')) return { ok: true, json: async () => ({ elevation: [1609] }) };
      return { ok: true, json: async () => ({ current: {
        time: OPEN_METEO_NOW, temperature_2m: 24, relative_humidity_2m: 55, uv_index: 6 } }) };
    }));
    const s = await getLocationSnapshot(true);
    expect(s.source).toBe('live');
    expect(s.acquisition).toEqual({
      kind: 'live', feeds: { forecast: true, airQuality: false, elevation: true },
    });
    expect(s.inputs.temperatureC).toBe(24);
    expect(s.inputs.airQualityIndex).toBeNull();
  });

  it('the anchor comes from the feeds that DID answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('air-quality')) {
        return { ok: true, json: async () => ({ current: { time: OPEN_METEO_NOW - 1800, us_aqi: 30 } }) };
      }
      if (url.includes('elevation')) return { ok: true, json: async () => ({ elevation: [1609] }) };
      return { ok: true, json: async () => ({ current: {
        time: OPEN_METEO_NOW, temperature_2m: 24, relative_humidity_2m: 55, uv_index: 6 } }) };
    }));
    const s = await getLocationSnapshot(true);
    // Weakest link across the two feeds that declared a time.
    expect(s.providerObservedAt).toBe((OPEN_METEO_NOW - 1800) * 1000);
  });
});

// ── 4 · no more precision than the evidence needs ───────────────────────────

describe('LAW 4 — coarse location is sufficient, so coarse is what we ask for', () => {
  it('requests a LOW accuracy fix', async () => {
    await getLocationSnapshot(true);
    // Every supported signal is a ~11 km grid quantity and the evidence
    // contract stores only a coarse location key, so precision here would be
    // a privacy cost with no evidentiary gain.
    expect(h.lastAccuracy.value).toBe(2); // Accuracy.Low
  });

  it('and never the most precise fix available', async () => {
    await getLocationSnapshot(true);
    expect(h.lastAccuracy.value).not.toBe(5); // Accuracy.Highest
    expect(h.lastAccuracy.value).not.toBe(4); // Accuracy.High
  });
});

// ── 5 · the request itself asks for unambiguous timestamps ──────────────────

describe('LAW 5 — the provider is asked for machine-readable instants', () => {
  it('both timed feeds request timeformat=unixtime', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes('air-quality')) {
        return { ok: true, json: async () => ({ current: { time: OPEN_METEO_NOW, us_aqi: 30 } }) };
      }
      if (url.includes('elevation')) return { ok: true, json: async () => ({ elevation: [1609] }) };
      return { ok: true, json: async () => ({ current: {
        time: OPEN_METEO_NOW, temperature_2m: 24, relative_humidity_2m: 55, uv_index: 6 } }) };
    }));
    await getLocationSnapshot(true);
    const forecast = calls.find((u) => u.includes('/v1/forecast'));
    const air = calls.find((u) => u.includes('air-quality'));
    // Without this, Open-Meteo returns an offset-less local string that
    // `Date.parse` reads as device-local — a clock error dressed as a fix.
    expect(forecast).toContain('timeformat=unixtime');
    expect(air).toContain('timeformat=unixtime');
  });
});
