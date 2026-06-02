/**
 * Smart Quick Actions — Priority #6 (Passive Logging).
 *
 * The "underneath": a PURE, deterministic derivation of the up-to-three
 * one-tap logging actions shown on home so a hydration log takes under
 * two seconds — no typing, no forms. No React, no storage, no Date.now;
 * everything is derived from the context passed in, so it is fully
 * unit-testable. The component just renders what this returns and calls
 * the existing `logIntake` with the action's parameters.
 *
 * Order (per spec): Repeat Last Drink → Log 12 oz → Complete Cycle.
 * "Repeat Last" is omitted when there is no prior intake to repeat; the
 * other two are always available, so logging is always one tap away.
 */
import type { FluidType, ProductFlavor } from '@/types';

export type QuickActionId = 'repeat_last' | 'log_water' | 'complete_cycle';

export interface QuickAction {
  id: QuickActionId;
  /** Short tracked label, e.g. "REPEAT LAST". */
  label: string;
  /** Human detail, e.g. "+24 oz Water" or "AForce Stick — Berry". */
  detail: string;
  icon: 'refresh-cw' | 'droplet' | 'zap';
  /** What to pass to logIntake. */
  fluidType: FluidType;
  ozOverride?: number;
  flavorLabel?: string;
}

export interface RecentIntake {
  fluidType: FluidType;
  oz: number;
  flavor?: ProductFlavor | null;
  /** Epoch ms — used to pick the genuinely most recent intake. */
  loggedAt: number;
}

export interface QuickActionContext {
  recentEvents: ReadonlyArray<RecentIntake>;
  /** Default water serving for the one-tap "Log N oz" action. */
  defaultWaterOz?: number;
}

const DEFAULT_WATER_OZ = 12;

/** Display names for each fluid — kept here so copy is testable. */
const FLUID_LABEL: Record<FluidType, string> = {
  water: 'Water',
  aforce_stick: 'AForce Stick',
  aforce_rtd: 'AForce RTD',
  aforce_canister: 'AForce Canister',
  aforce_bulk_bag: 'AForce Bulk',
};

/** Flavor → display label (for repeating a flavored AForce intake). */
const FLAVOR_LABEL: Record<ProductFlavor, string | null> = {
  watermelon: 'Watermelon',
  berry: 'Berry',
  soursop: 'Soursop',
  unflavored: null,
};

function mostRecent(events: ReadonlyArray<RecentIntake>): RecentIntake | null {
  let best: RecentIntake | null = null;
  for (const e of events) {
    if (!Number.isFinite(e.loggedAt)) continue;
    if (!best || e.loggedAt > best.loggedAt) best = e;
  }
  return best;
}

export function deriveQuickActions(ctx: QuickActionContext): QuickAction[] {
  const waterOz =
    ctx.defaultWaterOz && ctx.defaultWaterOz > 0
      ? Math.round(ctx.defaultWaterOz)
      : DEFAULT_WATER_OZ;

  const actions: QuickAction[] = [];

  // 1. Repeat Last Drink — only when there is something to repeat.
  const last = mostRecent(ctx.recentEvents);
  if (last) {
    const flavorLabel =
      last.flavor && last.flavor !== 'unflavored'
        ? FLAVOR_LABEL[last.flavor] ?? undefined
        : undefined;
    const name = FLUID_LABEL[last.fluidType];
    const detail = flavorLabel
      ? `${name} — ${flavorLabel}`
      : `+${Math.round(last.oz)} oz ${name}`;
    actions.push({
      id: 'repeat_last',
      label: 'REPEAT LAST',
      detail,
      icon: 'refresh-cw',
      fluidType: last.fluidType,
      ozOverride: last.oz,
      ...(flavorLabel ? { flavorLabel } : {}),
    });
  }

  // 2. Log 12 oz water — always available.
  actions.push({
    id: 'log_water',
    label: `LOG ${waterOz} OZ`,
    detail: `+${waterOz} oz Water`,
    icon: 'droplet',
    fluidType: 'water',
    ozOverride: waterOz,
  });

  // 3. Complete Cycle (AForce stick — the primary intake) — always available.
  actions.push({
    id: 'complete_cycle',
    label: 'COMPLETE CYCLE',
    detail: 'AForce Stick',
    icon: 'zap',
    fluidType: 'aforce_stick',
  });

  return actions;
}
