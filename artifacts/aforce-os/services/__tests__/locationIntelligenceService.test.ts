import { describe, it, expect } from 'vitest';

import {
  emptyLocationInputs,
  mapLiveInputs,
  buildMockInputs,
  anchorFromInputs,
  buildSnapshot,
} from '../locationIntelligenceService';

describe('emptyLocationInputs', () => {
  it('is an all-null inert input', () => {
    const e = emptyLocationInputs();
    expect(Object.values(e).every((v) => v === null)).toBe(true);
  });
});

describe('mapLiveInputs', () => {
  it('maps full Open-Meteo responses into normalized inputs', () => {
    const inputs = mapLiveInputs({
      latitude: 39.7392,
      longitude: -104.9903,
      timezone: 'America/Denver',
      forecast: {
        current: { temperature_2m: 24, relative_humidity_2m: 30, uv_index: 8 },
      },
      airQuality: { current: { us_aqi: 45 } },
      elevation: { elevation: [1609] },
    });
    expect(inputs).toEqual({
      latitude: 39.7392,
      longitude: -104.9903,
      timezone: 'America/Denver',
      altitudeMeters: 1609,
      temperatureC: 24,
      humidityPct: 30,
      uvIndex: 8,
      airQualityIndex: 45,
    });
  });

  it('degrades each missing source to null without throwing', () => {
    const inputs = mapLiveInputs({
      latitude: 1,
      longitude: 2,
      timezone: null,
      forecast: null,
      airQuality: null,
      elevation: null,
    });
    expect(inputs.latitude).toBe(1);
    expect(inputs.longitude).toBe(2);
    expect(inputs.timezone).toBeNull();
    expect(inputs.altitudeMeters).toBeNull();
    expect(inputs.temperatureC).toBeNull();
    expect(inputs.humidityPct).toBeNull();
    expect(inputs.uvIndex).toBeNull();
    expect(inputs.airQualityIndex).toBeNull();
  });

  it('rejects non-finite numbers from the API', () => {
    const inputs = mapLiveInputs({
      latitude: 1,
      longitude: 2,
      timezone: null,
      forecast: { current: { temperature_2m: Number.NaN, uv_index: 6 } },
      airQuality: { current: {} },
      elevation: { elevation: [] },
    });
    expect(inputs.temperatureC).toBeNull();
    expect(inputs.uvIndex).toBe(6);
    expect(inputs.airQualityIndex).toBeNull();
    expect(inputs.altitudeMeters).toBeNull();
  });
});

describe('buildMockInputs', () => {
  it('is deterministic for a given day', () => {
    const t = 1_700_000_000_000;
    expect(buildMockInputs(t)).toEqual(buildMockInputs(t));
  });

  it('always yields a usable (engine-available) input', () => {
    for (let day = 0; day < 6; day++) {
      const inputs = buildMockInputs(day * 86_400_000);
      expect(inputs.temperatureC).not.toBeNull();
      expect(inputs.timezone).toBe('America/New_York');
    }
  });
});

describe('anchorFromInputs', () => {
  it('keeps only the travel-relevant subset', () => {
    const inputs = buildMockInputs(0);
    const anchor = anchorFromInputs(inputs, '2026-06-19T00:00:00.000Z');
    expect(anchor).toEqual({
      latitude: inputs.latitude,
      longitude: inputs.longitude,
      timezone: inputs.timezone,
      capturedAt: '2026-06-19T00:00:00.000Z',
    });
  });
});

describe('buildSnapshot', () => {
  const iso = '2026-06-19T12:00:00.000Z';

  it('produces an available context with no travel when there is no prior anchor', () => {
    const inputs = mapLiveInputs({
      latitude: 39.7392,
      longitude: -104.9903,
      timezone: 'America/Denver',
      forecast: { current: { temperature_2m: 24, uv_index: 8 } },
      airQuality: { current: { us_aqi: 45 } },
      elevation: { elevation: [2500] },
    });
    const snap = buildSnapshot(inputs, null, 'live', iso);
    expect(snap.source).toBe('live');
    expect(snap.context.available).toBe(true);
    expect(snap.context.environmentalAdderOz).toBeGreaterThan(0);
    expect(snap.travel.isTraveling).toBe(false);
  });

  it('SIGNATURE: Miami anchor → NYC inputs fires the Travel Protocol', () => {
    const miamiAnchor = anchorFromInputs(
      mapLiveInputs({
        latitude: 25.7617,
        longitude: -80.1918,
        timezone: 'America/New_York',
        forecast: null,
        airQuality: null,
        elevation: null,
      }),
      '2026-06-18T12:00:00.000Z',
    );
    const nycInputs = mapLiveInputs({
      latitude: 40.7128,
      longitude: -74.006,
      timezone: 'America/New_York',
      forecast: { current: { temperature_2m: 21 } },
      airQuality: null,
      elevation: { elevation: [10] },
    });
    const snap = buildSnapshot(nycInputs, miamiAnchor, 'live', iso);
    expect(snap.travel.isTraveling).toBe(true);
    expect(snap.travel.protocolKey).toBe('travel_protocol');
    expect(snap.travel.distanceKm).not.toBeNull();
  });

  it('mock fallback still produces a valid snapshot', () => {
    const snap = buildSnapshot(buildMockInputs(0), null, 'mock', iso);
    expect(snap.source).toBe('mock');
    expect(snap.context.available).toBe(true);
    expect(snap.observedAt).toBe(iso);
  });
});
