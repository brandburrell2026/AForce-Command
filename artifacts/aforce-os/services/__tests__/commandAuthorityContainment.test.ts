/**
 * Command-authority CONTAINMENT lock — re-plumb wave (founder-authorized).
 *
 * §4 doctrine: HydroState = one hero metric; RecoveryCommand = ONE
 * authoritative action; observation/context surfaces defer — no screen,
 * notification, or commerce surface may silently become another
 * recommendation engine. Wave 1 (#865) contained the urine generator
 * (its own suite pins that). This wave contained the remaining three
 * independent generators the audit found, and this lock keeps ALL their
 * member copy dose-free, clock-free, and deferential:
 *
 *  - heatRiskEngine band commands ("Drink 12 to 16 ounces now …
 *    Recheck in 20 minutes") → heat-SAFETY behavior + defer. The band's
 *    recheckMinutes stays: it is the heat-risk RE-ASSESSMENT cadence
 *    (the HEAT_BANDS config ladder useHeatGuard runs), not a hydration
 *    command clock.
 *  - heatProtocolService dose steps ("Drink 24 ounces of AForce in
 *    under 10 min") → hydrate-now steps deferring the amount. The
 *    "Recheck score…" monitoring steps stay — risk monitoring, not a
 *    hydration clock — and are the documented allowance below.
 *  - cruiseModeService recommendations ("Drink 8–12 ounces … Recheck in
 *    20 min") → ritual-unit copy (a water cycle = the member's picker
 *    amount) + defer.
 *  - hydrationScanService commands ("Recommended: 12 oz water + X.
 *    Recheck in 20 minutes.") → equivalence + water-first + defer.
 *  - comparisonEngine CompareCommand (follow-up wave): six physiology
 *    buckets of dose+clock action copy that NO surface rendered — the
 *    sole caller reads `results` only. Retired outright (type, builder,
 *    field); the block below pins both the mechanism absence and a
 *    comment-stripped source scan so a dose-carrying action line cannot
 *    quietly return.
 */
import { describe, expect, it } from 'vitest';

import { evaluateHeatRisk } from '../heatRiskEngine';
import { computeComparison } from '../comparisonEngine';
import { buildHeatSignalInput } from '../heatGuardInput';
import { HEAT_PROTOCOLS } from '../heatProtocolService';
import { buildRecommendation } from '../hydrationScanService';
import { buildScanCoachScript } from '../scanCoachVoice';
import { deriveProtocol } from '../protocolDerivation';
import { hydrationInsightForHumidity } from '../cityClimateService';
import type { HumidityBand } from '../cityClimateService';
import type { UserState } from '../../types';

const DOSE = /\d+\s*(oz|ounce|stick|serving)/i;
const CLOCK = /recheck in \d/i;

/** Drive the heat engine across every band via hydration score + symptoms. */
function heatAcrossBands() {
  const base: Pick<
    UserState,
    | 'weatherTempC' | 'weatherHumidity' | 'activityLevel' | 'bodyWeightLbs'
    | 'symptoms' | 'urineSignal' | 'energyState' | 'lastIntakeTime'
  > = {
    weatherTempC: null, weatherHumidity: null, activityLevel: 5,
    bodyWeightLbs: 180, symptoms: [], urineSignal: 3,
    energyState: 'steady', lastIntakeTime: new Date(),
  };
  return [
    evaluateHeatRisk(buildHeatSignalInput(base, 95)), // STABLE
    evaluateHeatRisk(buildHeatSignalInput({ ...base, weatherTempC: 38, weatherHumidity: 60 }, 60)),
    evaluateHeatRisk(buildHeatSignalInput({ ...base, weatherTempC: 43, weatherHumidity: 75, urineSignal: 6 }, 35)),
    evaluateHeatRisk(
      buildHeatSignalInput(
        { ...base, weatherTempC: 45, weatherHumidity: 85, urineSignal: 8,
          symptoms: ['dizziness', 'nausea', 'confusion', 'cramping'], energyState: 'crashed' },
        5,
      ),
    ),
  ];
}

