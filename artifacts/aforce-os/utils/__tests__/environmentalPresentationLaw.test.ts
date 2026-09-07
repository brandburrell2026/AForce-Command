/**
 * LANE 3 TRUTH LAWS — the presentation layer cannot fabricate.
 *
 * The surface is where every earlier repair could be quietly undone: a screen
 * that prints a heat index as a temperature, calls a stale reading current, or
 * authors its own advice erases six PRs of work at the last inch.
 *
 * These laws sit on the view model rather than the pixels, because that is
 * where the fabrication would have to happen — a component can only render
 * what this object contains.
 */
import { describe, it, expect } from 'vitest';
import {
  buildEnvironmentalView,
  dominantFactor,
  type EnvironmentalView,
} from '../environment/environmentalPresentation';
import {
  interpretEnvironment,
  type EnvironmentalInputs,
} from '../environment/environmentalInterpretation';
import {
  observe, unobserved,
  type EnvironmentalEvidence,
  type EnvironmentalSignal,
  type EnvironmentalUnit,
} from '../environment/environmentalEvidence';

const T0 = Date.UTC(2026, 8, 7, 12, 0, 0);
const H = 3_600_000;

const seen = (signal: EnvironmentalSignal, value: number, unit: EnvironmentalUnit, ageMs = 0) =>
  observe({ signal, value, unit, observedAt: T0 - ageMs, provenance: 'provider',
    source: 'open-meteo', locationPrecision: 'coarse' }, T0) as EnvironmentalEvidence<number>;

const tempC = (c: number, age = 0) => seen('temperature', c, 'celsius', age);
const rh = (p: number, age = 0) => seen('humidity', p, 'percent', age);
const uv = (v: number, age = 0) => seen('uvIndex', v, 'uvIndex', age);
const aqi = (v: number, age = 0) => seen('airQuality', v, 'aqiUs', age);

const view = (inputs: EnvironmentalInputs): EnvironmentalView =>
  buildEnvironmentalView(interpretEnvironment(inputs, T0));

/** The five fixture states the founder is reviewing. */
export const FIXTURES = {
  clear: { temperature: tempC(17), humidity: rh(45), uvIndex: uv(2), airQuality: aqi(20) },
  awareUv: { temperature: tempC(17), humidity: rh(45), uvIndex: uv(4), airQuality: aqi(20) },
  // 31 °C at 55 % RH → heat index 92.6 °F → NWS Extreme Caution → 'significant'.
  // Measured, not assumed: 33 °C / 60 % crosses 103 °F into Danger and would
  // have produced CAUTION under a fixture named "prepare".
  prepareHeat: { temperature: tempC(31), humidity: rh(55), uvIndex: uv(2), airQuality: aqi(20) },
  caution: { temperature: tempC(41), humidity: rh(75), uvIndex: uv(5), airQuality: aqi(165) },
  insufficient: {} as EnvironmentalInputs,
} satisfies Record<string, EnvironmentalInputs>;

// ── 1 · one dominant factor, declared not emergent ──────────────────────────

