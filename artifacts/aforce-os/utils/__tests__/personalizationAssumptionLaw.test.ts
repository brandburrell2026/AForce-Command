/**
 * LANE B — a calculation assumption is not an observed environmental reading.
 *
 * The "Why this for you" chips quote a temperature: `Heat 34°C`, `Warm 24°C`.
 * That number came from a `tempC` that silently fell back to
 * `heatLoadToTempCFallback(heatLoad)` when no weather reading existed —
 * `20 + clamp(heatLoad,0,10) * 1.2`.
 *
 * `heatLoad` ships as a seeded constant 4 that NO code path writes from an
 * observation (PR4 established this and quarantined it as
 * `legacyHeatLoadAssumption`). So a member with no weather data at all was
 * shown `Warm 25°C` — a number that is the seed's arithmetic image, rendered
 * in the same chip, same format, same degree sign as a real reading. Nothing
 * distinguished the fabrication from a measurement.
 *
 * This is PR1's defect in a member-visible surface: the 70 °F calculation
 * neutral quoted back as though it were the weather. Same governing principle,
 * same repair — CALCULATION ASSUMPTION ≠ OBSERVED EVIDENCE.
 *
 * WHAT THIS LANE DOES NOT DO: it does not delete the fallback. The band
 * computation keeps it, because that is a legitimate internal calculation.
 * Only the VISUAL claim is withdrawn.
 */
import { describe, it, expect } from 'vitest';
import { derivePersonalizationSignals } from '../personalizationSignals';
import { resolveInitialUserState } from '../../data/initialUserState';
import { calculateScore } from '../scoringEngine';

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0);

const P = () => resolveInitialUserState(false) as unknown as Record<string, unknown>;

/** Derive the chips a member would actually see for a given state. */
const chipsFor = (over: Record<string, unknown>) => {
  const userState = { ...P(), lastIntakeTime: new Date(T0 - 30 * 60_000), ...over };
  const engineOutput = calculateScore(userState as never, T0);
  return derivePersonalizationSignals({
    userState: userState as never, engineOutput, nowMs: T0,
  } as never);
};

const heatChip = (over: Record<string, unknown>) =>
  chipsFor(over).reasons.find((r: { key: string }) => r.key === 'heat') ?? null;

/** Any chip label that quotes a temperature in degrees. */
const QUOTES_DEGREES = /-?\d+\s*°/;

// ── 1 · the defect ──────────────────────────────────────────────────────────

describe('LAW 1 — an assumed temperature is never quoted as a reading', () => {
  it('THE REPRODUCTION: no weather at all, but heatLoad is seeded', () => {
    // heatLoad 8 → 20 + 8*1.2 = 29.6 °C → previously rendered "Warm 30°C"
    // for a member about whose environment we know precisely nothing.
    const chip = heatChip({ weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null, heatLoad: 8 });
    expect(chip?.label ?? '').not.toMatch(QUOTES_DEGREES);
  });

  it('across every heatLoad the seed can hold', () => {
    for (let heatLoad = 0; heatLoad <= 10; heatLoad += 1) {
      const chip = heatChip({ weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null, heatLoad });
      expect(chip?.label ?? '', `heatLoad ${heatLoad}`).not.toMatch(QUOTES_DEGREES);
    }
  });

  it('and NO chip in the whole set quotes a temperature without a reading', () => {
    // The heat chip is the known offender; this catches any sibling that
    // learns the same trick.
    const out = chipsFor({ weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null, heatLoad: 9 });
    for (const r of out.reasons as Array<{ key: string; label: string }>) {
      expect(r.label, `chip ${r.key}`).not.toMatch(QUOTES_DEGREES);
    }
  });

  it('the seeded production default is the everyday case, not an edge case', () => {
    // A brand-new account ships heatLoad 4 and no weather. This is what a
    // first-run member saw.
    const chip = heatChip({ weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null });
    expect(chip?.label ?? '').not.toMatch(QUOTES_DEGREES);
  });
});

// ── 2 · a real reading is still reported in full ────────────────────────────

describe('LAW 2 — suppression is about provenance, not about heat', () => {
  it('a MEASURED hot reading still names its temperature', () => {
    const chip = heatChip({ weatherTempC: 34, weatherHumidity: 70, weatherFetchedAt: T0 });
    expect(chip?.label).toMatch(QUOTES_DEGREES);
    expect(chip?.label).toContain('34');
  });

  it('a MEASURED warm reading still names its temperature', () => {
    // 28 °C: above HEAT_ELEVATED_C (27) so a chip exists, below HEAT_HIGH_C.
    const chip = heatChip({ weatherTempC: 28, weatherHumidity: 50, weatherFetchedAt: T0 });
    expect(chip?.label).toMatch(QUOTES_DEGREES);
    expect(chip?.label).toContain('28');
  });

  it('a NON-FINITE reading is not an observation — it is an absence', () => {
    // NaN survives a `typeof === 'number'` check and would otherwise be
    // treated as a measurement, taking the assumption's place: `signals.tempC`
    // becomes NaN, the band collapses to 'normal', and a genuinely elevated
    // heatLoad silently stops registering. Same family as PR3's `observe()`
    // rejecting non-finite values — NaN is not a reading.
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const out = chipsFor({ weatherTempC: bad, weatherHumidity: null, weatherFetchedAt: T0, heatLoad: 10 });
      expect(Number.isFinite(out.signals.tempC), `weatherTempC ${bad}`).toBe(true);
      expect(out.signals.tempC).toBeCloseTo(32, 5);          // fell back, as it must
      expect(out.signals.bands.heat).toBe('high');           // still registers
      const chip = out.reasons.find((r: { key: string }) => r.key === 'heat');
      expect(chip?.label ?? '').not.toMatch(QUOTES_DEGREES); // ...and claims no degree
    }
  });

  it('the repair is not a blanket silence — measured and assumed differ', () => {
    // If the fix simply removed the chip, this would pass vacuously.
    const measured = heatChip({ weatherTempC: 34, weatherHumidity: 70, weatherFetchedAt: T0 });
    const assumed = heatChip({ weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null, heatLoad: 10 });
    expect(measured?.label).toBeTruthy();
    expect(measured?.label).not.toBe(assumed?.label ?? null);
  });
});

// ── 3 · the internal calculation is preserved ───────────────────────────────

describe('LAW 3 — the fallback survives where it is legitimate', () => {
  it('the heat BAND is still derived from the assumption', () => {
    // The founder's instruction: preserve the calculation, withdraw the visual
    // claim. A high heatLoad must still register internally as heat.
    const cold = chipsFor({ weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null, heatLoad: 0 });
    const hot = chipsFor({ weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null, heatLoad: 10 });
    expect(hot.signals.bands.heat).not.toBe(cold.signals.bands.heat);
  });

  it('and `signals.tempC` still carries the computed value for consumers', () => {
    const out = chipsFor({ weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null, heatLoad: 10 });
    expect(out.signals.tempC).toBeCloseTo(32, 5); // 20 + 10*1.2
  });

  it('a measured reading and an equivalent assumption agree INTERNALLY', () => {
    // The assumption is a legitimate stand-in for the calculation; it is only
    // the member-facing claim that must distinguish them.
    const assumed = chipsFor({ weatherTempC: null, weatherHumidity: null, weatherFetchedAt: null, heatLoad: 10 });
    const measured = chipsFor({ weatherTempC: 32, weatherHumidity: null, weatherFetchedAt: T0 });
    expect(assumed.signals.bands.heat).toBe(measured.signals.bands.heat);
  });
});