describe('heat — band copy is safety behavior + deference, never a dose or hydration clock', () => {
  const scores = heatAcrossBands();

  it('reaches multiple bands (non-vacuous matrix)', () => {
    expect(new Set(scores.map((s) => s.band)).size).toBeGreaterThanOrEqual(3);
  });

  it.each(scores.map((s) => [s.band, s] as const))('%s command/detail contained', (_band, s) => {
    for (const text of [s.command, s.commandDetail]) {
      expect(text, `dose in: ${text}`).not.toMatch(DOSE);
      expect(text, `clock in: ${text}`).not.toMatch(CLOCK);
      expect(text).not.toMatch(/AForce/); // no product pushes in safety copy
    }
  });

  it('escalation bands still defer the hydration action to the ONE command', () => {
    for (const s of scores) {
      if (s.band === 'STABLE') continue;
      expect(s.command.toLowerCase()).toContain('current command');
    }
  });
});

describe('heat protocols — steps hydrate-by-deference; monitoring steps are the one allowance', () => {
  it('no protocol step carries a dose or product push', () => {
    const protocols = Object.values(HEAT_PROTOCOLS);
    expect(protocols.length).toBeGreaterThan(0); // non-vacuous
    for (const p of protocols) {
      for (const a of p.actions) {
        const text = `${a.label} ${a.detail ?? ''}`;
        expect(text, `dose in step: ${text}`).not.toMatch(DOSE);
        expect(text).not.toMatch(/AForce/);
        // ALLOWANCE, documented: "Recheck score…" steps are heat-risk
        // MONITORING cadence (re-assess the risk surface), not a
        // hydration-command clock — the banned shape is "Recheck in N".
        expect(text, `hydration clock in step: ${text}`).not.toMatch(CLOCK);
      }
    }
  });
});

describe('climate insights — environmental observation, never a sip cadence', () => {
  // ClimateLine + HeatRiskScreen render these as climate CONTEXT. The old
  // very_dry copy authored a hydration clock ("Sip every 15 min").
  const BANDS: HumidityBand[] = ['very_dry', 'dry', 'comfortable', 'humid', 'oppressive'];

  it.each(BANDS)('%s insight contained', (band) => {
    const text = hydrationInsightForHumidity(band);
    expect(text, `dose in: ${text}`).not.toMatch(DOSE);
    expect(text, `clock in: ${text}`).not.toMatch(CLOCK);
    expect(text, `sip cadence in: ${text}`).not.toMatch(/\b(sip|drink)\s+every\b/i);
    expect(text, `cadence in: ${text}`).not.toMatch(/\bevery\s+\d+\s*(min|minute|hour)/i);
    expect(text).not.toMatch(/AForce/); // context copy carries no product push
  });
});

describe('cruise — recommendations are ritual-unit + deference', () => {
  it('every status recommendation is dose-free, clock-free', async () => {
    const src = (await import('node:fs')).readFileSync(
      (await import('node:path')).join(__dirname, '..', 'cruiseModeService.ts'),
      'utf8',
    );
    // Source-level pin (evaluateCruise needs a full session to drive all
    // four statuses; the strings are literals — pin them directly).
    const strings = [...src.matchAll(/recommendation = "([^"]+)"/g)].map((m) => m[1]);
    expect(strings.length).toBe(4); // all four statuses present
    for (const s of strings) {
      expect(s, `dose in: ${s}`).not.toMatch(DOSE);
      expect(s, `clock in: ${s}`).not.toMatch(CLOCK);
    }
  });
});

describe('scan — commerce-adjacent commands are equivalence + water-first + deference', () => {
  const inputs = {
    state: 'BALANCED', score: 70, protocol: 'maintenance', goal: 'performance',
    heatLoad: 0.4, sweatRate: 0.3, symptomCount: 0, hoursSinceLastIntake: 1,
  } as never;
  const fit = (verdict: string, fitScore: number) =>
    ({ product: { id: 'p1', name: 'Test', isAForce: false }, fitScore, rank: 1, whyItFits: 'w', axes: {}, verdict }) as never;
  const aforce = (fitScore: number) =>
    ({ product: { id: 'af1', name: 'AForce Stick', isAForce: true }, fitScore, rank: 1, whyItFits: 'w', axes: {}, verdict: 'strong' }) as never;
  const scanned = (isAForce: boolean) =>
    ({ productId: isAForce ? 'af1' : 'p1', productName: isAForce ? 'AForce Stick' : 'BrandX', isAForce }) as never;

  const cases = [
    ['aforce-optimal', buildRecommendation(scanned(true), inputs, fit('optimal', 80), undefined)],
    ['upsell', buildRecommendation(scanned(false), inputs, fit('acceptable', 50), aforce(80))],
    ['supportive', buildRecommendation(scanned(false), inputs, fit('strong', 70), undefined)],
    ['sub-par + equivalent', buildRecommendation(scanned(false), inputs, fit('weak', 20), aforce(60))],
    ['sub-par no equivalent', buildRecommendation(scanned(false), inputs, fit('weak', 20), undefined)],
  ] as const;

  it.each(cases.map(([n, r]) => [n, r] as const))('%s command contained', (_n, rec) => {
    expect(rec.command, `dose in: ${rec.command}`).not.toMatch(DOSE);
    expect(rec.command, `clock in: ${rec.command}`).not.toMatch(CLOCK);
  });

  it('water-first ordering survives the containment', () => {
    for (const [, rec] of cases) {
      expect(rec.command.toLowerCase()).toContain('water');
    }
  });
});

