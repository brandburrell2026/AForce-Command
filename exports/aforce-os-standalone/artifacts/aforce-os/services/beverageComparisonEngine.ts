/**
 * Beverage Comparison Engine.
 *
 * Pure scoring layer powering the AForce HydroScan "Compare vs Competitors"
 * screen. Given two `BeverageProfile`s it produces:
 *   - a 0-100 score per metric category (electrolytes, sugar burden, clean
 *     ingredients, functional adders, alkaline lift)
 *   - a weighted total per beverage
 *   - a winner verdict + per-metric "wins"
 *
 * Deliberately deterministic + side-effect-free so it can be unit tested
 * without React, the store, or the network. The UI just renders what the
 * engine returns.
 */

import type { BeverageProfile } from '../data/beverageCompetitors';

export type MetricKey =
  | 'electrolytes'
  | 'sugar'
  | 'clean'
  | 'functional'
  | 'alkaline';

export interface MetricScore {
  key: MetricKey;
  /** Human label for the UI row. */
  label: string;
  /** 0-100, higher is better. */
  score: number;
  /** What the panel actually says (e.g. "21g sugar"). */
  display: string;
  /** Free-form one-liner describing why this score (UI subtitle). */
  detail: string;
}

export interface BeverageScorecard {
  profile: BeverageProfile;
  metrics: MetricScore[];
  /** Weighted 0-100 total. */
  total: number;
}

export interface ComparisonResult {
  aforce: BeverageScorecard;
  competitor: BeverageScorecard;
  /** Per-metric winner — 'aforce' | 'competitor' | 'tie'. */
  metricWinners: Record<MetricKey, 'aforce' | 'competitor' | 'tie'>;
  /** Overall winner. */
  winner: 'aforce' | 'competitor' | 'tie';
  /** Point spread (positive = AForce ahead). */
  spread: number;
}

// Weights sum to 1.0. Electrolytes + clean ingredients weighted highest
// because they're the biggest performance + health levers AForce competes on.
const WEIGHTS: Record<MetricKey, number> = {
  electrolytes: 0.28,
  sugar:        0.22,
  clean:        0.20,
  functional:   0.18,
  alkaline:     0.12,
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Electrolyte score — sodium + potassium + magnesium normalized against an
 * "ideal performance load" (1500mg combined). Anything past 100 caps at 100
 * so a single mega-dose of sodium can't dominate the rubric.
 */
function electrolyteScore(p: BeverageProfile): MetricScore {
  const total = p.metrics.sodiumMg + p.metrics.potassiumMg + p.metrics.magnesiumMg;
  const score = clamp((total / 1500) * 100);
  return {
    key: 'electrolytes',
    label: 'Electrolyte Load',
    score: round(score),
    display: `${total}mg total`,
    detail: `Na ${p.metrics.sodiumMg} · K ${p.metrics.potassiumMg} · Mg ${p.metrics.magnesiumMg}`,
  };
}

/**
 * Sugar score — inverse. 0g = 100, every gram subtracts ~5pts. Added sugar
 * gets a small additional penalty so reformulated "lower-sugar but still
 * added" SKUs score below true zero-sugar formulas.
 */
function sugarScore(p: BeverageProfile): MetricScore {
  const base = 100 - p.metrics.sugarG * 5;
  const penalty = p.metrics.addedSugarG > 0 ? 5 : 0;
  const score = clamp(base - penalty);
  return {
    key: 'sugar',
    label: 'Sugar Burden',
    score: round(score),
    display: `${p.metrics.sugarG}g sugar`,
    detail: p.metrics.addedSugarG > 0
      ? `${p.metrics.addedSugarG}g added · ${p.metrics.caloriesKcal} kcal`
      : `Zero added sugar · ${p.metrics.caloriesKcal} kcal`,
  };
}

/**
 * Clean-label score — 100 if no artificial colors AND no artificial
 * sweeteners, 50 if one of the two, 0 if both. This is the simplest signal
 * users actually care about on a back-of-pack scan.
 */
function cleanScore(p: BeverageProfile): MetricScore {
  const hits =
    (p.metrics.artificialColors ? 1 : 0) +
    (p.metrics.artificialSweeteners ? 1 : 0);
  const score = hits === 0 ? 100 : hits === 1 ? 50 : 0;
  const flags: string[] = [];
  if (p.metrics.artificialColors) flags.push('artificial colors');
  if (p.metrics.artificialSweeteners) flags.push('artificial sweeteners');
  return {
    key: 'clean',
    label: 'Clean Label',
    score: round(score),
    display: flags.length === 0 ? 'No artificial inputs' : flags.join(' + '),
    detail: flags.length === 0
      ? 'No artificial colors or sweeteners.'
      : `Contains ${flags.join(' and ')}.`,
  };
}

/**
 * Functional-ingredients score — 25 pts per adder, capped at 100. Caps at
 * 4 so a "kitchen sink" label can't run away with the rubric — diminishing
 * returns past four meaningful functional inputs.
 */
function functionalScore(p: BeverageProfile): MetricScore {
  const count = p.metrics.functionalIngredients.length;
  const score = clamp(count * 25);
  return {
    key: 'functional',
    label: 'Functional Stack',
    score: round(score),
    display: count === 0 ? 'None listed' : `${count} adders`,
    detail: count === 0
      ? 'Standard electrolytes only.'
      : p.metrics.functionalIngredients.join(' · '),
  };
}

/**
 * Alkaline score — pH ≥ 9 is highly alkaline (the AForce thesis), 7-9 is
 * neutral-to-mild, < 7 is acidic. Most competitors land in the 3-5 range.
 */
function alkalineScore(p: BeverageProfile): MetricScore {
  const ph = p.metrics.alkalinePh;
  const score = ph >= 9 ? 100 : ph >= 7.5 ? 75 : ph >= 6.5 ? 55 : ph >= 4.5 ? 30 : 10;
  const tier =
    ph >= 9 ? 'Highly alkaline' :
    ph >= 7.5 ? 'Mild alkaline' :
    ph >= 6.5 ? 'Neutral' :
    ph >= 4.5 ? 'Acidic' : 'Highly acidic';
  return {
    key: 'alkaline',
    label: 'Alkaline Lift',
    score: round(score),
    display: `pH ~${ph}`,
    detail: `${tier} liquid.`,
  };
}

export function scoreBeverage(p: BeverageProfile): BeverageScorecard {
  const metrics: MetricScore[] = [
    electrolyteScore(p),
    sugarScore(p),
    cleanScore(p),
    functionalScore(p),
    alkalineScore(p),
  ];
  const total = round(
    metrics.reduce((sum, m) => sum + m.score * WEIGHTS[m.key], 0),
  );
  return { profile: p, metrics, total };
}

export function compareBeverages(
  aforce: BeverageProfile,
  competitor: BeverageProfile,
): ComparisonResult {
  const a = scoreBeverage(aforce);
  const c = scoreBeverage(competitor);

  const metricWinners = {} as Record<MetricKey, 'aforce' | 'competitor' | 'tie'>;
  for (const m of a.metrics) {
    const cm = c.metrics.find((x) => x.key === m.key)!;
    metricWinners[m.key] =
      m.score > cm.score ? 'aforce' :
      m.score < cm.score ? 'competitor' : 'tie';
  }

  const spread = round(a.total - c.total);
  const winner: ComparisonResult['winner'] =
    spread > 0.1 ? 'aforce' :
    spread < -0.1 ? 'competitor' : 'tie';

  return { aforce: a, competitor: c, metricWinners, winner, spread };
}
