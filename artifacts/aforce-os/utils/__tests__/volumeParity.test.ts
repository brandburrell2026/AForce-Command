/**
 * RP-8b — VOLUME PARITY (founder ruling, Wave 4 Option C, 2026-08-31).
 *
 * Planted BEFORE implementation. The governing principle:
 *
 *   "HydroState physiological credit must come from defensible physiological
 *    inputs, not product identity. AForce may be tracked as a product /
 *    ritual / commercial fact, but AForce identity alone must not increase
 *    hydration score, absorption, recovery credit, or recommendation
 *    priority."
 *
 * WHAT RP-8a FOUND (executed, not inferred). `aforceBonus` was never a
 * bonus: in the live per-event path it carried the ENTIRE hydration credit
 * for AForce intakes (a 12 oz stick materialized as
 * `{waterPoints: 0, aforcePoints: 10}`). The brand premium lived one layer
 * deeper, in `baseEventImpact`, which forked on brand and returned a FLAT
 * flavor-table constant that ignored volume entirely:
 *
 *      4 oz  water 2.0   vs  AForce 10   → 5.0x
 *     12 oz  water 6.0   vs  AForce 10   → 1.7x
 *     32 oz  water 16.0  vs  AForce 10   → 0.6x   (water won)
 *
 * Incoherent in both directions, and keyed on FORMAT, not composition — the
 * `unflavored: 10` entry was the proof. Brand additionally bought a better
 * absorption curve (70%/25 min vs water's 60%/12.5 min) and two situational
 * bonuses reachable only through a non-water fluid.
 *
 * RP-8b removes the premium at the MINT (`baseEventImpact` / the absorption
 * curve), not at the last mile — deleting the `aforceBonus` identifier alone
 * would have zeroed all credit for drinking the product.
 *
 * NOT IN THIS LANE (founder ruling, explicit): composition scoring. Nothing
 * here may infer composition from brand, package format, BLE source, or
 * words like "stick" / "bottle" / "can".
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  baseEventImpact,
  computeEventImpact,
  materializedIntakePoints,
} from '@/services/hydrationScoreService';
import { buildBreakdown, calculateBaseScore } from '@/utils/scoring/breakdown';
import { classifyTranscript } from '@/services/intentClassifier';
import { HYDROSTATE_MODEL_VERSION } from '@/config/hydroStateModel';
import type { FluidType, IntakeEvent, ProductFlavor, UserState } from '@/types';

const AOS = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(AOS, p), 'utf8');

const FLUIDS: FluidType[] = [
  'water',
  'aforce_stick',
  'aforce_rtd',
  'aforce_canister',
  'aforce_bulk_bag',
];
const FLAVORS: (ProductFlavor | undefined)[] = [
  undefined,
  'berry',
  'watermelon',
  'soursop',
  'unflavored',
];
const VOLUMES = [4, 8, 12, 16, 20, 32];
const NOW = new Date('2026-08-31T12:00:00.000Z');

/** Every context permutation the OLD situational bonuses keyed on. */
const CONTEXTS = [
  { heatGuardActive: false, scoreBefore: 70 },
  { heatGuardActive: true, scoreBefore: 70 }, // watermelon +2 fired here
  { heatGuardActive: false, scoreBefore: 30 }, // soursop +2 fired here
  { heatGuardActive: true, scoreBefore: 20 },
];

function event(fluidType: FluidType, oz: number, over: Partial<IntakeEvent> = {}): IntakeEvent {
  const i = computeEventImpact(fluidType, undefined, oz, [], NOW, CONTEXTS[0]);
  return {
    id: `evt-${fluidType}-${oz}`,
    fluidType,
    oz,
    loggedAt: new Date(NOW.getTime() - 60 * 60_000),
    baseImpact: i.baseImpact,
    capAdjusted: i.capAdjusted,
    immediate: i.immediate,
    delayed: i.delayed,
    delayedDurationMin: i.delayedDurationMin,
    heatGuardActiveAtLog: false,
    scoreBeforeAtLog: 70,
    ...over,
  } as IntakeEvent;
}