describe('LAW 1 — dominance is earned, and never invented', () => {
  it('a calm day has NO dominant factor — the field stays open', () => {
    const v = view(FIXTURES.clear);
    expect(v.dominant).toBeNull();
    expect(v.line).toBe('CONDITIONS ARE WORKING WITH YOU.');
  });

  it('promoting the "least benign" signal is exactly what must not happen', () => {
    // All three benign but at different absolute values. A ranking bug would
    // manufacture a concern out of a calm day.
    expect(view({ temperature: tempC(19), humidity: rh(50), uvIndex: uv(2), airQuality: aqi(49) })
      .dominant).toBeNull();
  });

  it('UV dominant at AWARE', () => {
    const v = view(FIXTURES.awareUv);
    expect(v.state).toBe('aware');
    expect(v.dominant?.signal).toBe('uvIndex');
    expect(v.line).toBe('UV IS THE FACTOR TO WATCH.');
  });

  it('HEAT dominant at PREPARE', () => {
    const v = view(FIXTURES.prepareHeat);
    expect(v.state).toBe('prepare');
    expect(v.dominant?.signal).toBe('heat');
    expect(v.line).toBe('THE HEAT IS THE LIMITER.');
  });

  it('the STRONGEST concern wins, not the first seen', () => {
    // Heat notable, air severe → air dominates despite heat's priority.
    const v = view({ temperature: tempC(28), humidity: rh(55), airQuality: aqi(180) });
    expect(v.dominant?.signal).toBe('airQuality');
    expect(v.line).toBe('AIR IS THE FACTOR TO WATCH.');
  });

  it('ties break on a DECLARED order, not on array position', () => {
    // The PR6 audit flagged tie order as an unpinned emergent property. It is
    // now a stated rule: heat limits the engine, air limits the breathing that
    // feeds it, UV is exposure the member can dress for.
    const both = view({ temperature: tempC(41), humidity: rh(75), airQuality: aqi(180) });
    expect(both.dominant?.signal).toBe('heat');
    const airVsUv = view({ uvIndex: uv(9), airQuality: aqi(180) });
    expect(airVsUv.dominant?.signal).toBe('airQuality');
  });

  it('the dominant factor never appears again in the secondary list', () => {
    const v = view(FIXTURES.caution);
    expect(v.secondary.map((s) => s.signal)).not.toContain(v.dominant!.signal);
    expect(v.secondary).toHaveLength(2);
  });
});

// ── 2 · no fabricated measurement ───────────────────────────────────────────

describe('LAW 2 — the surface cannot print what the read does not prove', () => {
  it('HEAT CARRIES NO NUMBER — its value is a heat index, not a temperature', () => {
    // The repeating defect, at the last inch: any numeral beside "HEAT" reads
    // as the ambient temperature.
    const v = view(FIXTURES.prepareHeat);
    expect(v.dominant?.signal).toBe('heat');
    expect(v.dominant?.value).toBeNull();
    const heatRow = view(FIXTURES.caution).secondary.find((s) => s.signal === 'heat');
    expect(heatRow?.value ?? null).toBeNull();
  });

  it('UV and AQI DO carry their numbers — those are published consumer scales', () => {
    const v = view(FIXTURES.caution);
    const rows = [v.dominant, ...v.secondary].filter(Boolean) as { signal: string; value: number | null }[];
    expect(rows.find((r) => r.signal === 'uvIndex')?.value).toBe(5);
    expect(rows.find((r) => r.signal === 'airQuality')?.value).toBe(165);
  });

  it('no published BAND string ever reaches the view model', () => {
    // Bands are internal identifiers ("EPA Unhealthy for Sensitive Groups"),
    // typed as bare strings and truncated at their top rung.
    //
    // WORD-BOUNDED deliberately: a bare /EPA/ matches inside "PR-EPA-RE" and
    // fails a correct view model. That substring collision is the same unsound
    // shape that produced a false acceptance FAIL earlier in this program, so
    // the assertion checks whole tokens and the real band phrases.
    const BAND_PHRASES = [
      'NWS Danger', 'NWS Extreme Caution', 'NWS Caution', 'below NWS Caution',
      'WHO Very High', 'WHO High', 'WHO Moderate', 'WHO Low',
      'EPA Unhealthy for Sensitive Groups', 'EPA Unhealthy', 'EPA Moderate', 'EPA Good',
    ];
    const all = [FIXTURES.clear, FIXTURES.awareUv, FIXTURES.prepareHeat, FIXTURES.caution];
    for (const f of all) {
      const blob = JSON.stringify(view(f));
      expect(blob).not.toMatch(/\b(NWS|WHO|EPA)\b/);
      for (const phrase of BAND_PHRASES) expect(blob).not.toContain(phrase);
    }
  });

  it('words come from CONCERN, not from the band', () => {
    // AQI 165 sits in EPA's "Unhealthy" band, but the member sees "VERY POOR"
    // — derived from concern 'severe', and deliberately NOT the EPA wording.
    // Two reasons it must differ: the band string is an internal identifier,
    // and "unhealthy" is a §42 block-severity HEALTH CLAIM the consumer-copy
    // lint refuses. Describing the air is allowed; diagnosing the member is not.
    const v = view(FIXTURES.caution);
    const air = [v.dominant, ...v.secondary].find((r) => r?.signal === 'airQuality');
    expect(air?.word).toBe('VERY POOR');
    expect(JSON.stringify(v)).not.toMatch(/unhealthy/i);
  });

  it('no timestamp, age, or policyVersion is exposed to the surface', () => {
    // The read carries no observation age, so "updated 4 min ago" cannot be
    // derived. Presence in `factors` already means current under the policy.
    const blob = JSON.stringify(view(FIXTURES.caution));
    expect(blob).not.toMatch(/env-validity|policyVersion|observedAt|updated|ago/i);
  });
});

