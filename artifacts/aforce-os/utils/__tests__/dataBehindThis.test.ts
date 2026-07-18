/**
 * Show-10 ① — DATA BEHIND THIS assembly.
 * Pins that §54 quality + §53 freshness COMPOSE into ONE chip per signal
 * (Design Decision 2: freshness caps quality, never a second chip), that the raw
 * contributing ratings ride along for the detail line, that order is preserved,
 * that §58 confidence passes through, and that rows carry NO §56 / no copy.
 */
import { describe, it, expect } from 'vitest';
import { buildDataBehindThis, type DataBehindSignal } from '../confidence/dataBehindThis';

const HOUR = 3_600_000;
const NOW = 1_700_000_000_000;

const SIGNALS: DataBehindSignal[] = [
  // phantom source → EXCELLENT, captured now → FRESH (ceiling excellent) → EXCELLENT
  { label: 'Sleep', quality: { kind: 'sleep', source: 'phantom' }, freshness: { kind: 'sleep', capturedAt: NOW } },
  // wearable → GOOD, no freshness window → composed rating stays GOOD
  { label: 'Heart Rate', quality: { kind: 'heart_rate', source: 'apple_watch' } },
  // regional weather → LIMITED, 13h old (weather expires at 12h) → EXPIRED (ceiling
  // unavailable) → composed DOWN to UNAVAILABLE: freshness caps the source
  { label: 'Weather', quality: { kind: 'weather', provenance: 'measured_regional' }, freshness: { kind: 'weather', capturedAt: NOW - 13 * HOUR } },
  // no source → UNAVAILABLE, no freshness window
  { label: 'HRV', quality: { kind: 'hrv', source: null } },
];

describe('Show-10 — buildDataBehindThis', () => {
  const result = buildDataBehindThis({ confidence: 'high', signals: SIGNALS, now: NOW });
  const byLabel = Object.fromEntries(result.rows.map((r) => [r.label, r]));

  it('passes the §58 confidence level through for the header', () => {
    expect(result.confidence).toBe('high');
  });

  it('composes §54 quality ⊓ §53 freshness into ONE chip per signal', () => {
    expect(byLabel.Sleep.chip).toEqual({ label: 'EXCELLENT', opacity: 1 });      // excellent ∧ fresh
    expect(byLabel['Heart Rate'].chip).toEqual({ label: 'GOOD', opacity: 0.78 }); // good, no freshness
    expect(byLabel.Weather.chip).toEqual({ label: 'UNAVAILABLE', opacity: 0.3 }); // limited capped by expired
    expect(byLabel.HRV.chip).toEqual({ label: 'UNAVAILABLE', opacity: 0.3 });     // no source
  });

  it('exposes the raw contributing ratings for the detail line (chip is one, facts are two)', () => {
    expect(byLabel.Sleep.sourceRating).toBe('excellent');
    expect(byLabel.Sleep.freshnessRating).toBe('fresh');
    expect(byLabel.Weather.sourceRating).toBe('limited');   // source, NOT the composed unavailable
    expect(byLabel.Weather.freshnessRating).toBe('expired');
    expect(byLabel['Heart Rate'].freshnessRating).toBeNull(); // no window
    expect(byLabel.HRV.freshnessRating).toBeNull();
  });

  it('preserves row order (rows[i] mirrors signals[i])', () => {
    expect(result.rows.map((r) => r.label)).toEqual(['Sleep', 'Heart Rate', 'Weather', 'HRV']);
  });

  it('rows carry only the one chip + raw ratings — no §56, no explanatory copy', () => {
    for (const row of result.rows) {
      expect(Object.keys(row).sort()).toEqual(['chip', 'freshnessRating', 'label', 'sourceRating']);
      expect(Object.keys(row.chip).sort()).toEqual(['label', 'opacity']);
    }
  });

  it('empty signals → empty rows, confidence still passed through', () => {
    const empty = buildDataBehindThis({ confidence: null, signals: [], now: NOW });
    expect(empty.rows).toEqual([]);
    expect(empty.confidence).toBeNull();
  });
});