describe('comparison — the engine compares; it no longer authors a command', () => {
  const inputs = {
    state: 'BALANCED', score: 70, protocol: 'maintenance', goal: 'performance',
    heatLoad: 0.4, sweatRate: 0.3, symptomCount: 0, hoursSinceLastIntake: 1,
  } as never;

  it('output carries results + winner and NO command key (populated and empty catalogs)', () => {
    const populated = computeComparison({ inputs });
    expect(populated.results.length).toBeGreaterThan(0); // non-vacuous
    expect(populated.winner).toBeDefined();
    expect('command' in populated).toBe(false);

    const empty = computeComparison({ inputs, catalog: [] });
    expect(empty.results).toEqual([]);
    expect('command' in empty).toBe(false);
  });

  it('source holds no dose or clock copy (comments stripped)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'comparisonEngine.ts'),
      'utf8',
    );
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(stripped.length).toBeGreaterThan(1000); // non-vacuous strip
    expect(stripped, 'dose copy returned to comparisonEngine').not.toMatch(DOSE);
    expect(stripped, 'clock copy returned to comparisonEngine').not.toMatch(CLOCK);
    expect(stripped, 'a minutes-clock returned to comparisonEngine').not.toMatch(/\b\d+\s*min\b/i);
    expect(stripped, 'CompareCommand returned to comparisonEngine').not.toMatch(/CompareCommand/);
  });
});

describe('heat_warning voice templates — safety speech, never a dose author', () => {
  // useHeatGuard rehost (founder ruling 2026-08-28): the escalation speech
  // went live with the /heat rehost. These templates previously carried
  // "Drink {oz} ounces now" — and the template engine fills {oz} with a
  // HARDCODED 16 when the context carries none, i.e. a fabricated dose on
  // a safety escalation. Structural ban: the heat_warning category may
  // never take a dose parameter or a fixed clock again.
  it('no {oz} parameter and no dose/clock copy in any heat_warning line', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'data', 'voiceTemplates.ts'),
      'utf8',
    );
    const start = src.indexOf('heat_warning: {');
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf('},', start) + 2);
    expect(block.length).toBeGreaterThan(100); // non-vacuous slice
    expect(block, 'a dose parameter returned to heat_warning').not.toMatch(/\{oz\}/);
    expect(block, 'dose copy returned to heat_warning').not.toMatch(DOSE);
    expect(block, 'a fixed clock returned to heat_warning').not.toMatch(/Recheck \d+ min/i);
    // The parameterized monitoring cadence stays — the hook threads the
    // band's safety-clamped interval into {recheck}.
    expect(block).toMatch(/\{recheck\}/);
  });
});