// ─────────────────── 1 · equal ounces → equal base credit

describe('RP-8b — equal volume earns equal base hydration credit', () => {
  it('every fluid type × flavor × context yields the SAME base impact for the same ounces', () => {
    for (const oz of VOLUMES) {
      const reference = baseEventImpact('water', undefined, oz, CONTEXTS[0]);
      for (const fluidType of FLUIDS) {
        for (const flavor of FLAVORS) {
          for (const ctx of CONTEXTS) {
            expect(
              baseEventImpact(fluidType, flavor, oz, ctx),
              `${fluidType}/${flavor ?? 'no-flavor'} @ ${oz}oz (heat=${ctx.heatGuardActive}, score=${ctx.scoreBefore})`,
            ).toBe(reference);
          }
        }
      }
    }
  });

  it('credit scales with VOLUME — the flat per-serving rate is gone', () => {
    // The old table paid a flat 10 for 4 oz and for 32 oz alike.
    const small = baseEventImpact('aforce_stick', 'berry', 4, CONTEXTS[0]);
    const large = baseEventImpact('aforce_stick', 'berry', 32, CONTEXTS[0]);
    expect(large).toBe(small * 8);
    expect(baseEventImpact('water', undefined, 32, CONTEXTS[0])).toBe(large);
  });

  it('the absorption curve is identical for every fluid — brand buys no faster uptake', () => {
    for (const oz of VOLUMES) {
      const ref = computeEventImpact('water', undefined, oz, [], NOW, CONTEXTS[0]);
      for (const fluidType of FLUIDS) {
        for (const flavor of FLAVORS) {
          const got = computeEventImpact(fluidType, flavor, oz, [], NOW, CONTEXTS[0]);
          expect(got.immediate, `${fluidType} @ ${oz}oz immediate`).toBe(ref.immediate);
          expect(got.delayed, `${fluidType} @ ${oz}oz delayed`).toBe(ref.delayed);
          expect(got.delayedDurationMin, `${fluidType} @ ${oz}oz duration`).toBe(
            ref.delayedDurationMin,
          );
        }
      }
    }
  });

  it('the situational bonuses are unreachable — heat and depletion change no impact', () => {
    for (const flavor of FLAVORS) {
      const plain = baseEventImpact('aforce_stick', flavor, 12, CONTEXTS[0]);
      for (const ctx of CONTEXTS) {
        expect(baseEventImpact('aforce_stick', flavor, 12, ctx), `${flavor}`).toBe(plain);
      }
    }
  });
});

// ─────────────────── 2 · brand identity cannot raise the score

