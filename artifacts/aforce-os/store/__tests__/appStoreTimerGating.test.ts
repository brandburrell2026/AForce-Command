/**
 * `store/useAppStore.tsx` timer-gating wiring (RC-1 fix-forward, PR #544
 * code review — blocker 2).
 *
 * `useAppStore.tsx` transitively imports a long chain of native/expo
 * services (phantom band BLE, TTS, secure storage, i18n, …) that fail to
 * load under this repo's node-environment vitest run (a pre-existing
 * `__DEV__ is not defined` gap in `expo-modules-core`, documented in
 * `governance/TEST-BASELINE.md`) — so, same as
 * `components/home/__tests__/homeRouteLazyLegacyWiring.test.ts` and
 * `hooks/__tests__/useAppStateGatedInterval.test.ts`'s own precedent, this
 * is a source-text guard rather than a mounted-component test.
 *
 * What this verifies (the exact regression PR #544 shipped and this
 * fix-forward corrects):
 *   1. the 1s countdown tick (`TICK_TIMER`) is NOT wrapped in
 *      `useAppStateGatedInterval` — it must run on a plain, always-on
 *      `setInterval` so it keeps decrementing while the app is
 *      backgrounded/inactive. WHY: the reducer's `TICK_TIMER` case
 *      (`appStoreReducer.ts`) is a pure "decrement by 1 per dispatch"
 *      accumulator with no clock — gating it froze the countdown for the
 *      full background duration and fired `pendingConfirmation` that same
 *      amount late (see the comment above the tick's `useEffect` in
 *      `useAppStore.tsx` for the full rationale);
 *   2. the tick's plain interval fires at the correct 1000ms cadence and
 *      is cleaned up on unmount-equivalent (a `useEffect` cleanup
 *      returning `clearInterval`), matching a normal `setInterval`
 *      lifecycle;
 *   3. `useAppStateGatedInterval` is still used — EXACTLY twice — for the
 *      30s `/state` poll and the 15min weather refresh, which stay
 *      correctly gated (both are idempotent network wakes, unlike the
 *      tick).
 *
 * Mutation-verify: re-wrapping the tick in `useAppStateGatedInterval`
 * (re-introducing the regression) fails test 1 (the forbidden pattern
 * reappears) AND test 3 (the gated-call count becomes 3, not 2).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'useAppStore.tsx'), 'utf8');
// Strip comments so assertions can't accidentally match documentation text
// (e.g. this file's own doc comments quoting the old, buggy call shape).
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('useAppStore.tsx — timer AppState-gating wiring (RC-1 fix-forward, blocker 2)', () => {
  it('does NOT wrap the TICK_TIMER dispatch in useAppStateGatedInterval', () => {
    expect(CODE).not.toMatch(
      /useAppStateGatedInterval\(\s*\(\)\s*=>\s*dispatch\(\{\s*type:\s*'TICK_TIMER'/,
    );
  });

  it('drives TICK_TIMER from a plain, always-on setInterval at a 1000ms cadence', () => {
    expect(CODE).toMatch(
      /setInterval\(\s*\(\)\s*=>\s*dispatch\(\{\s*type:\s*'TICK_TIMER'\s*\}\)\s*,\s*1000\s*\)/,
    );
  });

  it('cleans up the tick interval (clearInterval in the effect cleanup)', () => {
    expect(CODE).toMatch(/return\s*\(\)\s*=>\s*clearInterval\(\s*id\s*\)/);
  });

  it('keeps EXACTLY two call sites still wrapped in useAppStateGatedInterval — the 30s poll and 15min weather refresh', () => {
    const matches = CODE.match(/useAppStateGatedInterval\(/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('the 30s /state poll is still AppState-gated', () => {
    expect(CODE).toMatch(
      /useAppStateGatedInterval\(\s*\(\)\s*=>\s*\{\s*void refreshState\(\);?\s*\}\s*,\s*30\s*\*\s*1000\s*\)/,
    );
  });

  it('the 15min weather refresh is still AppState-gated', () => {
    expect(CODE).toMatch(
      /useAppStateGatedInterval\(\s*\(\)\s*=>\s*\{\s*void weatherTick\(/,
    );
    expect(CODE).toMatch(/15\s*\*\s*60\s*\*\s*1000/);
  });
});

describe('useAppStore.tsx — single outbox-flush path (RC-1 fix-forward, should-fix 4)', () => {
  it('calls flushOutboxRef.current() from EXACTLY one call site (no duplicate foreground flush)', () => {
    const matches = CODE.match(/flushOutboxRef\.current\(\)/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('does not register a second, standalone AppState "active" listener that also flushes the outbox', () => {
    // The one remaining flush call lives inside `refreshState`, triggered by
    // the 30s gated interval's resume-fire — not by a bespoke listener.
    expect(CODE).not.toMatch(
      /RNAppState\.addEventListener\(\s*'change'\s*,\s*\(next[^)]*\)\s*=>\s*\{\s*if\s*\(\s*next\s*===\s*'active'\s*\)\s*void flushOutboxRef\.current\(\)/,
    );
  });
});
