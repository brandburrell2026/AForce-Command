/**
 * HydroState v1.0 — THE EXECUTABLE MODEL CONTRACT (founder ruling R1, 2026-09-01).
 *
 * WHY THIS FILE IS PERMANENT. The v1.0 candidate previously existed only as prose in
 * design documents plus a temporary harness that was deleted before commit. When the
 * founder asked for the equation, it was restated from memory as an exponential
 * saturation — a form that was never executed and reproduces none of the measured
 * figures. That failure is only possible when the model has no executable home.
 *
 * So this file IS the model of record. It ties, in one runnable place:
 *     equation → representative inputs → component waterfall → HydroState → band/confidence
 * The printed tables are the sensitivity evidence; the assertions below them are the
 * contract. Neither may be deleted as scratch.
 *
 * CANDIDATE LABELLING (founder ruling R4). Two urine candidates are live and NOT
 * interchangeable. Every table names the candidate it was produced under. There is no
 * default: `urineCandidate` is a required input, so no result can be produced without
 * declaring which model it represents.
 *
 *   A — the ASYMMETRIC form that was actually executed and that produced every measured
 *       figure in the architecture artifact. Reference candidate only (R4); NOT approved
 *       production truth.
 *   B — "Variant C", the symmetric form. Its prior approval rested on incomplete
 *       measurement and is reopened (R2).
 *
 * NOT IMPLEMENTED. Nothing here is wired to the production engine. `HYDROSTATE_MODEL_VERSION`
 * remains 'hydrostate-v0'; this file evaluates a candidate and asserts its properties.
 */
import { describe, it, expect } from 'vitest';
import { absorptionEfficiency } from '@/services/hydrationScoreService';
import { depletionRatePerMinute } from '@/utils/depletionRate';
import {
  HYDROSTATE_V1_VOLUME_CEILING,
  HYDROSTATE_PEAK_THRESHOLD,
} from '@/config/hydroStateModel';

const R_DEFAULT = 96;
const PEAK_T = 90, BAL_T = 75, REC_T = 60;
const VOLUME_CEILING = PEAK_T - 1;   // 89 — derived, so volume alone tops out below PEAK
const COVERAGE_CAP = 1.0;

/**
 * The production API accepts urineSignal 1..8 ONLY
 * (`z.number().int().min(1).max(8)`, api-server/src/routes/aforce/status.ts:35);
 * the column is NOT NULL DEFAULT 3. 0 is unreachable in production and appears only in
 * demo/test fixtures, where it denotes "no urine signal" — i.e. UNOBSERVED. See the
 * R3 block below for the evidence and the consequence.
 */
const API_MIN = 1, API_MAX = 8;

type UrineCandidate =
  | 'A_asymmetric_executed'
  | 'B_variantC_symmetric'
  | 'B_variantC_clamped'
  | 'C_observed_gated';

interface Ev { oz: number; minAgo: number }

function absorbedOz(evs: Ev[]): number {
  let total = 0;
  const sorted = [...evs].sort((a, b) => b.minAgo - a.minAgo);
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i]!;
    const prev = sorted.slice(0, i)
      .filter((p) => p.minAgo - e.minAgo <= 20 && p.minAgo >= e.minAgo)
      .reduce((a, p) => a + p.oz / 12, 0);
    const eff = absorptionEfficiency(prev, e.oz / 12);
    const capped = e.oz * eff;
    const imm = capped * 0.6, del = capped * 0.4;
    total += imm + (e.minAgo >= 12.5 ? del : del * (e.minAgo / 12.5));
  }
  return total;
}

/** `null` = not observed. Never coerced to a number — that is the R3 defect. */
type Urine = number | null;

interface UrineResult { points: number; observed: boolean; corroborates: boolean; contradicts: boolean }

function urineTerm(u: Urine, candidate: UrineCandidate): UrineResult {
  // An unobserved signal is not an observation of anything. It earns no points and
  // corroborates nothing, under every candidate.
  if (u == null) return { points: 0, observed: false, corroborates: false, contradicts: false };

  const inRange = Number.isInteger(u) && u >= API_MIN && u <= API_MAX;
  const favourable = inRange && u <= 2;
  const adverse = inRange && u >= 5;

  let points: number;
  switch (candidate) {
    case 'A_asymmetric_executed':
      // penalty above neutral, plus a flat step bonus at or below 2
      points = -Math.max(0, u - 3) * 4 + (u <= 2 ? 4 : 0);
      break;
    case 'B_variantC_symmetric':
      points = 4 * (3 - u);
      break;
    case 'B_variantC_clamped':
      points = Math.max(-20, Math.min(8, 4 * (3 - u)));
      break;
    case 'C_observed_gated':
      // Variant C, but only over values production can actually produce. Anything
      // outside 1..8 is treated as unobserved rather than as an extreme observation.
      points = inRange ? Math.max(-20, Math.min(8, 4 * (3 - u))) : 0;
      break;
  }
  return {
    points,
    observed: candidate === 'C_observed_gated' ? inRange : true,
    corroborates: favourable,
    contradicts: adverse,
  };
}

