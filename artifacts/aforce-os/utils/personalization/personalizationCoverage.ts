/**
 * §56 UNIVERSAL PERSONALIZATION™ — Step 1: Personalization Coverage registry + resolver.
 *
 * Answers, per engine: of the fields that MATERIALLY change this engine's
 * recommendation (load-bearing), which did the engine actually consume, vs. fall
 * back to a population default, vs. couldn't because the user hasn't filled them
 * in (§55)?
 *
 * §55 measures which fields the user FILLED (input availability); §56 measures
 * whether the engine USED them (consumption). They compose — §55 availability is
 * §56's denominator.
 *
 * Pure · headless · Build-100/Show-10 · Score-Protection (never mutates a score,
 * band, or color). Composes §55 availability as the denominator. Personal
 * Baseline supersession is DEFERRED (founder ruling, behind cybersecurity +
 * counsel) — this layer measures CONSUMPTION, not learned-baseline promotion,
 * and persists nothing.
 *
 * Ruling by ml-engineer (ruling ②) — see the §56 audit. The eight sign-off
 * fields carry `requiresSignOff`; that gates the §20 COEFFICIENT (performance-
 * scientist), never the coverage layer itself.
 */

// ─── Vocabulary ────────────────────────────────────────────────────────

export type PersonalizationField =
  | 'age' | 'height' | 'weight' | 'sex' | 'activityLevel'
  | 'trainingLevel' | 'primaryGoal' | 'sweatClassification'
  | 'climateProfile' | 'environmentalPressure' | 'performanceMemory'
  | 'adaptiveProfile' | 'profileVersion' | 'travelStatus' | 'connectedWearables';

export type PersonalizationEngine =
  | 'HydroState' | 'HydroScan' | 'AutoPilot' | 'Guardian' | 'Cruise'
  | 'Clutch' | 'SleepReadiness' | 'RecoveryWindow' | 'TomorrowLoadForecast'
  | 'PerformanceIdentity' | 'EvidenceEngine';

/** Container fields — carry the other 13; never in any engine's denominator. */
export const STRUCTURAL_FIELDS: readonly PersonalizationField[] = [
  'adaptiveProfile',
  'profileVersion',
] as const;

export interface LoadBearingField {
  field: PersonalizationField;
  /** true ⇒ physiological coefficient claim; needs performance-scientist sign-off
   *  before the §20 coefficient ships (NOT before wiring the coverage layer). */
  requiresSignOff: boolean;
  /** present ⇒ load-bearing but wiring is blocked by an off-limits boundary
   *  (scoring engine). Reported in `scoringLocked`, never as an actionable miss. */
  boundary?: 'scoring-locked';
}

export type EngineCoverageSpec =
  | { kind: 'direct'; loadBearing: readonly LoadBearingField[] }
  | { kind: 'composite'; composedOf: readonly PersonalizationEngine[] }
  | { kind: 'reflective' }
  | { kind: 'absent'; reason: string };

// helpers so the registry stays readable
const lb = (field: PersonalizationField): LoadBearingField => ({ field, requiresSignOff: false });
const lbS = (field: PersonalizationField): LoadBearingField => ({ field, requiresSignOff: true });
const lbLocked = (field: PersonalizationField): LoadBearingField =>
  ({ field, requiresSignOff: true, boundary: 'scoring-locked' });

