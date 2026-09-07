/**
 * ENV PR6 LAWS — deterministic interpretation and first-class no-action.
 *
 * The chain this defends:
 *
 *     EnvironmentalEvidence → INTERPRETATION → Context Arbitration
 *                           → RecoveryCommand authority → presentation
 *
 * Four things must hold, and they pull against each other:
 *
 *   1. NO SECOND COMMAND AUTHORITY. Interpretation says what the world is
 *      like. It never says what the member should do, and carries no score.
 *   2. ABSENCE IS NEVER GOOD NEWS. Nothing observed is INSUFFICIENT, never
 *      CLEAR. Partial evidence lowers certainty; it never completes itself.
 *   3. NO-ACTION IS FIRST-CLASS. `clear` is a real, reachable, executable
 *      answer backed by real evidence — not a default or a null.
 *   4. ONE READING. Signals are arbitrated together, never emitted as
 *      competing headlines.
 */
import { describe, it, expect } from 'vitest';
import {
  interpretEnvironment,
  warrantsAttention,
  noActionNeeded,
  type EnvironmentalInputs,
  type EnvironmentalRead,
} from '../environment/environmentalInterpretation';
import {
  observe,
  unobserved,
  DEFAULT_VALIDITY_POLICY,
  type EnvironmentalEvidence,
  type EnvironmentalSignal,
  type EnvironmentalUnit,
} from '../environment/environmentalEvidence';

const T0 = Date.UTC(2026, 8, 6, 12, 0, 0);
const H = 3_600_000;

/** Observed evidence for `signal`, `ageMs` old at T0. */
const seen = (
  signal: EnvironmentalSignal,
  value: number,
  unit: EnvironmentalUnit,
  ageMs = 0,
): EnvironmentalEvidence<number> =>
  observe({
    signal, value, unit, observedAt: T0 - ageMs,
    provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
  }, T0) as EnvironmentalEvidence<number>;

const tempC = (c: number, ageMs = 0) => seen('temperature', c, 'celsius', ageMs);
const rh = (p: number, ageMs = 0) => seen('humidity', p, 'percent', ageMs);
const uv = (v: number, ageMs = 0) => seen('uvIndex', v, 'uvIndex', ageMs);
const aqi = (v: number, ageMs = 0) => seen('airQuality', v, 'aqiUs', ageMs);

const read = (inputs: EnvironmentalInputs) => interpretEnvironment(inputs, T0);

/** A pleasant, fully-observed day: 18 °C, 45 % RH, UV 2, AQI 20. */
const BENIGN: EnvironmentalInputs = {
  temperature: tempC(18), humidity: rh(45), uvIndex: uv(2), airQuality: aqi(20),
};

// ── 1 · absence is never good news ──────────────────────────────────────────

describe('LAW 1 — nothing observed is INSUFFICIENT, never CLEAR', () => {
  it('an empty input set cannot be called clear', () => {
    const r = read({});
    expect(r.state).toBe('insufficient');
    expect(noActionNeeded(r)).toBe(false);
    expect(r.factors).toHaveLength(0);
  });

  it('explicitly unobserved signals cannot be called clear', () => {
    for (const reason of ['never_requested', 'permission_denied', 'provider_unavailable',
      'not_supported', 'demo_withheld'] as const) {
      const r = read({
        temperature: unobserved('temperature', reason) as EnvironmentalEvidence<number>,
        humidity: unobserved('humidity', reason) as EnvironmentalEvidence<number>,
        uvIndex: unobserved('uvIndex', reason) as EnvironmentalEvidence<number>,
        airQuality: unobserved('airQuality', reason) as EnvironmentalEvidence<number>,
      });
      expect(r.state, reason).toBe('insufficient');
      expect(noActionNeeded(r), reason).toBe(false);
      expect(r.unavailable.map((u) => u.reason), reason).toContain(reason);
    }
  });

  it('WHOLLY STALE evidence is insufficient — not a benign day', () => {
    // The sharpest form. Yesterday's pleasant readings must not license
    // "nothing needs attention" today.
    const r = read({
      temperature: tempC(18, 9 * H), humidity: rh(45, 9 * H),
      uvIndex: uv(2, 9 * H), airQuality: aqi(20, 9 * H),
    });
    expect(r.state).toBe('insufficient');
    expect(noActionNeeded(r)).toBe(false);
    expect(r.unavailable.every((u) => u.reason === 'stale')).toBe(true);
  });

  it('and stale is reported as STALE, distinct from never having asked', () => {
    const r = read({ uvIndex: uv(2, 9 * H) });
    expect(r.unavailable.find((u) => u.signal === 'uvIndex')?.reason).toBe('stale');
    const never = read({});
    expect(never.unavailable.find((u) => u.signal === 'uvIndex')?.reason).toBe('never_requested');
  });

  it('a hot reading going stale REMOVES the concern — it does not become clear', () => {
    const hot = read({ temperature: tempC(40), humidity: rh(80) });
    expect(hot.state).toBe('caution');
    const aged = read({ temperature: tempC(40, 9 * H), humidity: rh(80, 9 * H) });
    expect(aged.state).toBe('insufficient');
    expect(noActionNeeded(aged)).toBe(false);
  });
});

