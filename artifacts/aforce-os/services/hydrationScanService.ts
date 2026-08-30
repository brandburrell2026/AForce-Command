/**
 * Hydration Scan service.
 *
 * Composes:
 *   ScanSource → recognize() → ScannedProduct
 *                      ↓
 *              comparison engine fit math (re-using current user state)
 *                      ↓
 *              recommendation (with AForce equivalent)
 *
 * Fit math piggybacks on `computeComparison` so a scanned product is
 * scored under exactly the same rules as the /compare screen — keeping
 * scores consistent across the product surface.
 */

import { recognize } from './productRecognitionService';
import { computeComparison, inferInputs } from './comparisonEngine';
import { COMPARE_PRODUCTS } from '../data/productDatabase';
import { getDynamicCompareProduct } from './openFoodFactsService';
import { derivePersonalizationSignals } from '../utils/personalizationSignals';
import { preWorkoutSupportFor } from '../utils/preWorkoutSupport';
import { buildSuperfoodSignalsBlock } from '../utils/superfoodSignals';
import { computeHydrationImpact } from '../utils/impact/hydrationImpact';
import { computeTimingGuidance } from '../utils/impact/hydrationTiming';
import { fraction01FromScale10 } from '../utils/quantities';
import type { CompareInputs, CompareProduct, CompareResult } from '../types/comparison';
import type { ScoreEngineOutput, UserState } from '../types';
import type { ProfileIdentity } from '../utils/profileIdentity';
import type {
  ScanOutcome,
  ScanRecommendation,
  ScanResult,
  ScanSource,
  ScannedProduct,
} from '../types/scan';

/** 200–500ms simulated latency to match "premium" perceived speed. */
const LATENCY = () => 200 + Math.floor(Math.random() * 300);
function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

function fitFor(product: CompareProduct, inputs: CompareInputs): CompareResult | undefined {
  const { results } = computeComparison({ inputs, catalog: [product] });
  return results[0];
}

/**
 * Per-product hydration efficiency 0..1 per spec:
 *   efficiency = M*0.4 + W*0.3 + LS*0.2 - S*0.1
 *
 * M  = mineral content     → product.electrolytes / 100
 * W  = water content       → product.hydrationSpeed / 100  (speed is the
 *                            best available water-availability proxy
 *                            we have on CompareProduct)
 * LS = low-sugar quality   → 1 - (product.sugar / 100)
 * S  = sugar penalty       → product.sugar / 100
 *
 * Result is clamped to [0, 1] and returned as a fraction so the UI
 * can format it as "Hydrates at X% efficiency".
 */
export function computeHydrationEfficiency(product: CompareProduct): number {
  const M = Math.max(0, Math.min(1, (product.electrolytes ?? 0) / 100));
  const W = Math.max(0, Math.min(1, (product.hydrationSpeed ?? 0) / 100));
  const sugar01 = Math.max(0, Math.min(1, (product.sugar ?? 0) / 100));
  const LS = 1 - sugar01;
  const S = sugar01;
  const raw = M * 0.4 + W * 0.3 + LS * 0.2 - S * 0.1;
  return Math.max(0, Math.min(1, raw));
}

export function efficiencyLabel(efficiency: number): string {
  return `Hydrates at ${Math.round(efficiency * 100)}% efficiency`;
}

/**
 * The strongest eligible alternative to what was scanned — across the WHOLE
 * catalog (founder ruling D6, 2026-08-30).
 *
 * This used to filter to `isAForce`, so an AForce SKU was the only product
 * that could ever be nominated: a rival could win the comparison outright and
 * still be told to switch. The scoring engine has always been brand-blind; the
 * bias lived here, in the pool it was allowed to choose from.
 *
 * Plain water is eligible. The scanned product is excluded so a product cannot
 * be offered as an alternative to itself.
 */
/**
 * The candidate pool the alternative is chosen from — every product except the
 * one just scanned. Exported so the neutrality invariant can assert on the POOL
 * itself rather than on the source text: a brand filter reintroduced here is
 * observable, where a regex over the source is not.
 */
export function eligibleAlternatives(scannedProductId: string): CompareProduct[] {
  return COMPARE_PRODUCTS.filter((p) => p.id !== scannedProductId);
}

export function bestAlternativeFor(
  inputs: CompareInputs,
  scannedProductId: string,
): CompareResult | undefined {
  const catalog = eligibleAlternatives(scannedProductId);
  if (catalog.length === 0) return undefined;
  const { results } = computeComparison({ inputs, catalog });
  return results[0];
}