// ── 3 · missing evidence never looks favourable ─────────────────────────────

describe('LAW 3 — INSUFFICIENT is never dressed as CLEAR', () => {
  it('no evidence produces the insufficient state and its own line', () => {
    const v = view(FIXTURES.insufficient);
    expect(v.state).toBe('insufficient');
    expect(v.stateWord).toBe('INSUFFICIENT');
    expect(v.line).toBe('WE NEED MORE SIGNAL.');
    expect(v.line).not.toBe('CONDITIONS ARE WORKING WITH YOU.');
  });

  it('and it shows NO dominant and NO secondary rows — silence, not placeholders', () => {
    const v = view(FIXTURES.insufficient);
    expect(v.dominant).toBeNull();
    expect(v.secondary).toHaveLength(0);
  });

  it('THE INVARIANT the view model relies on: insufficient carries no factors', () => {
    // The presentation deliberately has no `insufficient` special case — that
    // state exists BECAUSE there are no factors. This pins the assumption at
    // the module boundary rather than defending it with dead code, so if the
    // interpretation ever emitted insufficient WITH factors, this fails here
    // instead of a dominant factor silently appearing on an unresolved screen.
    for (const inputs of [
      {},
      { temperature: unobserved('temperature', 'permission_denied') as EnvironmentalEvidence<number> },
      { temperature: tempC(17, 9 * H), uvIndex: uv(2, 9 * H) },
      { temperature: tempC(34) }, // hot, humidity missing → incomplete heat
    ] as EnvironmentalInputs[]) {
      const read = interpretEnvironment(inputs, T0);
      if (read.state !== 'insufficient') continue;
      expect(read.factors, JSON.stringify(inputs)).toHaveLength(0);
    }
  });

  it('wholly stale evidence reads as insufficient, not calm', () => {
    const v = view({ temperature: tempC(17, 9 * H), humidity: rh(45, 9 * H),
      uvIndex: uv(2, 9 * H), airQuality: aqi(20, 9 * H) });
    expect(v.state).toBe('insufficient');
    expect(v.line).toBe('WE NEED MORE SIGNAL.');
  });

  it('each cause is explained in the member’s language, never as an enum', () => {
    const causes: Array<[string, string]> = [
      ['permission_denied', 'Location is off for AForce.'],
      ['never_requested', 'AForce has not asked for location yet.'],
      ['provider_unavailable', 'Could not reach the environment service.'],
      ['not_supported', 'Not available on this device.'],
      ['demo_withheld', 'Demo data is never used here.'],
    ];
    for (const [reason, copy] of causes) {
      const v = view({
        temperature: unobserved('temperature', reason as never) as EnvironmentalEvidence<number>,
        uvIndex: unobserved('uvIndex', reason as never) as EnvironmentalEvidence<number>,
        airQuality: unobserved('airQuality', reason as never) as EnvironmentalEvidence<number>,
      });
      expect(v.gaps.map((g) => g.reason), reason).toContain(copy);
      // The enum itself must never surface.
      expect(JSON.stringify(v.gaps), reason).not.toContain(reason);
    }
  });

  it('partial evidence lowers the stated signal quality', () => {
    expect(view(FIXTURES.clear).signalQuality).toBe('Reading all three environmental signals.');
    expect(view({ uvIndex: uv(2), airQuality: aqi(20) }).signalQuality)
      .toBe('Reading two of three environmental signals.');
    expect(view({ uvIndex: uv(2) }).signalQuality).toBe('Limited environmental signal.');
  });

  it('a partial read still names its gaps', () => {
    const v = view({ uvIndex: uv(4) });
    expect(v.gaps.map((g) => g.label).sort()).toEqual(['AIR', 'HEAT']);
  });
});

