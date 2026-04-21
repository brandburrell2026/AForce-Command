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
import type { CompareInputs, CompareProduct, CompareResult } from '../types/comparison';
import type { ScoreEngineOutput, UserState } from '../types';
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

function bestAforceFor(inputs: CompareInputs): CompareResult | undefined {
  const aforce = COMPARE_PRODUCTS.filter((p) => p.isAForce);
  if (aforce.length === 0) return undefined;
  const { results } = computeComparison({ inputs, catalog: aforce });
  return results[0];
}

function buildRecommendation(
  scanned: ScannedProduct,
  inputs: CompareInputs,
  selfFit: CompareResult,
  bestAforce: CompareResult | undefined,
): ScanRecommendation {
  const stateLabel = inputs.state.charAt(0) + inputs.state.slice(1).toLowerCase();
  // CASE 1: scanned product is AForce and already optimal → log it.
  if (scanned.isAForce && selfFit.verdict === 'optimal') {
    return {
      headline: `${scanned.productName} is optimal for your current state.`,
      detail: selfFit.whyItFits,
      command: `Take 1 ${scanned.productName} now with 16 oz water. Recheck in 20 minutes.`,
      shouldLog: true,
    };
  }
  // CASE 2: AForce alternative exists and outperforms.
  if (bestAforce && bestAforce.product.id !== scanned.productId && bestAforce.fitScore > selfFit.fitScore + 4) {
    return {
      headline: `${bestAforce.product.name} is a stronger fit for your ${stateLabel} state.`,
      detail: bestAforce.whyItFits,
      aforceEquivalentId: bestAforce.product.id,
      command: `Take 1 ${bestAforce.product.name} now with 16 oz water. Recheck in 20 minutes.`,
      shouldLog: false,
    };
  }
  // CASE 3: scanned product is acceptable, no clearly stronger AForce upgrade.
  if (selfFit.verdict === 'optimal' || selfFit.verdict === 'strong') {
    return {
      headline: `${scanned.productName} fits your current state.`,
      detail: selfFit.whyItFits,
      command: `Take 1 ${scanned.productName} now with 16 oz water. Recheck in 20 minutes.`,
      shouldLog: true,
    };
  }
  // CASE 4: scanned product is sub-par, no AForce uplift available.
  return {
    headline: `${scanned.productName} is not optimal for your current state.`,
    detail: selfFit.whyItFits,
    aforceEquivalentId: bestAforce?.product.id,
    command: bestAforce
      ? `Take 1 ${bestAforce.product.name} now with 16 oz water. Recheck in 20 minutes.`
      : `Take 16 oz water now. Recheck in 20 minutes.`,
    shouldLog: false,
  };
}

/** Recognize + score + recommend in one call. */
export async function scan(
  source: ScanSource,
  engineOutput: ScoreEngineOutput,
  userState: UserState,
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
  const result: ScanResult = {
    scannedAt: new Date().toISOString(),
    source,
    product: scanned,
    currentFitScore: selfFit.fitScore,
    verdict: selfFit.verdict,
    evaluatedAgainstState: inputs.state,
    recommendation,
  };
  return { ok: true, result };
}