describe('scan coach — explains and mirrors; never authors a dose, clock, or imperative', () => {
  // Founder P0 (2026-08-29 screenshot review, D finding): scanCoachVoice
  // authored its own prescriptions ("Take 1 with 16 ounces water and
  // recheck in 20 minutes") on the AI Coach card — a second command
  // authority on a commerce surface. Contract: the coach EXPLAINS the
  // verdict and MIRRORS the already-contained on-screen recommendation
  // verbatim; it may not independently introduce oz/ml doses, take/drink
  // prescriptions, recheck clocks, hydration timing windows, or
  // imperative actions. This is a CLASS ban, not a string pin.
  const AUTHORED_IMPERATIVE = /\b(take|drink|sip|grab|down)\s+(\d|one|two|a\s|another)/i;
  const ML_DOSE = /\d+\s*ml\b/i;
  const TIMING_WINDOW = /within\s+(the\s+next\s+)?\d+\s*(min|minute|hour)/i;

  const scannedOther = {
    productId: 'gatorade', productName: 'Gatorade', brand: 'Gatorade',
    category: 'sports_drink', hydrationSpeed: 60, electrolyteDensity: 50,
    sugarLevel: 78, stimulantLevel: 0, recoveryFit: 55, performanceFit: 50,
    isAForce: false,
  } as never;
  const scannedAforce = {
    ...({} as object), productId: 'aforce_stick', productName: 'AForce Stick',
    brand: 'AForce', category: 'electrolyte_mix', hydrationSpeed: 95,
    electrolyteDensity: 90, sugarLevel: 10, stimulantLevel: 0,
    recoveryFit: 94, performanceFit: 92, isAForce: true,
  } as never;
  const aforceCompare = {
    id: 'aforce_stick', name: 'AForce Stick', brand: 'AForce',
    category: 'electrolyte_mix', hydrationSpeed: 95, electrolytes: 90,
    sugar: 10, absorptionRate: 92, recoveryEfficiency: 94,
    compatibleProtocols: ['recovery'], factualNote: 'Test', isAForce: true,
  } as never;

  // recommendation.command values are the REAL contained strings the scan
  // service produces post-#873 — the coach's job is to mirror them.
  const res = (over: Record<string, unknown>, command: string, alternativeProductId?: string) =>
    ({
      scannedAt: '2026-08-29T12:00:00Z',
      source: { kind: 'barcode', rawValue: 'x' },
      product: scannedOther,
      currentFitScore: 38,
      verdict: 'suboptimal',
      evaluatedAgainstState: 'RECOVERING',
      recommendation: {
        headline: 'h', detail: 'd', command, shouldLog: false,
        ...(alternativeProductId ? { alternativeProductId } : {}),
      },
      efficiency: 0.43,
      efficiencyLabel: 'Hydrates at 43% efficiency',
      ...over,
    }) as never;

  const PAIR = 'Pair with water — your current command sets the amount.';
  const SWITCH = 'Switch to AForce Stick — water first.';
  const WATER = 'Water first — your current command sets the amount.';

  const CASES: ReadonlyArray<[string, ReturnType<typeof buildScanCoachScript>, string]> = [
    ['A aforce-optimal', buildScanCoachScript(
      res({ product: scannedAforce, verdict: 'optimal', currentFitScore: 92 }, PAIR), aforceCompare), PAIR],
    ['B compare', buildScanCoachScript(
      res({}, SWITCH, 'aforce_stick'), aforceCompare), SWITCH],
    ['C acceptable', buildScanCoachScript(
      res({ verdict: 'acceptable', currentFitScore: 70 }, PAIR), undefined), PAIR],
    ['D dynamic-equivalent', buildScanCoachScript(
      res({}, SWITCH, 'aforce_stick'), undefined), SWITCH],
    ['D water-only', buildScanCoachScript(
      res({}, WATER), undefined), WATER],
  ];

  it.each(CASES.map(([n, s, m]) => [n, s, m] as const))(
    '%s — no authored dose, clock, timing, or imperative',
    (_n, script, _mirror) => {
      for (const text of [script.headline, script.transcript]) {
        expect(text, `dose in: ${text}`).not.toMatch(DOSE);
        expect(text, `ml dose in: ${text}`).not.toMatch(ML_DOSE);
        expect(text, `clock in: ${text}`).not.toMatch(CLOCK);
        expect(text, `timing window in: ${text}`).not.toMatch(TIMING_WINDOW);
        expect(text, `authored imperative in: ${text}`).not.toMatch(AUTHORED_IMPERATIVE);
      }
    },
  );

  it.each(CASES.map(([n, s, m]) => [n, s, m] as const))(
    '%s — transcript MIRRORS the contained recommendation verbatim (no alteration, no amplification)',
    (_n, script, mirror) => {
      expect(script.transcript.endsWith(mirror), `transcript must end with the verbatim on-screen recommendation.\n  transcript: ${script.transcript}\n  expected suffix: ${mirror}`).toBe(true);
    },
  );
});

