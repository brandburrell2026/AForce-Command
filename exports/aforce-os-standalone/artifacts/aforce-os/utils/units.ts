/**
 * Unit-preference foundation for AForce OS.
 *
 * The app stores every physical quantity in canonical metric:
 *   - weight in kilograms (kg)
 *   - temperature in degrees Celsius (°C)
 *   - hydration volume in millilitres (mL)
 *
 * This module is the single source of truth for converting those
 * canonical values into the unit the user has chosen on their
 * Preferences card. Pure functions only — no React, no AsyncStorage,
 * no side effects — so the helpers can be exercised from anywhere
 * (intake modals, weather card, sweat calculator, share cards, tests).
 *
 * Conversion constants come from the international definition of the
 * pound (1 lb = 0.45359237 kg) and the US fluid ounce
 * (1 fl oz = 29.5735295625 mL). We intentionally pick US fl oz over
 * the UK imperial ounce because the AForce launch market is the US;
 * if/when we localise the UK, we can branch on locale here.
 */

export type WeightUnit = 'lbs' | 'kg';
export type TemperatureUnit = 'F' | 'C';
export type VolumeUnit = 'oz' | 'mL';
export type HeightUnit = 'ft' | 'cm';

export interface UnitPreferences {
  weight: WeightUnit;
  temperature: TemperatureUnit;
  volume: VolumeUnit;
  height: HeightUnit;
}

export const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  weight: 'lbs',
  temperature: 'F',
  volume: 'oz',
  height: 'ft',
};

export const KG_PER_LB = 0.45359237;
export const ML_PER_FL_OZ = 29.5735295625;

// ─── Pure converters (canonical metric ↔ display unit) ────────────────

export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB;
}
export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}
export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}
export function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}
export function mlToOz(ml: number): number {
  return ml / ML_PER_FL_OZ;
}
export function ozToMl(oz: number): number {
  return oz * ML_PER_FL_OZ;
}

// ─── Display formatters ──────────────────────────────────────────────
//
// Each accepts the canonical metric value AND the user's chosen unit,
// returning a ready-to-render string. Digit defaults match the most
// common UI use case (body weight to 1 decimal, ambient temperature
// rounded to whole degrees, intake volume rounded to whole units).

export function formatWeight(kg: number, unit: WeightUnit, digits = 1): string {
  if (unit === 'lbs') return `${kgToLbs(kg).toFixed(digits)} lbs`;
  return `${kg.toFixed(digits)} kg`;
}

export function formatTemperature(
  celsius: number,
  unit: TemperatureUnit,
  digits = 0,
): string {
  if (unit === 'F') return `${cToF(celsius).toFixed(digits)}°F`;
  return `${celsius.toFixed(digits)}°C`;
}

export function formatVolume(ml: number, unit: VolumeUnit, digits = 0): string {
  if (unit === 'oz') return `${mlToOz(ml).toFixed(digits)} oz`;
  return `${Math.round(ml)} mL`;
}

// ─── Type guards + persistence sanitiser ─────────────────────────────
//
// `sanitizeUnitPreferences` is the bottleneck used when hydrating from
// AsyncStorage. It tolerates a partial / corrupt payload (e.g. a
// forward-incompat key the user wrote in a newer build of the app)
// by falling back to defaults per-field, identical to the pattern
// used by the notification settings hydration.

export function isWeightUnit(v: unknown): v is WeightUnit {
  return v === 'lbs' || v === 'kg';
}
export function isTemperatureUnit(v: unknown): v is TemperatureUnit {
  return v === 'F' || v === 'C';
}
export function isVolumeUnit(v: unknown): v is VolumeUnit {
  return v === 'oz' || v === 'mL';
}
export function isHeightUnit(v: unknown): v is HeightUnit {
  return v === 'ft' || v === 'cm';
}

export function sanitizeUnitPreferences(raw: unknown): UnitPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_UNIT_PREFERENCES };
  const r = raw as Partial<UnitPreferences>;
  return {
    weight: isWeightUnit(r.weight) ? r.weight : DEFAULT_UNIT_PREFERENCES.weight,
    temperature: isTemperatureUnit(r.temperature)
      ? r.temperature
      : DEFAULT_UNIT_PREFERENCES.temperature,
    volume: isVolumeUnit(r.volume) ? r.volume : DEFAULT_UNIT_PREFERENCES.volume,
    height: isHeightUnit(r.height) ? r.height : DEFAULT_UNIT_PREFERENCES.height,
  };
}
