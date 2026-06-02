/**
 * realApi.postIntakeLog — wire-contract integration test.
 *
 * Locks in the store→server seam every logging path goes through:
 *   - The right `flavor` is computed from the FluidType + caller-
 *     supplied flavor (so Heat Guard / Soursop bonuses fire).
 *   - The right `ozAmount` is sent (default per-serving for sticks /
 *     RTD / canister / bulk-bag; explicit ozOverride for water).
 *   - The embedded `event` carries the fully-decomposed impact
 *     (baseImpact, capAdjusted, immediate, delayed, delayedDurationMin)
 *     produced by the REAL `computeEventImpact` — i.e. the math users
 *     actually see on their orb.
 *   - scoreBefore / scoreAfter are integers and reflect the optimistic
 *     post-intake update (so the +N pop on the home screen is correct).
 *
 * The unit tests for the rubric live in `hydrationScoreService.test.ts`
 * and `hydrationScoreEngine.production.test.ts`. This file does NOT
 * re-test the math; it tests the plumbing that feeds the math, which
 * is the layer most likely to silently regress when the store, picker,
 * or PRODUCTS catalog changes.
 *
 * Heavy `vi.mock` usage is intentional. `data/products.ts` and
 * `services/i18nService.ts` (transitively imported by realApi) pull in
 * React Native asset `require()` calls and `expo-localization`, which
 * are unparseable in node/vitest. The real `computeEventImpact` is
 * preserved — only the RN-only edges are stubbed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// PRODUCTS shape mirrored from data/products.ts (kept minimal — only
// the fields realApi.postIntakeLog actually reads).
vi.mock('../../data/products', () => ({
  PRODUCTS: {
    water: { fluidType: 'water', ozPerServing: 12 },
    aforce_stick: { fluidType: 'aforce_stick', ozPerServing: 12, flavor: 'watermelon' },
    aforce_rtd: { fluidType: 'aforce_rtd', ozPerServing: 12, flavor: 'watermelon' },
    aforce_canister: { fluidType: 'aforce_canister', ozPerServing: 18, flavor: 'watermelon' },
    aforce_bulk_bag: { fluidType: 'aforce_bulk_bag', ozPerServing: 16, flavor: 'soursop' },
  },
}));

// Minimal defaultUserState — realApi imports it for the lastKnownState
// fallback only. Postgres-shaped fields are filled in via the
// normalizeUserState path on the response.
vi.mock('../../data/mockData', () => ({
  defaultUserState: {
    unitsConsumedToday: 0, ozConsumedToday: 0, aforceUnitsToday: 0,
    lastIntakeTime: new Date(), lastIntakeType: 'water',
    symptomState: 'none', symptoms: [], urineSignal: 3, energyState: 'steady',
    heatLoad: 4, sweatRate: 3, activityLevel: 5, complianceStreak: 0,
    dailyTarget: 8, ozTarget: 96, isSnoozed: false, snoozeUntil: null,
    bodyWeightLbs: 180, isAwake: true, wakeTime: null, overnightLossOz: 0,
    hasSeenMorningCommand: false, weatherTempC: null, weatherHumidity: null,
    weatherCity: null, weatherFetchedAt: null, language: 'en',
    intakeEvents: [],
  },
}));

// scoringEngine pulls in i18next + expo-localization at top level — we
// stub `calculateScore` to return a deterministic engine output so the
// optimistic scoreAfter computation in postIntakeLog is testable
// without bundling RN locales.
vi.mock('../../utils/scoringEngine', () => ({
  calculateScore: vi.fn((state: { unitsConsumedToday?: number; ozConsumedToday?: number }) => ({
    // Score increases by 1 for each unit consumed today, plus 0.1 per oz.
    // Deterministic so the integration test can assert exact movements.
    score: Math.round(50 + (state.unitsConsumedToday ?? 0) * 1 + (state.ozConsumedToday ?? 0) * 0.1),
    performanceState: { level: 'BALANCED', label: 'Balanced', score: 50 },
    riskTimer: { minutes: 30, seconds: 0, urgency: 'moderate' },
    contributions: [], reasons: [], command: null, decayPerMinute: 0.5,
    minutesSinceLastIntake: 0, prediction: null, recoverySignal: null,
    pulseConfig: { stateName: 'balanced', primary: '#fff', secondary: '#fff', waveBehavior: 'breathing', colorMode: 'static', durationMs: 4000 },
  })),
}));

// authToken is RN AsyncStorage-backed — return empty headers so the
// fetch call goes through cleanly.
vi.mock('../authToken', () => ({
  getAuthHeaders: async () => ({}),
  getAuthToken: async () => null,
}));

import { postIntakeLog } from '../realApi';
import type { UserState } from '../../types';
import {
  AFORCE_BASE_IMPACT,
  WATER_PTS_PER_OZ,
  WATER_IMMEDIATE_PCT,
  AFORCE_IMMEDIATE_PCT,
} from '../hydrationScoreService';

// ─── Test harness ────────────────────────────────────────────────────────────

function freshUserState(over: Partial<UserState> = {}): UserState {
  return {
    unitsConsumedToday: 0,
    ozConsumedToday: 0,
    aforceUnitsToday: 0,
    lastIntakeTime: new Date(Date.now() - 60 * 60_000),
    lastIntakeType: 'water',
    symptomState: 'none',
    symptoms: [],
    urineSignal: 3,
    energyState: 'steady',
    heatLoad: 4,
    sweatRate: 3,
    activityLevel: 5,
    complianceStreak: 0,
    dailyTarget: 8,
    ozTarget: 96,
    isSnoozed: false,
    snoozeUntil: null,
    bodyWeightLbs: 180,
    isAwake: true,
    wakeTime: null,
    overnightLossOz: 0,
    hasSeenMorningCommand: false,
    weatherTempC: null,
    weatherHumidity: null,
    weatherCity: null,
    weatherFetchedAt: null,
    language: 'en',
    intakeEvents: [],
    ...over,
  } as UserState;
}

interface CapturedRequest {
  url: string;
  body: {
    fluidType: string;
    ozAmount: number;
    scoreBefore: number;
    scoreAfter: number;
    event: {
      fluidType: string;
      flavor?: string;
      oz: number;
      baseImpact: number;
      capAdjusted: number;
      immediate: number;
      delayed: number;
      delayedDurationMin: number;
      heatGuardActiveAtLog: boolean;
      scoreBeforeAtLog: number;
    };
  };
}

let captured: CapturedRequest[];

beforeEach(() => {
  captured = [];
  globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    captured.push({ url: url.toString(), body });
    // Server echoes the optimistic state back so normalizeUserState is happy.
    return new Response(
      JSON.stringify({
        userState: {
          unitsConsumedToday: body.event ? 1 : 0,
          ozConsumedToday: body.ozAmount ?? 0,
          aforceUnitsToday: body.fluidType?.startsWith('aforce_') ? 1 : 0,
          lastIntakeTime: new Date().toISOString(),
          lastIntakeType: body.fluidType,
          intakeEvents: body.event ? [body.event] : [],
          symptoms: [], urineSignal: 3, energyState: 'steady',
          heatLoad: 4, sweatRate: 3, activityLevel: 5,
          complianceStreak: 0, dailyTarget: 8, ozTarget: 96,
          bodyWeightLbs: 180, isAwake: true, overnightLossOz: 0,
          weatherTempC: null, weatherHumidity: null, weatherCity: null,
          language: 'en',
        },
        log: { id: 1, loggedAt: new Date().toISOString() },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Water — every WaterAmountModal preset ───────────────────────────────────
describe('postIntakeLog — water', () => {
  for (const oz of [8, 12, 16, 20, 24, 32] as const) {
    it(`water at ${oz}oz: sends correct ozAmount and baseImpact (= ${oz * WATER_PTS_PER_OZ})`, async () => {
      const { log } = await postIntakeLog(freshUserState(), { fluidType: 'water', ozAmount: oz });
      expect(captured).toHaveLength(1);
      const sent = captured[0]!.body;
      expect(sent.fluidType).toBe('water');
      expect(sent.ozAmount).toBe(oz);
      expect(sent.event.flavor).toBeUndefined();
      expect(sent.event.oz).toBe(oz);
      expect(sent.event.baseImpact).toBe(oz * WATER_PTS_PER_OZ);
      // Water uses 60/40 split over 12.5 min
      expect(sent.event.immediate).toBeCloseTo(sent.event.capAdjusted * WATER_IMMEDIATE_PCT, 5);
      expect(sent.event.delayed).toBeCloseTo(sent.event.capAdjusted * (1 - WATER_IMMEDIATE_PCT), 5);
      expect(sent.event.delayedDurationMin).toBe(12.5);
      // The +N popup the user sees comes from this delta
      expect(log.scoreAfter - log.scoreBefore).toBeGreaterThanOrEqual(0);
    });
  }

  it('water default ozAmount falls back to PRODUCTS[water].ozPerServing (12oz)', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'water' });
    expect(captured[0]!.body.ozAmount).toBe(12);
    expect(captured[0]!.body.event.baseImpact).toBe(6); // 12 * 0.5
  });
});

// ─── AForce stick — flavor wiring + bonuses ──────────────────────────────────
describe('postIntakeLog — AForce stick', () => {
  it('berry stick (no Heat Guard, score=70): baseImpact = 10', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'aforce_stick', flavor: 'berry' });
    const sent = captured[0]!.body;
    expect(sent.fluidType).toBe('aforce_stick');
    expect(sent.event.flavor).toBe('berry');
    expect(sent.event.baseImpact).toBe(AFORCE_BASE_IMPACT.berry); // 10
    expect(sent.event.heatGuardActiveAtLog).toBe(false);
    // AForce uses 70/30 split over 25 min
    expect(sent.event.immediate).toBeCloseTo(sent.event.capAdjusted * AFORCE_IMMEDIATE_PCT, 5);
    expect(sent.event.delayedDurationMin).toBe(25);
  });

  it('watermelon stick + Heat Guard ON (heatLoad >= 6): baseImpact = 12 (+2 bonus)', async () => {
    await postIntakeLog(freshUserState({ heatLoad: 7 }), { fluidType: 'aforce_stick', flavor: 'watermelon' });
    const sent = captured[0]!.body;
    expect(sent.event.flavor).toBe('watermelon');
    expect(sent.event.heatGuardActiveAtLog).toBe(true);
    expect(sent.event.baseImpact).toBe(12); // 10 + 2 Heat Guard
  });

  it('watermelon stick, Heat Guard OFF (heatLoad < 6): baseImpact = 10 (no bonus)', async () => {
    await postIntakeLog(freshUserState({ heatLoad: 5 }), { fluidType: 'aforce_stick', flavor: 'watermelon' });
    expect(captured[0]!.body.event.heatGuardActiveAtLog).toBe(false);
    expect(captured[0]!.body.event.baseImpact).toBe(10);
  });

  it('soursop stick + low score (<40): baseImpact = 13 (+2 depleted bonus)', async () => {
    // Force a low score by giving the user a depleted state. The mocked
    // calculateScore returns 50 + units*1 + oz*0.1, so a fresh user
    // with 0 units & 0 oz starts at score 50. To force scoreBefore<40
    // we'd need negative units, but the bonus path in postIntakeLog
    // calls computeEventImpact with the REAL scoreBefore from
    // calculateScore. We mock calculateScore to return a low value
    // for this one assertion so the soursop bonus fires.
    const { calculateScore } = await import('../../utils/scoringEngine');
    (calculateScore as unknown as { mockReturnValueOnce: (v: unknown) => void }).mockReturnValueOnce({
      score: 30, performanceState: { level: 'DEPLETED', label: 'Depleted', score: 30 },
      riskTimer: { minutes: 5, seconds: 0, urgency: 'critical' },
      contributions: [], reasons: [], command: null, decayPerMinute: 0.5,
      minutesSinceLastIntake: 90, prediction: null, recoverySignal: null,
      pulseConfig: { stateName: 'depleted', primary: '#fff', secondary: '#fff', waveBehavior: 'breathing', colorMode: 'static', durationMs: 4000 },
    });
    await postIntakeLog(freshUserState(), { fluidType: 'aforce_stick', flavor: 'soursop' });
    const sent = captured[0]!.body;
    expect(sent.event.flavor).toBe('soursop');
    expect(sent.event.scoreBeforeAtLog).toBe(30);
    expect(sent.event.baseImpact).toBe(13); // 11 + 2 depleted
  });
});

// ─── AForce non-stick formats ────────────────────────────────────────────────
describe('postIntakeLog — AForce non-stick formats', () => {
  it('aforce_rtd (12oz default): wired through with flavor', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'aforce_rtd', flavor: 'berry' });
    const sent = captured[0]!.body;
    expect(sent.fluidType).toBe('aforce_rtd');
    expect(sent.ozAmount).toBe(12);
    expect(sent.event.oz).toBe(12);
    expect(sent.event.baseImpact).toBe(10);
  });

  it('aforce_canister (18oz default = exactly 1.5 units = at-cap)', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'aforce_canister', flavor: 'watermelon' });
    const sent = captured[0]!.body;
    expect(sent.fluidType).toBe('aforce_canister');
    expect(sent.ozAmount).toBe(18);
    expect(sent.event.baseImpact).toBe(10);
    expect(sent.event.capAdjusted).toBe(10); // exactly at cap, full efficiency
  });

  it('aforce_bulk_bag (16oz default, soursop default flavor)', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'aforce_bulk_bag' });
    const sent = captured[0]!.body;
    expect(sent.fluidType).toBe('aforce_bulk_bag');
    expect(sent.ozAmount).toBe(16);
    // No explicit flavor passed → falls back to PRODUCTS[bulk_bag].flavor = 'soursop'
    expect(sent.event.flavor).toBe('soursop');
    expect(sent.event.baseImpact).toBe(11); // soursop base
  });

  it('AForce stick with no flavor falls back to PRODUCTS[stick].flavor (watermelon)', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'aforce_stick' });
    expect(captured[0]!.body.event.flavor).toBe('watermelon');
  });
});

// ─── Silent / phantom-band auto-log path ─────────────────────────────────────
describe('postIntakeLog — phantom-band auto-log path (ozOverride)', () => {
  it('water with ozOverride (e.g. 16oz) sent as ozAmount 16, not the 12oz default', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'water', ozAmount: 16 });
    expect(captured[0]!.body.ozAmount).toBe(16);
    expect(captured[0]!.body.event.oz).toBe(16);
    expect(captured[0]!.body.event.baseImpact).toBe(8); // 16 * 0.5
  });

  it('aforce_stick with ozOverride respects the override (24oz = 2 units, scaled)', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'aforce_stick', flavor: 'berry', ozAmount: 24 });
    const sent = captured[0]!.body;
    expect(sent.ozAmount).toBe(24);
    expect(sent.event.oz).toBe(24);
    expect(sent.event.baseImpact).toBe(10); // berry flavor base, NOT oz-scaled
    // 24oz = 2 units, prevUnits=0, cap=1.5 → headroom 1.5 + 0.5 over at 0.75
    // eff = (1.5 + 0.5*0.75)/2 = 0.9375
    expect(sent.event.capAdjusted).toBeCloseTo(10 * 0.9375, 5);
  });
});

// ─── Score movement / wire integers ──────────────────────────────────────────
describe('postIntakeLog — scoreBefore/scoreAfter contract', () => {
  it('both scoreBefore and scoreAfter are integers (server schema requires z.number().int())', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'aforce_stick', flavor: 'berry' });
    const sent = captured[0]!.body;
    expect(Number.isInteger(sent.scoreBefore)).toBe(true);
    expect(Number.isInteger(sent.scoreAfter)).toBe(true);
  });

  it('the request goes to the /aforce/intake endpoint', async () => {
    await postIntakeLog(freshUserState(), { fluidType: 'water', ozAmount: 12 });
    expect(captured[0]!.url).toContain('/aforce/intake');
  });
});
