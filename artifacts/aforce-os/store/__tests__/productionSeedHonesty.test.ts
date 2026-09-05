/**
 * Production-seed honesty lock (PR-2, founder-authorized).
 *
 * The store's cold-start seed governs three windows: the pre-first-fetch
 * first paint, the offline fetchHome echo (stale:true returns the caller's
 * own state and isHydrated still flips true), and DEMO/CAPTURE sessions
 * that never reach a server. Production previously seeded the DEMO-tuned
 * day (5 units / 45 oz / streak 5 → BALANCED 76) in all three — a
 * fabricated day presented as the member's own, beside an empty event
 * list.
 *
 * Pins: (1) the production seed is the honest empty day, (2) it is
 * byte-shaped like a fresh server account post-fetch (normalizeUserState
 * of an empty row) so first frame ≡ post-fetch, (3) it carries ZERO
 * fabricated evidence (the Wave-5 gate counts intake events as real
 * behavior), (4) the engine stays finite on it, (5) the store and
 * realApi seed through the resolver, and (6) the demo-tuned seed
 * survives untouched for env-gated DEMO/CAPTURE builds.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  productionInitialUserState,
  resolveInitialUserState,
} from '../../data/initialUserState';
import { defaultUserState } from '../../data/mockData';
import { normalizeUserState } from '../../services/realApi';
import { calculateScore } from '../../utils/scoringEngine';

const AOS_ROOT = join(__dirname, '..', '..');

describe('the production seed is the honest empty day', () => {
  const seed = productionInitialUserState;

  it('claims nothing that did not happen', () => {
    expect(seed.unitsConsumedToday).toBe(0);
    expect(seed.ozConsumedToday).toBe(0);
    expect(seed.aforceUnitsToday).toBe(0);
    expect(seed.complianceStreak).toBe(0);
    expect(seed.overnightLossOz).toBe(0);
    expect(seed.hasSeenMorningCommand).toBe(false);
    expect(seed.symptoms).toEqual([]);
    expect(seed.symptomState).toBe('none');
    expect(seed.urineSignal).toBe(3); // true neutral — 2 read as "optimal"
    expect(seed.inventory).toBeUndefined(); // absent = post-fetch truth
    expect(seed.wakeTime).toBeNull();
  });

  it('carries ZERO fabricated evidence (Wave-5 gate protection)', () => {
    // resolveHomeEvidence counts intakeEvents as real behavior; a seeded
    // event would flip a fresh account to "established" and present the
    // score. The production seed must never carry any.
    expect(seed.intakeEvents ?? []).toEqual([]);
    expect(seed.complianceStreak).toBe(0);
  });

  it('keeps the NaN guards: targets are non-zero (score math divides by ozTarget)', () => {
    expect(seed.ozTarget).toBeGreaterThan(0);
    expect(seed.dailyTarget).toBeGreaterThan(0);
  });

  it('honors the recorded non-nullable constraints (documented residuals, not new fabrications)', () => {
    // W3-PR10: lastIntakeTime is non-nullable through the engine; "now"
    // mirrors normalizeUserState's recorded coalesce (epoch-0 renders
    // decades-old "ago" copy + a fabricated depletion command).
    expect(seed.lastIntakeTime).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - seed.lastIntakeTime.getTime())).toBeLessThan(
      6 * 60 * 60 * 1000, // module-load instant; generous CI window
    );
    // The recorded 180 default (normalizeUserState ?? 180, reducer mirror).
    expect(seed.bodyWeightLbs).toBe(180);
  });

  it('is byte-shaped like a fresh server account post-fetch (normalizeUserState of an empty row)', () => {
    const fresh = normalizeUserState({});
    // Dates are minted at different instants — compare shape, not clocks.
    const strip = (u: typeof fresh) => {
      const { lastIntakeTime, ...rest } = u;
      return { ...rest, lastIntakeTimeIsDate: lastIntakeTime instanceof Date };
    };
    // normalizeUserState carries a few explicitly-undefined optionals the
    // seed simply omits — normalize both sides through JSON to compare
    // the *present* shape (undefined keys drop on both).
    expect(JSON.parse(JSON.stringify(strip(productionInitialUserState)))).toEqual(
      JSON.parse(JSON.stringify(strip(fresh))),
    );
  });

  it('the engine stays finite and in-range on the honest seed (cold-start projection)', () => {
    const out = calculateScore(productionInitialUserState);
    expect(Number.isFinite(out.score)).toBe(true);
    expect(out.score).toBeGreaterThanOrEqual(0);
    expect(out.score).toBeLessThanOrEqual(100);
    expect(Number.isFinite(out.riskTimer.minutes)).toBe(true);
    expect(out.riskTimer.minutes).toBeGreaterThan(0); // timerSeconds seed
  });
});

describe('the demo-tuned seed survives, but only for demo/capture builds', () => {
  it('resolver: production → honest, demo/capture → tuned', () => {
    expect(resolveInitialUserState(false)).toBe(productionInitialUserState);
    expect(resolveInitialUserState(true)).toBe(defaultUserState);
  });

  it('the gallery/demo contract values are untouched (tuned day preserved)', () => {
    expect(defaultUserState.unitsConsumedToday).toBe(5);
    expect(defaultUserState.ozConsumedToday).toBe(45);
    expect(defaultUserState.complianceStreak).toBe(5);
  });
});

describe('the store and realApi seed through the resolver (source locks)', () => {
  it('useAppStore seeds userState + the cold-start projection from resolveInitialUserState', () => {
    const src = readFileSync(join(AOS_ROOT, 'store', 'useAppStore.tsx'), 'utf8');
    expect(src).toMatch(/const initialUserState = resolveInitialUserState\(\)/);
    // Anchored on the FIRST ARGUMENT, not on the whole call text. The P0
    // evidence repair passes `now` and a `HydroEvidence` tag alongside it, so
    // the call is no longer a single line — but this lock's prohibition is
    // unchanged and still enforced: the cold-start projection must be built
    // from the honest resolver's state and nothing else.
    expect(src).toMatch(/_initialOnly\(\s*initialUserState\b/);
    expect(src).toMatch(/userState: initialUserState,/);
    // The demo-tuned seed must never be the unconditional store seed again.
    expect(src).not.toContain('defaultUserState');
  });

  it('realApi seeds its offline-echo fallback from resolveInitialUserState', () => {
    const src = readFileSync(join(AOS_ROOT, 'services', 'realApi.ts'), 'utf8');
    expect(src).toMatch(/let lastKnownState: UserState = resolveInitialUserState\(\)/);
    expect(src).not.toContain("from '../data/mockData'");
  });
});