interface Inputs {
  evs: Ev[]; R?: number; minutesSinceLast: number;
  urine: Urine; urineCandidate: UrineCandidate;          // required — R4
  symptomState: 'none' | 'mild' | 'moderate' | 'severe'; symptomCount: number;
  hrv?: number | null; sleepH?: number | null;
  activityLevel: number; heatLoad: number; bodyWeightLbs?: number;
  streak: number; confirmed?: boolean;
  /** R6: count "no symptoms" as corroborating evidence? The executed model does. */
  countAbsenceAsCorroboration?: boolean;
  /** R6: require N independent signals for high confidence. Executed model: 2. */
  corroborationThreshold?: number;
  /** R5: freshness window in minutes. Executed model: 120. */
  freshnessWindowMin?: number;
  /** R5 isolation: hold losses at this many minutes so only the GATE moves. */
  lossMinutesOverride?: number;
}

function v1(i: Inputs) {
  const R = i.R ?? R_DEFAULT;
  const oz = absorbedOz(i.evs);
  const coverage = Math.min(COVERAGE_CAP, oz / R);
  const pVolume = VOLUME_CEILING * coverage;

  const rate = depletionRatePerMinute({
    bodyWeightLbs: i.bodyWeightLbs ?? 180, activityLevel: i.activityLevel,
    weatherTempC: null, weatherHumidity: null, heatLoad: i.heatLoad,
    isAwake: true, clutchActive: false, socialDecayMultiplier: 1,
  });
  const lossMin = i.lossMinutesOverride ?? i.minutesSinceLast;
  const losses = rate * Math.max(0, lossMin);

  const u = urineTerm(i.urine, i.urineCandidate);

  const sym = (i.symptomState === 'severe' ? -22 : i.symptomState === 'moderate' ? -14
    : i.symptomState === 'mild' ? -6 : 0) - Math.min(8, i.symptomCount * 2);

  let bio = 0, bioSignals = 0;
  if (i.hrv != null) { bioSignals++; bio += i.hrv >= 60 ? 5 : i.hrv >= 40 ? 2 : i.hrv >= 30 ? 0 : -5; }
  if (i.sleepH != null) { bioSignals++; bio += (i.sleepH >= 7 && i.sleepH <= 9) ? 5 : i.sleepH >= 6 ? 2 : i.sleepH >= 4 ? -3 : -5; }
  bio = Math.max(-10, Math.min(10, bio));

  const raw = pVolume - losses + u.points + sym + bio;
  const H = Math.max(0, Math.min(100, Math.round(raw)));

  const freshWindow = i.freshnessWindowMin ?? 120;
  const freshEvidence = i.minutesSinceLast <= freshWindow;

  // Independent eligible evidence. A wearable is ONE signal however many fields it
  // reports (hrv + sleep both come from the same device and the same night).
  const countAbsence = i.countAbsenceAsCorroboration ?? true;
  const evidenceSignals = (u.corroborates ? 1 : 0) + (bioSignals > 0 ? 1 : 0);
  const absenceSignals = (i.symptomState === 'none' ? 1 : 0);
  const corroborating = evidenceSignals + (countAbsence ? absenceSignals : 0);
  const contradiction = (u.contradicts ? 1 : 0) + (i.symptomState !== 'none' ? 1 : 0);

  const threshold = i.corroborationThreshold ?? 2;
  const confidence = !freshEvidence ? 'low'
    : contradiction > 0 ? 'low'
    : corroborating >= threshold ? 'high' : 'medium';

  let band: string;
  if (H >= PEAK_T && confidence === 'high') band = 'PEAK';
  else if (H >= BAL_T || (H >= PEAK_T && confidence !== 'high')) band = 'BALANCED';
  else if (H >= REC_T) band = 'RECOVERING';
  else band = 'DEPLETED';

  return { H, band, confidence, corroborating, evidenceSignals, absenceSignals,
    contradiction, coverage, pVolume, losses, rate, urine: u, sym, bio, bioSignals,
    raw, absorbed: oz, freshEvidence, clamped: Math.round(raw) > 100 };
}

function day(pct: number, R = R_DEFAULT, lastMin = 10): Ev[] {
  const oz = R * pct;
  if (oz <= 0) return [];
  const n = Math.max(1, Math.round(oz / 16));
  return Array.from({ length: n }, (_, k) => ({ oz: oz / n, minAgo: lastMin + k * 45 }));
}

