/**
 * §56 Step 1 — Personalization Coverage resolver.
 *
 * Pins ruling ②: per-engine load-bearing denominators; the four field statuses
 * (personalized / population-default / blocked-on-input / scoring-locked); the
 * scoring-locked bucket for `sex`; coverage=1 when there's nothing to personalize
 * yet; composite union + pendingBuild; reflective delegation; absent engines.
 * Pure qualifier — never a score/band/color.
 */
import { describe, it, expect } from 'vitest';
import {
  assessEngineCoverage,
  assessAllCoverage,
  LOAD_BEARING_FIELDS,
  STRUCTURAL_FIELDS,
  type PersonalizationField,
  type PersonalizationEngine,
  type EngineCoverageSpec,
} from '../personalization/personalizationCoverage';

/** Build a registry override for the recursion-hardening tests. */
const withRegistry = (over: Partial<Record<PersonalizationEngine, EngineCoverageSpec>>) =>
  ({ ...LOAD_BEARING_FIELDS, ...over }) as Record<PersonalizationEngine, EngineCoverageSpec>;

const ALL_FIELDS: PersonalizationField[] = [
  'age', 'height', 'weight', 'sex', 'activityLevel', 'trainingLevel', 'primaryGoal',
  'sweatClassification', 'climateProfile', 'environmentalPressure', 'performanceMemory',
  'adaptiveProfile', 'profileVersion', 'travelStatus', 'connectedWearables',
];
const pred = (set: Iterable<PersonalizationField>) => {
  const s = new Set(set);
  return (f: PersonalizationField) => s.has(f);
};
const ALL = pred(ALL_FIELDS);
const NONE = pred([]);
const byField = (r: { fields: { field: PersonalizationField; status: string }[] }) =>
  Object.fromEntries(r.fields.map((f) => [f.field, f.status]));

describe('§56 — registry sanity', () => {
  it('every named engine is registered; structural fields are in NO denominator', () => {
    const engines: PersonalizationEngine[] = [
      'HydroState', 'HydroScan', 'AutoPilot', 'Guardian', 'Cruise', 'Clutch',
      'SleepReadiness', 'RecoveryWindow', 'TomorrowLoadForecast', 'PerformanceIdentity', 'EvidenceEngine',
    ];
    for (const e of engines) expect(LOAD_BEARING_FIELDS[e], e).toBeDefined();
    for (const [, spec] of Object.entries(LOAD_BEARING_FIELDS)) {
      if (spec.kind !== 'direct') continue;
      for (const s of STRUCTURAL_FIELDS) {
        expect(spec.loadBearing.some((l) => l.field === s)).toBe(false);
      }
    }
  });
});

describe('§56 — direct engine (HydroState)', () => {
  it('fully personalized: all consumed → coverage 1, sex scoring-locked and out of the denominator', () => {
    const r = assessEngineCoverage('HydroState', ALL, ALL);
    expect(byField(r).sex).toBe('scoring-locked');
    expect(r.scoringLocked).toBe(1);
    expect(r.actionableTotal).toBe(10); // 11 load-bearing minus locked sex
    expect(r.consumedCount).toBe(10);
    expect(r.coverage).toBe(1);
    expect(r.blockedOnInput).toBe(0);
    // the seven §20 sign-off fields are actionable → pending PS coefficient sign-off
    expect(r.pendingSignOff.sort()).toEqual(
      ['age', 'climateProfile', 'environmentalPressure', 'primaryGoal', 'sweatClassification', 'trainingLevel', 'travelStatus'].sort(),
    );
  });

  it('available but not consumed → population-default (the §56 gap), coverage 0', () => {
    const r = assessEngineCoverage('HydroState', ALL, NONE);
    expect(r.consumedCount).toBe(0);
    expect(r.coverage).toBe(0);
    expect(byField(r).weight).toBe('population-default');
    expect(byField(r).sex).toBe('scoring-locked'); // locked regardless of consumption
  });

  it('unavailable load-bearing fields are blocked-on-input and excluded from the denominator', () => {
    const only3 = pred(['weight', 'activityLevel', 'connectedWearables']);
    const r = assessEngineCoverage('HydroState', only3, only3);
    expect(r.actionableTotal).toBe(3);
    expect(r.consumedCount).toBe(3);
    expect(r.coverage).toBe(1); // 3/3 of what CAN be personalized
    expect(r.blockedOnInput).toBe(7); // the 7 sign-off fields aren't filled
    expect(byField(r).age).toBe('blocked-on-input');
    expect(r.pendingSignOff).toEqual([]); // blocked fields aren't pending-to-wire
  });

  it('nothing available → coverage 1 (nothing to personalize yet), not 0', () => {
    const r = assessEngineCoverage('HydroState', NONE, NONE);
    expect(r.actionableTotal).toBe(0);
    expect(r.coverage).toBe(1);
    expect(r.blockedOnInput).toBe(10);
    expect(r.scoringLocked).toBe(1);
  });
});

