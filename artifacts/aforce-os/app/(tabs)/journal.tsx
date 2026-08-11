/**
 * Hydration tab route. Three-way flag branch, newest first:
 *   1. `signal_v3_dashboard_enabled` → PerformanceSignalV3 (founder comps
 *      2026-08-11: Command History / Performance Signal, rollup-backed).
 *   2. `spec_hydration` → HydrationScreenV2 (Phase 2 hydration dashboard).
 *   3. else the legacy <JournalScreen/> (Performance Timeline + PDF export).
 * Flipping a flag is the go-live switch; nothing changes for users until then.
 */

import React from 'react';
import JournalScreen from '@/screens/JournalScreen';
import { HydrationScreenV2 } from '@/components/hydration/HydrationScreenV2';
import { PerformanceSignalV3 } from '@/components/hydration/PerformanceSignalV3';
import { useAppStore } from '@/store/useAppStore';

export default function JournalRoute() {
  const flags = useAppStore().state.featureFlags;
  if (flags.signal_v3_dashboard_enabled) return <PerformanceSignalV3 />;
  return flags.spec_hydration ? <HydrationScreenV2 /> : <JournalScreen />;
}
