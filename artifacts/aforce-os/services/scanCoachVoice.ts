/**
 * AI Coach narrative builder for the Hydration Scan screen.
 *
 * Pure function — given a `ScanResult` (and the resolved AForce equivalent
 * from `COMPARE_PRODUCTS` when one was recommended) it returns:
 *   - headline   : short on-card title
 *   - transcript : the line the AI Coach speaks out loud (≤3 sentences)
 *   - bullets[]  : per-metric scanned-vs-AForce rows for the visual side
 *                  -by-side breakdown (empty when there's nothing to compare)
 *
 * Mirrors the four cases in `hydrationScanService.buildRecommendation` so
 * the spoken narrative always matches the on-screen verdict:
 *   A. scanned IS AForce + optimal/strong
 *   B. AForce equivalent stronger than scanned (the "compare" case)
 *   C. scanned product acceptable + no AForce upgrade
 *   D. scanned product sub-par + no AForce uplift available
 *
 * Numbers are written as digits — TTS pronounces them naturally.
 *
 * COMMAND-AUTHORITY CONTAINMENT (founder P0, 2026-08-29 screenshot
 * review): this module previously AUTHORED its own prescriptions on the
 * AI Coach card ("Take 1 with 16 ounces water and recheck in 20
 * minutes") — a second command authority on a commerce surface. The
 * authority hierarchy is HydroState = state, RecoveryCommand =
 * authoritative action, AI Coach = explanation, commerce = subordinate.
 * Every case now closes by MIRRORING `result.recommendation.command`
 * VERBATIM — the already-contained on-screen line, which itself defers
 * amount and cadence to the member's current command. The coach may
 * never independently introduce a dose, a recheck clock, a timing
 * window, or an imperative action, and a product must never create or
 * amplify a hydration command
 * (services/__tests__/commandAuthorityContainment.test.ts, class ban).
 */

import type { CompareProduct } from '../types/comparison';
import { consumerCopyBlocked } from '@/utils/intelligence/languageGate/runtimeClaimScan';
import type { ScanResult } from '../types/scan';

export interface ScanCoachBullet {
  label: string;
  /** Display string for the scanned product, e.g. "70/100". */
  scanned: string;
  /** Display string for the AForce equivalent, e.g. "92/100". */
  aforce: string;
  /** Which side is better on this metric. */
  winner: 'scanned' | 'aforce' | 'tie';
}

export interface ScanCoachScript {
  /** Short on-card title (≤12 words). */
  headline: string;
  /** Full spoken transcript (≤3 sentences). */
  transcript: string;
  /** Side-by-side comparison rows; empty when no AForce comparison applies. */
  bullets: ScanCoachBullet[];
  /** True iff the script compares the scanned product to a different AForce one. */
  hasComparison: boolean;
}

const round = (n: number): number => Math.round(n);
const pct = (n: number): string => `${Math.round(n * 100)}%`;
const stateLabel = (s: string): string =>
  s.length === 0 ? s : s.charAt(0) + s.slice(1).toLowerCase();

function compareBullets(
  scanned: ScanResult['product'],
  aforce: CompareProduct,
): ScanCoachBullet[] {
  const rows: Array<{
    label: string;
    s: number;
    a: number;
    higherWins: boolean;
  }> = [
    { label: 'Electrolytes', s: scanned.electrolyteDensity, a: aforce.electrolytes,       higherWins: true  },
    { label: 'Sugar load',   s: scanned.sugarLevel,         a: aforce.sugar,              higherWins: false },
    { label: 'Uptake speed', s: scanned.hydrationSpeed,     a: aforce.hydrationSpeed,     higherWins: true  },
    { label: 'Recovery fit', s: scanned.recoveryFit,        a: aforce.recoveryEfficiency, higherWins: true  },
  ];
  return rows.map((r) => {
    const tie = r.s === r.a;
    const aforceWins = r.higherWins ? r.a > r.s : r.a < r.s;
    return {
      label: r.label,
      scanned: `${round(r.s)}/100`,
      aforce: `${round(r.a)}/100`,
      winner: tie ? 'tie' : aforceWins ? 'aforce' : 'scanned',
    };
  });
}

