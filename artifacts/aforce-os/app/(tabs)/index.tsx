/**
 * Home — AForce OS Hydration Control System.
 *
 * Renders the Phase 2 redesign (`HomeScreenV2`) when `spec_home` is on —
 * the default in `featureFlags/flags.ts`, so this is the live path in
 * production. The legacy Home (minimal, score-driven command surface;
 * see `@/components/home/HomeScreenLegacy.tsx` for its own header) is
 * `React.lazy`-loaded instead of statically imported.
 *
 * RC-1 Wave-3 P1 perf fix (audit P2-7): this file used to statically
 * import the ENTIRE legacy component tree (CommandConsole, EntryActions,
 * HomeDashboard, MetabolicReadinessZone, PerformanceAgeZone,
 * VoiceCheckInZone, ActivationJourneyZone, AIVideoPlayer, StatusPulseOrb,
 * FlavorPickerModal, etc.) even though `spec_home: true` makes that branch
 * unreachable in production — so Metro evaluated all of it on every cold
 * start for nothing. The legacy render path was relocated verbatim to
 * `@/components/home/HomeScreenLegacy.tsx` (no JSX/logic/styles changed,
 * see that file's header) so it can be lazy-loaded here instead: Metro now
 * only evaluates that module the moment the flag branch actually renders.
 * The V2 path's import (`HomeScreenV2`) is untouched — still a normal,
 * eager import, exactly as before.
 *
 * RC-1 fix-forward (PR #544 code review, blocker 1): the legacy screen
 * was relocated a second time, from `app/(tabs)/HomeScreenLegacy.tsx` to
 * `components/home/HomeScreenLegacy.tsx`. expo-router treats every file
 * under `app/` as a route; `HomeScreenLegacy.tsx` had no `Tabs.Screen`
 * declaration in `_layout.tsx` (nor an `href: null`), so it rendered as a
 * genuine, undeclared 6th bottom tab ("HomeScreenLegacy", sorting first).
 * Moving it out of `app/` entirely — it was never meant to be routable on
 * its own, only reachable via this lazy import — removes the phantom tab
 * at the source. See `components/home/__tests__/homeTabsRouteManifest.test.ts`
 * for the regression guard against this recurring.
 *
 * Legacy deletion is a separate, pending founder decision (CLAUDE.md
 * working agreement) — this is a lazy-load-only relocation.
 */

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { HomeScreenV2 } from '@/components/home/HomeScreenV2';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';

const LazyHomeScreenLegacy = React.lazy(() => import('@/components/home/HomeScreenLegacy'));

export default function HomeScreen() {
  const specHome = useAppStore().state.featureFlags.spec_home;
  return specHome ? (
    <HomeScreenV2 />
  ) : (
    <React.Suspense fallback={<HomeSkeleton />}>
      <LazyHomeScreenLegacy />
    </React.Suspense>
  );
}