describe('RP-8b — AForce identity alone cannot increase physiological score', () => {
  // Tuned to sit MID-RANGE so neither the 0 nor the 100 clamp can hide a
  // divergence. The first draft of this fixture logged 12 oz and both sides
  // clamped to 0 — the law passed against the very defect it names (the
  // Lane-B lesson). Every comparison below asserts non-clamping first.
  const base: UserState = {
    unitsConsumedToday: 5,
    ozConsumedToday: 60,
    aforceUnitsToday: 0,
    lastIntakeTime: new Date(NOW.getTime() - 5 * 60_000),
    lastIntakeType: 'water',
    symptomState: 'none',
    symptoms: [],
    urineSignal: 2,
    energyState: 'steady',
    heatLoad: 0,
    sweatRate: 2,
    activityLevel: 3,
    complianceStreak: 5,
    dailyTarget: 8,
    ozTarget: 96,
    isSnoozed: false,
    snoozeUntil: null,
    bodyWeightLbs: 180,
    isAwake: true,
    wakeTime: null,
    overnightLossOz: 0,
    hasSeenMorningCommand: true,
  } as UserState;

  /** Five 12 oz logs = 60 oz, the same volume on every branch. */
  const fiveOf = (f: FluidType) => [1, 2, 3, 4, 5].map((n) => event(f, 12, { id: `evt-${f}-${n}` }));

  it('the SAME ounces logged as water or as any AForce format produce the SAME score', () => {
    const scores = FLUIDS.map((fluidType) => {
      const state: UserState = {
        ...base,
        // The counter tracks the product fact; it must not move the score.
        aforceUnitsToday: fluidType === 'water' ? 0 : 5,
        lastIntakeType: fluidType,
        intakeEvents: fiveOf(fluidType),
      };
      return { fluidType, score: buildBreakdown(state, NOW.getTime()).score };
    });
    const first = scores[0]!.score;
    // ANTI-VACUITY: a clamped comparison proves nothing. Pre-RP-8b these
    // same fixtures scored 57 (water) vs 77 (stick) — a 20-point brand gap
    // for identical volume.
    expect(first, 'fixture must sit inside the clamp').toBeGreaterThan(0);
    expect(first, 'fixture must sit inside the clamp').toBeLessThan(100);
    for (const s of scores) {
      expect(s.score, `${s.fluidType} scored ${s.score}, water scored ${first}`).toBe(first);
    }
  });

  it('the legacy running-aggregate path is volume-only — the counter buys nothing', () => {
    // Legacy path: no intakeEvents. Two members, identical ounces, one with
    // a full day of AForce units on the counter.
    const legacy = (aforceUnitsToday: number) =>
      buildBreakdown({ ...base, aforceUnitsToday, intakeEvents: [] }, NOW.getTime()).score;
    // ANTI-VACUITY: both endpoints inside the clamp (pre-RP-8b: 55 vs 91).
    expect(legacy(0)).toBeGreaterThan(0);
    expect(legacy(3)).toBeLessThan(100);
    expect(legacy(3)).toBe(legacy(0));
  });

  it('BOTH formula copies agree — the duplicate cannot keep a brand term', () => {
    for (const fluidType of FLUIDS) {
      const state: UserState = {
        ...base,
        aforceUnitsToday: fluidType === 'water' ? 0 : 5,
        intakeEvents: fiveOf(fluidType),
      };
      expect(calculateBaseScore(state, NOW.getTime()), fluidType).toBe(
        buildBreakdown(state, NOW.getTime()).score,
      );
    }
  });

  it('no brand-keyed points table survives in the scoring modules (structural, not lexical)', () => {
    // The Wave-3 lesson: a renamed constant evades a string scan. Assert the
    // SHAPE — no per-flavor or per-fluid points map may be exported from the
    // scoring surface at all, whatever it is called.
    const files = ['services/hydrationScoreService.ts', 'utils/scoring/breakdown.ts'];
    for (const f of files) {
      const src = read(f);
      const tables = [
        ...src.matchAll(/export const (\w+)\s*:\s*Record<\s*(ProductFlavor|FluidType)\s*,\s*number/g),
      ].map((m) => m[1]);
      expect(tables, `${f} exports a per-product points table: ${tables.join(', ')}`).toEqual([]);
    }
  });
});

// ─────────────────── 3 · the product fact survives

describe('RP-8b — aforceUnitsToday still counts AForce consumption (product fact, not score)', () => {
  it('the optimistic counter still increments for AForce formats only', () => {
    const src = read('services/realApi.ts');
    expect(src).toMatch(/aforceUnitsToday: userState\.aforceUnitsToday \+ \(body\.fluidType\.startsWith\('aforce_'\) \? 1 : 0\)/);
  });

  it('the reporting split still labels which points came from AForce products', () => {
    // Provenance labelling is legitimate: it says WHAT was drunk, not what it
    // was worth. The two buckets must now be scored identically.
    const water = materializedIntakePoints([event('water', 12)], NOW);
    const stick = materializedIntakePoints([event('aforce_stick', 12)], NOW);
    expect(stick.aforcePoints).toBeGreaterThan(0);
    expect(stick.waterPoints).toBe(0);
    expect(water.waterPoints).toBeGreaterThan(0);
    // …and the TOTAL — the only thing that reaches the score — is equal.
    expect(stick.total).toBe(water.total);
  });
});

