/**
 * Units slice — display-unit preferences (lbs/kg, °F/°C, oz/mL).
 * Pins the reducer contract that backs the Preferences card on the
 * Profile screen, including the corrupt-payload sanitiser path used
 * by the AsyncStorage hydration effect.
 */

import { describe, it, expect } from 'vitest';

import { reducer } from '../appStoreReducer';
import {
  DEFAULT_UNIT_PREFERENCES,
  sanitizeUnitPreferences,
  kgToLbs,
  lbsToKg,
  cToF,
  fToC,
  mlToOz,
  ozToMl,
  formatWeight,
  formatTemperature,
  formatVolume,
} from '../../utils/units';
import { makeState } from './_fixtures';

describe('store · units slice', () => {
  it('initial state seeds DEFAULT_UNIT_PREFERENCES (imperial defaults)', () => {
    const s = makeState();
    expect(s.unitPreferences).toEqual({ weight: 'lbs', temperature: 'F', volume: 'oz' });
  });

  it('SET_UNIT_PREFERENCE changes a single field without touching the others', () => {
    const next = reducer(makeState(), {
      type: 'SET_UNIT_PREFERENCE',
      payload: { key: 'weight', value: 'kg' },
    });
    expect(next.unitPreferences.weight).toBe('kg');
    expect(next.unitPreferences.temperature).toBe('F');
    expect(next.unitPreferences.volume).toBe('oz');
  });

  it('two sequential SET_UNIT_PREFERENCE calls accumulate (no clobber)', () => {
    const a = reducer(makeState(), {
      type: 'SET_UNIT_PREFERENCE',
      payload: { key: 'temperature', value: 'C' },
    });
    const b = reducer(a, {
      type: 'SET_UNIT_PREFERENCE',
      payload: { key: 'volume', value: 'mL' },
    });
    expect(b.unitPreferences).toEqual({ weight: 'lbs', temperature: 'C', volume: 'mL' });
  });

  it('SET_UNIT_PREFERENCES replaces the entire record (used by hydration)', () => {
    const next = reducer(makeState(), {
      type: 'SET_UNIT_PREFERENCES',
      payload: { weight: 'kg', temperature: 'C', volume: 'mL' },
    });
    expect(next.unitPreferences).toEqual({ weight: 'kg', temperature: 'C', volume: 'mL' });
  });

  it('three rapid SET_UNIT_PREFERENCE calls persist the fully merged record (no clobber)', () => {
    // Documents the contract the persist effect relies on: building
    // the next saved record from `state.unitPreferences` after the
    // reducer commit (not from a closure snapshot taken at the call
    // site) yields a merge of all three updates.
    let s = makeState();
    s = reducer(s, { type: 'SET_UNIT_PREFERENCE', payload: { key: 'weight', value: 'kg' } });
    s = reducer(s, { type: 'SET_UNIT_PREFERENCE', payload: { key: 'temperature', value: 'C' } });
    s = reducer(s, { type: 'SET_UNIT_PREFERENCE', payload: { key: 'volume', value: 'mL' } });
    expect(s.unitPreferences).toEqual({ weight: 'kg', temperature: 'C', volume: 'mL' });
  });

  it('user edit then hydration-style SET_UNIT_PREFERENCES would overwrite (race documented)', () => {
    // Reducer alone has no opinion on race ordering — this test pins
    // the raw semantics so the gate in useAppStore.tsx (the
    // `unitPrefsDirtyRef` guard) remains the only place that protects
    // the user's edit from a late-arriving hydration read.
    const edited = reducer(makeState(), {
      type: 'SET_UNIT_PREFERENCE',
      payload: { key: 'weight', value: 'kg' },
    });
    const clobbered = reducer(edited, {
      type: 'SET_UNIT_PREFERENCES',
      payload: { weight: 'lbs', temperature: 'F', volume: 'oz' },
    });
    expect(clobbered.unitPreferences.weight).toBe('lbs');
  });

  it('SET_UNIT_PREFERENCE does not mutate unrelated state (engine / userState / subscription)', () => {
    const start = makeState();
    const next = reducer(start, {
      type: 'SET_UNIT_PREFERENCE',
      payload: { key: 'weight', value: 'kg' },
    });
    expect(next.engineOutput).toBe(start.engineOutput);
    expect(next.userState).toBe(start.userState);
    expect(next.subscription).toBe(start.subscription);
    expect(next.notificationSettings).toBe(start.notificationSettings);
  });
});

describe('utils · units sanitiser', () => {
  it('falls back to defaults when payload is null / non-object', () => {
    expect(sanitizeUnitPreferences(null)).toEqual(DEFAULT_UNIT_PREFERENCES);
    expect(sanitizeUnitPreferences(undefined)).toEqual(DEFAULT_UNIT_PREFERENCES);
    expect(sanitizeUnitPreferences(42)).toEqual(DEFAULT_UNIT_PREFERENCES);
    expect(sanitizeUnitPreferences('lbs')).toEqual(DEFAULT_UNIT_PREFERENCES);
  });

  it('per-field fallback when one key is corrupt and others are valid', () => {
    // 'fortnights' is not a weight unit — fall back to default 'lbs';
    // the other two valid keys must survive.
    const out = sanitizeUnitPreferences({
      weight: 'fortnights',
      temperature: 'C',
      volume: 'mL',
    });
    expect(out).toEqual({ weight: 'lbs', temperature: 'C', volume: 'mL' });
  });

  it('partial payload (missing keys) is completed with defaults', () => {
    expect(sanitizeUnitPreferences({ temperature: 'C' })).toEqual({
      weight: 'lbs',
      temperature: 'C',
      volume: 'oz',
    });
  });

  it('accepts a fully-valid payload unchanged', () => {
    const payload = { weight: 'kg' as const, temperature: 'C' as const, volume: 'mL' as const };
    expect(sanitizeUnitPreferences(payload)).toEqual(payload);
  });
});

describe('utils · units converters (round-trip + landmarks)', () => {
  it('kg ↔ lbs round-trips to within 1e-9', () => {
    expect(kgToLbs(lbsToKg(150))).toBeCloseTo(150, 9);
    expect(lbsToKg(kgToLbs(70))).toBeCloseTo(70, 9);
  });

  it('°C ↔ °F round-trips and matches known landmarks', () => {
    expect(cToF(0)).toBeCloseTo(32, 9);
    expect(cToF(100)).toBeCloseTo(212, 9);
    expect(fToC(98.6)).toBeCloseTo(37, 6);
    expect(cToF(fToC(72))).toBeCloseTo(72, 9);
  });

  it('mL ↔ fl oz round-trips and matches the canonical 1 fl oz = 29.5735… mL', () => {
    expect(ozToMl(1)).toBeCloseTo(29.5735295625, 9);
    expect(mlToOz(ozToMl(16))).toBeCloseTo(16, 9);
  });
});

describe('utils · units formatters', () => {
  it('formatWeight emits the correct suffix and respects digits', () => {
    expect(formatWeight(70, 'kg')).toBe('70.0 kg');
    expect(formatWeight(70, 'lbs', 0)).toBe(`${Math.round(kgToLbs(70))} lbs`);
  });

  it('formatTemperature uses °F / °C and 0 digits by default', () => {
    expect(formatTemperature(0, 'C')).toBe('0°C');
    expect(formatTemperature(0, 'F')).toBe('32°F');
  });

  it('formatVolume rounds mL to integers and respects digits for oz', () => {
    expect(formatVolume(500, 'mL')).toBe('500 mL');
    expect(formatVolume(500, 'oz', 1)).toBe(`${mlToOz(500).toFixed(1)} oz`);
  });
});
