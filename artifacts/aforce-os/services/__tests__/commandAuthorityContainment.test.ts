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
 */
import { describe, expect, it } from 'vitest';

import { evaluateHeatRisk } from '../heatRiskEngine';
import { buildHeatSignalInput } from '../heatGuardInput';
import { HEAT_PROTOCOLS } from '../heatProtocolService';
import { buildRecommendation } from '../hydrationScanService';
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