// ─── THE RULING (ruling ②) ─────────────────────────────────────────────
export const LOAD_BEARING_FIELDS: Record<PersonalizationEngine, EngineCoverageSpec> = {
  HydroState: {
    kind: 'direct',
    loadBearing: [
      lb('weight'), lb('activityLevel'), lb('connectedWearables'),
      lbS('age'), lbS('trainingLevel'), lbS('primaryGoal'),
      lbS('sweatClassification'), lbS('climateProfile'),
      lbS('environmentalPressure'), lbS('travelStatus'),
      lbLocked('sex'),
    ],
  },
  HydroScan: {
    kind: 'direct',
    loadBearing: [
      lb('weight'), lb('activityLevel'), lb('performanceMemory'),
      lbS('sweatClassification'), lbS('primaryGoal'),
    ],
  },
  SleepReadiness: {
    kind: 'direct',
    loadBearing: [
      lb('connectedWearables'), lb('performanceMemory'),
      lbS('age'), lbS('activityLevel'), lbS('travelStatus'),
    ],
  },
  RecoveryWindow: {
    kind: 'direct',
    loadBearing: [
      lb('connectedWearables'), lb('activityLevel'), lb('performanceMemory'),
      lbS('trainingLevel'), lbS('age'), lbS('travelStatus'),
    ],
  },
  PerformanceIdentity: {
    kind: 'direct',
    loadBearing: [lb('performanceMemory'), lb('primaryGoal'), lb('trainingLevel')],
  },
  AutoPilot: {
    kind: 'composite',
    composedOf: ['HydroState', 'HydroScan', 'SleepReadiness', 'RecoveryWindow', 'TomorrowLoadForecast', 'PerformanceIdentity'],
  },
  Guardian: {
    kind: 'composite',
    composedOf: ['HydroState', 'SleepReadiness', 'RecoveryWindow', 'TomorrowLoadForecast'],
  },
  Clutch: {
    kind: 'composite',
    composedOf: ['HydroState', 'SleepReadiness', 'RecoveryWindow', 'TomorrowLoadForecast'],
  },
  Cruise: {
    kind: 'composite',
    composedOf: ['HydroState'],
  },
  EvidenceEngine: { kind: 'reflective' },
  TomorrowLoadForecast: {
    kind: 'absent',
    reason: 'Stub only (app/(hidden)/cruise/excursion.tsx renders "Forecast not yet wired"); no calculator exists.',
  },
};

/**
 * §56 field key → the ProfileIdentity key §55 already resolves presence for.
 * Build the `available` predicate by unioning this (via §55 field presence) with
 * the cross-slice sources §55 does not own (noted below). A field NOT in this map
 * has no ProfileIdentity home; its availability comes from its own runtime source.
 */
export const FIELD_FROM_PROFILE_IDENTITY: Partial<Record<PersonalizationField, string>> = {
  weight: 'bodyWeightLbs',
  height: 'heightCm',
  age: 'birthYear',
  sex: 'biologicalSex',
  activityLevel: 'activityLevel',
  trainingLevel: 'trainingLevel',
  primaryGoal: 'primaryGoal',
  sweatClassification: 'sweatClassification',
  travelStatus: 'frequentTraveler', // proxy today (static boolean)
  // Cross-slice — availability from their own source, NOT ProfileIdentity:
  //   climateProfile        ← Climate Profile source (UNBUILT — unavailable today)
  //   environmentalPressure ← derived; available when a sweat profile exists
  //   performanceMemory     ← Performance Memory entriesLogged >= its floor
  //   connectedWearables    ← linked provider set non-empty
};

// ─── Resolver ──────────────────────────────────────────────────────────

export type FieldPredicate = (field: PersonalizationField) => boolean;

export type FieldStatus =
  | 'personalized'        // load-bearing, available, consumed  ✓
  | 'population-default'  // load-bearing, available, NOT consumed  ← the §56 gap
  | 'blocked-on-input'    // load-bearing, not available (a §55 problem)
  | 'scoring-locked';     // load-bearing but boundary-deferred (founder decision)

export interface FieldCoverage {
  field: PersonalizationField;
  requiresSignOff: boolean;
  available: boolean;
  consumed: boolean;
  status: FieldStatus;
}

