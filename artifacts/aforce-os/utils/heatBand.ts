/**
 * Temperature-based Heat Band — single source of truth for the home
 * screen heat pill, the heat-guard voice escalation gate, and any
 * other surface that derives heat severity directly from ambient
 * temperature.
 *
 * Distinct from the multi-factor `HeatRiskBand` produced by
 * `services/heatRiskEngine.ts` (which folds in HRV / sweat /
 * symptoms / hydration). This helper is intentionally simple:
 * temperature in, band out.
 */

export type TempHeatBand = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export function getHeatBand(tempF: number): TempHeatBand {
  if (tempF < 75) return 'NORMAL';
  if (tempF < 85) return 'ELEVATED';
  if (tempF < 95) return 'HIGH';
  return 'CRITICAL';
}

/** Convert Celsius (the canonical store unit) to Fahrenheit. */
export function celsiusToFahrenheit(tempC: number): number {
  return tempC * 9 / 5 + 32;
}

/** Convenience: derive the band straight from the stored Celsius value. */
export function getHeatBandFromCelsius(tempC: number | null | undefined): TempHeatBand {
  if (tempC == null || !Number.isFinite(tempC)) return 'NORMAL';
  return getHeatBand(celsiusToFahrenheit(tempC));
}

export const TEMP_HEAT_BAND_COLOR: Record<TempHeatBand, string> = {
  NORMAL: 'rgba(255,255,255,0.30)',
  ELEVATED: '#FFA01E', // amber / orange
  HIGH: '#FF6A00',     // orange-red
  CRITICAL: '#FF0026', // red
};

export const TEMP_HEAT_BAND_LABEL: Record<TempHeatBand, string> = {
  NORMAL: 'NORMAL',
  ELEVATED: 'ELEVATED',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

/** True when the band warrants voice / haptic escalation. */
export function shouldEscalateForBand(band: TempHeatBand): boolean {
  return band === 'HIGH' || band === 'CRITICAL';
}