const NEUTRAL = {
  urine: 3 as Urine, symptomState: 'none' as const, symptomCount: 0,
  activityLevel: 3, heatLoad: 0, streak: 0,
  urineCandidate: 'A_asymmetric_executed' as UrineCandidate,
};
const WEARABLE = { hrv: 65, sleepH: 8 };
const f2 = (n: number) => n.toFixed(2);
const CANDIDATES: UrineCandidate[] = [
  'A_asymmetric_executed', 'B_variantC_symmetric', 'B_variantC_clamped', 'C_observed_gated',
];

// ═════════════════════════ R2 — urine candidate comparison ═════════════════════════

describe('R2 — candidate A (executed asymmetric) vs candidate B (Variant C)', () => {
  it('point contribution at every supported and unsupported urine input', () => {
    console.log('###R2_POINTS');
    console.log('u\tstatus\t\tA_exec\tB_symm\tB_clamp\tC_gated');
    const inputs: Array<[Urine, string]> = [
      [null, 'UNOBSERVED'], [0, 'OUT-OF-RANGE'],
      [1, 'api 1..8'], [2, 'api 1..8'], [3, 'api 1..8 (neutral)'], [4, 'api 1..8'],
      [5, 'api 1..8'], [6, 'api 1..8'], [7, 'api 1..8'], [8, 'api 1..8'],
      [9, 'OUT-OF-RANGE'],
    ];
    for (const [u, status] of inputs) {
      const pts = CANDIDATES.map((c) => urineTerm(u, c).points);
      console.log(`${u === null ? 'null' : u}\t${status.padEnd(14)}\t${pts.join('\t')}`);
    }
  });

  it('band / confidence / PEAK reachability under each candidate, wearable and not', () => {
    console.log('###R2_BANDS');
    console.log('u\tcand\t\t\twear\tH\tband\t\tconf\tcorrob\tcontra');
    for (const u of [null, 0, 1, 2, 3, 5, 8] as Urine[])
      for (const c of CANDIDATES)
        for (const wear of [false, true]) {
          const r = v1({ ...NEUTRAL, urine: u, urineCandidate: c,
            evs: day(1.1, R_DEFAULT, 5), minutesSinceLast: 5, ...(wear ? WEARABLE : {}) });
          console.log(`${u === null ? 'null' : u}\t${c.padEnd(22)}\t${wear ? 'Y' : 'n'}\t${r.H}\t${r.band.padEnd(10)}\t${r.confidence}\t${r.corroborating}\t${r.contradiction}`);
        }
  });

  it('PEAK reachability WITHOUT a wearable, per candidate', () => {
    console.log('###R2_PEAK_NOWEAR');
    for (const c of CANDIDATES) {
      let best = -1, at = 'UNREACHABLE';
      for (const pct of [1.0, 1.05, 1.1, 1.25, 1.5])
        for (const last of [1, 5, 10, 30, 60])
          for (const u of [1, 2, 3] as Urine[])
            for (const act of [0, 1, 3]) {
              const r = v1({ ...NEUTRAL, urine: u, urineCandidate: c, activityLevel: act,
                evs: day(pct, R_DEFAULT, last), minutesSinceLast: last });
              if (r.band === 'PEAK' && r.H > best) {
                best = r.H; at = `H=${r.H} at ${(pct * 100).toFixed(0)}% last=${last}m u=${u} act=${act}`;
              }
            }
      console.log(`${c.padEnd(24)}\t${at}`);
    }
  });

  it('safety edges — a dark signal must never be rescued by volume', () => {
    console.log('###R2_SAFETY');
    for (const c of CANDIDATES)
      for (const u of [5, 8] as Urine[]) {
        const r = v1({ ...NEUTRAL, urine: u, urineCandidate: c, ...WEARABLE,
          evs: day(2.0, R_DEFAULT, 1), minutesSinceLast: 1 });
        console.log(`${c.padEnd(24)}\tu=${u}\t200% volume + wearable → H=${r.H}\t${r.band}\tconf=${r.confidence}\tcontra=${r.contradiction}`);
      }
  });
});

// ═════════════════════════ R3 — the u=0 ruling, executable ═════════════════════════

