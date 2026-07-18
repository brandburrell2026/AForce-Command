/**
 * Section 53 — Data Freshness™.
 *
 * Pins the ml-engineer ruling: age→rating with per-kind windows; undated→stale;
 * future→fresh; the fresh/aging/stale/expired ceiling; and the anti-double-count
 * composition — freshness DOWNGRADES a §54 source rating via a floor and can
 * never promote it. Thresholds come from config (never hardcoded in the module).
 */
import { describe, it, expect } from 'vitest';
import { FRESHNESS_WINDOWS, type FreshnessSignalKind } from '../../config/hydroStateModel';
import type { SignalQualityRating } from '../confidence/signalQuality';
import {
  assessFreshness,
  freshnessCeiling,
  applyFreshness,
  type FreshnessRating,
} from '../confidence/dataFreshness';

const NOW = 1_700_000_000_000; // fixed clock (module takes `now` as input; no Date.now())
const at = (ageMs: number) => NOW - ageMs;
const QORDER: Record<SignalQualityRating, number> = { unavailable: 0, limited: 1, good: 2, excellent: 3 };
const ALL_KINDS = Object.keys(FRESHNESS_WINDOWS) as FreshnessSignalKind[];

describe('Section 53 — assessFreshness age → rating', () => {
  it('weather crosses every band at its exact window boundaries', () => {
    const w = FRESHNESS_WINDOWS.weather; // fresh 1h, stale 3h, expire 12h
    expect(assessFreshness('weather', at(0), NOW).rating).toBe('fresh');
    expect(assessFreshness('weather', at(w.freshUntilMs), NOW).rating).toBe('fresh');       // == freshUntil
    expect(assessFreshness('weather', at(w.freshUntilMs + 1), NOW).rating).toBe('aging');
    expect(assessFreshness('weather', at(w.staleAfterMs), NOW).rating).toBe('aging');       // == staleAfter
    expect(assessFreshness('weather', at(w.staleAfterMs + 1), NOW).rating).toBe('stale');
    expect(assessFreshness('weather', at(w.expireAfterMs!), NOW).rating).toBe('stale');     // == expireAfter
    expect(assessFreshness('weather', at(w.expireAfterMs! + 1), NOW).rating).toBe('expired');
  });

  it('a kind with no expireAfter degrades to stale and NEVER expires (sleep, profile)', () => {
    for (const kind of ['sleep', 'profile'] as const) {
      const w = FRESHNESS_WINDOWS[kind];
      expect(w.expireAfterMs).toBeUndefined();
      expect(assessFreshness(kind, at(w.staleAfterMs + 1), NOW).rating).toBe('stale');
      expect(assessFreshness(kind, at(w.staleAfterMs * 100), NOW).rating).toBe('stale'); // still just stale
    }
  });

  it('undated (null/undefined/NaN capturedAt) is stale, not expired, and flagged undated', () => {
    for (const bad of [null, undefined, Number.NaN, Infinity]) {
      const r = assessFreshness('sleep', bad as any, NOW);
      expect(r.rating, String(bad)).toBe('stale');
      expect(r.undated).toBe(true);
      expect(r.ageMs).toBeNull();
    }
  });

  it('a future timestamp (clock skew) reads fresh, never stale', () => {
    expect(assessFreshness('weather', NOW + 5 * 3_600_000, NOW).rating).toBe('fresh');
  });

  it('non-finite now fails safe to undated/stale', () => {
    expect(assessFreshness('weather', at(0), Number.NaN as any).undated).toBe(true);
  });

  it('an explicit windows override is honored over the config default', () => {
    const tiny = { freshUntilMs: 10, staleAfterMs: 20 };
    expect(assessFreshness('sleep', at(15), NOW, tiny).rating).toBe('aging');
  });
});

describe('Section 53 — freshnessCeiling', () => {
  it('maps each rating onto the §54 quality scale', () => {
    expect(freshnessCeiling('fresh')).toBe('excellent');
    expect(freshnessCeiling('aging')).toBe('good');
    expect(freshnessCeiling('stale')).toBe('limited');
    expect(freshnessCeiling('expired')).toBe('unavailable');
  });
});

describe('Section 53 — applyFreshness composition (downgrade-only, counted once)', () => {
  it('a stale reading caps an Excellent source at limited (the whole point of §53)', () => {
    expect(applyFreshness('excellent', 'stale')).toBe('limited');
  });

  it('fresh never promotes a weak source', () => {
    expect(applyFreshness('limited', 'fresh')).toBe('limited');   // min(limited, excellent)
    expect(applyFreshness('unavailable', 'fresh')).toBe('unavailable');
  });

  it('expired collapses any source to unavailable (renormalized away downstream)', () => {
    expect(applyFreshness('excellent', 'expired')).toBe('unavailable');
    expect(applyFreshness('good', 'expired')).toBe('unavailable');
  });

  it('aging caps at good; a phone source stays limited', () => {
    expect(applyFreshness('excellent', 'aging')).toBe('good');
    expect(applyFreshness('limited', 'aging')).toBe('limited'); // min(limited, good)
  });

  it('INVARIANT: applyFreshness can only lower or hold a rating — never promote', () => {
    const ratings: SignalQualityRating[] = ['unavailable', 'limited', 'good', 'excellent'];
    const fresh: FreshnessRating[] = ['fresh', 'aging', 'stale', 'expired'];
    for (const s of ratings) {
      for (const f of fresh) {
        expect(QORDER[applyFreshness(s, f)], `${s} × ${f}`).toBeLessThanOrEqual(QORDER[s]);
      }
    }
  });

  it("worked case: fresh vs stale Phantom sleep — currency changes effective quality, source doesn't", () => {
    const freshRating = assessFreshness('sleep', at(0), NOW).rating;               // fresh
    const staleRating = assessFreshness('sleep', at(FRESHNESS_WINDOWS.sleep.staleAfterMs + 1), NOW).rating; // stale
    expect(applyFreshness('excellent', freshRating)).toBe('excellent');
    expect(applyFreshness('excellent', staleRating)).toBe('limited');
  });
});

describe('Section 53 — config windows are well-ordered', () => {
  it('freshUntil ≤ staleAfter ≤ expireAfter for every signal', () => {
    for (const kind of ALL_KINDS) {
      const w = FRESHNESS_WINDOWS[kind];
      expect(w.freshUntilMs, kind).toBeLessThanOrEqual(w.staleAfterMs);
      if (w.expireAfterMs != null) {
        expect(w.staleAfterMs, kind).toBeLessThanOrEqual(w.expireAfterMs);
      }
    }
  });
});
