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

function bestAforceFor(inputs: CompareInputs): CompareResult | undefined {
  const aforce = COMPARE_PRODUCTS.filter((p) => p.isAForce);
  if (aforce.length === 0) return undefined;
  const { results } = computeComparison({ inputs, catalog: aforce });
  return results[0];
}

export function buildRecommendation(
  scanned: ScannedProduct,
  inputs: CompareInputs,
  selfFit: CompareResult,
  bestAforce: CompareResult | undefined,
): ScanRecommendation {
  const stateLabel = inputs.state.charAt(0) + inputs.state.slice(1).toLowerCase();
  // Tone — AForce is positioned as system fuel / mineral recovery
  // support / hydration efficiency support / performance amplifier.
  // Headlines read as natural system observations, never as a
  // hard sell. Recommended pour standardized at 12 oz water.

  // CASE 1: scanned product is AForce and already optimal → log it.
  // Frame as "active system fuel" — the user is already on it.
  if (scanned.isAForce && selfFit.verdict === 'optimal') {
    return {
      headline: `${scanned.productName} is active system fuel for your ${stateLabel} state.`,
      detail: selfFit.whyItFits,
      command: `Pair with 12 oz water. Recheck in 20 minutes.`,
      shouldLog: true,
    };
  }
  // CASE 2: AForce alternative exists and outperforms.
  // Lead with a system observation, then surface the recommended
  // pairing — water + AForce as mineral recovery support.
  if (bestAforce && bestAforce.product.id !== scanned.productId && bestAforce.fitScore > selfFit.fitScore + 4) {
    return {
      headline: `Current intake may increase hydration demand.`,
      detail: bestAforce.whyItFits,
      aforceEquivalentId: bestAforce.product.id,
      command: `Recommended: 12 oz water + ${bestAforce.product.name} for mineral recovery support.`,
      shouldLog: false,
    };
  }
  // CASE 3: scanned product is acceptable, no clearly stronger
  // AForce upgrade. Frame as supporting their current state; offer
  // the standard 12 oz water pairing. Includes 'acceptable' so a
  // workable-but-not-stellar product still gets the supportive
  // framing, not the sub-par observation copy.
  if (
    selfFit.verdict === 'optimal' ||
    selfFit.verdict === 'strong' ||
    selfFit.verdict === 'acceptable'
  ) {
    return {
      headline: `${scanned.productName} supports your ${stateLabel} state.`,
      detail: selfFit.whyItFits,
      command: `Pair with 12 oz water. Recheck in 20 minutes.`,
      shouldLog: true,
    };
  }
  // CASE 4: scanned product is sub-par. Use the natural observation
  // framing. When an AForce uplift exists, position it as hydration
  // efficiency support; otherwise recommend water alone.
  return {
    headline: `Current intake may increase hydration demand.`,
    detail: selfFit.whyItFits,
    aforceEquivalentId: bestAforce?.product.id,
    command: bestAforce
      ? `Recommended: 12 oz water + ${bestAforce.product.name} for hydration efficiency support.`
      : `Recommended: 12 oz water. Recheck in 20 minutes.`,
    shouldLog: false,
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
  const bestAforce = bestAforceFor(inputs);
  const recommendation = buildRecommendation(scanned, inputs, selfFit, bestAforce);
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
        heat01: userState.heatLoad,
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