describe('R3 — urineSignal 0 is not a physiological observation', () => {
  it('production cannot emit 0, so 0 can only mean unobserved or invalid', () => {
    // Authoritative range, quoted from the API validator.
    expect(API_MIN).toBe(1);
    expect(API_MAX).toBe(8);
  });

  it('UNKNOWN must not be scored as EXTREMELY GOOD — which A and B both do', () => {
    console.log('###R3_UNKNOWN');
    for (const c of CANDIDATES) {
      const zero = urineTerm(0, c).points;
      const best = urineTerm(1, c).points;   // the best REAL observation
      const flag = zero >= best ? '  ← unobserved scores at or above the best real reading' : '';
      console.log(`${c.padEnd(24)}\tu=0 → ${zero >= 0 ? '+' : ''}${zero}\tbest real (u=1) → +${best}${flag}`);
    }
    // The defect, pinned: both live candidates award favourable points to a value
    // production cannot produce and that the only self-documenting fixture calls
    // "no urine signal".
    expect(urineTerm(0, 'A_asymmetric_executed').points).toBeGreaterThan(0);
    expect(urineTerm(0, 'B_variantC_symmetric').points).toBeGreaterThan(
      urineTerm(1, 'B_variantC_symmetric').points,
    );
    // The gated candidate is the only one that refuses to invent physiology.
    expect(urineTerm(0, 'C_observed_gated').points).toBe(0);
    expect(urineTerm(null, 'C_observed_gated').observed).toBe(false);
    expect(urineTerm(0, 'C_observed_gated').corroborates).toBe(false);
  });
});

// ═════════════════════════ R5 — freshness sensitivity ═════════════════════════

describe('R5 — the 120-minute freshness window (PROVISIONAL)', () => {
  it('coupled sensitivity: staleness moves BOTH losses and the gate', () => {
    console.log('###R5_COUPLED');
    console.log('min\twear\tH\tband\t\tconf\tfresh\tlosses');
    for (const last of [30, 60, 90, 120, 180, 240])
      for (const wear of [false, true]) {
        const r = v1({ ...NEUTRAL, urine: 2, evs: day(1.1, R_DEFAULT, last),
          minutesSinceLast: last, ...(wear ? WEARABLE : {}) });
        console.log(`${last}\t${wear ? 'Y' : 'n'}\t${r.H}\t${r.band.padEnd(10)}\t${r.confidence}\t${r.freshEvidence ? 'Y' : 'n'}\t${f2(-r.losses)}`);
      }
  });

  it('gate-isolated sensitivity: losses held constant, only the window moves', () => {
    console.log('###R5_ISOLATED');
    console.log('min\twear\tH\tband\t\tconf\tPEAK-eligible');
    for (const last of [30, 60, 90, 120, 180, 240])
      for (const wear of [false, true]) {
        const r = v1({ ...NEUTRAL, urine: 2, evs: day(1.1, R_DEFAULT, 10),
          minutesSinceLast: last, lossMinutesOverride: 10, ...(wear ? WEARABLE : {}) });
        console.log(`${last}\t${wear ? 'Y' : 'n'}\t${r.H}\t${r.band.padEnd(10)}\t${r.confidence}\t${r.band === 'PEAK' ? 'Y' : 'n'}`);
      }
  });

  it('where the window would have to move to change any outcome', () => {
    console.log('###R5_WINDOW');
    console.log('window\tPEAK@90m\tPEAK@120m\tPEAK@180m\tPEAK@240m');
    for (const w of [60, 90, 120, 180, 240, 360]) {
      const at = (m: number) => v1({ ...NEUTRAL, urine: 2, ...WEARABLE,
        evs: day(1.1, R_DEFAULT, 10), minutesSinceLast: m, lossMinutesOverride: 10,
        freshnessWindowMin: w }).band === 'PEAK' ? 'Y' : 'n';
      console.log(`${w}\t${at(90)}\t\t${at(120)}\t\t${at(180)}\t\t${at(240)}`);
    }
  });

  it('stale urine vs stale biometrics are indistinguishable to the model', () => {
    console.log('###R5_STALENESS_BLINDNESS');
    // The model has ONE freshness clock: minutesSinceLast (intake recency). Neither the
    // urine reading nor the biometric sample carries its own timestamp here.
    const a = v1({ ...NEUTRAL, urine: 2, ...WEARABLE, evs: day(1.1, R_DEFAULT, 10),
      minutesSinceLast: 10, lossMinutesOverride: 10 });
    console.log(`fresh intake, urine+bio of UNKNOWN age → H=${a.H} ${a.band} conf=${a.confidence}`);
    console.log('NOTE: urine and biometric readings have no independent age in this model;');
    console.log('a 3-day-old urine observation is treated exactly like one taken now.');
  });
});

// ═════════════════════════ R6 — corroboration sensitivity ═════════════════════════

