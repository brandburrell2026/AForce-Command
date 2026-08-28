/**
 * COR-001 battery extension — drive-scale CONSUMERS (founder-authorized
 * PR "fix/wrong-scale-normalization").
 *
 * The store's drive fields (`heatLoad`, `sweatRate`, `activityLevel`) are
 * the canonical 0–10 scale (realApi defaults heat 4 / sweat 3 / activity 5).
 * Six consumers read them as 0–1 or 0–100 — over-reading (every default
 * member "heat_stress", saturated heat factors, fabricated 166 °F/410 bpm
 * vitals) and under-reading (recovery pressure and the Home heat signal
 * pinned low) at the same time. Each is now bridged at ITS boundary through
 * `fraction01FromScale10` — the ONLY sanctioned conversion — with zero
 * engine-math or threshold changes.
 *
 * This file proves, per the founder's required regression evidence:
 * consistent 0–10 interpretation; defaults don't force heat_stress;
 * legitimate heat states stay reachable; Home heat bands reachable across
 * range; recovery pressure not suppressed; Scan doesn't saturate; no
 * impossible fabricated vitals; unknown stays unknown; 0/mid/10 boundary
 * determinism; non-finite degrades safely. Plus the inventory lock that
 * stops FUTURE consumers from silently reinterpreting the scale.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { inferInputs, computeComparison } from '../comparisonEngine';
import {
  recoveryInputsFromState,
  derivePressure,
  deriveFingerprint,
} from '../recoveryEngine';
import { deriveRecoveryLoad } from '../biometricIntelligence';
import { computeHydrationImpact } from '../../utils/impact/hydrationImpact';
import { buildHeatSignalInput } from '../heatGuardInput';
import { evaluateHeatRisk } from '../heatRiskEngine';
import { fraction01FromScale10 } from '../../utils/quantities';
import type { ScoreEngineOutput, UserState } from '../../types';

const AOS_ROOT = join(__dirname, '..', '..');

/** Minimal engine stub — inferInputs reads only score + performanceState. */
function engineStub(score = 76, level = 'BALANCED'): ScoreEngineOutput {
  return { score, performanceState: { level } } as unknown as ScoreEngineOutput;
}

/** A default-drives member exactly as realApi seeds one (heat 4/sweat 3/activity 5). */
function defaultUser(overrides: Partial<UserState> = {}): UserState {
  return {
    heatLoad: 4,
    sweatRate: 3,
    activityLevel: 5,
    urineSignal: 3,
    energyState: 'steady',
    symptoms: [],
    isAwake: true,
    hasSeenMorningCommand: true,
    unitsConsumedToday: 3,
    lastIntakeTime: new Date(Date.now() - 30 * 60000).toISOString(),
    bodyWeightLbs: null,
    weatherTempC: null,
    weatherHumidity: null,
    overnightLossOz: 0,
    complianceStreak: 0,
    dailyTarget: 8,
    ...overrides,
  } as unknown as UserState;
}

// ─── A · comparisonEngine.inferInputs ───────────────────────────────────────