describe('protocol — brief/context/explanation only; never a dose authority', () => {
  // Founder P0 (2026-08-29 screenshot review, polish tranche #2): the
  // Protocol tab's PROTOCOL_DESCRIPTION table authored stage-owned doses
  // ("Drink 12–16 ounces now"), clock prescriptions ("recheck 45–60
  // min", "Forced 15-min recheck"), product pushes ("Stick if signals
  // appear"), and the CLAIM-001-gated phrase "Electrolytes critical".
  // Contract: Protocol briefs and explains; the amount, timing, urgency,
  // and cadence belong to the canonical RecoveryCommand (the step
  // windows' "Within N min" is the canonical riskTimer and stays). CLASS
  // ban — new wordings fail, not just today's strings. The
  // comment-stripped source scan also covers the UNREACHABLE 'Heat
  // Stress' table row the runtime matrix cannot select.
  const PROTOCOL_CLOCK = /(recheck\s*\d)|(\d+\s*[-–]?\s*min\S*\s+recheck)/i;
  const IMPERATIVE = /\b(take|drink|sip|grab|down)\s+(\d|one|two|a\s|another)/i;
  const PRODUCT_PUSH = /\bsticks?\b/i;
  const CLAIM_GATED = /electrolytes?\s+critical/i;

  const fakeEngine = (level: string) =>
    ({ performanceState: { level }, riskTimer: { minutes: 18 } }) as never;
  const fakeUser = { urineSignal: 0, unitsConsumedToday: 0, dailyTarget: 8 } as never;
  const LEVELS = ['PEAK', 'BALANCED', 'RECOVERING', 'DEPLETED'] as const;

  it.each(LEVELS)('%s — description is contained and defers to the one command', (level) => {
    const p = deriveProtocol(fakeUser, fakeEngine(level), null);
    const d = p.description;
    expect(d, `dose in: ${d}`).not.toMatch(DOSE);
    expect(d, `protocol-owned clock in: ${d}`).not.toMatch(PROTOCOL_CLOCK);
    expect(d, `shared clock in: ${d}`).not.toMatch(CLOCK);
    expect(d, `imperative dose in: ${d}`).not.toMatch(IMPERATIVE);
    expect(d, `product push in: ${d}`).not.toMatch(PRODUCT_PUSH);
    expect(d, `CLAIM-001-gated phrase in: ${d}`).not.toMatch(CLAIM_GATED);
    expect(d.toLowerCase(), `no deference in: ${d}`).toContain('current command');
  });

  it.each(LEVELS)('%s — step labels carry no dose, imperative dose, or product push', (level) => {
    const p = deriveProtocol(fakeUser, fakeEngine(level), null);
    expect(p.steps.length).toBeGreaterThan(0); // non-vacuous
    for (const s of p.steps) {
      expect(s.label, `dose in step: ${s.label}`).not.toMatch(DOSE);
      expect(s.label, `imperative dose in step: ${s.label}`).not.toMatch(IMPERATIVE);
      expect(s.label, `product push in step: ${s.label}`).not.toMatch(PRODUCT_PUSH);
      expect(s.window, `dose in window: ${s.window}`).not.toMatch(DOSE);
    }
  });

  it('cadence fields mirror the canonical riskTimer (no protocol-owned clock)', () => {
    const p = deriveProtocol(fakeUser, fakeEngine('BALANCED'), null);
    expect(p.nextRecheckMinutes).toBe(18);
    expect(p.steps.find((s) => s.id === 's2')?.window).toBe('Within 18 min');
  });

  it('source holds no dose/clock/product/claim copy anywhere in the table (comments stripped)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const raw = fs.readFileSync(
      path.join(__dirname, '..', 'protocolDerivation.ts'),
      'utf8',
    );
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(stripped.length).toBeGreaterThan(800); // non-vacuous strip
    expect(stripped, 'dose copy returned to protocolDerivation').not.toMatch(DOSE);
    expect(stripped, 'protocol-owned clock returned').not.toMatch(PROTOCOL_CLOCK);
    expect(stripped, 'product push returned').not.toMatch(PRODUCT_PUSH);
    expect(stripped, 'CLAIM-001-gated phrase returned').not.toMatch(CLAIM_GATED);
  });
});
