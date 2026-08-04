/**
 * Home — AForce OS Hydration Control System.
 *
 * Renders the Phase 2 redesign (`HomeScreenV2`) when `spec_home` is on —
 * the default in `featureFlags/flags.ts`, so this is the live path in
 * production. The legacy Home (minimal, score-driven command surface;
 * see `./HomeScreenLegacy.tsx` for its own header) is `React.lazy`-loaded
 * instead of statically imported.
 *
 * RC-1 Wave-3 P1 perf fix (audit P2-7): this file used to statically
 * import the ENTIRE legacy component tree (CommandConsole, EntryActions,
 * HomeDashboard, MetabolicReadinessZone, PerformanceAgeZone,
 * VoiceCheckInZone, ActivationJourneyZone, AIVideoPlayer, StatusPulseOrb,
 * FlavorPickerModal, etc.) even though `spec_home: true` makes that branch
 * unreachable in production — so Metro evaluated all of it on every cold
 * start for nothing. The legacy render path was relocated verbatim to
 * `./HomeScreenLegacy.tsx` (no JSX/logic/styles changed, see that file's
 * header) so it can be lazy-loaded here instead: Metro now only evaluates
 * that module the moment the flag branch actually renders. The V2 path's
 * import (`HomeScreenV2`) is untouched — still a normal, eager import,
 * exactly as before.
 *
 * Legacy deletion is a separate, pending founder decision (CLAUDE.md
 * working agreement) — this is a lazy-load-only relocation.
 */

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { HomeScreenV2 } from '@/components/home/HomeScreenV2';

const LazyHomeScreenLegacy = React.lazy(() => import('./HomeScreenLegacy'));

export default function HomeScreen() {
  const specHome = useAppStore().state.featureFlags.spec_home;
  return specHome ? (
    <HomeScreenV2 />
  ) : (
    <React.Suspense fallback={null}>
      <LazyHomeScreenLegacy />
    </React.Suspense>
  );
}