// ── 2 · no-action is first-class ────────────────────────────────────────────

describe('LAW 2 — CLEAR is a real answer, reachable only with evidence', () => {
  it('a genuinely benign observed day is CLEAR and needs no action', () => {
    const r = read(BENIGN);
    expect(r.state).toBe('clear');
    expect(noActionNeeded(r)).toBe(true);
    expect(r.certainty).toBe('high');
    expect(warrantsAttention(r)).toBe(false);
  });

  it('CLEAR names the evidence it rests on — it is not an empty verdict', () => {
    const r = read(BENIGN);
    expect(r.factors).toHaveLength(3);
    expect(r.factors.every((f) => f.concern === 'benign')).toBe(true);
    expect(r.factors.map((f) => f.band)).toEqual(
      expect.arrayContaining(['below NWS Caution', 'WHO Low', 'EPA Good']),
    );
  });

  it('AWARE asks for no intervention, but is NOT the same as unknown', () => {
    // AWARE is meaningful context that does not warrant an intervention, so it
    // shares CLEAR's disposition. What it must never share is INSUFFICIENT's:
    // "no action needed" is a claim, and an empty read cannot make it.
    const aware = read({ ...BENIGN, uvIndex: uv(4) });
    expect(aware.state).toBe('aware');
    expect(noActionNeeded(aware)).toBe(true);
    expect(warrantsAttention(aware)).toBe(false);

    const blind = read({});
    expect(noActionNeeded(blind)).toBe(false);
    expect(warrantsAttention(blind)).toBe(false);
    expect(blind.attention).toBe('unknown');
  });

  it('ONE rule, three outcomes — the accessors can never drift apart', () => {
    // noActionNeeded is deliberately NOT !warrantsAttention. Two booleans for
    // one question is how the live and ledger freshness verdicts drifted.
    const cases = [read({}), read(BENIGN), read({ ...BENIGN, uvIndex: uv(4) }),
      read({ ...BENIGN, uvIndex: uv(7) }), read({ ...BENIGN, uvIndex: uv(10) })];
    for (const r of cases) {
      expect(noActionNeeded(r) && warrantsAttention(r), r.state).toBe(false);
      expect(noActionNeeded(r)).toBe(r.attention === 'no_action');
      expect(warrantsAttention(r)).toBe(r.attention === 'attention');
    }
    // ...and exactly one read in that set is 'unknown'.
    expect(cases.filter((r) => r.attention === 'unknown')).toHaveLength(1);
  });

  it('no-action is EXECUTABLE — one question, not a per-surface threshold', () => {
    expect(warrantsAttention(read(BENIGN))).toBe(false);                       // clear
    expect(warrantsAttention(read({ ...BENIGN, uvIndex: uv(4) }))).toBe(false); // aware
    expect(warrantsAttention(read({ ...BENIGN, uvIndex: uv(7) }))).toBe(true);  // prepare
    expect(warrantsAttention(read({ ...BENIGN, uvIndex: uv(10) }))).toBe(true); // caution
    expect(warrantsAttention(read({}))).toBe(false);                            // insufficient
  });

  it('partial but benign evidence is still CLEAR — with LOWER certainty', () => {
    // Honest, not silent: we say what we saw and admit how little it was.
    const r = read({ uvIndex: uv(1) });
    expect(r.state).toBe('clear');
    expect(r.certainty).toBe('low');
    expect(r.unavailable.map((u) => u.signal)).toEqual(
      expect.arrayContaining(['heat', 'airQuality']),
    );
  });

  it('certainty tracks coverage, in every step', () => {
    expect(read({ uvIndex: uv(1) }).certainty).toBe('low');
    expect(read({ uvIndex: uv(1), airQuality: aqi(10) }).certainty).toBe('moderate');
    expect(read(BENIGN).certainty).toBe('high');
  });
});

