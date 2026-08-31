/**
 * RP-6 — INTAKE UNDO lock (founder ruling R4, Wave 2, 2026-08-31).
 *
 * The undo half of the explicit intake lifecycle. This is the FIRST client
 * consumer of the server's append-only POST /intake/correction (§10 RC-L12:
 * the original row is never mutated or deleted; a correction row references
 * it, reverses today's counters floor-0, and the per-user lock makes a
 * double-tapped Undo safe). The laws below pin the shape that keeps undo
 * inside the existing score-integrity walls:
 *
 *  - the client NEVER does its own reversal arithmetic — server truth comes
 *    back and the engine recomputes from it (postAndRecompute), exactly like
 *    every other server-state write;
 *  - the commit path is the EXISTING allowlisted one (applyServerUserState →
 *    SET_USER_STATE) — no new score-bearing action types, so the
 *    goldenInvariantLocks allowlists are deliberately UNTOUCHED;
 *  - logIntake hands back the logged cycle id so an undo window can exist at
 *    all — and only the success path does (guards and failures return null,
 *    so an undo can never target a write that did not land).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const AOS = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(AOS, p), 'utf8');

describe('R4 — undoIntake routes through the append-only correction endpoint', () => {
  it('realApi: postIntakeCorrection targets /intake/correction via postAndRecompute', () => {
    const src = read('services/realApi.ts');
    const fn = /export function postIntakeCorrection[\s\S]*?\n}/.exec(src)?.[0] ?? '';
    expect(fn, 'postIntakeCorrection must exist').not.toBe('');
    expect(fn).toContain("'/intake/correction'");
    // Server truth + full engine recompute — the same contract every other
    // server-state write uses. No bespoke fetch, no client arithmetic.
    expect(fn).toMatch(/postAndRecompute\(/);
  });

  it('actions: undoIntake exists, is guarded, and commits through applyServerUserState', () => {
    const src = read('store/app/actions.ts');
    const fn = /const undoIntake = useCallback\([\s\S]*?\n  \}, \[/.exec(src)?.[0] ?? '';
    expect(fn, 'undoIntake must exist').not.toBe('');
    // Re-entrancy: an undo cannot race an in-flight cycle write.
    expect(fn).toMatch(/isCompletingCycle/);
    // The id contract: only the canonical `intake-<serverId>` shape is
    // accepted — anything else is refused, never guessed at.
    expect(fn).toMatch(/\^intake-/);
    expect(fn).toMatch(/postIntakeCorrection\(/);
    // The one allowlisted committer — no new dispatch types.
    expect(fn).toMatch(/applyServerUserState\(/);
    expect(fn).not.toMatch(/dispatch\(/);
  });

  it('the client performs NO reversal arithmetic of its own', () => {
    const src = read('store/app/actions.ts');
    const fn = /const undoIntake = useCallback\([\s\S]*?\n  \}, \[/.exec(src)?.[0] ?? '';
    expect(fn, 'undoIntake must exist').not.toBe('');
    // No counter math anywhere in the undo path — the server reverses,
    // the engine recomputes.
    expect(fn).not.toMatch(/ozConsumedToday\s*[-+]/);
    expect(fn).not.toMatch(/unitsConsumedToday\s*[-+]/);
    expect(fn).not.toMatch(/score\s*[-+]=/);
  });

  it('logIntake returns the logged cycle id on success and null on every other path', () => {
    const types = read('store/app/types.ts');
    expect(types).toMatch(/logIntake:[\s\S]*?=> Promise<string \| null>/);
    expect(types).toMatch(/undoIntake:[\s\S]*?=> Promise<boolean>/);
    const src = read('store/app/actions.ts');
    // The success return is the CycleResult id (the `intake-<n>` shape undo
    // consumes); the reentrancy guard and the failure path return null.
    expect(src).toMatch(/if \(state\.isCompletingCycle\) return null;/);
    expect(src).toMatch(/return result\.id;/);
  });
});