// ─────────────────── 4 · history is not rewritten

describe('RP-8b — historical stored impacts are replayed, never re-derived', () => {
  it('an event carrying OLD brand-inflated numbers still materializes at those numbers', () => {
    // A stick logged under the old model: baseImpact 10 for 12 oz, the
    // brand-only 70/25 curve. New code must replay it verbatim — the ruling
    // forbids rewriting history; these age out of the 24h window naturally.
    const legacyEvent = event('aforce_stick', 12, {
      baseImpact: 10,
      capAdjusted: 10,
      immediate: 7,
      delayed: 3,
      delayedDurationMin: 25,
    });
    const m = materializedIntakePoints([legacyEvent], NOW);
    // 60 min elapsed > 25 min ramp ⇒ fully realized: 7 + 3.
    expect(m.aforcePoints).toBe(10);
    expect(m.total).toBe(10);
  });

  it('materialization reads the stored fields only — never the flavor or fluid type', () => {
    const src = read('services/hydrationScoreService.ts');
    const fn = /function materializedFor[\s\S]*?\n}/.exec(src)?.[0] ?? '';
    expect(fn, 'materializedFor must exist').not.toBe('');
    expect(fn).toMatch(/event\.immediate/);
    expect(fn).toMatch(/event\.delayed/);
    expect(fn).not.toMatch(/fluidType|flavor|baseEventImpact/);
  });
});

// ─────────────────── 5 · the model boundary is marked

describe('RP-8b — the scoring discontinuity is marked', () => {
  it('the model version advanced past the pre-RP-8b value', () => {
    expect(HYDROSTATE_MODEL_VERSION).not.toBe('hydrostate-v0');
  });

  it('client and server mirrors agree (the parity lock still holds)', () => {
    const server = readFileSync(
      join(AOS, '..', 'api-server', 'src', 'lib', 'hydroStateModelVersion.ts'),
      'utf8',
    );
    expect(server).toContain(`"${HYDROSTATE_MODEL_VERSION}"`);
  });
});

// ─────────────────── 6 · the weekly report cannot attribute lift to brand

describe('RP-8b — no surface can name a brand premium as a physiological lift', () => {
  it('no contribution row is brand-named — the weekly "biggest lift" cannot be a product', () => {
    const state: UserState = {
      unitsConsumedToday: 2,
      ozConsumedToday: 24,
      aforceUnitsToday: 2,
      lastIntakeTime: new Date(NOW.getTime() - 20 * 60_000),
      lastIntakeType: 'aforce_stick',
      symptomState: 'none',
      symptoms: [],
      urineSignal: 3,
      energyState: 'steady',
      heatLoad: 0,
      sweatRate: 3,
      activityLevel: 5,
      complianceStreak: 3,
      dailyTarget: 8,
      ozTarget: 96,
      isSnoozed: false,
      snoozeUntil: null,
      bodyWeightLbs: 180,
      isAwake: true,
      wakeTime: null,
      overnightLossOz: 0,
      hasSeenMorningCommand: true,
      intakeEvents: [event('aforce_stick', 12), event('aforce_stick', 12)],
    } as UserState;
    const { contributions, factorDeltas } = buildBreakdown(state, NOW.getTime());
    for (const c of contributions) {
      expect(c.id, `contribution id ${c.id}`).not.toMatch(/aforce|protocol|brand/i);
      expect(c.label, `contribution label ${c.label}`).not.toMatch(/aforce|protocol|brand/i);
      // The hint may not market the product either ("Log a stick or RTD").
      expect(c.hint ?? '', `contribution hint ${c.hint}`).not.toMatch(/aforce|stick|rtd/i);
    }
    for (const key of Object.keys(factorDeltas)) {
      expect(key, `factor key ${key}`).not.toMatch(/aforce|protocol|brand/i);
    }
  });

  it('the instrumentation vector still reconciles to raw exactly', () => {
    const state: UserState = {
      unitsConsumedToday: 1,
      ozConsumedToday: 12,
      aforceUnitsToday: 1,
      lastIntakeTime: new Date(NOW.getTime() - 20 * 60_000),
      lastIntakeType: 'aforce_stick',
      symptomState: 'none',
      symptoms: [],
      urineSignal: 3,
      energyState: 'steady',
      heatLoad: 0,
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
      hasSeenMorningCommand: true,
      intakeEvents: [event('aforce_stick', 12)],
    } as UserState;
    const { factorDeltas } = buildBreakdown(state, NOW.getTime());
    const { raw, clamped, ...terms } = factorDeltas as Record<string, number>;
    const sum = Object.values(terms).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(raw, 6);
    expect(clamped).toBeDefined();
  });
});