// ── 3 · the four states, from published bands ───────────────────────────────

describe('LAW 3 — states are read off published scales, not an invented score', () => {
  it.each([
    ['UV 2 — WHO Low', uv(2), 'clear'],
    ['UV 4 — WHO Moderate', uv(4), 'aware'],
    ['UV 7 — WHO High', uv(7), 'prepare'],
    ['UV 9 — WHO Very High', uv(9), 'caution'],
  ] as const)('%s', (_l, evidence, expected) => {
    expect(read({ uvIndex: evidence }).state).toBe(expected);
  });

  it.each([
    ['AQI 20 — EPA Good', aqi(20), 'clear'],
    ['AQI 75 — EPA Moderate', aqi(75), 'aware'],
    ['AQI 120 — EPA USG', aqi(120), 'prepare'],
    ['AQI 180 — EPA Unhealthy', aqi(180), 'caution'],
  ] as const)('%s', (_l, evidence, expected) => {
    expect(read({ airQuality: evidence }).state).toBe(expected);
  });

  it('HEAT BOUNDARIES: the NWS ladder flips exactly where it is published', () => {
    // Chosen so the heat index lands in each band. Below 80 °F the index is
    // the temperature itself, so these are exact.
    const atF = (f: number, humidityPct: number) =>
      read({ temperature: tempC((f - 32) * (5 / 9)), humidity: rh(humidityPct) });
    expect(atF(79, 40).state).toBe('clear');    // below NWS Caution
    // 82 °F at 55 % RH → HI ≈ 83 → NWS Caution.
    expect(atF(82, 55).factors.find((f) => f.signal === 'heat')?.band).toBe('NWS Caution');
    expect(atF(82, 55).state).toBe('aware');
    // 90 °F at 55 % RH → HI ≈ 97 → Extreme Caution.
    expect(atF(90, 55).factors.find((f) => f.signal === 'heat')?.band).toBe('NWS Extreme Caution');
    expect(atF(90, 55).state).toBe('prepare');
    // 100 °F at 60 % RH → HI ≈ 129 → Danger.
    expect(atF(100, 60).factors.find((f) => f.signal === 'heat')?.band).toBe('NWS Danger');
    expect(atF(100, 60).state).toBe('caution');
  });

  it('HEAT is the index, not the temperature — humidity changes the verdict', () => {
    // 34 °C at 20 % RH and 34 °C at 85 % RH are different days for a body.
    // Interpreting temperature alone would erase that.
    const dry = read({ temperature: tempC(34), humidity: rh(20) });
    const humid = read({ temperature: tempC(34), humidity: rh(85) });
    expect(dry.state).not.toBe(humid.state);
    expect(humid.state).toBe('caution');
    const dryHeat = dry.factors.find((f) => f.signal === 'heat');
    const humidHeat = humid.factors.find((f) => f.signal === 'heat');
    expect(humidHeat!.value).toBeGreaterThan(dryHeat!.value);
  });

  it('the output carries NO invented number — only banded published values', () => {
    const r = read({ temperature: tempC(34), humidity: rh(85), uvIndex: uv(9), airQuality: aqi(180) });
    for (const f of r.factors) {
      expect(['heatIndexF', 'uvIndex', 'aqiUs']).toContain(f.unit);
      expect(f.band).toMatch(/NWS|WHO|EPA/);
    }
  });
});

// ── 4 · not a second command authority ──────────────────────────────────────

