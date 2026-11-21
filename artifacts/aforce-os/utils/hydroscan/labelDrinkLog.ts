/**
 * HydroScan label reader: the pure side of saving and undoing a drink.
 *
 * The write itself is the Scan screen's `onConfirmDrink` (which goes through
 * `drinkRoute`: plain water to the scored rail, everything else, alcohol
 * included, to the private drink log that can never move HydroState). This
 * module only builds what that handler is given, guards against a second write
 * of the same drink, and decides what Undo may take back.
 */
import { displayNameFor, type Reading } from './labelEvidence';
import { MAX_SINGLE_LOG_OZ, MIN_SINGLE_LOG_OZ } from './amountOptions';

export interface DrinkLogArgs {
  readonly categoryId: string;
  readonly name: string;
  readonly displayName: string;
  readonly enteredOz: number;
  readonly effectiveOz: number;
  /** Historical argument the handler still takes; never a credit. */
  readonly hydrationCoefficient: number;
}

/** Null until the reading names a drink type and the amount is a real amount. */
export function buildDrinkLogArgs(reading: Reading, oz: number): DrinkLogArgs | null {
  const categoryId = reading.drinkType.value;
  if (!categoryId) return null;
  if (!Number.isFinite(oz) || oz < MIN_SINGLE_LOG_OZ || oz > MAX_SINGLE_LOG_OZ) return null;
  const name = displayNameFor(reading);
  return { categoryId, name, displayName: name, enteredOz: oz, effectiveOz: oz, hydrationCoefficient: 1 };
}

/** What a save left behind, so Undo can take exactly that back. */
export type SavedDrink =
  | { readonly kind: 'water'; readonly cycleId: string }
  | { readonly kind: 'recorded'; readonly id: number };

/** The same check the Scan screen's existing Undo uses for a water log. */
const WATER_ID = /^intake-\d+$/;

export function canUndo(saved: SavedDrink | null): saved is SavedDrink {
  if (!saved) return false;
  return saved.kind === 'water' ? WATER_ID.test(saved.cycleId) : Number.isInteger(saved.id) && saved.id > 0;
}

export async function undoSaved(
  saved: SavedDrink | null,
  deps: {
    undoWater: (cycleId: string) => Promise<boolean>;
    removeRecorded: (id: number) => Promise<boolean>;
  },
): Promise<boolean> {
  if (!canUndo(saved)) return false;
  try {
    return saved.kind === 'water' ? await deps.undoWater(saved.cycleId) : await deps.removeRecorded(saved.id);
  } catch {
    return false;
  }
}

export interface LogGuard {
  /** True when this write may start. False for a second tap, or the same drink again. */
  begin(drinkKey: string): boolean;
  settle(saved: boolean): void;
  /** A new drink in view (Scan again, a different barcode): its own writes are allowed again. */
  reset(): void;
}

export function createLogGuard(): LogGuard {
  let phase: 'idle' | 'inflight' | 'saved' = 'idle';
  let savedKey: string | null = null;
  let pendingKey: string | null = null;
  return {
    begin(key) {
      if (phase === 'inflight') return false;
      if (phase === 'saved' && savedKey === key) return false;
      phase = 'inflight';
      pendingKey = key;
      return true;
    },
    settle(saved) {
      phase = saved ? 'saved' : 'idle';
      savedKey = saved ? pendingKey : null;
      pendingKey = null;
    },
    reset() {
      phase = 'idle';
      savedKey = null;
      pendingKey = null;
    },
  };
}

/** One key per drink and amount, so a retry of the same save is recognised. */
export const drinkKey = (args: DrinkLogArgs, epoch: number) => `${epoch}|${args.categoryId}|${args.displayName}|${args.enteredOz}`;