export function buildScanCoachScript(
  result: ScanResult,
  aforceEquivalent?: CompareProduct,
): ScanCoachScript {
  const script = buildScanCoachScriptUnchecked(result, aforceEquivalent);
  // §42 claims gate (Wave-2 PR5): HydroScan is a STRICT surface and this
  // module interpolates EXTERNAL text (scanned product names) into raw
  // English templates. A blocked headline/transcript falls back to a
  // neutral, claim-free script — never stripped, never rewritten.
  if (consumerCopyBlocked(script.headline) || consumerCopyBlocked(script.transcript)) {
    return {
      headline: 'Scan complete.',
      transcript: '',
      bullets: script.bullets,
      hasComparison: script.hasComparison,
    };
  }
  return script;
}

function buildScanCoachScriptUnchecked(
  result: ScanResult,
  aforceEquivalent?: CompareProduct,
): ScanCoachScript {
  const scanned = result.product;
  const state = stateLabel(result.evaluatedAgainstState);
  const fit = result.currentFitScore;
  const eff = pct(result.efficiency);

  // CASE A — scanned IS AForce and already strong/optimal: lock it in.
  if (scanned.isAForce && (result.verdict === 'optimal' || result.verdict === 'strong')) {
    return {
      headline: `${scanned.productName} is locked in for your ${state} state.`,
      transcript:
        `${scanned.productName} is locked in for your ${state} state. ` +
        `This is a strong match — stay with it. ` +
        `${result.recommendation.command}`,
      bullets: [],
      hasComparison: false,
    };
  }

  const isComparing =
    !!aforceEquivalent && aforceEquivalent.id !== scanned.productId;

  // CASE B — AForce alternative recommended: the comparison narrative.
  if (isComparing && aforceEquivalent) {
    const bullets = compareBullets(scanned, aforceEquivalent);
    const electrolyteDelta = round(aforceEquivalent.electrolytes - scanned.electrolyteDensity);
    const sugarDelta = round(scanned.sugarLevel - aforceEquivalent.sugar);
    const speedDelta = round(aforceEquivalent.hydrationSpeed - scanned.hydrationSpeed);

    const wins: string[] = [];
    if (electrolyteDelta > 0) wins.push(`${electrolyteDelta} points stronger on electrolytes`);
    if (sugarDelta > 0) wins.push(`${sugarDelta} points lower on sugar`);
    if (wins.length === 0 && speedDelta > 0) {
      wins.push(`${speedDelta} points faster uptake`);
    }
    const winsLine = wins.length > 0 ? wins.join(' and ') : 'a cleaner overall profile';

    const opener =
      result.verdict === 'avoid' || result.verdict === 'suboptimal'
        ? `${scanned.productName} is not optimal for your ${state} state at ${fit} fit, ${eff} efficiency.`
        : `${scanned.productName} fits your ${state} state at ${fit} fit, ${eff} efficiency, but there's a stronger option.`;

    return {
      headline: `${aforceEquivalent.name} beats ${scanned.productName} — ${winsLine}.`,
      transcript:
        `${opener} ` +
        `${aforceEquivalent.name} delivers ${winsLine}. ` +
        `${result.recommendation.command}`,
      bullets,
      hasComparison: true,
    };
  }

  // CASE C — scanned acceptable + no upgrade: log it.
  if (
    result.verdict === 'optimal' ||
    result.verdict === 'strong' ||
    result.verdict === 'acceptable'
  ) {
    return {
      headline: `${scanned.productName} fits your ${state} state.`,
      transcript:
        `${scanned.productName} fits your ${state} state. ` +
        `A solid choice right now. ` +
        `${result.recommendation.command}`,
      bullets: [],
      hasComparison: false,
    };
  }

  // CASE D — scanned sub-par. The recommendation may still point at an
  // AForce alternative whose full nutrition row we couldn't resolve (e.g.
  // dynamic OFF entry not in COMPARE_PRODUCTS). In that situation we keep
  // the spoken narrative in sync with the AForceReplacementCard by reading
  // the recommendation's own command line instead of falling back to water.
  const aforceId = result.recommendation.aforceEquivalentId;
  if (aforceId) {
    return {
      headline: `${scanned.productName} is not optimal — switch to AForce.`,
      transcript:
        `${scanned.productName} is not optimal for your ${state} state at ${fit} fit, ${eff} efficiency. ` +
        `${result.recommendation.command}`,
      bullets: [],
      hasComparison: false,
    };
  }
  return {
    headline: `${scanned.productName} is not optimal for your ${state} state.`,
    transcript:
      `${scanned.productName} is not optimal for your ${state} state. ` +
      `Water alone is the safer move here. ` +
      `${result.recommendation.command}`,
    bullets: [],
    hasComparison: false,
  };
}