describe('LAW 4 — interpretation never becomes a command or a second score', () => {
  it('the read carries no action, dose, urgency, timing or score — in ANY state', () => {
    const reads: EnvironmentalRead[] = [
      read({}), read(BENIGN),
      read({ ...BENIGN, uvIndex: uv(4) }),
      read({ ...BENIGN, uvIndex: uv(7) }),
      read({ temperature: tempC(42), humidity: rh(90), uvIndex: uv(11), airQuality: aqi(300) }),
    ];
    const FORBIDDEN = ['action', 'dose', 'doseOz', 'urgency', 'urgencyLevel',
      'command', 'score', 'points', 'recommendation', 'instruction', 'estimatedImpact'];
    for (const r of reads) {
      const keys = Object.keys(r);
      for (const banned of FORBIDDEN) {
        expect(keys, `state ${r.state}`).not.toContain(banned);
      }
      // And nothing nested inside a factor, either.
      for (const f of r.factors) {
        for (const banned of FORBIDDEN) expect(Object.keys(f)).not.toContain(banned);
      }
    }
  });

  it('ONE reading, not one per signal — three concerns produce a single state', () => {
    const r = read({ temperature: tempC(38), humidity: rh(70), uvIndex: uv(9), airQuality: aqi(180) });
    expect(typeof r.state).toBe('string');
    // Every contributing signal is named inside the ONE read.
    expect(r.factors.map((f) => f.signal).sort()).toEqual(['airQuality', 'heat', 'uvIndex']);
  });

  it('factors are ordered strongest-first so no surface has to re-rank them', () => {
    const r = read({ temperature: tempC(15), humidity: rh(40), uvIndex: uv(9), airQuality: aqi(75) });
    expect(r.factors[0]!.signal).toBe('uvIndex');
    expect(r.factors[0]!.concern).toBe('severe');
  });
});

// ── 5 · adversarial fixtures ────────────────────────────────────────────────

describe('LAW 5 — adversarial conditions', () => {
  it('CONTRADICTORY: a beautiful temperature under dangerous UV is not clear', () => {
    // The seductive failure: most signals benign, one severe. Averaging — or a
    // risk score — would dilute it. The strongest concern governs.
    const r = read({ temperature: tempC(17), humidity: rh(40), uvIndex: uv(11), airQuality: aqi(15) });
    expect(r.state).toBe('caution');
    expect(noActionNeeded(r)).toBe(false);
    expect(r.factors[0]!.signal).toBe('uvIndex');
  });

  it('CONTRADICTORY: severe heat with pristine air is still caution', () => {
    const r = read({ temperature: tempC(41), humidity: rh(75), uvIndex: uv(1), airQuality: aqi(5) });
    expect(r.state).toBe('caution');
  });

  it('COMPOUNDING: two significant signals escalate PREPARE to CAUTION', () => {
    const one = read({ uvIndex: uv(7), airQuality: aqi(20) });
    expect(one.state).toBe('prepare');
    const two = read({ uvIndex: uv(7), airQuality: aqi(120) });
    expect(two.state).toBe('caution');
  });

  it('...and compounding can NEVER manufacture concern from benign signals', () => {
    // The rule must not be a back-door score. Any number of benign signals is
    // still benign.
    const r = read({ temperature: tempC(10), humidity: rh(30), uvIndex: uv(1), airQuality: aqi(5) });
    expect(r.state).toBe('clear');
    // Nor can two merely-notable signals reach prepare.
    expect(read({ uvIndex: uv(4), airQuality: aqi(75) }).state).toBe('aware');
  });

  it('MIXED STALENESS: a stale severe signal does not govern, and is disclosed', () => {
    // Last night's dangerous UV must not drive today's morning read — but its
    // absence must be visible rather than silently dropped.
    const r = read({ temperature: tempC(16), humidity: rh(40), uvIndex: uv(11, 9 * H) });
    expect(r.state).toBe('clear');
    expect(r.unavailable.find((u) => u.signal === 'uvIndex')?.reason).toBe('stale');
    expect(r.certainty).not.toBe('high');
  });

  it('INCOMPLETE HEAT: hot with no humidity refuses to guess', () => {
    // At/above 80 °F humidity decides the answer. Substituting a neutral would
    // be the PR1 defect — an unknown becoming a comfortable verdict on a
    // genuinely hot day.
    const r = read({ temperature: tempC(34) });
    expect(r.factors.find((f) => f.signal === 'heat')).toBeUndefined();
    expect(r.unavailable.find((u) => u.signal === 'heat')?.reason).toBe('incomplete');
    expect(r.state).toBe('insufficient');
    expect(noActionNeeded(r)).toBe(false);
  });

  it('...but cool with no humidity is answerable, because humidity cannot change it', () => {
    // Below the NWS floor the index IS the temperature. Refusing here would be
    // false modesty, not honesty.
    const r = read({ temperature: tempC(12) });
    expect(r.factors.find((f) => f.signal === 'heat')?.concern).toBe('benign');
    expect(r.state).toBe('clear');
  });

  it('EXTREME: nothing overflows past the top of the ladder', () => {
    const r = read({ temperature: tempC(50), humidity: rh(95), uvIndex: uv(15), airQuality: aqi(500) });
    expect(r.state).toBe('caution');
    expect(r.factors.every((f) => f.concern === 'severe')).toBe(true);
  });

  it('EXTREME COLD is not a heat concern — the scale is not symmetric', () => {
    const r = read({ temperature: tempC(-30), humidity: rh(60), uvIndex: uv(0), airQuality: aqi(5) });
    expect(r.state).toBe('clear');
    expect(r.factors.find((f) => f.signal === 'heat')?.concern).toBe('benign');
  });

  it('BOUNDARIES: each published threshold flips exactly where it is published', () => {
    expect(read({ uvIndex: uv(2.9) }).state).toBe('clear');
    expect(read({ uvIndex: uv(3) }).state).toBe('aware');
    expect(read({ uvIndex: uv(5.9) }).state).toBe('aware');
    expect(read({ uvIndex: uv(6) }).state).toBe('prepare');
    expect(read({ uvIndex: uv(7.9) }).state).toBe('prepare');
    expect(read({ uvIndex: uv(8) }).state).toBe('caution');
    expect(read({ airQuality: aqi(50) }).state).toBe('clear');
    expect(read({ airQuality: aqi(51) }).state).toBe('aware');
    expect(read({ airQuality: aqi(100) }).state).toBe('aware');
    expect(read({ airQuality: aqi(101) }).state).toBe('prepare');
    expect(read({ airQuality: aqi(150) }).state).toBe('prepare');
    expect(read({ airQuality: aqi(151) }).state).toBe('caution');
  });
});