describe('§56 — composite engine (Guardian)', () => {
  it('unions its members, propagates scoring-locked, and flags absent members as pendingBuild', () => {
    const r = assessEngineCoverage('Guardian', ALL, ALL);
    expect(r.kind).toBe('composite');
    expect(r.buildStatus).toBe('built');
    expect(r.pendingBuild).toEqual(['TomorrowLoadForecast']); // absent member
    expect(byField(r).sex).toBe('scoring-locked'); // inherited from HydroState
    expect(r.scoringLocked).toBe(1); // sex counted once in the union
    expect(r.coverage).toBe(1); // all consumed
    // a field load-bearing in multiple members appears once
    expect(r.fields.filter((f) => f.field === 'age')).toHaveLength(1);
    // OR-merge of requiresSignOff (not last-write-wins): activityLevel is
    // sign-off-free in HydroState/RecoveryWindow but sign-off-required in
    // SleepReadiness, so the union must surface it as pending.
    expect(r.pendingSignOff).toContain('activityLevel');
    expect(byField(r).activityLevel).toBe('personalized');
  });

  it('Cruise composes only HydroState — its actionable set matches HydroState', () => {
    const cruise = assessEngineCoverage('Cruise', ALL, ALL);
    const hydro = assessEngineCoverage('HydroState', ALL, ALL);
    expect(cruise.actionableTotal).toBe(hydro.actionableTotal);
    expect(cruise.scoringLocked).toBe(1);
  });
});

describe('§56 — reflective engine (EvidenceEngine)', () => {
  it('with no reflect target: nothing to reflect → coverage 1, empty fields', () => {
    const r = assessEngineCoverage('EvidenceEngine', ALL, ALL);
    expect(r.kind).toBe('reflective');
    expect(r.buildStatus).toBe('built');
    expect(r.fields).toEqual([]);
    expect(r.coverage).toBe(1);
  });

  it('reflects the target engine, relabeled', () => {
    const r = assessEngineCoverage('EvidenceEngine', ALL, ALL, { reflectTarget: 'HydroState' });
    const hydro = assessEngineCoverage('HydroState', ALL, ALL);
    expect(r.engine).toBe('EvidenceEngine');
    expect(r.kind).toBe('reflective');
    expect(r.actionableTotal).toBe(hydro.actionableTotal);
    expect(r.consumedCount).toBe(hydro.consumedCount);
  });
});

describe('§56 — absent engine (TomorrowLoadForecast)', () => {
  it('reports not-yet-built with an empty result', () => {
    const r = assessEngineCoverage('TomorrowLoadForecast', ALL, ALL);
    expect(r.buildStatus).toBe('not-yet-built');
    expect(r.kind).toBe('absent');
    expect(r.fields).toEqual([]);
    expect(r.actionableTotal).toBe(0);
    expect(r.coverage).toBe(1);
  });
});

describe('§56 — recursion hardening (registry designed to grow)', () => {
  it('a composite over only-absent members is not-yet-built, never coverage 1', () => {
    const reg = withRegistry({ Cruise: { kind: 'composite', composedOf: ['TomorrowLoadForecast'] } });
    const r = assessEngineCoverage('Cruise', ALL, ALL, { registry: reg });
    expect(r.buildStatus).toBe('not-yet-built');
    expect(r.pendingBuild).toContain('TomorrowLoadForecast');
  });

  it('nested pendingBuild propagates from a composite one level down', () => {
    // Cruise → Guardian → (…, TomorrowLoadForecast absent). The absent engine is
    // one level below Cruise and must still surface in Cruise.pendingBuild.
    const reg = withRegistry({ Cruise: { kind: 'composite', composedOf: ['Guardian'] } });
    const r = assessEngineCoverage('Cruise', ALL, ALL, { registry: reg });
    expect(r.buildStatus).toBe('built'); // Guardian is built (has HydroState)
    expect(r.pendingBuild).toContain('TomorrowLoadForecast');
  });

  it('a cyclic registry terminates (no stack overflow) and surfaces the cycle member', () => {
    const reg = withRegistry({
      Cruise: { kind: 'composite', composedOf: ['Guardian'] },
      Guardian: { kind: 'composite', composedOf: ['Cruise', 'HydroState'] },
    });
    const r = assessEngineCoverage('Cruise', ALL, ALL, { registry: reg });
    expect(r.buildStatus).toBe('built'); // resolves via HydroState
    expect(r.pendingBuild).toContain('Cruise'); // the cycle member, reported not resolved
  });

  it('a self-referential reflect target has nothing to reflect (no infinite loop)', () => {
    const r = assessEngineCoverage('EvidenceEngine', ALL, ALL, { reflectTarget: 'EvidenceEngine' });
    expect(r.coverage).toBe(1);
    expect(r.fields).toEqual([]);
  });
});

describe('§56 — assessAllCoverage + purity', () => {
  it('resolves every engine in one pass', () => {
    const all = assessAllCoverage(ALL, ALL);
    expect(Object.keys(all)).toHaveLength(11);
    expect(all.TomorrowLoadForecast.buildStatus).toBe('not-yet-built');
    expect(all.HydroState.buildStatus).toBe('built');
  });

  it('is a pure qualifier — the result exposes only coverage fields, no score/band/color', () => {
    const r = assessEngineCoverage('HydroState', ALL, ALL);
    expect(Object.keys(r).sort()).toEqual(
      ['actionableTotal', 'blockedOnInput', 'buildStatus', 'consumedCount', 'coverage',
        'engine', 'fields', 'kind', 'pendingBuild', 'pendingSignOff', 'scoringLocked'].sort(),
    );
  });
});