describe('comparisonEngine — drives bridged at inferInputs', () => {
  it('default drives (heat 4) do NOT force heat_stress', () => {
    const inputs = inferInputs(engineStub(), defaultUser());
    expect(inputs.protocol).not.toBe('heat_stress');
    expect(inputs.protocol).toBe('maintenance');
  });

  it('bridged values land on the 0–1 CompareInputs axis (4→0.4, 3→0.3)', () => {
    const inputs = inferInputs(engineStub(), defaultUser());
    expect(inputs.heatLoad).toBeCloseTo(0.4, 10);
    expect(inputs.sweatRate).toBeCloseTo(0.3, 10);
  });

  it('legitimate heat states remain reachable: heatLoad 8 → heat_stress', () => {
    const inputs = inferInputs(engineStub(), defaultUser({ heatLoad: 8 }));
    expect(inputs.protocol).toBe('heat_stress');
  });

  it('boundary determinism: 0 → 0, 5 → 0.5, 10 → 1', () => {
    for (const [raw, want] of [[0, 0], [5, 0.5], [10, 1]] as const) {
      const inputs = inferInputs(engineStub(), defaultUser({ heatLoad: raw, sweatRate: raw }));
      expect(inputs.heatLoad).toBe(want);
      expect(inputs.sweatRate).toBe(want);
    }
  });

  it('non-finite drives degrade to 0 (normalizeInputs’ prior semantic), never throw', () => {
    const inputs = inferInputs(
      engineStub(),
      defaultUser({ heatLoad: Number.NaN, sweatRate: Number.POSITIVE_INFINITY }),
    );
    expect(inputs.heatLoad).toBe(0);
    expect(inputs.sweatRate).toBe(0);
    expect(inputs.protocol).not.toBe('heat_stress');
  });

  it('default-state command copy comes from the non-hot buckets', () => {
    const out = computeComparison({ inputs: inferInputs(engineStub(), defaultUser()) });
    // hot/sweaty buckets trigger at >= 0.6 on the normalized axis; a default
    // member (0.4/0.3) must not read heat-flavored command copy.
    expect(out.command.action.toLowerCase()).not.toContain('carrying heat');
    expect(out.command.action.toLowerCase()).not.toContain('sweat rate elevated');
  });
});

// ─── B · recoveryEngine.recoveryInputsFromState ─────────────────────────────

describe('recoveryEngine — adapter maps drives onto the documented 0–100 axis', () => {
  const engine = { score: 76, prediction: { decayPerMinute: 0.2 } } as unknown as Pick<
    ScoreEngineOutput, 'score' | 'prediction'
  >;

  it('0–10 → 0–100: heat 4 → 40, activity 5 → 50; boundaries 0→0, 10→100', () => {
    expect(recoveryInputsFromState(defaultUser(), engine).heatLoad).toBeCloseTo(40, 10);
    expect(recoveryInputsFromState(defaultUser(), engine).activityLevel).toBeCloseTo(50, 10);
    const zero = recoveryInputsFromState(defaultUser({ heatLoad: 0, activityLevel: 0 }), engine);
    expect(zero.heatLoad).toBe(0);
    expect(zero.activityLevel).toBe(0);
    const max = recoveryInputsFromState(defaultUser({ heatLoad: 10, activityLevel: 10 }), engine);
    expect(max.heatLoad).toBe(100);
    expect(max.activityLevel).toBe(100);
  });

  it('pressure is no longer suppressed: full heat+activity contributes 35+25, not 3.5+2.5', () => {
    const suppressed = derivePressure({
      ...recoveryInputsFromState(defaultUser({ heatLoad: 10, activityLevel: 10 }), engine),
    });
    // heat 100*0.35 + activity 100*0.25 + decay 0.2*20=4 → 64 (minus relief 3*3=9) = 55
    expect(suppressed).toBeGreaterThanOrEqual(50);
    const calm = derivePressure({
      ...recoveryInputsFromState(defaultUser({ heatLoad: 0, activityLevel: 0, unitsConsumedToday: 0 }), engine),
    });
    expect(suppressed).toBeGreaterThan(calm + 40); // heat/activity genuinely move pressure now
  });

  it('fingerprint heat/activity M and H bands are reachable again', () => {
    const high = deriveFingerprint(
      recoveryInputsFromState(defaultUser({ heatLoad: 8, activityLevel: 8 }), engine),
    );
    const mid = deriveFingerprint(
      recoveryInputsFromState(defaultUser({ heatLoad: 4, activityLevel: 5 }), engine),
    );
    const low = deriveFingerprint(
      recoveryInputsFromState(defaultUser({ heatLoad: 1, activityLevel: 1 }), engine),
    );
    // Distinct fingerprints prove the >66 / >33 bands are all reachable
    // (pre-fix, every member hashed into the L band forever).
    expect(new Set([high, mid, low]).size).toBe(3);
  });

  it('non-finite drives degrade to 0, never throw', () => {
    const inputs = recoveryInputsFromState(
      defaultUser({ heatLoad: Number.NaN, activityLevel: Number.NEGATIVE_INFINITY }),
      engine,
    );
    expect(inputs.heatLoad).toBe(0);
    expect(inputs.activityLevel).toBe(0);
  });
});

