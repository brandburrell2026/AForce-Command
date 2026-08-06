/**
 * appleRefreshGuard — RC-2 (TestFlight build 45, founder-reported).
 *
 * Real execution, not a source-text guard: `createAppleRefreshGuard()` is
 * pure logic with no React/RN import, so it runs directly under vitest.
 * This is the mechanism `ProfileScreenV2.tsx`'s `refreshAppleSnapshot`
 * actually calls (see the source-guard test in
 * `profileScreenV2AppleRefreshFeedback.test.ts` that proves the wiring),
 * so a real failure here is a real failure of the duplicate-tap guard.
 */
import { describe, it, expect } from 'vitest';
import { createAppleRefreshGuard } from '../appleRefreshGuard';

describe('createAppleRefreshGuard — duplicate-tap guard (founder item 2)', () => {
  it('acquire() succeeds on a fresh guard', () => {
    const guard = createAppleRefreshGuard();
    expect(guard.busy).toBe(false);
    expect(guard.acquire()).toBe(true);
    expect(guard.busy).toBe(true);
  });

  it('a rapid double-tap — two synchronous acquire() calls before any release — lets exactly ONE through', () => {
    const guard = createAppleRefreshGuard();
    const first = guard.acquire();
    const second = guard.acquire(); // simulates the second tap arriving before the first fetch's `await` ever suspends
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('after release(), a new acquire() succeeds again (retry after completion is not permanently blocked)', () => {
    const guard = createAppleRefreshGuard();
    guard.acquire();
    guard.release();
    expect(guard.busy).toBe(false);
    expect(guard.acquire()).toBe(true);
  });

  it('release() is safe to call even if never acquired (symmetry with a `finally` that always runs)', () => {
    const guard = createAppleRefreshGuard();
    expect(() => guard.release()).not.toThrow();
    expect(guard.busy).toBe(false);
  });

  it('three back-to-back acquire() calls before any release still let exactly one through', () => {
    const guard = createAppleRefreshGuard();
    const results = [guard.acquire(), guard.acquire(), guard.acquire()];
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