export interface EngineCoverageResult {
  engine: PersonalizationEngine;
  kind: EngineCoverageSpec['kind'];
  buildStatus: 'built' | 'not-yet-built';
  fields: FieldCoverage[];
  /** denominator: load-bearing ∩ available ∩ not scoring-locked. */
  actionableTotal: number;
  consumedCount: number;
  /** consumedCount / actionableTotal; 1 when actionableTotal === 0 (nothing to personalize yet). */
  coverage: number;
  blockedOnInput: number;
  scoringLocked: number;
  /** actionable load-bearing fields whose §20 coefficient still needs PS sign-off. */
  pendingSignOff: PersonalizationField[];
  /** composite only: composing engines not yet built. */
  pendingBuild: PersonalizationEngine[];
}

function statusFor(available: boolean, consumed: boolean, locked: boolean): FieldStatus {
  if (locked) return 'scoring-locked';
  if (!available) return 'blocked-on-input';
  return consumed ? 'personalized' : 'population-default';
}

/** Roll a FieldCoverage list up into the result counts. Single source for direct + composite. */
function finalize(
  engine: PersonalizationEngine,
  kind: EngineCoverageResult['kind'],
  fields: FieldCoverage[],
  pendingBuild: PersonalizationEngine[],
): EngineCoverageResult {
  let actionableTotal = 0, consumedCount = 0, blockedOnInput = 0, scoringLocked = 0;
  const pendingSignOff: PersonalizationField[] = [];
  for (const f of fields) {
    if (f.status === 'scoring-locked') scoringLocked += 1;
    else if (f.status === 'blocked-on-input') blockedOnInput += 1;
    else {
      // actionable: personalized or population-default
      actionableTotal += 1;
      if (f.status === 'personalized') consumedCount += 1;
      if (f.requiresSignOff) pendingSignOff.push(f.field);
    }
  }
  return {
    engine, kind, buildStatus: 'built', fields,
    actionableTotal, consumedCount,
    coverage: actionableTotal === 0 ? 1 : consumedCount / actionableTotal,
    blockedOnInput, scoringLocked, pendingSignOff, pendingBuild,
  };
}

function coverFields(
  loadBearing: readonly LoadBearingField[],
  available: FieldPredicate,
  consumed: FieldPredicate,
): FieldCoverage[] {
  return loadBearing.map((lbf) => {
    const locked = lbf.boundary === 'scoring-locked';
    const isAvailable = available(lbf.field) === true;
    const isConsumed = consumed(lbf.field) === true;
    return {
      field: lbf.field,
      requiresSignOff: lbf.requiresSignOff,
      available: isAvailable,
      consumed: isConsumed,
      status: statusFor(isAvailable, isConsumed, locked),
    };
  });
}

function absentResult(engine: PersonalizationEngine): EngineCoverageResult {
  return {
    engine, kind: 'absent', buildStatus: 'not-yet-built', fields: [],
    actionableTotal: 0, consumedCount: 0, coverage: 1,
    blockedOnInput: 0, scoringLocked: 0, pendingSignOff: [], pendingBuild: [],
  };
}

/**
 * Resolve one engine's personalization coverage. Pure + deterministic.
 *
 *  - direct     → score loadBearing against availability + consumption.
 *  - composite  → recurse composedOf; union FieldCoverage by field (a field is
 *                 consumed if it is consumed for any composing engine — with a
 *                 single `consumed` predicate that reduces to dedup); absent
 *                 members go to pendingBuild and are excluded from the denominator.
 *  - reflective → EvidenceEngine reflects `reflectTarget`'s coverage (its metric
 *                 is citation fidelity of what the target actually consumed).
 *                 Without a target, coverage 1 / fields [] (nothing to reflect).
 *                 NOTE: true cited-vs-consumed fidelity needs the Evidence Engine's
 *                 citation output as a predicate — a wiring-step refinement.
 *  - absent     → buildStatus 'not-yet-built', empty result.
 */
