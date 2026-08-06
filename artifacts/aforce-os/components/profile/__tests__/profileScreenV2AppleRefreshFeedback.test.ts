/**
 * ProfileScreenV2 — Apple Health refresh feedback (RC-2, TestFlight build
 * 45, founder-reported: "the refresh icon does nothing visibly when
 * tapped").
 *
 * COMMANDER'S AUDIT (verified on shipped main @ 669d8c49): the press
 * target was already correctly wired (44pt effective hit target via
 * hitSlop, the RC-1 fix) — NOT a dead button, NOT a too-small target. Root
 * cause was a pure feedback vacuum: no loading state, no success feedback
 * (HealthKit reads rarely change between taps, so a pixel-identical
 * re-render is indistinguishable from a no-op), and no press-state
 * feedback on the Pressable itself.
 *
 * `ProfileScreenV2` pulls in `useAppStore()` / `expo-router` / the WHOOP,
 * Garmin, and Apple Health service modules — the same category of
 * store+router-connected container this repo's existing tests deliberately
 * never mount directly (see `profileScreenV2ErrorAndSkeletonWiring.test.ts`'s
 * header and `homeScreenV2Wiring.test.ts`'s header). This file applies that
 * same established source-text-guard convention.
 *
 * The stateful pieces that genuinely execute (not just text-matched) live
 * in two framework-light siblings, tested with real behavior:
 *  - `appleRefreshGuard.test.ts` — the synchronous duplicate-tap guard.
 *  - `AppleHealthRefreshControl.render.test.tsx` — the presentational
 *    spinner/disabled/confirmation/press-feedback rendering.
 * This file is the wiring proof: that `refreshAppleSnapshot` actually uses
 * the guard and actually drives those props from real fetch outcomes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'ProfileScreenV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

function refreshAppleSnapshotBody(): string {
  const start = CODE.indexOf('const refreshAppleSnapshot');
  const end = CODE.indexOf('const connectAppleHealth');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return CODE.slice(start, end);
}

describe('ProfileScreenV2 — Apple Health refresh: exactly one fetch per tap (founder item 2)', () => {
  it('imports the real synchronous guard rather than a useState-only approximation', () => {
    expect(CODE).toContain("import { createAppleRefreshGuard } from './appleRefreshGuard';");
    expect(CODE).toContain('const appleRefreshGuardRef = React.useRef(createAppleRefreshGuard());');
  });

  it('refreshAppleSnapshot acquires the guard BEFORE calling fetchAppleHealthSnapshot, and bails out if already busy', () => {
    const fnBody = refreshAppleSnapshotBody();
    const acquireIdx = fnBody.indexOf('appleRefreshGuardRef.current.acquire()');
    const fetchIdx = fnBody.indexOf('fetchAppleHealthSnapshot()');
    expect(acquireIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(acquireIdx);
    // The guard call must gate an early return (`if (!...acquire()) return;`),
    // not just be called and ignored.
    expect(fnBody).toMatch(/if\s*\(!appleRefreshGuardRef\.current\.acquire\(\)\)\s*return;/);
  });

  it('releases the guard in a `finally` — so it is released on BOTH success and failure', () => {
    const fnBody = refreshAppleSnapshotBody();
    expect(fnBody).toMatch(/finally\s*\{[\s\S]*appleRefreshGuardRef\.current\.release\(\);/);
  });
});

describe('ProfileScreenV2 — Apple Health refresh: visible loading state (founder item 1)', () => {
  it('declares isRefreshingApple state and passes it to AppleHealthRefreshControl', () => {
    expect(CODE).toContain('const [isRefreshingApple, setIsRefreshingApple] = useState(false);');
    expect(CODE).toContain('isRefreshing={isRefreshingApple}');
  });

  it('sets loading true before the fetch, and clears it in `finally` (so it clears on error too)', () => {
    const fnBody = refreshAppleSnapshotBody();
    const setTrueIdx = fnBody.indexOf('setIsRefreshingApple(true);');
    const acquireIdx = fnBody.indexOf('appleRefreshGuardRef.current.acquire()');
    const fetchIdx = fnBody.indexOf('fetchAppleHealthSnapshot()');
    expect(setTrueIdx).toBeGreaterThan(acquireIdx);
    expect(setTrueIdx).toBeLessThan(fetchIdx);
    expect(fnBody).toMatch(/finally\s*\{[\s\S]*setIsRefreshingApple\(false\);/);
  });
});

describe('ProfileScreenV2 — Apple Health refresh: completion feedback survives byte-identical data (founder item 3, THE CORE BUG)', () => {
  it('sets the confirmation flag unconditionally in the success branch — not gated behind any diff/equality check against the previous snapshot', () => {
    const fnBody = refreshAppleSnapshotBody();
    const successIdx = fnBody.indexOf('setAppleHealthSnapshot({ ...snap, fetchedAt: Date.now() });');
    const confirmIdx = fnBody.indexOf('setAppleUpdatedConfirmationVisible(true);');
    expect(successIdx).toBeGreaterThan(-1);
    expect(confirmIdx).toBeGreaterThan(successIdx);
    // Between the successful fetch resolving and the confirmation firing,
    // there must be no `if` that could gate it on the snapshot's contents
    // (e.g. comparing against a previous value) — only timer bookkeeping.
    const between = fnBody.slice(successIdx, confirmIdx);
    expect(between).not.toMatch(/if\s*\(/);
  });

  it('mutation-verify anchor: the exact statement that fixes the core bug is present in the success path', () => {
    // This assertion is intentionally literal (not a loose regex) so that
    // deleting or commenting out the confirmation line — the mutation this
    // ticket calls out by name — fails this test.
    const fnBody = refreshAppleSnapshotBody();
    expect(fnBody).toContain('setAppleUpdatedConfirmationVisible(true);');
  });

  it('the confirmation auto-clears via a timeout rather than staying on screen forever', () => {
    const fnBody = refreshAppleSnapshotBody();
    expect(fnBody).toMatch(/setTimeout\(\s*\(\)\s*=>\s*\{\s*setAppleUpdatedConfirmationVisible\(false\);/);
  });

  it('passes showUpdatedConfirmation and the localized updatedLabel through to the control', () => {
    expect(CODE).toContain('showUpdatedConfirmation={appleUpdatedConfirmationVisible}');
    expect(CODE).toContain("updatedLabel={t('profile.v2.apple_updated_confirmation')}");
  });
});

describe('ProfileScreenV2 — Apple Health refresh: failure path unchanged (founder item 5)', () => {
  it('still wraps the fetch in try/catch and sets appleFetchError on failure (RC-1 Wave-2B behavior preserved)', () => {
    const fnBody = refreshAppleSnapshotBody();
    expect(fnBody).toMatch(/try\s*\{[\s\S]*fetchAppleHealthSnapshot\(\)[\s\S]*\}\s*catch\s*\(err\)\s*\{/);
    expect(fnBody).toContain('setAppleFetchError(');
  });

  it('still clears appleFetchError on a successful fetch', () => {
    const fnBody = refreshAppleSnapshotBody();
    expect(fnBody).toContain('setAppleFetchError(null);');
  });

  it('the existing retryable AFInlineErrorRow wiring is untouched — onRetry still calls refreshAppleSnapshot', () => {
    expect(CODE).toContain('testID="profile-apple-fetch-error"');
    expect(CODE).toContain('testID="profile-apple-fetch-error-no-snapshot"');
    const occurrences = CODE.split('onRetry={() => { void refreshAppleSnapshot(); }}').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('loading clears on the failure path too (finally runs on both branches — no separate catch-side reset needed)', () => {
    const fnBody = refreshAppleSnapshotBody();
    const catchIdx = fnBody.indexOf('} catch (err) {');
    const finallyIdx = fnBody.indexOf('} finally {');
    expect(catchIdx).toBeGreaterThan(-1);
    expect(finallyIdx).toBeGreaterThan(catchIdx);
    expect(fnBody.slice(finallyIdx)).toContain('setIsRefreshingApple(false);');
  });
});

describe('ProfileScreenV2 — Apple Health refresh: pressed-state feedback (founder item 4)', () => {
  it('renders the pure-presentational AppleHealthRefreshControl instead of a bare Pressable+Icon for the refresh affordance', () => {
    expect(CODE).toContain("import { AppleHealthRefreshControl } from './AppleHealthRefreshControl';");
    expect(CODE).toContain('<AppleHealthRefreshControl');
    expect(CODE).toContain('onPress={() => { void refreshAppleSnapshot(); }}');
  });
});

describe('ProfileScreenV2 — hard constraints untouched', () => {
  it('does not reference HealthKit permission scopes, scoringEngine, statusColor, or hydroStateModel in this diff area', () => {
    const fnBody = refreshAppleSnapshotBody();
    expect(fnBody).not.toMatch(/toShare|scoringEngine|statusColor|hydroStateModel/);
  });
});
