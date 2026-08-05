/**
 * `useActionsSlice<T>()` unchecked-cast guard (RC-1 W3 r2 hardening, #551
 * verdict follow-up — should-fix 1) + `_renderCountHarness.tsx`'s
 * `buildHarnessActions()` hand-mirror sync (nit 5).
 *
 * `store/slices.tsx`'s `useActionsSlice<T = ActionsSlice>()` returns
 * `useContext(ActionsContext) as unknown as T` — an unchecked cast. A screen
 * can declare `useActionsSlice<{ someAction: () => void }>()` for an action
 * the real `AppProvider` actions memo (`store/useAppStore.tsx`) doesn't
 * actually provide, and TypeScript will never flag the mismatch: the
 * destructured `someAction` is simply `undefined` at runtime, and the
 * failure only surfaces the moment a user triggers the call site.
 *
 * This suite closes that gap two ways:
 *   1. For each RC-1 W3P2-migrated screen, source-scans the real `actions`
 *      memo for its actual key set and the screen for the keys it actually
 *      destructures off `useActionsSlice()`, then asserts the real memo is a
 *      superset — so dropping (or typo-ing) an action the memo used to
 *      provide fails this test loudly instead of shipping a screen that
 *      silently calls `undefined()`.
 *   2. Asserts `_renderCountHarness.tsx`'s `buildHarnessActions()` — a
 *      hand-written mirror of the real actions memo used to drive the
 *      render-count probes below — carries the EXACT same key set as the
 *      real memo, in both directions, so that hand-mirror can't quietly
 *      drift stale (an action added to the real memo but never mirrored, or
 *      vice versa) without a failing test calling it out.
 *
 * Both checks read `store/useAppStore.tsx` (and each screen) from disk
 * rather than mounting `AppProvider` — the provider transitively imports
 * AsyncStorage / expo-location / phantom-band BLE / secureKV / i18nService,
 * all of which hit the documented pre-existing `ReferenceError: __DEV__ is
 * not defined` load failure under this repo's vitest runtime (see
 * `_renderCountHarness.tsx`'s header for the full citation trail). A
 * source-scan is the same convention every other `useAppStore.tsx`-adjacent
 * guard in this repo already uses (`appStoreTimerGating.test.ts`, the
 * `*RenderCount.render.test.tsx` files).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  extractActionsMemoKeys,
  extractDestructuredActionKeys,
} from './_actionsSourceScan';
import { buildHarnessActions } from './_renderCountHarness';

const USE_APP_STORE_SOURCE = readFileSync(join(__dirname, '..', 'useAppStore.tsx'), 'utf8');

const SCREENS: Array<{ name: string; source: string }> = [
  {
    name: 'HomeScreenV2',
    source: readFileSync(join(__dirname, '..', '..', 'components', 'home', 'HomeScreenV2.tsx'), 'utf8'),
  },
  {
    name: 'ReadinessInsightsV2',
    source: readFileSync(
      join(__dirname, '..', '..', 'components', 'insights', 'ReadinessInsightsV2.tsx'),
      'utf8',
    ),
  },
  {
    name: 'ProfileScreenV2',
    source: readFileSync(
      join(__dirname, '..', '..', 'components', 'profile', 'ProfileScreenV2.tsx'),
      'utf8',
    ),
  },
];

describe('useActionsSlice<T>() unchecked-cast guard (#551 should-fix 1)', () => {
  const realActionKeys = new Set(extractActionsMemoKeys(USE_APP_STORE_SOURCE));

  it('sanity: the source-scan actually found the real actions memo (regex still matches store/useAppStore.tsx)', () => {
    expect(realActionKeys.size).toBeGreaterThan(0);
    // A loose floor, not a pin — this just proves the regex captured the
    // real multi-line object literal and not e.g. an empty match.
    expect(realActionKeys.size).toBeGreaterThan(20);
  });

  for (const screen of SCREENS) {
    it(`${screen.name}'s useActionsSlice() destructure is a subset of the real actions memo`, () => {
      const destructured = extractDestructuredActionKeys(screen.source);
      const missing = destructured.filter((key) => !realActionKeys.has(key));
      expect(missing).toEqual([]);
    });
  }

  it('mutation-verify: an action key NOT present in the real actions memo is caught', () => {
    // Simulates the exact regression this guard exists for: a screen (or a
    // future refactor of one) destructuring an action the real memo doesn't
    // provide. Using a key no real action is named, rather than mutating
    // source on disk, keeps this test hermetic while still exercising the
    // same comparison the per-screen assertions above run.
    const fabricatedDestructure = ['logIntake', 'thisActionDoesNotExistOnTheRealMemo'];
    const missing = fabricatedDestructure.filter((key) => !realActionKeys.has(key));
    expect(missing).toEqual(['thisActionDoesNotExistOnTheRealMemo']);
  });
});

describe('_renderCountHarness.tsx buildHarnessActions() stays in sync with the real actions memo (#551 nit 5)', () => {
  it('mirrors EXACTLY the real actions memo key set (same source-scan as should-fix 1) — no missing keys, no stale extras', () => {
    const realActionKeys = new Set(extractActionsMemoKeys(USE_APP_STORE_SOURCE));
    const harnessActionKeys = new Set(Object.keys(buildHarnessActions()));

    const missingFromHarness = [...realActionKeys].filter((k) => !harnessActionKeys.has(k)).sort();
    const staleInHarness = [...harnessActionKeys].filter((k) => !realActionKeys.has(k)).sort();

    expect({ missingFromHarness, staleInHarness }).toEqual({
      missingFromHarness: [],
      staleInHarness: [],
    });
  });
});