// ─── C · hydrationScanService heat01 (via computeHydrationImpact) ───────────

describe('scan hydration impact — heat factor not saturated by default drives', () => {
  const product = {
    hydrationSpeed: 80, electrolyteDensity: 40, sugarLevel: 10,
    stimulantLevel: 0, isAForce: false, isWater: true,
  };
  const profile = { bodyWeightLbs: null, biologicalSex: 'unspecified' as const, activityLevel: null };

  it('bridged default heat (4 → 0.4) stays below the heat-driver threshold (no saturation)', () => {
    const impact = computeHydrationImpact({
      product, profile, state: 'BALANCED',
      environment: { heat01: fraction01FromScale10(4), humidity01: null, tempC: null },
    });
    // The 'heat' driver only fires at heatFactor >= 0.5 — a bridged default
    // member (0.4) must not read a heat-driven impact explanation.
    expect(impact.drivers.map((d) => d.key)).not.toContain('heat');
  });

  it('the raw read this PR removed WOULD have saturated (defect’s death certificate)', () => {
    const impact = computeHydrationImpact({
      product, profile, state: 'BALANCED',
      environment: { heat01: 4 /* the old unbridged read */, humidity01: null, tempC: null },
    });
    // clamp01(4) → 1.0: the old read pinned the heat driver on for everyone.
    expect(impact.drivers.map((d) => d.key)).toContain('heat');
  });

  it('service call site pins the bridge (source lock)', () => {
    const src = readFileSync(join(AOS_ROOT, 'services', 'hydrationScanService.ts'), 'utf8');
    expect(src).toMatch(/heat01:\s*fraction01FromScale10\(/);
  });
});

// ─── D · useHeatGuard.buildHeatSignalInput — no fabricated vitals ───────────

describe('heat guard input — measured facts only, unknowns stay neutral', () => {
  it('unknown weather/vitals produce the engine-neutral input, not inventions', () => {
    const input = buildHeatSignalInput(defaultUser(), 90);
    // The fabrications the founder ruled unacceptable are gone:
    expect(input.ambientTempF).toBeLessThan(80);      // was 166 °F from heatLoad 4
    expect(input.humidityPct).toBe(0);                // was 150 %
    expect(input.heartRateBpm).toBe(0);               // was 410 bpm
    expect(input.sweatLossOzPerHr).toBe(0);           // was 90 oz/hr
    expect(input.continuousActiveMin).toBe(0);        // was 300 min
    expect(input.hrRecoveryDelaySec).toBe(0);
    expect(input.sunExposure).toBe(0);
    expect(input.recoveryMomentum).toBe(1);           // was NEGATIVE (1 - 4)
    expect(input.bodyWeightLbs).toBe(0);              // was a fabricated 175 lb
    // Physiological plausibility floor — nothing impossible can be built:
    expect(input.humidityPct).toBeGreaterThanOrEqual(0);
    expect(input.humidityPct).toBeLessThanOrEqual(100);
    expect(input.recoveryMomentum).toBeGreaterThanOrEqual(0);
    expect(input.recoveryMomentum).toBeLessThanOrEqual(1);
    expect(input.heartRateBpm).toBeLessThan(230);
    expect(input.sweatLossOzPerHr).toBeLessThan(80);
  });

  it('the drive contributes ONLY on the engine’s documented 0–1 intensity axis', () => {
    const input = buildHeatSignalInput(defaultUser({ activityLevel: 5 }), 90);
    expect(input.activityIntensity).toBeCloseTo(0.5, 10);
    expect(buildHeatSignalInput(defaultUser({ activityLevel: 10 }), 90).activityIntensity).toBe(1);
    expect(buildHeatSignalInput(defaultUser({ activityLevel: 0 }), 90).activityIntensity).toBe(0);
  });

  it('MEASURED weather flows through as measured (35 °C / 60 % → 95 °F / 60 %)', () => {
    const input = buildHeatSignalInput(
      defaultUser({ weatherTempC: 35, weatherHumidity: 60 }),
      90,
    );
    expect(input.ambientTempF).toBeCloseTo(95, 5);
    expect(input.humidityPct).toBe(60);
  });

  it('a hydrated default member with no measurements evaluates STABLE (unknown adds no risk)', () => {
    const heat = evaluateHeatRisk(buildHeatSignalInput(defaultUser(), 95));
    expect(heat.band).toBe('STABLE');
  });

  it('legitimate heat risk stays reachable: real hot weather + symptoms escalate', () => {
    const heat = evaluateHeatRisk(
      buildHeatSignalInput(
        defaultUser({
          weatherTempC: 41, weatherHumidity: 70,
          symptoms: ['dizziness', 'nausea', 'confusion'], urineSignal: 7,
          activityLevel: 9,
        }),
        30, // depleted hydration
      ),
    );
    expect(heat.band).not.toBe('STABLE'); // measured danger still alarms
  });

  it('non-finite inputs degrade to neutral, never throw and never alarm', () => {
    const input = buildHeatSignalInput(
      defaultUser({
        weatherTempC: Number.NaN, weatherHumidity: Number.POSITIVE_INFINITY,
        activityLevel: Number.NaN, bodyWeightLbs: Number.NaN,
      } as Partial<UserState>),
      95,
    );
    expect(input.ambientTempF).toBeLessThan(80);
    expect(input.humidityPct).toBe(0);
    expect(input.activityIntensity).toBe(0);
    expect(input.bodyWeightLbs).toBe(0);
    expect(evaluateHeatRisk(input).band).toBe('STABLE');
  });
});

// ─── E · biometricIntelligence.deriveRecoveryLoad ───────────────────────────

describe('recovery load — drives bridged like deriveSweatLoss (file now fully migrated)', () => {
  it('default member + STABLE band: heatImpact 25 %, not 100 %', () => {
    const load = deriveRecoveryLoad(
      defaultUser(),
      { social: undefined } as unknown as ScoreEngineOutput,
      'NORMAL' as never,
    );
    // 0.5 * 0.4 (bridged heat 4) + 0.5 * 0.1 (NORMAL bandWeight) = 0.25
    expect(load.heatImpact).toBe(25);
  });
});

// ─── F · HomeScreenV2 heat tile (source lock — screens stay scan-guarded) ───

describe('Home heat signal — bridged at the tile, thresholds untouched', () => {
  const src = readFileSync(
    join(AOS_ROOT, 'components', 'home', 'HomeScreenV2.tsx'), 'utf8',
  );
  it('the tile feeds heatBand the bridged 0–100 value', () => {
    expect(src).toMatch(/heatBand\(\s*fraction01FromScale10\(/);
  });
  it('band thresholds are unchanged (60/30 — no retune)', () => {
    expect(src).toMatch(/heatLoad100 >= 60/);
    expect(src).toMatch(/heatLoad100 >= 30/);
  });
  it('all three bands are reachable on the normalized axis', () => {
    // 0-10 drive → ×10 on the 0-100 axis: 7→70 high, 4→40 moderate, 1→10 low.
    const band = (heatLoad100: number) =>
      heatLoad100 >= 60 ? 'high' : heatLoad100 >= 30 ? 'moderate' : 'low';
    expect(band(fraction01FromScale10(7) * 100)).toBe('high');
    expect(band(fraction01FromScale10(4) * 100)).toBe('moderate');
    expect(band(fraction01FromScale10(1) * 100)).toBe('low');
  });
});