export function buildRecommendation(
  scanned: ScannedProduct,
  inputs: CompareInputs,
  selfFit: CompareResult,
  bestAlternative: CompareResult | undefined,
): ScanRecommendation {
  const stateLabel = inputs.state.charAt(0) + inputs.state.slice(1).toLowerCase();

  // COMMAND-AUTHORITY CONTAINMENT (re-plumb wave, founder-authorized): these
  // strings once carried a locally-authored dose and a competing recheck clock.
  // The product-EQUIVALENCE logic stays (that is comparison, this module's
  // job); amount and cadence defer to the member's current command. No dose
  // numbers or clock clauses may return here
  // (services/__tests__/commandAuthorityContainment.test.ts).
  //
  // COMMERCIAL NEUTRALITY — founder ruling D6, 2026-08-30. Two brand gates
  // used to live in this function and are now gone:
  //   1. the most favourable branch was reachable only when `scanned.isAForce`,
  //      so a rival holding an IDENTICAL verdict could not receive it;
  //   2. the alternative was drawn from an AForce-only pool.
  // `isAForce` is deliberately not read anywhere below. Identical deterministic
  // outcomes now produce identical copy, whatever the brand.
  //
  // PHYSIOLOGICAL CLAIM — founder ruling D4. "Current intake may increase
  // hydration demand." is retired. It asserted a consequence inside the
  // member's body from a product lookup plus arithmetic, with nothing
  // measured and no canonical source behind it. Its replacement describes the
  // COMPARISON, which is the only thing that actually happened.
  const RANKED_LOWER = 'This product ranked lower under the current comparison criteria.';

  const MARGIN = 4;
  const outranked =
    bestAlternative != null &&
    bestAlternative.product.id !== scanned.productId &&
    bestAlternative.fitScore != null &&
    selfFit.fitScore != null &&
    bestAlternative.fitScore > selfFit.fitScore + MARGIN;

  // A genuinely stronger alternative exists — of ANY brand, plain water
  // included. `whyItFits` is itself brand-agnostic and generated from axis
  // values, so the explanation stays factual.
  if (outranked && bestAlternative) {
    return {
      headline: RANKED_LOWER,
      detail: bestAlternative.whyItFits,
      alternativeProductId: bestAlternative.product.id,
      command: `Consider ${bestAlternative.product.name} — water first.`,
      shouldLog: false,
    };
  }

  // Nothing on file outranks what was scanned. NO CHANGE NEEDED is an explicit
  // outcome (D6), not merely the absence of a switch card.
  if (
    selfFit.verdict === 'optimal' ||
    selfFit.verdict === 'strong' ||
    selfFit.verdict === 'acceptable'
  ) {
    return {
      headline: `${scanned.productName} supports your ${stateLabel} state.`,
      detail: selfFit.whyItFits,
      command: `Pair with water — your current command sets the amount.`,
      shouldLog: true,
      noChangeNeeded: true,
    };
  }

  // Ranked low, and nothing better on file either. Prefer the specific factual
  // explanation the engine already produced; the neutral comparison sentence
  // carries the headline. No physiological assertion is made.
  return {
    headline: RANKED_LOWER,
    detail: selfFit.whyItFits,
    command: `Water first — your current command sets the amount.`,
    shouldLog: false,
    noChangeNeeded: true,
  };
}

