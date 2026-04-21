/**
 * City climate service — pin the humidity-band classifier and the
 * insight-copy mapping so the UI is never showing a contradictory message
 * (e.g. an "oppressive humidity" insight on a 30% RH reading).
 */

import { describe, expect, it } from 'vitest';

import {
  classifyHumidity,
  hydrationInsightForHumidity,
  getCurrentCityClimateSync,
} from '../cityClimateService';

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
    it('returns a snapshot whose insight matches its humidity band', () => {
      const snap = getCurrentCityClimateSync();
      expect(snap.humidityBand).toBe(classifyHumidity(snap.humidityPct));
      expect(snap.hydrationInsight).toBe(hydrationInsightForHumidity(snap.humidityBand));
    });

    it('returns a city, region, and a plausible humidity number', () => {
      const snap = getCurrentCityClimateSync();
      expect(snap.city.length).toBeGreaterThan(0);
      expect(snap.region.length).toBeGreaterThan(0);
      expect(snap.humidityPct).toBeGreaterThanOrEqual(0);
      expect(snap.humidityPct).toBeLessThanOrEqual(100);
    });
  });
});
