/**
 * HYDRATION TAB ROUTING — the Build-60 device-QA defect, locked (Build 61).
 *
 * THE DEFECT. `app/(tabs)/journal.tsx` — the Hydration tab — branched on the
 * newest flag first:
 *
 *   if (flags.signal_v3_dashboard_enabled) return <PerformanceSignalV3 />;
 *   return flags.spec_hydration ? <HydrationScreenV2 /> : <JournalScreen />;
 *
 * `signal_v3_dashboard_enabled` ships ON (the 2026-08-11 V3 launch flip), so
 * the FIRST branch always won and `HydrationScreenV2` — the intake ring, "Scan
 * a drink" / "Log manually", the week strip — was unreachable in production.
 * A member tapped HYDRATION and got a read-only history screen. Nothing caught
 * it: `v3DashboardLaunchFlip.test.ts` pins the flag VALUES, and
 * `performanceSignalV3Wiring.test.ts` pins the history screen's own contents.
 * Neither asked what the tab actually resolves to under shipped flags. This
 * file asks exactly that.
 *
 * THE FIX, in three parts, one describe block each:
 *   1. the tab root is the hydration experience under production flags;
 *   2. Performance Signal is still reachable — as a PUSH DESTINATION
 *      (`app/performance-signal.tsx`) from an affordance on that root, the same
 *      root → detail push Home uses for `/weekly-report`. It was not deleted
 *      and not demoted (Wave 5 did real work on it);
 *   3. the legacy `JournalScreen` fallback is untouched for the flag-off case.
 *
 * WHY SOURCE GUARDS: every file involved is a store-/router-connected container
 * — the category this repo deliberately never mounts in tests (the convention
 * and its rationale are documented in `homeScreenV2Wiring.test.ts`, and
 * `homeTabsRouteManifest.test.ts` already guards `app/(tabs)/` this same way,
 * off disk). The flag arithmetic underneath is checked against the REAL
 * `DEFAULT_FLAGS`, so a future flag flip that re-orphans the tab fails here.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_FLAGS } from '@/featureFlags/flags';
import type { FeatureFlags } from '@/types';

const PKG = join(__dirname, '..', '..', '..');

/** Source with comments stripped, so a doc comment can never satisfy a guard. */
function code(...segments: string[]): string {
  return readFileSync(join(PKG, ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, '');
}

const TAB = code('app', '(tabs)', 'journal.tsx');
const ROUTE = code('app', 'performance-signal.tsx');
const HYDRATION = code('components', 'hydration', 'HydrationScreenV2.tsx');
const SIGNAL = code('components', 'hydration', 'PerformanceSignalV3.tsx');
const ROOT_LAYOUT = code('app', '_layout.tsx');
const EN = JSON.parse(readFileSync(join(PKG, 'locales', 'en.json'), 'utf8')) as {
  hydration: { v2: Record<string, string> };
  signal: { v3: Record<string, string> };
};

/**
 * The tab's branch, restated from the source pinned in the first block below.
 * The restatement is only as good as that pin — which is the point: the pin
 * fails if the source stops matching, and this evaluates the pinned shape
 * against the flags the binary actually ships.
 */
function resolveTabRoot(flags: FeatureFlags): 'HydrationScreenV2' | 'JournalScreen' {
  return flags.spec_hydration ? 'HydrationScreenV2' : 'JournalScreen';
}

describe('Hydration tab — the tab root IS the hydration experience', () => {
  it('branches on spec_hydration alone, straight to HydrationScreenV2', () => {
    expect(TAB).toMatch(
      /return flags\.spec_hydration \? <HydrationScreenV2 \/> : <JournalScreen \/>;/,
    );
    expect(TAB).toContain(
      "import { HydrationScreenV2 } from '@/components/hydration/HydrationScreenV2';",
    );
    // ONE return, so nothing can sit ABOVE the hydration branch and take the
    // tab before it is reached. The pre-fix file had two: the early
    // `if (flags.signal_v3_dashboard_enabled) return <PerformanceSignalV3 />;`
    // sat above this exact line, which is why pinning the line alone would not
    // have caught the defect.
    expect(TAB.match(/\breturn\b/g)).toHaveLength(1);
  });

  it('resolves to HydrationScreenV2 under the flags the production binary ships', () => {
    // The exact question Build 60 never asked. `spec_hydration` is ON, so the
    // member who taps HYDRATION gets the hydration dashboard.
    expect(DEFAULT_FLAGS.spec_hydration).toBe(true);
    expect(resolveTabRoot(DEFAULT_FLAGS)).toBe('HydrationScreenV2');
  });

  it('cannot be taken over by the history screen again — the tab never names it', () => {
    // THE regression. Both halves matter: the flag can't be read here, and the
    // component can't be imported here, so neither a re-ordered branch nor a
    // silent re-add can put a history screen back on this tab.
    expect(TAB).not.toContain('signal_v3_dashboard_enabled');
    expect(TAB).not.toContain('PerformanceSignalV3');
  });

  it('mutation-verify: the pre-fix branch is detectable by these guards', () => {
    // Proves the two assertions above actually move when the source does,
    // rather than passing because the strings never appear anywhere.
    const regressed = `${TAB}\n  if (flags.signal_v3_dashboard_enabled) return <PerformanceSignalV3 />;`;
    expect(regressed).toContain('signal_v3_dashboard_enabled');
    expect(regressed).toContain('PerformanceSignalV3');
    // …and the shape guard moves too: two returns is the pre-fix file.
    expect(regressed.match(/\breturn\b/g)).toHaveLength(2);
  });

  it('keeps the Hydration root independent of the history read (founder: it must remain useful even if history fails)', () => {
    // The root renders from the store only. No rollup fetch, no rollup type,
    // no api client — so a failed/slow history read cannot blank the ring, the
    // log affordances or the week strip. The history's own failure states live
    // entirely on the destination screen.
    expect(HYDRATION).not.toContain('fetchJournalRollups');
    expect(HYDRATION).not.toContain('@/services/realApi');
    expect(HYDRATION).not.toContain('JournalRollup');
  });

  it('keeps the logging affordances the tab exists for', () => {
    // The user-visible loss in Build 60, stated positively.
    expect(HYDRATION).toContain("t('hydration.v2.scan_a_drink')");
    expect(HYDRATION).toContain("t('hydration.v2.log_manually')");
    expect(HYDRATION).toContain('<AFProgressRing');
    expect(HYDRATION).toContain("t('hydration.v2.this_week')");
  });
});

describe('Performance Signal — still reachable, as a push destination', () => {
  it('exists as a root Stack route, NOT as a new tab', () => {
    expect(existsSync(join(PKG, 'app', 'performance-signal.tsx'))).toBe(true);
    // Nav lock: a sixth bottom tab is prohibited. (`homeTabsRouteManifest.test.ts`
    // pins the whole `app/(tabs)/` file set; this states the specific case.)
    expect(existsSync(join(PKG, 'app', '(tabs)', 'performance-signal.tsx'))).toBe(false);
  });

  it('is declared in the root Stack with the same card presentation as /weekly-report', () => {
    expect(ROOT_LAYOUT).toContain(
      '<Stack.Screen name="performance-signal" options={{ headerShown: false, presentation: \'card\' }} />',
    );
  });

  it('renders PerformanceSignalV3 — the Wave-5 screen, not a replacement for it', () => {
    expect(ROUTE).toContain(
      "import { PerformanceSignalV3 } from '@/components/hydration/PerformanceSignalV3';",
    );
    expect(ROUTE).toMatch(/<PerformanceSignalV3\s+onBack=\{onBack\}\s*\/>/);
  });

  it('still lets signal_v3_dashboard_enabled decide what the destination shows', () => {
    // The flag kept its meaning; it simply no longer decides what the TAB is.
    expect(ROUTE).toContain('flags.signal_v3_dashboard_enabled ?');
    expect(DEFAULT_FLAGS.signal_v3_dashboard_enabled).toBe(true);
  });

  it('is pushed from the Hydration root by an obvious, labelled affordance', () => {
    expect(HYDRATION).toContain("onPress={() => router.push('/performance-signal')}");
    expect(HYDRATION).toContain('testID="hydration-v2-history-link"');
    // A shipped primitive, not a new component: AFListRow already renders
    // icon · title · subtitle · disclosure chevron and announces them as one.
    expect(HYDRATION).toMatch(/<AFListRow[\s\S]{0,400}?hydration-v2-history-link/);
    expect(HYDRATION).toMatch(/<AFListRow[\s\S]{0,400}?disclosure/);
  });

  it('names its destination in the row, using the destination screen\'s own title', () => {
    expect(HYDRATION).toContain("t('hydration.v2.history_title')");
    expect(HYDRATION).toContain("t('hydration.v2.history_subtitle')");
    expect(EN.hydration.v2.history_title).toBe(EN.signal.v3.title);
    expect(EN.hydration.v2.history_subtitle).toBeTruthy();
  });

  it('gives the pushed screen a way back that works on a cold deep link', () => {
    // AFTopBar's back control (spec §4.2 — only for non-root destinations),
    // wired to the guarded canGoBack() pattern app/weekly-report.tsx uses, so a
    // deep link with nothing to pop lands on the tab instead of doing nothing.
    expect(SIGNAL).toMatch(/onBack\?: \(\) => void;/);
    expect(SIGNAL).toMatch(/<AFTopBar[^>]*onBack=\{onBack\}/);
    expect(ROUTE).toContain(
      "router.canGoBack() ? router.back() : router.replace('/journal')",
    );
  });

  it('keeps PerformanceSignalV3 router-free, so the demo gallery can still mount it', () => {
    // `onBack` arrives as a prop exactly like `fixtureRollups`; the screen never
    // reaches for expo-router itself. demo/AForceScreenGallery.tsx mounts it
    // with no stack underneath and must keep working.
    expect(SIGNAL).not.toContain('expo-router');
    expect(SIGNAL).toContain('fixtureRollups');
  });
});

describe('Hydration tab — the legacy fallback is untouched', () => {
  it('still falls back to the legacy JournalScreen when spec_hydration is off', () => {
    expect(TAB).toContain("import JournalScreen from '@/screens/JournalScreen';");
    expect(TAB).toMatch(/: <JournalScreen \/>;/);
    expect(resolveTabRoot({ ...DEFAULT_FLAGS, spec_hydration: false })).toBe('JournalScreen');
  });

  it('keeps the legacy Performance Timeline as the destination\'s own flag-off path', () => {
    // Founder ruling on the pre-V3 screens is relocate, never delete.
    expect(ROUTE).toContain("import JournalScreen from '@/screens/JournalScreen';");
    expect(ROUTE).toMatch(/<JournalScreen \/>/);
  });
});