export function assessEngineCoverage(
  engine: PersonalizationEngine,
  available: FieldPredicate,
  consumed: FieldPredicate,
  opts?: {
    registry?: Record<PersonalizationEngine, EngineCoverageSpec>;
    reflectTarget?: PersonalizationEngine;
    /** Internal: ancestor engines in the current resolution chain (cycle guard). */
    _visited?: ReadonlySet<PersonalizationEngine>;
  },
): EngineCoverageResult {
  const registry = opts?.registry ?? LOAD_BEARING_FIELDS;
  const visited = opts?._visited ?? new Set<PersonalizationEngine>();
  // Cycle guard: this engine is already being resolved in its own ancestry
  // (only reachable via a cyclic registry edit). Cannot recurse — report it as
  // not-yet-built so it is excluded from the denominator and surfaced in
  // pendingBuild upstream, rather than overflowing the stack.
  if (visited.has(engine)) {
    return { ...absentResult(engine), kind: registry[engine].kind };
  }
  const spec = registry[engine];
  const childOpts = { ...opts, _visited: new Set(visited).add(engine) };

  switch (spec.kind) {
    case 'absent':
      return absentResult(engine);

    case 'reflective': {
      // No target — or a self-reflection — has nothing to reflect.
      if (!opts?.reflectTarget || opts.reflectTarget === engine) {
        return { ...absentResult(engine), kind: 'reflective', buildStatus: 'built' };
      }
      const target = assessEngineCoverage(opts.reflectTarget, available, consumed, childOpts);
      return { ...target, engine, kind: 'reflective' };
    }

    case 'direct':
      return finalize(engine, 'direct', coverFields(spec.loadBearing, available, consumed), []);

    case 'composite': {
      const members = spec.composedOf.map((m) =>
        assessEngineCoverage(m, available, consumed, childOpts));
      // pendingBuild = direct not-yet-built members ∪ nested composites' pendingBuild.
      const pending = new Set<PersonalizationEngine>();
      for (let i = 0; i < members.length; i += 1) {
        if (members[i].buildStatus === 'not-yet-built') pending.add(spec.composedOf[i]);
        for (const nested of members[i].pendingBuild) pending.add(nested);
      }
      const built = members.filter((m) => m.buildStatus === 'built');
      // A composite whose members are ALL unbuilt is itself not-yet-built —
      // never report coverage 1 for a wholly-absent composite.
      if (built.length === 0) {
        return { ...absentResult(engine), kind: 'composite', buildStatus: 'not-yet-built', pendingBuild: [...pending] };
      }
      // Union built members' FieldCoverage by field. available/consumed are
      // consistent across members (same predicates); merge requiresSignOff (OR)
      // and the scoring-locked boundary (locked in any member ⇒ locked here).
      const byField = new Map<PersonalizationField, FieldCoverage>();
      for (const m of built) {
        for (const f of m.fields) {
          const prior = byField.get(f.field);
          if (!prior) {
            byField.set(f.field, { ...f });
          } else {
            const requiresSignOff = prior.requiresSignOff || f.requiresSignOff;
            const locked = prior.status === 'scoring-locked' || f.status === 'scoring-locked';
            byField.set(f.field, {
              field: f.field,
              requiresSignOff,
              available: f.available,
              consumed: f.consumed,
              status: statusFor(f.available, f.consumed, locked),
            });
          }
        }
      }
      return finalize(engine, 'composite', [...byField.values()], [...pending]);
    }
  }
}

/** Resolve every engine at once (dashboard / founder-mode audit). Pure. */
export function assessAllCoverage(
  available: FieldPredicate,
  consumed: FieldPredicate,
  registry: Record<PersonalizationEngine, EngineCoverageSpec> = LOAD_BEARING_FIELDS,
): Record<PersonalizationEngine, EngineCoverageResult> {
  const out = {} as Record<PersonalizationEngine, EngineCoverageResult>;
  for (const engine of Object.keys(registry) as PersonalizationEngine[]) {
    out[engine] = assessEngineCoverage(engine, available, consumed, { registry });
  }
  return out;
}
