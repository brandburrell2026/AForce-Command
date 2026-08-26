/**
 * S1-2 (COR-001) — plausibility qualification locks.
 *
 * The reproduced defect: a one-keystroke weight typo (170→140 lb),
 * every field individually valid, produced 595 oz / 29,148 mg as an
 * authoritative prescription (14.1 L/h — 4× the elite human ceiling).
 * These tests lock the qualification layer that makes that class of
 * output non-authoritative, without touching the referenced formulas.
 *
 * The thresholds are PROPOSED and isolated for claims/science
 * ratification (PROPOSED_* exports) — the pin tests here lock that
 * they exist and gate, not that the specific numbers are final.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeSweatSession,
  qualifySweat,
  PROPOSED_MAX_PLAUSIBLE_SWEAT_RATE_LH,
  PROPOSED_MAX_PLAUSIBLE_DEFICIT_PCT,
  PROPOSED_LIMITED_SWEAT_RATE_LH,
} from '../sweatRateEngine';
import type { QuickInputs, EstimateInputs } from '../../types/sweat';

function quick(over: Partial<QuickInputs> = {}): QuickInputs {
  return {
    mode: 'quick',
    preWeight: 170,
    postWeight: 167.5,
    weightUnit: 'lbs',
    durationMinutes: 60,
    fluidIntake: 16,
    fluidUnit: 'oz',
    ...over,
  };
}

describe('COR-001 reproduction is no longer authoritative', () => {
  it('the exact reproduced typo case (170→140 lb) is UNAVAILABLE', () => {
    const s = computeSweatSession(quick({ postWeight: 140 }));
    expect(s.qualification?.status).toBe('unavailable');
    expect(s.qualification?.reasons).toContain('sweat_rate_implausible');
  });

  it('a normal session stays ok and keeps the referenced formula output', () => {
    const s = computeSweatSession(quick());
    expect(s.qualification?.status).toBe('ok');
    expect(s.sweatLossL).toBeCloseTo(1.61, 1); // ACSM path untouched
  });

  it('600-minute estimate sessions carry at least a limited qualifier', () => {
    const e: EstimateInputs = {
      mode: 'estimate',
      bodyWeight: 170,
      weightUnit: 'lbs',
      height: 5.8,
      heightUnit: 'ft',
      sportId: 'basketball',
      intensity: 5,
      durationMinutes: 600,
      ambientTempC: 35,
      ambientHumidityPct: 80,
      acclimatized: false,
      sodiumProfile: 'moderate',
    };
    const s = computeSweatSession(e);
    expect(['limited', 'unavailable']).toContain(s.qualification?.status);
  });
});

describe('qualifySweat — cross-field and hostile inputs', () => {
  it('rate above the proposed ceiling is unavailable; below is not (mutation-sensitive)', () => {
    const above = qualifySweat({ sweatLossL: 4, sweatRateLh: PROPOSED_MAX_PLAUSIBLE_SWEAT_RATE_LH + 0.01, deficitPct: 2, sodiumLossMg: 4000, durationMin: 60 });
    const below = qualifySweat({ sweatLossL: 2, sweatRateLh: PROPOSED_MAX_PLAUSIBLE_SWEAT_RATE_LH - 0.01, deficitPct: 2, sodiumLossMg: 2000, durationMin: 60 });
    expect(above.status).toBe('unavailable');
    expect(below.status).not.toBe('unavailable');
  });

  it('deficit beyond the proposed maximum is unavailable', () => {
    const q = qualifySweat({ sweatLossL: 6, sweatRateLh: 2, deficitPct: PROPOSED_MAX_PLAUSIBLE_DEFICIT_PCT + 1, sodiumLossMg: 6000, durationMin: 180 });
    expect(q.status).toBe('unavailable');
    expect(q.reasons).toContain('deficit_implausible');
  });

  it.each([NaN, Infinity, -Infinity])('non-finite anywhere (%s) is unavailable', (bad) => {
    expect(qualifySweat({ sweatLossL: bad, sweatRateLh: 1, deficitPct: 1, sodiumLossMg: 1, durationMin: 60 }).status).toBe('unavailable');
    expect(qualifySweat({ sweatLossL: 1, sweatRateLh: 1, deficitPct: 1, sodiumLossMg: bad, durationMin: 60 }).status).toBe('unavailable');
  });

  it('property: 500 random in-range measured sessions never yield an authoritative implausible rate', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let i = 0; i < 500; i++) {
      const pre = 90 + rand() * 300; // 90-390 lb
      const post = pre - rand() * (pre * 0.35); // up to 35% "loss" (typo space)
      const dur = 1 + rand() * 599;
      const fluid = rand() * 500;
      const s = computeSweatSession(quick({ preWeight: pre, postWeight: post, durationMinutes: dur, fluidIntake: fluid }));
      const authoritative = s.qualification?.status !== 'unavailable';
      if (authoritative) {
        expect(s.sweatRateLh).toBeLessThanOrEqual(PROPOSED_MAX_PLAUSIBLE_SWEAT_RATE_LH);
        expect(s.deficitPct).toBeLessThanOrEqual(PROPOSED_MAX_PLAUSIBLE_DEFICIT_PCT);
      }
    }
  });

  it('duration boundaries: 1 min and 600 min both qualify without crashing', () => {
    expect(computeSweatSession(quick({ durationMinutes: 1 })).qualification).toBeDefined();
    expect(computeSweatSession(quick({ durationMinutes: 600 })).qualification).toBeDefined();
  });

  it('limited band sits between the proposed limited and max thresholds', () => {
    const mid = qualifySweat({ sweatLossL: 3, sweatRateLh: (PROPOSED_LIMITED_SWEAT_RATE_LH + PROPOSED_MAX_PLAUSIBLE_SWEAT_RATE_LH) / 2, deficitPct: 2, sodiumLossMg: 3000, durationMin: 60 });
    expect(mid.status).toBe('limited');
  });
});

describe('screen integration locks (source-level)', () => {
  const src = readFileSync(
    resolve(__dirname, '..', '..', 'components', 'sweat', 'SweatCalculatorScreenV2.tsx'),
    'utf8',
  );

  it('no seeded measurement defaults remain — inputs start empty (NEEDS INPUT)', () => {
    expect(src).not.toMatch(/useState\('170'\)|useState\('167\.5?'\)|useState\('5\.8'\)/);
  });

  it('unavailable sessions never become a result and never push autopilot', () => {
    const seg = src.slice(src.indexOf('function commitSession'), src.indexOf('function commitSession') + 600);
    expect(seg).toContain("status === 'unavailable'");
    expect(seg).toContain('setSweatAutopilot(null)');
  });

  it('metric entry is genuinely absent (recorded gap, not invented here)', () => {
    // weightUnit is hardcoded imperial on every path; a metric UX is a
    // separate founder-scoped work item — this lock documents the gap.
    expect(src).toMatch(/weightUnit: 'lbs'/);
    expect(src).not.toMatch(/weightUnit: 'kg'/);
  });
});
