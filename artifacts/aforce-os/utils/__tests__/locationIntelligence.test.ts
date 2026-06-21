import { describe, it, expect } from 'vitest';

import {
  classifyUv,
  classifyAirQuality,
  classifyAltitude,
  classifyHeat,
  classifyHumidity,
  calculateLocationDemandAdderOz,
  deriveLocationContext,
  detectTravel,
  haversineKm,
  LOCATION_DEMAND_CAP_OZ,
  TRAVEL_DISTANCE_KM,
  type LocationInputs,
  type LocationBands,
  type LocationAnchor,
} from '../location/locationIntelligence';

const EMPTY_INPUTS: LocationInputs = {
  latitude: null,
  longitude: null,
  timezone: null,
  altitudeMeters: null,
  temperatureC: null,
  humidityPct: null,
  uvIndex: null,
  airQualityIndex: null,
};

const NO_BANDS: LocationBands = {
  uv: null,
  airQuality: null,
  altitude: null,
  heat: null,
  humidity: null,
};

describe('band classifiers', () => {
  it('classifies UV index into standard bands', () => {
    expect(classifyUv(0)).toBe('low');
    expect(classifyUv(2.9)).toBe('low');
    expect(classifyUv(3)).toBe('moderate');
    expect(classifyUv(6)).toBe('high');
    expect(classifyUv(8)).toBe('very_high');
    expect(classifyUv(11)).toBe('extreme');
    expect(classifyUv(null)).toBeNull();
    expect(classifyUv(Number.NaN)).toBeNull();
  });

  it('classifies US AQI into bands', () => {
    expect(classifyAirQuality(0)).toBe('good');
    expect(classifyAirQuality(50)).toBe('good');
    expect(classifyAirQuality(75)).toBe('moderate');
    expect(classifyAirQuality(120)).toBe('sensitive');
    expect(classifyAirQuality(180)).toBe('unhealthy');
    expect(classifyAirQuality(300)).toBe('hazardous');
    expect(classifyAirQuality(null)).toBeNull();
  });

  it('classifies altitude into bands', () => {
    expect(classifyAltitude(0)).toBe('sea_level');
    expect(classifyAltitude(799)).toBe('sea_level');
    expect(classifyAltitude(800)).toBe('elevated');
    expect(classifyAltitude(1800)).toBe('high');
    expect(classifyAltitude(2800)).toBe('very_high');
    expect(classifyAltitude(null)).toBeNull();
  });

  it('classifies heat and humidity', () => {
    expect(classifyHeat(5)).toBe('cold');
    expect(classifyHeat(20)).toBe('mild');
    expect(classifyHeat(27)).toBe('warm');
    expect(classifyHeat(32)).toBe('hot');
    expect(classifyHeat(36)).toBe('extreme');
    expect(classifyHumidity(10)).toBe('very_dry');
    expect(classifyHumidity(50)).toBe('comfortable');
    expect(classifyHumidity(80)).toBe('oppressive');
    expect(classifyHumidity(null)).toBeNull();
  });
});

describe('calculateLocationDemandAdderOz', () => {
  it('is zero with no bands', () => {
    expect(calculateLocationDemandAdderOz(NO_BANDS)).toBe(0);
  });

  it('adds for altitude and UV, additive', () => {
    expect(calculateLocationDemandAdderOz({ ...NO_BANDS, altitude: 'high' })).toBe(7);
    expect(calculateLocationDemandAdderOz({ ...NO_BANDS, uv: 'extreme' })).toBe(6);
    expect(
      calculateLocationDemandAdderOz({ ...NO_BANDS, altitude: 'high', uv: 'high' }),
    ).toBe(9);
  });

  it('never exceeds the cap and never goes negative', () => {
    const maxed = calculateLocationDemandAdderOz({
      ...NO_BANDS,
      altitude: 'very_high',
      uv: 'extreme',
    });
    expect(maxed).toBe(LOCATION_DEMAND_CAP_OZ);
    expect(maxed).toBeLessThanOrEqual(LOCATION_DEMAND_CAP_OZ);
    expect(maxed).toBeGreaterThanOrEqual(0);
  });

  it('poor air adds a small, capped advisory bump (target-side only, never score)', () => {
    expect(
      calculateLocationDemandAdderOz({ ...NO_BANDS, airQuality: 'hazardous' }),
    ).toBe(3);
    expect(
      calculateLocationDemandAdderOz({ ...NO_BANDS, airQuality: 'unhealthy' }),
    ).toBe(2);
    expect(
      calculateLocationDemandAdderOz({ ...NO_BANDS, airQuality: 'sensitive' }),
    ).toBe(1);
    // Clean air never adds.
    expect(
      calculateLocationDemandAdderOz({ ...NO_BANDS, airQuality: 'good' }),
    ).toBe(0);
    expect(
      calculateLocationDemandAdderOz({ ...NO_BANDS, airQuality: 'moderate' }),
    ).toBe(0);
  });

  it('the air-quality bump still respects the combined cap', () => {
    const maxed = calculateLocationDemandAdderOz({
      ...NO_BANDS,
      altitude: 'very_high',
      uv: 'extreme',
      airQuality: 'hazardous',
    });
    expect(maxed).toBe(LOCATION_DEMAND_CAP_OZ);
  });
});

