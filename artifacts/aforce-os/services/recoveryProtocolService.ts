/**
 * Recovery Protocol resolver — Sweat Intelligence v2.
 *
 * Builds the inventory-gated step list rendered by the "Recovery
 * Protocol" card on the Sweat Calculator results pane. Honors three
 * spec rules from the upgrade brief (§2 Inventory Integration):
 *
 *   1. Only show product types the user actually has on hand.
 *   2. Prefer RTD → sticks → canister when multiple are available
 *      (RTD is the lowest-friction choice, sticks are the staple,
 *      canister is the bulk fallback).
 *   3. When everything is zero, return a `restock` command instead of
 *      a placeholder protocol — never recommend what cannot be poured.
 *
 * Pure function. Engine output drives the prescription budget; the
 * inventory state gates which products fulfill it.
 */

import type { SweatSession } from '@/types/sweat';
import type { InventoryState } from '@/types';

export type RecoveryProductId = 'rtd' | 'stick' | 'canister';

export interface RecoveryProtocolStep {
  productId: RecoveryProductId;
  /** Number of servings to consume from this product. */
  count: number;
  /** Plain-English instruction for the card. */
  label: string;
}

export type RecoveryProtocolReason = 'ok' | 'restock';

export interface RecoveryProtocolPlan {
  reason: RecoveryProtocolReason;
  /** Ordered protocol steps; empty when reason === 'restock'. */
  steps: RecoveryProtocolStep[];
  /** Optional plain water (oz) to pair with the protocol. */
  waterOz: number;
  /** Headline that goes above the steps (or the restock CTA). */
  headline: string;
  /** One-line explanation of why this protocol was chosen. */
  reasoning: string;
}

const EMPTY_INVENTORY: InventoryState = { sticks: 0, rtd: 0, canister: 0 };

function safeInventory(inv: InventoryState | undefined | null): InventoryState {
  if (!inv) return EMPTY_INVENTORY;
  return {
    sticks: Math.max(0, Math.floor(inv.sticks)),
    rtd: Math.max(0, Math.floor(inv.rtd)),
    canister: Math.max(0, Math.floor(inv.canister)),
  };
}

/**
 * Build the inventory-gated recovery protocol for a sweat session.
 *
 * Allocation strategy (matches spec §E "Examples"):
 *   - If RTD on hand: use up to 1 RTD as the seed serving.
 *   - Then fill the remaining unit budget with sticks (1:1).
 *   - If neither sticks nor RTD are stocked, fall back to canister
 *     scoops (1 scoop ≈ 1 stick).
 *   - Plain water always pairs at the prescription's `pairWaterOz`.
 *
 * The total served never exceeds `prescription.aforceSticks` — we
 * don't oversupply just because inventory is deep.
 */
export function pickRecoveryProtocol(
  session: SweatSession,
  inventory: InventoryState | undefined | null,
): RecoveryProtocolPlan {
  const inv = safeInventory(inventory);
  const totalUnitsNeeded = Math.max(0, session.prescription.aforceSticks);
  const waterOz = Math.max(0, session.prescription.pairWaterOz);

  // No inventory at all → restock command.
  if (inv.sticks + inv.rtd + inv.canister === 0) {
    return {
      reason: 'restock',
      steps: [],
      waterOz,
      headline: 'Restock AForce to start your recovery protocol.',
      reasoning:
        'No sticks, RTD, or canister on hand — your tracked inventory is empty.',
    };
  }

  const steps: RecoveryProtocolStep[] = [];
  let remaining = totalUnitsNeeded;

  // Edge case: zero unit budget but inventory exists — still surface a
  // light "stay topped up" suggestion using whatever the user has.
  if (remaining === 0) {
    if (inv.rtd > 0) {
      steps.push({ productId: 'rtd', count: 1, label: '1 AForce RTD' });
    } else if (inv.sticks > 0) {
      steps.push({ productId: 'stick', count: 1, label: '1 AForce stick' });
    } else if (inv.canister > 0) {
      steps.push({ productId: 'canister', count: 1, label: '1 canister scoop' });
    }
    return {
      reason: 'ok',
      steps,
      waterOz,
      headline: 'Sip to maintain — sodium loss this session was minimal.',
      reasoning:
        'Deficit was within optimal range. One light serving keeps your balance trending up.',
    };
  }

  // 1) Lead with RTD if available — lowest-friction recovery serving.
  if (inv.rtd > 0 && remaining > 0) {
    const rtdCount = Math.min(remaining, inv.rtd, 1);
    if (rtdCount > 0) {
      steps.push({ productId: 'rtd', count: rtdCount, label: `${rtdCount} AForce RTD` });
      remaining -= rtdCount;
    }
  }

  // 2) Fill the rest with sticks.
  if (inv.sticks > 0 && remaining > 0) {
    const stickCount = Math.min(remaining, inv.sticks);
    if (stickCount > 0) {
      steps.push({
        productId: 'stick',
        count: stickCount,
        label: `${stickCount} AForce stick${stickCount > 1 ? 's' : ''}`,
      });
      remaining -= stickCount;
    }
  }

  // 3) Canister scoops as the bulk fallback.
  if (inv.canister > 0 && remaining > 0) {
    const scoopCount = Math.min(remaining, inv.canister);
    if (scoopCount > 0) {
      steps.push({
        productId: 'canister',
        count: scoopCount,
        label: `${scoopCount} canister scoop${scoopCount > 1 ? 's' : ''}`,
      });
      remaining -= scoopCount;
    }
  }

  // If we still have leftover budget, the inventory partially covers
  // the prescription. Show what's available + flag the gap in the
  // reasoning so the user knows to top up.
  const partial = remaining > 0;

  const labelList = steps.map((s) => s.label).join(' + ');
  const headline = partial
    ? `Use what you have: ${labelList} + ${waterOz} oz water.`
    : `Recommended: ${labelList} + ${waterOz} oz water over the next ${session.autopilot.recoveryWindowHours}h.`;

  const reasoning = partial
    ? `Inventory covers ${totalUnitsNeeded - remaining}/${totalUnitsNeeded} units. Top up to fully replace your sodium loss.`
    : `${totalUnitsNeeded} unit${totalUnitsNeeded > 1 ? 's' : ''} matches your sodium loss; ${waterOz} oz water pairs the absorption window.`;

  return { reason: 'ok', steps, waterOz, headline, reasoning };
}