describe('R6 — the two-signal corroboration rule (PROVISIONAL)', () => {
  it('what actually counts as a signal today', () => {
    console.log('###R6_SIGNALS');
    console.log('scenario\t\t\t\tevidence\tabsence\ttotal\tconf\tband');
    const scen: Array<[string, Partial<Inputs>]> = [
      ['nothing but neutral urine', { urine: 3 }],
      ['favourable urine only', { urine: 2 }],
      ['wearable only', { urine: 3, ...WEARABLE }],
      ['favourable urine + wearable', { urine: 2, ...WEARABLE }],
      ['unobserved urine + wearable', { urine: null, ...WEARABLE }],
      ['favourable urine + mild symptoms', { urine: 2, symptomState: 'mild', symptomCount: 1 }],
    ];
    for (const [label, over] of scen) {
      const r = v1({ ...NEUTRAL, evs: day(1.1, R_DEFAULT, 5), minutesSinceLast: 5, ...over });
      console.log(`${label.padEnd(36)}\t${r.evidenceSignals}\t\t${r.absenceSignals}\t${r.corroborating}\t${r.confidence}\t${r.band}`);
    }
  });

  it('threshold sweep: 1 / 2 / 3 signals, and absence counted or not', () => {
    console.log('###R6_THRESHOLD');
    console.log('thr\tabsence\tno-wearable PEAK\twearable PEAK\tfalse-PEAK exposure');
    for (const thr of [1, 2, 3])
      for (const countAbsence of [true, false]) {
        const noWear = v1({ ...NEUTRAL, urine: 2, evs: day(1.1, R_DEFAULT, 5),
          minutesSinceLast: 5, corroborationThreshold: thr, countAbsenceAsCorroboration: countAbsence });
        const wear = v1({ ...NEUTRAL, urine: 2, ...WEARABLE, evs: day(1.1, R_DEFAULT, 5),
          minutesSinceLast: 5, corroborationThreshold: thr, countAbsenceAsCorroboration: countAbsence });
        // false-PEAK exposure: high confidence carried by NO real observation at all
        const bare = v1({ ...NEUTRAL, urine: null, evs: day(1.1, R_DEFAULT, 5),
          minutesSinceLast: 5, corroborationThreshold: thr, countAbsenceAsCorroboration: countAbsence });
        console.log(`${thr}\t${countAbsence ? 'counted' : 'ignored'}\t${noWear.band === 'PEAK' ? 'Y' : 'n'}\t\t\t${wear.band === 'PEAK' ? 'Y' : 'n'}\t\t${bare.confidence === 'high' ? 'HIGH conf on zero observations' : 'none'}`);
      }
  });

  it('duplicate representation: one device, two fields', () => {
    console.log('###R6_DUPLICATE');
    const hrvOnly = v1({ ...NEUTRAL, urine: 3, hrv: 65, evs: day(1.1, R_DEFAULT, 5), minutesSinceLast: 5 });
    const both = v1({ ...NEUTRAL, urine: 3, ...WEARABLE, evs: day(1.1, R_DEFAULT, 5), minutesSinceLast: 5 });
    console.log(`hrv only        → bio=${f2(hrvOnly.bio)} signals=${hrvOnly.evidenceSignals} H=${hrvOnly.H}`);
    console.log(`hrv + sleep     → bio=${f2(both.bio)} signals=${both.evidenceSignals} H=${both.H}`);
    console.log('counted as ONE signal (correct) but contributes DOUBLE points from one device.');
  });

  it('missing and conflicting data', () => {
    console.log('###R6_MISSING_CONFLICT');
    const missing = v1({ ...NEUTRAL, urine: null, evs: day(1.1, R_DEFAULT, 5), minutesSinceLast: 5 });
    const conflict = v1({ ...NEUTRAL, urine: 7, ...WEARABLE, evs: day(1.1, R_DEFAULT, 5), minutesSinceLast: 5 });
    const conflict2 = v1({ ...NEUTRAL, urine: 1, symptomState: 'moderate', symptomCount: 2,
      evs: day(1.1, R_DEFAULT, 5), minutesSinceLast: 5 });
    console.log(`no urine observed          → H=${missing.H} ${missing.band} conf=${missing.confidence} corrob=${missing.corroborating}`);
    console.log(`dark urine + good wearable → H=${conflict.H} ${conflict.band} conf=${conflict.confidence} contra=${conflict.contradiction}`);
    console.log(`clear urine + symptoms     → H=${conflict2.H} ${conflict2.band} conf=${conflict2.confidence} contra=${conflict2.contradiction}`);
  });
});

// ═════════════════════ R7 — the verified model facts, pinned ═════════════════════