describe('deriveLocationContext', () => {
  it('is an inert no-op when nothing is available', () => {
    const ctx = deriveLocationContext(EMPTY_INPUTS);
    expect(ctx.available).toBe(false);
    expect(ctx.environmentalAdderOz).toBe(0);
    expect(ctx.noteKey).toBeNull();
    expect(Object.values(ctx.routes).every((r) => r === false)).toBe(true);
  });

  it('coordinates/timezone alone do not make context available', () => {
    const ctx = deriveLocationContext({
      ...EMPTY_INPUTS,
      latitude: 40.7,
      longitude: -74,
      timezone: 'America/New_York',
    });
    expect(ctx.available).toBe(false);
    expect(ctx.environmentalAdderOz).toBe(0);
  });

  it('routes always-on engines when any environment is present', () => {
    const ctx = deriveLocationContext({ ...EMPTY_INPUTS, temperatureC: 20 });
    expect(ctx.available).toBe(true);
    expect(ctx.routes.forecasting).toBe(true);
    expect(ctx.routes.performanceMemory).toBe(true);
    expect(ctx.routes.commandConfidence).toBe(true);
  });

  it('high altitude raises hydration demand and routes recovery + note', () => {
    const ctx = deriveLocationContext({ ...EMPTY_INPUTS, altitudeMeters: 2500 });
    expect(ctx.bands.altitude).toBe('high');
    expect(ctx.environmentalAdderOz).toBe(7);
    expect(ctx.routes.hydrationDemand).toBe(true);
    expect(ctx.routes.recovery).toBe(true);
    expect(ctx.noteKey).toBe('altitude');
  });

  it('poor air raises hydration demand and routes recovery + brain energy', () => {
    const ctx = deriveLocationContext({ ...EMPTY_INPUTS, airQualityIndex: 180 });
    expect(ctx.bands.airQuality).toBe('unhealthy');
    expect(ctx.environmentalAdderOz).toBe(2);
    expect(ctx.routes.recovery).toBe(true);
    expect(ctx.routes.brainEnergy).toBe(true);
    expect(ctx.routes.hydrationDemand).toBe(true);
    expect(ctx.noteKey).toBe('air');
  });

  it('extreme UV adds water and surfaces the uv note', () => {
    const ctx = deriveLocationContext({ ...EMPTY_INPUTS, uvIndex: 11 });
    expect(ctx.bands.uv).toBe('extreme');
    expect(ctx.environmentalAdderOz).toBe(6);
    expect(ctx.routes.hydrationDemand).toBe(true);
    expect(ctx.noteKey).toBe('uv');
  });

  it('caps the combined adder at the documented ceiling', () => {
    const ctx = deriveLocationContext({
      ...EMPTY_INPUTS,
      altitudeMeters: 3500,
      uvIndex: 12,
    });
    expect(ctx.environmentalAdderOz).toBe(LOCATION_DEMAND_CAP_OZ);
  });

  it('is deterministic — same input, same output', () => {
    const input = { ...EMPTY_INPUTS, temperatureC: 33, humidityPct: 80, uvIndex: 9 };
    expect(deriveLocationContext(input)).toEqual(deriveLocationContext(input));
  });
});

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(25.76, -80.19, 25.76, -80.19)).toBeCloseTo(0, 5);
  });

  it('measures Miami → NYC at ~1750 km', () => {
    const km = haversineKm(25.7617, -80.1918, 40.7128, -74.006);
    expect(km).toBeGreaterThan(1700);
    expect(km).toBeLessThan(1800);
  });
});

describe('detectTravel', () => {
  const miami: LocationAnchor = {
    latitude: 25.7617,
    longitude: -80.1918,
    timezone: 'America/New_York',
  };
  const nyc: LocationAnchor = {
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
  };

  it('reports no travel without a prior anchor', () => {
    const sig = detectTravel(null, miami);
    expect(sig.isTraveling).toBe(false);
    expect(sig.distanceKm).toBeNull();
    expect(sig.protocolKey).toBeNull();
  });

  it('SIGNATURE: Miami → NYC auto-triggers the Travel Protocol by distance', () => {
    const sig = detectTravel(miami, nyc);
    expect(sig.isTraveling).toBe(true);
    expect(sig.distanceKm).not.toBeNull();
    expect(sig.distanceKm! >= TRAVEL_DISTANCE_KM).toBe(true);
    expect(sig.timezoneShifted).toBe(false); // same tz — distance is what fires
    expect(sig.protocolKey).toBe('travel_protocol');
  });

  it('does not trigger for a short local move', () => {
    const nearby: LocationAnchor = { ...miami, latitude: 25.78, longitude: -80.21 };
    const sig = detectTravel(miami, nearby);
    expect(sig.isTraveling).toBe(false);
    expect(sig.protocolKey).toBeNull();
  });

  it('triggers on a time-zone change even without coordinates', () => {
    const sig = detectTravel(
      { latitude: null, longitude: null, timezone: 'America/Los_Angeles' },
      { latitude: null, longitude: null, timezone: 'Europe/London' },
    );
    expect(sig.timezoneShifted).toBe(true);
    expect(sig.isTraveling).toBe(true);
    expect(sig.distanceKm).toBeNull();
  });
});
