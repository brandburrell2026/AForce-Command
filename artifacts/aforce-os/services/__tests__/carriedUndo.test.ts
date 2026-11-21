/**
 * An Undo carried from One Breath to the next screen: offered for the time
 * left, used once, and honest about what happened.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { carryUndo, clearCarriedUndo, getCarriedUndo, takeCarriedUndo, CARRIED_UNDO_RESULT_MS } from '@/services/carriedUndo';

beforeEach(() => { vi.useFakeTimers(); clearCarriedUndo(); });
afterEach(() => vi.useRealTimers());

describe('carried Undo', () => {
  it('is offered for the time left, then goes on its own and the log stands', async () => {
    const undo = vi.fn(async () => true);
    carryUndo({ label: '16 oz water', msLeft: 4_000, undo });
    expect(getCarriedUndo()).toMatchObject({ kind: 'offer', label: '16 oz water' });
    await vi.advanceTimersByTimeAsync(4_100);
    expect(getCarriedUndo()).toEqual({ kind: 'none' });
    await takeCarriedUndo();
    expect(undo).not.toHaveBeenCalled();
  });

  it('runs the undo once, however many taps', async () => {
    const undo = vi.fn(async () => true);
    carryUndo({ label: '16 oz water', msLeft: 4_000, undo });
    await Promise.all([takeCarriedUndo(), takeCarriedUndo()]);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(getCarriedUndo()).toMatchObject({ kind: 'undone' });
    await vi.advanceTimersByTimeAsync(CARRIED_UNDO_RESULT_MS + 50);
    expect(getCarriedUndo()).toEqual({ kind: 'none' });
  });

  it('says the drink is still logged when the undo fails or throws', async () => {
    carryUndo({ label: '16 oz water', msLeft: 4_000, undo: async () => false });
    await takeCarriedUndo();
    expect(getCarriedUndo()).toMatchObject({ kind: 'kept' });
    carryUndo({ label: '8 oz water', msLeft: 4_000, undo: async () => { throw new Error('x'); } });
    await takeCarriedUndo();
    expect(getCarriedUndo()).toMatchObject({ kind: 'kept', label: '8 oz water' });
  });

  it('nothing is offered when no time is left', () => {
    carryUndo({ label: '16 oz water', msLeft: 0, undo: async () => true });
    expect(getCarriedUndo()).toEqual({ kind: 'none' });
  });
});
