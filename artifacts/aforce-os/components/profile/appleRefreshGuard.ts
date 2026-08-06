/**
 * appleRefreshGuard (RC-2) — synchronous in-flight guard for the Apple
 * Health refresh action.
 *
 * `refreshAppleSnapshot` in `ProfileScreenV2.tsx` is invoked from a
 * `Pressable`'s `onPress`. Two rapid taps can call it twice before the
 * first call's `await` ever suspends and before React commits any state
 * update — a `useState` boolean alone is NOT a reliable duplicate-tap
 * guard, because `setState` is async/batched and both taps can read the
 * same stale `false` value. This is a plain synchronous object (held in a
 * `useRef`, never itself reactive) so the SECOND of two back-to-back calls
 * is rejected before it ever reaches `fetchAppleHealthSnapshot()`.
 *
 * No React import — pure logic, unit-tested directly, same convention as
 * `components/ui/motionLogic.ts`.
 */

export interface AppleRefreshGuard {
  /** Marks the guard busy and returns true, UNLESS it was already busy — then returns false and does nothing. */
  acquire(): boolean;
  /** Releases the guard. Safe to call even if never acquired. */
  release(): void;
  /** Current busy state (read-only; for tests/inspection). */
  readonly busy: boolean;
}

export function createAppleRefreshGuard(): AppleRefreshGuard {
  let busy = false;
  return {
    acquire() {
      if (busy) return false;
      busy = true;
      return true;
    },
    release() {
      busy = false;
    },
    get busy() {
      return busy;
    },
  };
}
