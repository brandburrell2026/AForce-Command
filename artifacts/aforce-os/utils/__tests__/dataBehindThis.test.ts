/**
 * Show-10 ① — DATA BEHIND THIS assembly.
 * Pins that it composes §54 quality + §53 freshness into per-signal chip rows,
 * preserves order, passes §58 confidence through, and carries NO §56 / no copy.
 */
import { describe, it, expect } from 'vitest';
import { buildDataBehindThis, type DataBehindSignal } from '../confidence/dataBehindThis';

const HOUR = 3_600_000;
const NOW = 1_700_000_000_000;

const SIGNALS: DataBehindSignal[] = [
  // phantom source + captured now → EXCELLENT quality, FRESH
  { label: 'Sleep', quality: { kind: 'sleep', source: 'phantom' }, freshness: { kind: 'sleep', capturedAt: NOW } },
  // wearable source, no freshness window → GOOD quality, freshness null
  { label: 'Heart Rate', quality: { kind: 'heart_rate', source: 'apple_watch' } },
  // regional weather + 13h old (weather expires at 12h) → LIMITED quality, EXPIRED
  { label: 'Weather', quality: { kind: 'weather', provenance: 'measured_regional' }, freshness: { kind: 'weather', capturedAt: NOW - 13 * HOUR } },
  // no source → UNAVAILABLE, freshness null
  { label: 'HRV', quality: { kind: 'hrv', source: null } },
];

describe('Show-10 — buildDataBehindThis', () => {
  const result = buildDataBehindThis({ confidence: 'high', signals: SIGNALS, now: NOW });

  it('passes the §58 confidence level through for the header', () => {
    expect(result.confidence).toBe('high');
  });

  it('grades §54 quality per signal (source tier → chip)', () => {
    const byLabel = Object.fromEntries(result.rows.map((r) => [r.label, r.quality]));
    expect(byLabel.Sleep).toEqual({ label: 'EXCELLENT', opacity: 1 });     // phantom
    expect(byLabel['Heart Rate']).toEqual({ label: 'GOOD', opacity: 0.7 }); // wearable
    expect(byLabel.Weather).toEqual({ label: 'LIMITED', opacity: 0.45 });   // regional env
    expect(byLabel.HRV).toEqual({ label: 'UNAVAILABLE', opacity: 0.3 });    // no source
  });

  it('grades §53 freshness when a window exists, else null', () => {
    const byLabel = Object.fromEntries(result.rows.map((r) => [r.label, r.freshness]));
    expect(byLabel.Sleep).toEqual({ label: 'FRESH', opacity: 1 });     // captured now
    expect(byLabel.Weather).toEqual({ label: 'EXPIRED', opacity: 0.3 }); // 13h > 12h expire
    expect(byLabel['Heart Rate']).toBeNull(); // no freshness field
    expect(byLabel.HRV).toBeNull();
  });

  it('preserves row order (rows[i] mirrors signals[i])', () => {
    expect(result.rows.map((r) => r.label)).toEqual(['Sleep', 'Heart Rate', 'Weather', 'HRV']);
  });

  it('rows carry only chips — no §56, no explanatory copy', () => {
    for (const row of result.rows) {
      expect(Object.keys(row).sort()).toEqual(['freshness', 'label', 'quality']);
      expect(Object.keys(row.quality).sort()).toEqual(['label', 'opacity']);
    }
  });

  it('empty signals → empty rows, confidence still passed through', () => {
    const empty = buildDataBehindThis({ confidence: null, signals: [], now: NOW });
    expect(empty.rows).toEqual([]);
    expect(empty.confidence).toBeNull();
  });
});
