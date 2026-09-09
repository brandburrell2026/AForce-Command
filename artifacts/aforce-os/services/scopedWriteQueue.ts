/**
 * scopedWriteQueue — the shared scope barriers for durable work.
 *
 * Founder-approved shared file (storage isolation PR B). It exists because the
 * race this program repairs has FOUR distinct windows, and a guard placed in
 * any one of them leaves the other three open. Naming them is the whole point:
 *
 *   W1  decision → facade entry
 *       A store decides to persist under member A, but the write runs inside a
 *       queued lambda. The lambda binds its key when it DRAINS, so if the
 *       account switched in between, A's snapshot is written under B's key.
 *       Barrier: capture the scope at ENQUEUE time; skip at drain if stale.
 *       → `createScopedWriteQueue`
 *
 *   W2  facade entry → native issue
 *       Already closed, in `scopedStorage`: the key is computed before any
 *       further await, so a write issued by A lands under A. That is the
 *       CORRECT outcome, not a bug — A's data belongs in A's namespace.
 *
 *   W3  native issue → completion
 *       A read issued under A can RESOLVE after the switch to B. The bytes are
 *       A's. Barrier: re-check the generation after the native call and refuse
 *       to return the value. → `scopedStorage` throws `ScopeChangedError`.
 *
 *   W4  completion → publish
 *       A store's own `setState` after its own await. Even with W3, a store
 *       that catches the error and then marks itself hydrated would present
 *       "no history" to a member who has history.
 *       Barrier: publish only through `commitIfCurrent`.
 *
 * W3 is the one that protects the INVARIANT (A's bytes never reach B). W4
 * protects CORRECTNESS (a store that could not read stays un-hydrated rather
 * than becoming falsely empty). Both are required; neither substitutes.
 *
 * ── WHY A TOKEN AND NOT "COMPARE THE CURRENT SCOPE" ────────────────────────
 *
 * Comparing against the current scope at completion time answers the wrong
 * question. A → B → A returns to the same scope, but the store's RAM was
 * cleared on the way through, so work begun in the first A is still stale. The
 * generation is monotonic and answers "has anything changed since I started",
 * which is the question that matters.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT DO ─────────────────────────────────────
 *
 * It does not replace a store's own generation counter. `commandLedger` and
 * `performanceMemoryCapture` bump theirs from `clear()` as well as from a
 * scope change, so that counter carries a SECOND invariant — "a delete must
 * not be undone by a late read". Collapsing the two would silently delete a
 * working data-deletion guard. The two conditions are independent and both
 * are checked.
 */

import { getUserScopeGeneration } from './userScope';

/**
 * A capture of "which scope was current when this work began". Opaque on
 * purpose: callers compare it through `isScopeCurrent`, never by reading the
 * number, so the representation can change without touching twelve stores.
 */
export interface ScopeToken {
  readonly generation: number;
}

/** Capture the current scope. Call SYNCHRONOUSLY, before the first await. */
export function captureScope(): ScopeToken {
  return { generation: getUserScopeGeneration() };
}

/** Whether the scope is unchanged since `token` was captured. */
export function isScopeCurrent(token: ScopeToken): boolean {
  return token.generation === getUserScopeGeneration();
}

/**
 * W4 — publish a value derived from durable work, but only if the scope that
 * produced it is still current. Returns whether `apply` ran, so a caller can
 * tell "published" from "abandoned" without inspecting the token itself.
 */
export function commitIfCurrent(token: ScopeToken, apply: () => void): boolean {
  if (!isScopeCurrent(token)) return false;
  apply();
  return true;
}

/**
 * W1 — a per-store serialized write queue whose tasks are bound to the scope
 * that ENQUEUED them.
 *
 * Per-store, not global: the six stores that hand-rolled this each serialized
 * only against themselves, and making one global queue would serialize every
 * store's persists behind each other. The barrier is shared; the ordering
 * stays where it was.
 *
 * A task whose scope has changed by the time it drains is SKIPPED, not failed:
 * the data it would have written belongs to a member who is no longer active,
 * and the store's RAM was already reset by the transition, so there is nothing
 * left to write and nothing to report.
 */
export function createScopedWriteQueue(): <T>(task: () => Promise<T>) => Promise<T | undefined> {
  let writeQueue: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T | undefined> {
    // Captured HERE — at the moment the write was decided — not when the
    // lambda runs. This is the whole of W1.
    const token = captureScope();
    const guarded = async (): Promise<T | undefined> => {
      if (!isScopeCurrent(token)) return undefined;
      return task();
    };
    const run = writeQueue.then(guarded, guarded);
    writeQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
