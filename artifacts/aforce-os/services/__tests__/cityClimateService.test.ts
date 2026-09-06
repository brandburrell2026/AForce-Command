/**
 * City climate service — pin the humidity-band classifier and the
 * insight-copy mapping so the UI is never showing a contradictory message
 * (e.g. an "oppressive humidity" insight on a 30% RH reading).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  classifyHumidity,
  hydrationInsightForHumidity,
  getCurrentCityClimateSync,
  getCurrentCityClimate,
  __resetClimateCache,
} from '../cityClimateService';

beforeEach(() => {
  __resetClimateCache();
});

describe('cityClimateService', () => {
  describe('classifyHumidity', () => {
    it('buckets the full 0-100 range into the 5 expected bands', () => {
      expect(classifyHumidity(0)).toBe('very_dry');
      expect(classifyHumidity(20)).toBe('very_dry');
      expect(classifyHumidity(25)).toBe('dry');
      expect(classifyHumidity(39)).toBe('dry');
      expect(classifyHumidity(40)).toBe('comfortable');
      expect(classifyHumidity(60)).toBe('comfortable');
      expect(classifyHumidity(61)).toBe('humid');
      expect(classifyHumidity(75)).toBe('humid');
      expect(classifyHumidity(76)).toBe('oppressive');
      expect(classifyHumidity(100)).toBe('oppressive');
    });
  });

  describe('hydrationInsightForHumidity', () => {
    it('returns a non-empty insight for every band', () => {
      const bands = ['very_dry', 'dry', 'comfortable', 'humid', 'oppressive'] as const;
      for (const band of bands) {
        const text = hydrationInsightForHumidity(band);
        expect(text.length).toBeGreaterThan(20);
      }
    });

    it('mentions electrolytes when humidity blocks cooling, not when it does not', () => {
      expect(hydrationInsightForHumidity('humid').toLowerCase()).toContain('electrolyte');
      expect(hydrationInsightForHumidity('oppressive').toLowerCase()).toContain('electrolyte');
      expect(hydrationInsightForHumidity('comfortable').toLowerCase()).not.toContain('electrolyte');
    });
  });

  describe('getCurrentCityClimateSync', () => {
    // CONTRACT INVERTED, DELIBERATELY (Env PR2). This block previously asserted
    // that the sync accessor always returns a snapshot — which is exactly the
    // defect: with no live reading it returned a deterministic Denver / Miami /
    // New York day as the member's own conditions. The demo seed now reaches
    // only env-gated demo/capture builds; production fails closed.
    it('RETURNS NULL in a production build with no live reading', () => {
      expect(getCurrentCityClimateSync()).toBeNull();
    });

    it('and any snapshot it DOES return is internally consistent', () => {
      // The original prohibition, preserved: a returned snapshot's insight must
      // match its own band. Vacuous-safe — it only asserts when one exists.
      const snap = getCurrentCityClimateSync();
      if (snap) {
        expect(snap.humidityBand).toBe(classifyHumidity(snap.humidityPct));
        expect(snap.hydrationInsight).toBe(hydrationInsightForHumidity(snap.humidityBand));
        expect(snap.city.length).toBeGreaterThan(0);
        expect(snap.humidityPct).toBeGreaterThanOrEqual(0);
        expect(snap.humidityPct).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('getCurrentCityClimate (async)', () => {
    it('RESOLVES NULL rather than a mock city when no live source exists', async () => {
      // In the node test env expo-location is unavailable, which is the same
      // shape as a denied permission or an offline device in production. The
      // service must fail closed and never name another city.
      const snap = await getCurrentCityClimate();
      expect(snap).toBeNull();
    });

    it('does not throw when every step fails', async () => {
      // The original guarantee, kept: failing closed must not mean crashing.
      await expect(getCurrentCityClimate()).resolves.toBeNull();
    });

    it('NEVER CACHES A NON-READING — the demo day must not become sticky', async () => {
      // Caching a fallback would make it outlive the condition that produced
      // it and survive the rest of the session as though it were observed.
      const first = await getCurrentCityClimate();
      const second = await getCurrentCityClimate();
      expect(first).toBeNull();
      expect(second).toBeNull();
    });
  });
});