/** Recognize + score + recommend in one call. */
export async function scan(
  source: ScanSource,
  engineOutput: ScoreEngineOutput,
  userState: UserState,
  profileIdentity?: ProfileIdentity | null,
  opts?: { hydroScan2?: boolean },
): Promise<ScanOutcome> {
  await delay(LATENCY());
  const scanned = await recognize(source);
  if (!scanned) {
    return {
      ok: false,
      failure: {
        scannedAt: new Date().toISOString(),
        source,
        reason: source.kind === 'qr' ? 'unrecognized_qr' : 'unknown_barcode',
        message: 'Product not recognized. Try manual search or rescan.',
      },
    };
  }
  // Resolve the comparable product. Local catalog first; OFF-synthesized
  // entries live in the dynamic cache.
  const product =
    COMPARE_PRODUCTS.find((p) => p.id === scanned.productId) ??
    getDynamicCompareProduct(scanned.productId);
  if (!product) {
    return {
      ok: false,
      failure: {
        scannedAt: new Date().toISOString(),
        source,
        reason: 'invalid_payload',
        message: 'Could not load comparable nutrition for that product.',
      },
    };
  }
  const inputs = inferInputs(engineOutput, userState);
  const selfFit = fitFor(product, inputs);
  if (!selfFit) {
    return {
      ok: false,
      failure: {
        scannedAt: new Date().toISOString(),
        source,
        reason: 'invalid_payload',
        message: 'Could not score scanned product against current state.',
      },
    };
  }
  const bestAlternative = bestAlternativeFor(inputs, scanned.productId);
  const recommendation = buildRecommendation(scanned, inputs, selfFit, bestAlternative);
  // Personalization layer — derive the dominant signals (heat, humidity,
  // activity, recovery, alcohol, consistency, mass) from current user
  // state + engine output and attach them so the UI can render
  // "Why this for you" chips. Pure derivation; never throws.
  recommendation.personalization = derivePersonalizationSignals({
    userState,
    engineOutput,
    profileIdentity,
    recentIntake: userState.intakeEvents ?? null,
  });
  // Pre-Workout Support — recognize pre-workouts, stimulant-heavy
  // formulas, pump blends, and energy formulas across BOTH surfaces:
  // the scanned product itself (by name keyword) and the user's
  // recent intake (by drink-catalog category). When detected, attach
  // three supportive lines — these talk about the body's needs
  // (hydration during training, recovery after), never about the
  // supplement being a problem. Pre-workouts are never attacked.
  const scannedText = `${scanned.brand ?? ''} ${scanned.productName ?? ''}`;
  const supportive = preWorkoutSupportFor({
    recentIntake: userState.intakeEvents ?? null,
    scannedText,
  });
  if (supportive) {
    recommendation.supportiveNotes = supportive;
  }
  // Superfood Signals — when the scanned product is AForce, attach
  // the "SUPERFOOD SIGNALS ACTIVE" block (5 chips + TAP TO LEARN WHY
  // CTA + education entries + positioning + canonical sodium-balance
  // note). All copy comes from utils/superfoodSignals.ts which is
  // guarded by a compliant-language regression test.
  const superfood = buildSuperfoodSignalsBlock({ isAForce: scanned.isAForce });
  if (superfood) {
    recommendation.superfoodSignals = superfood;
  }
  const efficiency = computeHydrationEfficiency(product);
  const result: ScanResult = {
    scannedAt: new Date().toISOString(),
    source,
    product: scanned,
    currentFitScore: selfFit.fitScore,
    verdict: selfFit.verdict,
    evaluatedAgainstState: inputs.state,
    recommendation,
    efficiency,
    efficiencyLabel: efficiencyLabel(efficiency),
  };
  // HydroScan 2.0™ — profile-aware Hydration Impact + Timing Guidance.
  // Attached ONLY when the caller passes the flag; when off, `result`
  // is byte-identical to the legacy shape. Advisory only (Score-Protection):
  // these never award, mutate, or fabricate score.
  if (opts?.hydroScan2) {
    const isWater = scanned.fluidType === 'water' || scanned.category === 'plain_water';
    const hydrationImpact = computeHydrationImpact({
      product: {
        hydrationSpeed: scanned.hydrationSpeed,
        electrolyteDensity: scanned.electrolyteDensity,
        sugarLevel: scanned.sugarLevel,
        stimulantLevel: scanned.stimulantLevel,
        isAForce: scanned.isAForce,
        isWater,
      },
      profile: {
        bodyWeightLbs: profileIdentity?.bodyWeightLbs ?? null,
        biologicalSex: profileIdentity?.biologicalSex ?? 'unspecified',
        activityLevel: profileIdentity?.activityLevel ?? null,
      },
      state: inputs.state,
      environment: {
        // hydrationImpact's contract: heat01 is 0..1 and "the service
        // normalizes UserState.heatLoad" — the store field is 0–10, so an
        // unbridged read saturated the heat factor for every member ≥1.
        heat01: fraction01FromScale10(
          Number.isFinite(userState.heatLoad) ? userState.heatLoad : 0,
        ),
        humidity01:
          userState.weatherHumidity != null ? userState.weatherHumidity / 100 : null,
        tempC: userState.weatherTempC ?? null,
      },
    });
    const timingGuidance = computeTimingGuidance({
      isWater,
      impactLevel: hydrationImpact.level,
      state: inputs.state,
      hoursSinceLastIntake: hoursSinceIntake(userState.lastIntakeTime),
    });
    result.hydrationImpact = hydrationImpact;
    result.timingGuidance = timingGuidance;
  }
  return { ok: true, result };
}

/** Hours since the user's last intake, or null when unknown/invalid. */
function hoursSinceIntake(last: Date | string | null | undefined): number | null {
  if (last == null) return null;
  const t = last instanceof Date ? last.getTime() : new Date(last).getTime();
  if (!Number.isFinite(t)) return null;
  const h = (Date.now() - t) / 3_600_000;
  return h >= 0 ? h : null;
}