describe('R7 — verified properties of the candidate (model behaviour, not clinical claims)', () => {
  const neutral100 = () => v1({ ...NEUTRAL, evs: day(1.0), minutesSinceLast: 10 });

  it('volume uses absorbed ounces over the personalized requirement', () => {
    const r = neutral100();
    expect(r.absorbed).toBeLessThan(96);            // absorbed < logged
    expect(r.absorbed).toBeCloseTo(94.72, 2);
    expect(r.coverage).toBeCloseTo(94.72 / 96, 4);
  });

  it('a HARD CAP, not an exponential asymptote — the derivative past it is exactly 0', () => {
    const a = v1({ ...NEUTRAL, evs: day(1.5), minutesSinceLast: 10 });
    const b = v1({ ...NEUTRAL, evs: day(20.0), minutesSinceLast: 10 });
    expect(a.pVolume).toBe(VOLUME_CEILING);
    expect(b.pVolume).toBe(VOLUME_CEILING);
    expect(b.H - a.H).toBe(0);                       // exactly flat, 150% → 2000%
  });

  it('the volume ceiling is 89 and volume ALONE cannot reach PEAK', () => {
    expect(VOLUME_CEILING).toBe(89);
    expect(VOLUME_CEILING).toBeLessThan(PEAK_T);
    const volumeOnly = v1({ ...NEUTRAL, evs: day(5.0, R_DEFAULT, 1), minutesSinceLast: 1 });
    expect(volumeOnly.band).not.toBe('PEAK');
  });

  it('saturation lands just past target, near 101.35%', () => {
    const below = v1({ ...NEUTRAL, evs: day(1.01), minutesSinceLast: 10 });
    const above = v1({ ...NEUTRAL, evs: day(1.02), minutesSinceLast: 10 });
    expect(below.coverage).toBeLessThan(COVERAGE_CAP);
    expect(above.coverage).toBe(COVERAGE_CAP);
  });

  it('neutral at 100% of target ≈ 83, BALANCED', () => {
    const r = neutral100();
    expect(r.H).toBe(83);
    expect(r.band).toBe('BALANCED');
  });

  it('fully corroborated at neutral activity ≈ 97, PEAK', () => {
    const r = v1({ ...NEUTRAL, urine: 2, ...WEARABLE, evs: day(1.0), minutesSinceLast: 10 });
    expect(r.H).toBe(97);
    expect(r.band).toBe('PEAK');
  });

  it('brand contributes exactly zero physiological points — structurally', () => {
    // The model takes no fluidType, no flavor and no product identity of any kind.
    // This is enforced by the shape of `Inputs`, not by a runtime comparison: there is
    // no field to set. Two identical volumes are identical inputs by construction.
    const src = v1.toString() + urineTerm.toString() + absorbedOz.toString();
    expect(src).not.toMatch(/fluidType|aforce|flavor|brand/i);
  });
});

// ═══════════════ RULING 8 — THE SHIPPED MODEL, NOT A LOCAL COPY ═══════════════
//
// Everything above explores the CANDIDATE using a local restatement, which is
// what made the sensitivity sweeps possible. That is also its weakness: a local
// copy can drift from the code that actually runs, and a contract that tests a
// copy of the model proves nothing about the model.
//
// This block therefore asserts the twelve cases the founder enumerated against
// the SHIPPED functions — `urineContribution`, `evaluateEvidence`,
// `resolveStateV1` — imported from production source. If the implementation and
// the explored candidate ever disagree, these fail.

import {
  urineContribution as shippedUrine,
  evaluateEvidence as shippedEvidence,
  resolveStateV1 as shippedBand,
  isObservedUrine,
} from '../scoring/hydroStateV1';

const noSymptoms = 'none' as const;
const ev = (over: Partial<Parameters<typeof shippedEvidence>[0]> = {}) => shippedEvidence({
  urine: shippedUrine(3),
  biometricsPresent: false, biometricsFavourable: false, biometricsAdverse: false,
  symptomState: noSymptoms, minutesSinceLastIntake: 10, ...over,
});

