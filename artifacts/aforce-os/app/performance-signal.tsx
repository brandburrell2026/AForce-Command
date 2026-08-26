/**
 * PERFORMANCE SIGNAL — the Hydration tab's 7-day history, as a PUSH
 * DESTINATION (Build-61 correction).
 *
 * A NON-TAB route (Nav lock: no new tab — the same posture app/weekly-report.tsx
 * documents). Until Build 61 this screen WAS the Hydration tab: the route file
 * `app/(tabs)/journal.tsx` branched on `signal_v3_dashboard_enabled` before
 * `spec_hydration`, and that flag ships ON, so Performance Signal replaced the
 * hydration dashboard outright — the member tapped HYDRATION and got history,
 * with no way back to the intake ring.
 *
 * It is now reached the way every other detail surface in this app is reached:
 * `router.push` from a root screen (see Home → `/weekly-report`), here from
 * HydrationScreenV2's "Performance Signal" row. Nothing about the screen
 * changed — Wave 5's disclosure hierarchy, confidence chip, skeleton, stale
 * notice and retry are all intact — only where it sits in the navigation.
 *
 * `signal_v3_dashboard_enabled` still selects WHAT this destination renders:
 * the V3 Performance Signal when on, else the legacy Performance Timeline
 * (`JournalScreen`), which is the history screen V3 succeeded. Either way the
 * Hydration root above stays whole if the history fails to load (founder: "The
 * Hydration root must remain useful even if history fails").
 */

import React from 'react';
import { Stack, useRouter } from 'expo-router';

import JournalScreen from '@/screens/JournalScreen';
import { PerformanceSignalV3 } from '@/components/hydration/PerformanceSignalV3';
import { useAppStore } from '@/store/useAppStore';

export default function PerformanceSignalRoute() {
  const router = useRouter();
  const flags = useAppStore().state.featureFlags;

  // Guarded back, matching app/weekly-report.tsx: a deep link straight to this
  // route has no stack entry to pop, so fall back to the tab this screen hangs
  // off rather than leaving a control that does nothing. PerformanceSignalV3
  // stays router-free — it takes the handler as a prop, exactly as it takes
  // `fixtureRollups` for the demo gallery.
  const onBack = React.useCallback(
    () => (router.canGoBack() ? router.back() : router.replace('/journal')),
    [router],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {flags.signal_v3_dashboard_enabled ? (
        <PerformanceSignalV3 onBack={onBack} />
      ) : (
        /* Legacy Performance Timeline. It predates AFTopBar and carries no back
           control of its own, so the OS gesture / hardware back is the way out
           here — acceptable because this branch is not the production path
           (`signal_v3_dashboard_enabled` ships ON) and the founder ruling on
           the legacy screens is relocate, never delete. */
        <JournalScreen />
      )}
    </>
  );
}