// ── 6 · determinism ─────────────────────────────────────────────────────────

describe('LAW 6 — deterministic in (inputs, now, policy)', () => {
  it('same inputs and same `now` give a byte-identical read', () => {
    const a = JSON.stringify(read({ temperature: tempC(34), humidity: rh(85), uvIndex: uv(7) }));
    const b = JSON.stringify(read({ temperature: tempC(34), humidity: rh(85), uvIndex: uv(7) }));
    expect(a).toBe(b);
  });

  it('advancing `now` past validity changes the read — the clock is injected', () => {
    const inputs = { temperature: tempC(40), humidity: rh(80) };
    expect(interpretEnvironment(inputs, T0).state).toBe('caution');
    expect(interpretEnvironment(inputs, T0 + 9 * H).state).toBe('insufficient');
  });

  it('a custom policy governs validity — applied where the contract applies it', () => {
    // The contract stamps `expiresAt` at OBSERVATION (PR3), and a provider's
    // own expiry may only ever SHORTEN it. So a policy handed to the
    // interpreter cannot retroactively re-age evidence already observed under
    // a different one — if it could, a later policy could LENGTHEN a reading's
    // life, which is precisely what that design forbids. The policy therefore
    // binds at capture, and this proves it binds there.
    const tight = {
      version: 'test-tight',
      rules: { ...DEFAULT_VALIDITY_POLICY.rules,
        temperature: { kind: 'time', freshForMs: 60_000 },
        humidity: { kind: 'time', freshForMs: 60_000 } },
    } as const;
    const observedTight = (signal: EnvironmentalSignal, value: number, unit: EnvironmentalUnit) =>
      observe({
        signal, value, unit, observedAt: T0 - 30 * 60_000,
        provenance: 'provider', source: 'open-meteo', locationPrecision: 'coarse',
      }, T0 - 30 * 60_000, tight as never) as EnvironmentalEvidence<number>;

    // Same 30-minute-old readings, captured under each policy.
    const underDefault = { temperature: tempC(40, 30 * 60_000), humidity: rh(80, 30 * 60_000) };
    const underTight = {
      temperature: observedTight('temperature', 40, 'celsius'),
      humidity: observedTight('humidity', 80, 'percent'),
    };
    expect(interpretEnvironment(underDefault, T0).state).toBe('caution');
    expect(interpretEnvironment(underTight, T0, tight as never).state).toBe('insufficient');
  });

  it('the read records the policy it was made under', () => {
    expect(read(BENIGN).policyVersion).toBe(DEFAULT_VALIDITY_POLICY.version);
  });
});