describe('MODEL CONTRACT — the shipped v1.0 rules', () => {
  it('u=0 contributes zero and corroborates nothing', () => {
    const u = shippedUrine(0);
    expect(u.points).toBe(0);
    expect(u.observed).toBe(false);
    expect(u.corroborates).toBe(false);
    // and it must never out-earn the best real reading
    expect(u.points).toBeLessThan(shippedUrine(1).points);
  });

  it('valid u=1 → +8, u=2 → +4, u=3 → 0', () => {
    expect(shippedUrine(1).points).toBe(8);
    expect(shippedUrine(2).points).toBe(4);
    expect(shippedUrine(3).points).toBe(0);
  });

  it('the negative direction runs through the valid range and clamps', () => {
    expect(shippedUrine(4).points).toBe(-4);
    expect(shippedUrine(5).points).toBe(-8);
    expect(shippedUrine(6).points).toBe(-12);
    expect(shippedUrine(7).points).toBe(-16);
    expect(shippedUrine(8).points).toBe(-20);
    // out of range in the adverse direction is ALSO unobserved, not -24
    expect(shippedUrine(9).points).toBe(0);
    expect(isObservedUrine(9)).toBe(false);
    expect(isObservedUrine(0)).toBe(false);
    expect(isObservedUrine(1)).toBe(true);
    expect(isObservedUrine(8)).toBe(true);
    expect(isObservedUrine(null)).toBe(false);
    expect(isObservedUrine(2.5)).toBe(false);
  });

  it('PEAK is reachable WITHOUT a wearable, on valid positive urine alone', () => {
    const v = ev({ urine: shippedUrine(2) });
    expect(v.positiveCorroborations).toBe(1);
    expect(v.peakEligible).toBe(true);
    expect(shippedBand(93, v)).toBe('PEAK');
    // ruling 5: no hardware paywall on physiology
    expect(v.observedSources).toBe(1);
  });

  it('PEAK is reachable WITH a wearable', () => {
    const v = ev({ biometricsPresent: true, biometricsFavourable: true });
    expect(v.peakEligible).toBe(true);
    expect(shippedBand(93, v)).toBe('PEAK');
  });

  it('volume alone NEVER produces PEAK', () => {
    // No positive physiological observation of any kind.
    const v = ev();
    expect(v.positiveCorroborations).toBe(0);
    expect(v.peakEligible).toBe(false);
    expect(shippedBand(100, v)).toBe('BALANCED');
    // and structurally: the ceiling is below the threshold, so even a perfect
    // volume score cannot reach 90 without a positive term.
    expect(HYDROSTATE_V1_VOLUME_CEILING).toBeLessThan(HYDROSTATE_PEAK_THRESHOLD);
  });

  it('"no symptoms" alone is NOT positive corroboration', () => {
    const v = ev({ symptomState: 'none' });
    expect(v.materialContradiction).toBe(false);   // it is the absence of contradiction
    expect(v.positiveCorroborations).toBe(0);      // but it measures nothing
    expect(v.peakEligible).toBe(false);
    expect(shippedBand(95, v)).toBe('BALANCED');
  });

  it('a missing wearable does not penalise HydroState', () => {
    const withOut = ev({ urine: shippedUrine(2) });
    const withIt = ev({ urine: shippedUrine(2), biometricsPresent: true, biometricsFavourable: true });
    // Same score, same band. The wearable buys CONFIDENCE, not points or rank.
    expect(shippedBand(92, withOut)).toBe('PEAK');
    expect(shippedBand(92, withIt)).toBe('PEAK');
    expect(withOut.confidence).toBe('medium');
    expect(withIt.confidence).toBe('high');
  });

  it('contradictory evidence suppresses PEAK', () => {
    const darkUrine = ev({ urine: shippedUrine(6), biometricsPresent: true, biometricsFavourable: true });
    expect(darkUrine.materialContradiction).toBe(true);
    expect(darkUrine.peakEligible).toBe(false);
    expect(shippedBand(95, darkUrine)).toBe('BALANCED');   // crosses 90, refused
    const symptomatic = ev({ urine: shippedUrine(1), symptomState: 'moderate' });
    expect(symptomatic.peakEligible).toBe(false);
    expect(shippedBand(95, symptomatic)).toBe('BALANCED');
  });

  it('MISSING evidence does not act as contradiction', () => {
    const nothing = ev({ urine: shippedUrine(0), biometricsPresent: false });
    expect(nothing.materialContradiction).toBe(false);   // absent ≠ adverse
    expect(nothing.peakEligible).toBe(false);            // but nothing corroborates
    // it lowers CONFIDENCE only
    expect(nothing.confidence).toBe('low');
    expect(shippedBand(80, nothing)).toBe('BALANCED');   // and never lowers the band
  });

  it('confidence is separate from eligibility and adds no points', () => {
    const oneSource = ev({ urine: shippedUrine(2) });
    const twoSources = ev({ urine: shippedUrine(2), biometricsPresent: true, biometricsFavourable: true });
    // Both eligible for PEAK; they differ ONLY in confidence.
    expect(oneSource.peakEligible).toBe(true);
    expect(twoSources.peakEligible).toBe(true);
    expect(oneSource.confidence).toBe('medium');
    expect(twoSources.confidence).toBe('high');
    // The band function takes ONLY eligibility — confidence cannot reach it.
    expect(shippedBand(93, oneSource)).toBe(shippedBand(93, twoSources));
  });

  it('intake recency gates confidence, and is not evidence freshness', () => {
    const stale = ev({ urine: shippedUrine(2), minutesSinceLastIntake: 200 });
    expect(stale.intakeRecent).toBe(false);
    expect(stale.confidence).toBe('low');
    // The urine reading itself has no age anywhere in the model — recorded as
    // debt, and asserted here so the limitation cannot be quietly forgotten.
    expect(shippedUrine(2)).not.toHaveProperty('observedAt');
  });
});


