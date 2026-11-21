import { describe, expect, it, vi } from 'vitest';
import { drinkRoute } from '../hydration/drinkRoute';
import { addSample, createEvidence, readEvidence, type LabelLine } from '../hydroscan/labelEvidence';
import {
  buildDrinkLogArgs,
  canUndo,
  createLogGuard,
  drinkKey,
  undoSaved,
  type SavedDrink,
} from '../hydroscan/labelDrinkLog';

const lines = (...t: string[]): LabelLine[] => t.map((text) => ({ text, confidence: 0.9 }));
const read = (...frames: string[][]) =>
  readEvidence(frames.reduce((s, f) => addSample(s, { lines: lines(...f) }), createEvidence()));

describe('what is handed to the drink save', () => {
  it('needs a drink type and a real amount', () => {
    expect(buildDrinkLogArgs(read(['x']), 12)).toBeNull();
    const r = read(['COCA-COLA', 'ZERO SUGAR'], ['COCA-COLA ZERO SUGAR']);
    expect(buildDrinkLogArgs(r, 0)).toBeNull();
    expect(buildDrinkLogArgs(r, 65)).toBeNull();
    expect(buildDrinkLogArgs(r, Number.NaN)).toBeNull();
    expect(buildDrinkLogArgs(r, 12)).toMatchObject({ categoryId: 'soda', displayName: 'Coke Zero', enteredOz: 12, effectiveOz: 12 });
  });

  it('a soda goes to the private drink log, never the scored rail', () => {
    const args = buildDrinkLogArgs(read(['COCA-COLA ZERO SUGAR'], ['COCA-COLA ZERO SUGAR']), 12)!;
    expect(drinkRoute(args).kind).toBe('recorded');
  });

  it('sparkling water is recorded, not counted as plain water', () => {
    const r = read(['SPARKLING WATER'], ['SPARKLING WATER']);
    const args = buildDrinkLogArgs(r, 12)!;
    expect(drinkRoute(args)).toMatchObject({ kind: 'recorded', categoryId: 'sparkling_water' });
  });

  it('a branded sparkling water that is not in the catalog still carries the word', () => {
    const r = read(['SMARTWATER', 'SPARKLING'], ['SMARTWATER SPARKLING']);
    expect(r.sparkling).toBe(true);
    expect(drinkRoute(buildDrinkLogArgs(r, 12)!).kind).toBe('recorded');
  });

  it('plain bottled water is the only thing that takes the scored water rail', () => {
    const r = read(['PURIFIED WATER'], ['PURIFIED WATER']);
    expect(drinkRoute(buildDrinkLogArgs(r, 16.9)!).kind).toBe('water');
  });

  it('a confirmed alcoholic drink goes to the private drink log and contributes nothing to hydration', () => {
    const r = read(['HARD SELTZER', '5% ALC/VOL'], ['HARD SELTZER', 'GOVERNMENT WARNING']);
    expect(r.drinkType.value).toBe('alcohol');
    const route = drinkRoute(buildDrinkLogArgs(r, 12)!);
    expect(route.kind).toBe('recorded');
    expect(route).toMatchObject({ categoryId: 'alcohol' });
  });
});

describe('a second write of the same drink cannot happen', () => {
  const args = buildDrinkLogArgs(read(['LMNT'], ['LMNT']), 16)!;

  it('a double tap while the save is in flight is refused', () => {
    const g = createLogGuard();
    expect(g.begin(drinkKey(args, 1))).toBe(true);
    expect(g.begin(drinkKey(args, 1))).toBe(false);
  });

  it('repeated samples or taps after the save cannot save it again', () => {
    const g = createLogGuard();
    expect(g.begin(drinkKey(args, 1))).toBe(true);
    g.settle(true);
    expect(g.begin(drinkKey(args, 1))).toBe(false);
  });

  it('a failed save can be retried', () => {
    const g = createLogGuard();
    expect(g.begin(drinkKey(args, 1))).toBe(true);
    g.settle(false);
    expect(g.begin(drinkKey(args, 1))).toBe(true);
  });

  it('a second drink, after Scan again, logs normally even if it is the same drink and amount', () => {
    const g = createLogGuard();
    g.begin(drinkKey(args, 1));
    g.settle(true);
    g.reset();
    expect(g.begin(drinkKey(args, 2))).toBe(true);
  });

  it('a different drink in the same session is not blocked by the saved one', () => {
    const g = createLogGuard();
    g.begin(drinkKey(args, 1));
    g.settle(true);
    const other = buildDrinkLogArgs(read(['GATORADE ZERO'], ['GATORADE ZERO']), 20)!;
    expect(g.begin(drinkKey(other, 1))).toBe(true);
  });
});

describe('Undo takes back exactly what was saved', () => {
  const deps = () => ({ undoWater: vi.fn().mockResolvedValue(true), removeRecorded: vi.fn().mockResolvedValue(true) });

  it('a saved non-water drink is removed by its id', async () => {
    const d = deps();
    expect(await undoSaved({ kind: 'recorded', id: 41 }, d)).toBe(true);
    expect(d.removeRecorded).toHaveBeenCalledWith(41);
    expect(d.undoWater).not.toHaveBeenCalled();
  });

  it('a water log is taken back through the existing intake undo', async () => {
    const d = deps();
    expect(await undoSaved({ kind: 'water', cycleId: 'intake-7' }, d)).toBe(true);
    expect(d.undoWater).toHaveBeenCalledWith('intake-7');
    expect(d.removeRecorded).not.toHaveBeenCalled();
  });

  it('Undo is offered only when the save returned something to remove', async () => {
    const d = deps();
    const bad: (SavedDrink | null)[] = [null, { kind: 'recorded', id: 0 }, { kind: 'recorded', id: 1.5 }, { kind: 'water', cycleId: 'x' }];
    for (const s of bad) {
      expect(canUndo(s)).toBe(false);
      expect(await undoSaved(s, d)).toBe(false);
    }
    expect(d.removeRecorded).not.toHaveBeenCalled();
    expect(d.undoWater).not.toHaveBeenCalled();
  });

  it('a failed removal is not reported as removed', async () => {
    const d = { undoWater: vi.fn(), removeRecorded: vi.fn().mockRejectedValue(new Error('offline')) };
    expect(await undoSaved({ kind: 'recorded', id: 3 }, d)).toBe(false);
    d.removeRecorded.mockResolvedValue(false);
    expect(await undoSaved({ kind: 'recorded', id: 3 }, d)).toBe(false);
  });
});