// ─────────────────── 7 · no composition inference, no false brand assertion

describe('RP-8b — nothing infers product identity from evidence that cannot prove it', () => {
  it('a BLE sip is not asserted to be an AForce product', () => {
    const src = read('services/bleService.ts');
    expect(
      src,
      'the band knows volume, not contents — it may not name a branded product',
    ).not.toMatch(/fluidType:\s*'aforce_/);
  });

  it('generic vessel words do not classify as AForce — EXECUTED, not source-scanned', () => {
    // A container is not a product. Each phrase below names only a vessel.
    for (const phrase of [
      'log a stick',
      'i had a packet',
      'log a bottle',
      'drank a can',
      'log a jar',
      'had a tub',
      'log a sachet',
      'log 12 ounces',
    ]) {
      const { entities } = classifyTranscript(phrase);
      expect(
        entities.fluidType ?? 'water',
        `"${phrase}" must not assert an AForce product`,
      ).toBe('water');
    }
  });

  it('…but an explicitly spoken brand still classifies', () => {
    // The member naming the product IS evidence. Parity means brand no longer
    // buys score — not that AForce becomes unloggable.
    expect(classifyTranscript('log an aforce stick').entities.fluidType).toBe('aforce_stick');
    expect(classifyTranscript('drank an aforce bottle').entities.fluidType).toBe('aforce_rtd');
  });

  it('no unproven brand default: an unclassified intake never defaults to a product', () => {
    const src = read('services/voiceService.ts');
    expect(src).not.toMatch(/\?\?\s*'aforce_/);
  });

  it('composition is NOT inferred anywhere in the scoring path (out-of-lane guard)', () => {
    // The founder ruling forbids composition scoring in this lane. No sodium /
    // electrolyte / mineral term may enter event impact.
    const src = read('services/hydrationScoreService.ts');
    expect(src.replace(/\/\*[\s\S]*?\*\//g, ' ')).not.toMatch(
      /sodium|electrolyte|potassium|magnesium|carb/i,
    );
  });
});

// ─────────────────── the dormant twin

describe('RP-8b — the dormant parallel engine carries no brand premium either', () => {
  it('no module outside the live path mints brand-keyed score', () => {
    // RP-8a found a complete second scoring engine (zero importers) with its
    // own AForce boost. A re-key that leaves a loaded parallel implementation
    // is the dropped-twin defect this program has hit repeatedly.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(AOS, dir))) {
        if (name.startsWith('.') || name === 'node_modules' || name === '__tests__') continue;
        const rel = join(dir, name);
        if (statSync(join(AOS, rel)).isDirectory()) walk(rel);
        else if (/\.ts$/.test(name)) {
          // Strip comments first: a tombstone recording the removal is not a
          // producer, and a law that cannot tell them apart is noise.
          const src = readFileSync(join(AOS, rel), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, ' ')
            .replace(/(^|\s)\/\/[^\n]*/g, '$1');
          if (/AFORCE_BOOST_CAP|calculateAForceBoost/.test(src)) offenders.push(relative('.', rel));
        }
      }
    };
    walk('utils');
    walk('services');
    expect(offenders, `brand-boost machinery survives in:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});