// ═════════ END-TO-END — the SHIPPED buildBreakdown, not the local model ═════════
//
// The final link in the contract: equation → representative inputs → component
// waterfall → HydroState → band, through the function the app actually calls.
// These numbers are the ones the architecture artifact publishes. If the
// implementation drifts from the explored candidate, this is where it shows.

import { buildBreakdown } from '../scoring/breakdown';
import type { UserState, IntakeEvent } from '../../types';

const E2E_NOW = new Date('2026-09-01T12:00:00Z').getTime();
const E2E_MIN = 60000;

function e2eEvents(totalOz: number, lastMin: number): IntakeEvent[] {
  const n = Math.max(1, Math.round(totalOz / 16));
  return Array.from({ length: n }, (_, k) => {
    const oz = totalOz / n;
    return { id: `e${k}`, fluidType: 'water', oz,
      loggedAt: new Date(E2E_NOW - (lastMin + k * 45) * E2E_MIN),
      baseImpact: oz * 0.5, capAdjusted: oz * 0.5, immediate: oz * 0.3, delayed: oz * 0.2,
      delayedDurationMin: 12.5, heatGuardActiveAtLog: false, scoreBeforeAtLog: 50 } as IntakeEvent;
  });
}

const e2eState = (over: Partial<UserState>): UserState => ({
  unitsConsumedToday: 0, ozConsumedToday: 96, aforceUnitsToday: 0, ozTarget: 96,
  intakeEvents: e2eEvents(96, 10), lastIntakeTime: new Date(E2E_NOW - 10 * E2E_MIN),
  lastIntakeType: 'water', symptomState: 'none', symptoms: [], urineSignal: 3,
  energyState: 'steady', heatLoad: 0, sweatRate: 0, activityLevel: 3, complianceStreak: 0,
  dailyTarget: 8, isSnoozed: false, snoozeUntil: null, bodyWeightLbs: 180, isAwake: true,
  wakeTime: null, overnightLossOz: 0, hasSeenMorningCommand: true, ...over,
} as UserState);

describe('END TO END — the published numbers, through the shipped engine', () => {
  it('100% of target, everything neutral → 83, BALANCED', () => {
    const r = buildBreakdown(e2eState({}), E2E_NOW);
    expect(r.score).toBe(83);
    expect(r.level).toBe('BALANCED');
    // and BALANCED not because the score fell short of PEAK by luck, but
    // because nothing physiological corroborated a top-band claim
    expect(r.evidence.peakEligible).toBe(false);
  });

  it('volume saturates: 150% and 2000% of target score identically', () => {
    const at150 = buildBreakdown(e2eState({ ozConsumedToday: 144, intakeEvents: e2eEvents(144, 10) }), E2E_NOW);
    const at2000 = buildBreakdown(e2eState({ ozConsumedToday: 1920, intakeEvents: e2eEvents(1920, 10) }), E2E_NOW);
    expect(at150.score).toBe(84);
    expect(at2000.score).toBe(84);
    expect(at2000.score - at150.score).toBe(0);   // exactly flat, 13x the volume
    expect(at2000.level).toBe('BALANCED');        // and drinking more never buys PEAK
  });

  it('PEAK without a wearable, on a valid clear reading alone', () => {
    const r = buildBreakdown(e2eState({ urineSignal: 1 }), E2E_NOW);
    expect(r.score).toBe(91);
    expect(r.level).toBe('PEAK');
    expect(r.evidence.peakEligible).toBe(true);
    // ruling 4: eligibility and confidence are different things. This member
    // reaches PEAK on one observed source, and their confidence says so.
    expect(r.evidence.confidence).toBe('medium');
  });

  it('an unobserved urine signal earns nothing end to end', () => {
    const observed = buildBreakdown(e2eState({ urineSignal: 1 }), E2E_NOW);
    const unobserved = buildBreakdown(e2eState({ urineSignal: 0 }), E2E_NOW);
    const neutral = buildBreakdown(e2eState({ urineSignal: 3 }), E2E_NOW);
    expect(unobserved.score).toBe(neutral.score);       // scores as nothing
    expect(unobserved.score).toBeLessThan(observed.score);
    expect(unobserved.evidence.peakEligible).toBe(false);
  });

  it('the brand cannot buy a point: identical volume, different product', () => {
    const water = e2eState({});
    const product = e2eState({
      aforceUnitsToday: 8,
      intakeEvents: e2eEvents(96, 10).map((e) => ({ ...e, fluidType: 'aforce_stick' as const })),
    });
    expect(buildBreakdown(product, E2E_NOW).score).toBe(buildBreakdown(water, E2E_NOW).score);
  });
});
