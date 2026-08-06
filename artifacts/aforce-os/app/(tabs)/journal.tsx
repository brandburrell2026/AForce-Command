/**
 * Hydration tab route. Renders the Phase 2 hydration dashboard redesign
 * (HydrationScreenV2) when `spec_hydration` is on, else the legacy
 * <JournalScreen/> (Performance Timeline — timeline, daily cards, PDF export).
 * Flipping the flag is the go-live switch; nothing changes for users until then.
 */

import React from 'react';
import JournalScreen from '@/screens/JournalScreen';
import { HydrationScreenV2 } from '@/components/hydration/HydrationScreenV2';
import { ScreenErrorBoundary } from '@/components/ui/ScreenErrorBoundary';
import { useAppStore } from '@/store/useAppStore';

export default function JournalRoute() {
  const specHydration = useAppStore().state.featureFlags.spec_hydration;
  return (
    <ScreenErrorBoundary>
      {specHydration ? <HydrationScreenV2 /> : <JournalScreen />}
    </ScreenErrorBoundary>
  );
}
