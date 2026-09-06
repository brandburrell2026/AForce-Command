/**
 * PR1 LAW — CALCULATION NEUTRAL != OBSERVED ENVIRONMENTAL EVIDENCE.
 *
 * THE DEFECT. `heatGuardInput.NEUTRAL.ambientTempF = 70` is the zero-risk value
 * fed to the heat engine when no temperature reading exists. It is a legitimate
 * ENGINE INPUT — it is precisely the value that contributes no points, so an
 * unknown measurement can never inflate a heat alarm. Its module comment
 * claimed the mitigation was that "None of these values is displayed anywhere."
 *
 * That was true only by coincidence, and the coincidence was one line deep.
 * `heatIndexLoad` built its reason by interpolating the number —
 * `Heat index ${Math.round(hi)}°F is mild.` — and `computeHeatIndex` returns
 * the input verbatim below 80 °F. The string "Heat index 70°F is mild." was
 * therefore constructed on every unmeasured evaluation. It stayed off screen
 * ONLY because heat_index scored 0 at the neutral and `topDrivers` filters
 * `points > 0`.
 *
 * Executed reproduction, before the repair:
 *   unmeasured                    -> 0 pts -> filtered out      -> not visible
 *   unmeasured + sunExposure 0.8  -> 3 pts -> IN topDrivers     -> "Heat index 70°F is mild." VISIBLE
 *
 * `sunExposure` is hardcoded to 0 today (`heatGuardInput.ts:103`). Supplying a
 * real one is exactly what an environmental UV/sun feature does — so this was
 * latent, and Environmental Intelligence is the program that would trip it.
 *
 * THE REPAIR. Provenance travels with the input as a REQUIRED field, and the
 * member-visible sentence is withheld when the temperature was not measured.
 * The POINTS are untouched in both arms: the neutral remains a legitimate
 * calculation input; only the claim about the world is suppressed.
 *
 * These are EXECUTABLE laws — they run the real engine, not a source scan.
 */
import { describe, it, expect } from 'vitest';
import { buildHeatSignalInput } from '../heatGuardInput';
import { evaluateHeatRisk } from '../heatRiskEngine';
import type { HeatSignalInput } from '../../types/heat';

const BASE = {
  activityLevel: 3, bodyWeightLbs: 180, symptoms: [] as string[],
  urineSignal: 3, energyState: 'steady', lastIntakeTime: new Date(),
};

const build = (weatherTempC: number | null, weatherHumidity: number | null) =>
  buildHeatSignalInput({ ...BASE, weatherTempC, weatherHumidity } as never, 80);

/** Every string this engine can put in front of a member, for one input. */
function memberVisibleStrings(input: HeatSignalInput): string[] {
  const out = evaluateHeatRisk(input);
  return [
    ...out.topDrivers.map((d) => d.reason),
    ...out.topDrivers.map((d) => d.label),
    out.command,
    out.commandDetail,
  ].filter((s): s is string => typeof s === 'string');
}

/** A temperature-like number quoted as a reading. */
const QUOTES_A_TEMPERATURE = /\d+\s*°\s*F|\bheat index\s+\d/i;

describe('LAW 1 — an UNMEASURED temperature is never quoted to a member', () => {
  it('no member-visible string carries a temperature when nothing was measured', () => {
    const visible = memberVisibleStrings(build(null, null));
    for (const s of visible) {
      expect(s, `unmeasured temperature quoted in: "${s}"`).not.toMatch(QUOTES_A_TEMPERATURE);
    }
  });

  it('THE EXACT BREAK CONDITION: still silent once the driver becomes visible', () => {
    // This is the case that made the defect real rather than theoretical. With
    // a real sunExposure the heat driver scores points and ENTERS topDrivers,
    // so it is now on screen — and must still refuse to name a temperature.
    const withSun = { ...build(null, null), sunExposure: 0.8 };
    const out = evaluateHeatRisk(withSun);
    const heat = out.topDrivers.find((d) => d.id === 'heat_index');

    expect(heat, 'the heat driver must be VISIBLE here, or this law proves nothing').toBeDefined();
    expect(heat?.points, 'and it must actually score').toBeGreaterThan(0);
    expect(heat?.reason).not.toMatch(QUOTES_A_TEMPERATURE);
    expect(heat?.reason).not.toContain('70');
  });

  it('and the unfiltered breakdown is clean too — not merely the filtered view', () => {
    // Hiding the sentence behind a filter is not a repair; the string must not
    // be constructed with the neutral in it at all.
    const out = evaluateHeatRisk(build(null, null));
    const heat = out.breakdown.find((d) => d.id === 'heat_index');
    expect(heat?.reason).not.toMatch(QUOTES_A_TEMPERATURE);
  });
});

describe('LAW 2 — a MEASURED temperature is still reported in full', () => {
  it('a real hot reading still names its heat index', () => {
    const out = evaluateHeatRisk(build(34, 70));
    const heat = out.breakdown.find((d) => d.id === 'heat_index');
    expect(heat?.reason).toMatch(QUOTES_A_TEMPERATURE);
    expect(heat?.reason).toMatch(/danger zone/i);
  });

  it('a real MILD reading is still named — suppression is about provenance, not comfort', () => {
    // The repair must not silence legitimate mild readings; that would trade
    // one falsehood for a different one.
    const out = evaluateHeatRisk(build(21, 45));
    const heat = out.breakdown.find((d) => d.id === 'heat_index');
    expect(heat?.reason).toMatch(QUOTES_A_TEMPERATURE);
  });
});

describe('LAW 3 — the calculation neutral is PRESERVED', () => {
  it('points are identical whether or not the number may be quoted', () => {
    // The whole point of NEUTRAL is that an unknown measurement contributes no
    // risk. Suppressing the sentence must not change the arithmetic.
    const unmeasured = build(null, null);
    const spoofed: HeatSignalInput = { ...unmeasured, ambientTempMeasured: true };

    const a = evaluateHeatRisk(unmeasured);
    const b = evaluateHeatRisk(spoofed);

    expect(a.score).toBe(b.score);
    expect(a.band).toBe(b.band);
    expect(a.breakdown.find((d) => d.id === 'heat_index')?.points)
      .toBe(b.breakdown.find((d) => d.id === 'heat_index')?.points);
  });

  it('an unmeasured member is never escalated by the neutral', () => {
    const out = evaluateHeatRisk(build(null, null));
    expect(out.breakdown.find((d) => d.id === 'heat_index')?.points).toBe(0);
  });
});

describe('LAW 4 — provenance cannot be omitted', () => {
  it('the builder states it honestly in both directions', () => {
    expect(build(null, null).ambientTempMeasured).toBe(false);
    expect(build(30, 60).ambientTempMeasured).toBe(true);
  });

  it('a non-finite reading is NOT a measurement', () => {
    // NaN passes a `!= null` check and would otherwise read as measured.
    expect(build(Number.NaN, 50).ambientTempMeasured).toBe(false);
  });
});
