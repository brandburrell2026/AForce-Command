/**
 * HydroScan 2.0™ — Stack Awareness signal layer (pure, HEADLESS).
 *
 * "Headless" = it derives structured signals from a scanned (and possibly
 * consumed) product but renders NOTHING and calls NO downstream engine. It
 * is a routing layer: it describes what an item contributes to the user's
 * daily "stack" and which downstream layers (Brain Energy, Performance
 * Memory, fuel timing, caffeine tracking) would care, leaving the actual
 * consumption to those engines later.
 *
 * Score-Protection: advisory only. Signals never award or mutate score,
 * and only an item the user actually CONSUMED produces active routes —
 * "Not Yet" / "Just Curious" scans contribute nothing to the stack.
 */

import type { ConsumptionStatus } from '../../types/scan';
import type { CaffeineHabit } from '../profileIdentity';

export interface StackSignalProduct {
  /** Product category or unknown-flow type (free-form, lowercased match). */
  category: string;
  /** 0..100 stimulant / caffeine load. */
  stimulantLevel: number;
  /** 0..100 sugar load. */
  sugarLevel: number;
  /** 0..100 mineral / electrolyte content. */
  electrolyteDensity: number;
  isAForce: boolean;
}

export interface StackSignalInput {
  product: StackSignalProduct;
  consumption: ConsumptionStatus;
  /** Profile caffeine context, for downstream caffeine routing. */
  caffeineHabit?: CaffeineHabit;
}

export interface StackSignalRoutes {
  /** Stimulant or fuel could colour the cognitive read. */
  brainEnergy: boolean;
  /** Any consumed item is part of the day's remembered stack. */
  performanceMemory: boolean;
  /** Fuel sources (protein / energy / carbs). */
  fuelTiming: boolean;
  /** Caffeine / stimulant tracking. */
  caffeine: boolean;
}

export interface StackSignal {
  /** True only when the user actually consumed the item. */
  active: boolean;
  /** 0..1 caffeine / stimulant presence (descriptor — always populated). */
  caffeineLoad: number;
  /** True when the product is a fuel source (descriptor — always populated). */
  isFuel: boolean;
  /** True when the product is mineral / electrolyte support. */
  isMineralSupport: boolean;
  /** Which downstream layers care — all false unless consumed. */
  routes: StackSignalRoutes;
  /** Plain advisory note (Water-First when caffeine present); null when inactive. */
  note: string | null;
}

const CAFFEINE_PRESENCE = 0.05;
const FUEL_KEYWORDS = ['protein', 'energy', 'carb', 'fuel', 'recovery', 'pre_workout', 'preworkout'];
const MINERAL_THRESHOLD = 0.5;

export function deriveStackSignal(input: StackSignalInput): StackSignal {
  const { product, consumption } = input;
  const active = consumption === 'consumed';

  const caffeineLoad = clamp01(product.stimulantLevel / 100);
  const isFuel = matchesFuel(product.category);
  const isMineralSupport =
    clamp01(product.electrolyteDensity / 100) >= MINERAL_THRESHOLD || product.isAForce;

  const hasCaffeine = caffeineLoad > CAFFEINE_PRESENCE;

  const routes: StackSignalRoutes = {
    brainEnergy: active && (hasCaffeine || isFuel),
    performanceMemory: active,
    fuelTiming: active && isFuel,
    caffeine: active && hasCaffeine,
  };

  return {
    active,
    caffeineLoad,
    isFuel,
    isMineralSupport,
    routes,
    note: active ? buildNote(hasCaffeine, isFuel) : null,
  };
}

function buildNote(hasCaffeine: boolean, isFuel: boolean): string | null {
  if (hasCaffeine) return 'Caffeine in the mix — keep water alongside to stay balanced.';
  if (isFuel) return 'Fuel logged — water helps you absorb it.';
  return null;
}

function matchesFuel(category: string): boolean {
  const c = String(category ?? '').toLowerCase();
  return FUEL_KEYWORDS.some((k) => c.includes(k));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