// ── 4 · Environmental never authors an action ───────────────────────────────

describe('LAW 4 — RecoveryCommand authority is structural, not editorial', () => {
  it('the view model has NO field a command could occupy', () => {
    const FORBIDDEN = ['action', 'dose', 'doseOz', 'urgency', 'urgencyLevel', 'command',
      'score', 'points', 'recommendation', 'instruction', 'estimatedImpact', 'advice'];
    for (const f of Object.values(FIXTURES)) {
      const v = view(f as EnvironmentalInputs);
      for (const banned of FORBIDDEN) expect(Object.keys(v)).not.toContain(banned);
    }
  });

  it('no copy it produces is imperative advice', () => {
    // Environmental explains the world. "Drink", "take", "avoid" belong to the
    // command authority, and must not appear in an environmental sentence.
    const IMPERATIVES = /\b(drink|take|avoid|hydrate|sip|consume|rest|stop)\b/i;
    for (const f of Object.values(FIXTURES)) {
      const v = view(f as EnvironmentalInputs);
      expect(v.line, v.state).not.toMatch(IMPERATIVES);
      for (const g of v.gaps) expect(g.reason).not.toMatch(IMPERATIVES);
    }
  });

  it('the command block appears only when attention is warranted', () => {
    expect(view(FIXTURES.clear).showsCommand).toBe(false);        // clear
    expect(view(FIXTURES.awareUv).showsCommand).toBe(false);      // aware — no intervention
    expect(view(FIXTURES.prepareHeat).showsCommand).toBe(true);   // prepare
    expect(view(FIXTURES.caution).showsCommand).toBe(true);       // caution
    expect(view(FIXTURES.insufficient).showsCommand).toBe(false); // unknown
  });

  it('NO-ACTION IS FIRST CLASS — a calm screen is not padded with advice', () => {
    const v = view(FIXTURES.clear);
    expect(v.showsCommand).toBe(false);
    expect(v.dominant).toBeNull();
    expect(v.secondary).toHaveLength(3); // available, quiet, not competing
  });
});

// ── 5 · the five review fixtures are what they claim ────────────────────────

describe('LAW 5 — the founder review fixtures are non-vacuous', () => {
  it.each([
    ['clear', 'clear', null],
    ['awareUv', 'aware', 'uvIndex'],
    ['prepareHeat', 'prepare', 'heat'],
    ['caution', 'caution', 'heat'],
    ['insufficient', 'insufficient', null],
  ] as const)('%s → state %s, dominant %s', (key, state, dominant) => {
    const v = view(FIXTURES[key]);
    expect(v.state).toBe(state);
    expect(v.dominant?.signal ?? null).toBe(dominant);
  });

  it('all five states are reachable and distinct', () => {
    const states = Object.values(FIXTURES).map((f) => view(f as EnvironmentalInputs).state);
    expect(new Set(states).size).toBe(5);
  });

  it('dominantFactor is a pure function of the factor list', () => {
    const a = interpretEnvironment(FIXTURES.caution, T0).factors;
    expect(dominantFactor(a)?.signal).toBe(dominantFactor([...a].reverse())?.signal);
  });
});
