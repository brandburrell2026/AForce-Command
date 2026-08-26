/**
 * Hydration tab route.
 *
 * BUILD-61 CORRECTION (Build 60 failed physical-device QA). This route used to
 * branch on `signal_v3_dashboard_enabled` FIRST:
 *
 *   if (flags.signal_v3_dashboard_enabled) return <PerformanceSignalV3 />;
 *
 * and that flag ships ON (featureFlags/flags.ts), so tapping HYDRATION landed
 * on Performance Signal's history screen and `HydrationScreenV2` — the intake
 * ring, "Scan a drink" / "Log manually", the week strip — was UNREACHABLE in
 * production. A history screen had quietly taken the tab whose whole job is
 * logging a drink.
 *
 * The tab now owns the hydration experience, two-way, newest first:
 *   1. `spec_hydration` → HydrationScreenV2 (Phase 2 hydration dashboard).
 *   2. else the legacy <JournalScreen/> (Performance Timeline + PDF export),
 *      preserved verbatim for the flag-off case.
 *
 * PerformanceSignalV3 was NOT removed and NOT demoted: it moved from REPLACING
 * this tab to being a push destination at `/performance-signal`, reached from
 * HydrationScreenV2's "Performance Signal" row — the same root → detail push
 * Home already uses for `/weekly-report`. `signal_v3_dashboard_enabled` still
 * decides what that destination renders; it just no longer decides what this
 * TAB is. Founder: "The Hydration root must remain useful even if history
 * fails."
 */

import React from 'react';
import JournalScreen from '@/screens/JournalScreen';
import { HydrationScreenV2 } from '@/components/hydration/HydrationScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function JournalRoute() {
  const flags = useAppStore().state.featureFlags;
  return flags.spec_hydration ? <HydrationScreenV2 /> : <JournalScreen />;
}
