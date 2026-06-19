/**
 * Unit-preference + measurement-system helpers.
 *
 * Pins the single Imperial/Metric switch the onboarding wizard uses to
 * adapt the whole OS, plus the half-inch height math (canonical integer
 * cm ↔ imperial half-inch steps) that backs the height stepper.
 */

import { describe, it, expect } from 'vitest';

import {
  unitPreferencesForMeasurementSystem,
  inferMeasurementSystem,
  cmToNearestHalfInches,
  halfInchesToCm,
  formatHalfInches,
  formatHeightImperial,
  formatHeightMetric,
  formatHeight,
} from '../units';

describe('utils · measurement system', () => {
  it('maps imperial → lbs / F / oz / ft', () => {
    expect(unitPreferencesForMeasurementSystem('imperial')).toEqual({
      weight: 'lbs',
      temperature: 'F',
      volume: 'oz',
      height: 'ft',
    });
  });

  it('maps metric → kg / C / mL / cm', () => {
    expect(unitPreferencesForMeasurementSystem('metric')).toEqual({
      weight: 'kg',
      temperature: 'C',
      volume: 'mL',
      height: 'cm',
    });
  });

  it('infers the system from the height anchor field', () => {
    expect(
      inferMeasurementSystem({ weight: 'lbs', temperature: 'F', volume: 'oz', height: 'ft' }),
    ).toBe('imperial');
    expect(
      inferMeasurementSystem({ weight: 'kg', temperature: 'C', volume: 'mL', height: 'cm' }),
    ).toBe('metric');
    // Height anchors the inference even when other prefs are mixed.
    expect(
      inferMeasurementSystem({ weight: 'lbs', temperature: 'F', volume: 'oz', height: 'cm' }),
    ).toBe('metric');
  });

  it('round-trips infer ∘ unitPreferencesForMeasurementSystem', () => {
    for (const sys of ['imperial', 'metric'] as const) {
      expect(inferMeasurementSystem(unitPreferencesForMeasurementSystem(sys))).toBe(sys);
    }
  });
});

describe('utils · height half-inch helpers', () => {
  it('formats whole and half inches', () => {
    expect(formatHalfInches(144)).toBe("6'0\""); // 72in
    expect(formatHalfInches(145)).toBe("6'0.5\""); // 72.5in
    expect(formatHalfInches(143)).toBe("5'11.5\""); // 71.5in
    expect(formatHalfInches(120)).toBe("5'0\""); // 60in
  });

  it('converts half-inches to canonical cm (rounded)', () => {
    expect(halfInchesToCm(144)).toBe(183); // 72in   = 182.88cm
    expect(halfInchesToCm(145)).toBe(184); // 72.5in = 184.15cm
    expect(halfInchesToCm(120)).toBe(152); // 60in   = 152.4cm
  });

  it('converts canonical cm back to the nearest half-inch', () => {
    expect(cmToNearestHalfInches(183)).toBe(144);
    expect(cmToNearestHalfInches(184)).toBe(145);
  });

  it('formats canonical cm in each unit', () => {
    expect(formatHeightMetric(180)).toBe('180 cm');
    expect(formatHeightImperial(183)).toBe("6'0\"");
    expect(formatHeight(180, 'cm')).toBe('180 cm');
    expect(formatHeight(183, 'ft')).toBe("6'0\"");
  });
});
