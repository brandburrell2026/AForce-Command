import { TravelIntelligenceLifecycle } from './TravelIntelligenceLifecycle';
import React from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useFeatureFlags } from '@/store/useAppStore';
import { travelPilotAvailable } from '@/featureFlags/flags';
import { getScopeState, subscribeScopeState, scopeResolved } from '@/services/userScope';
import { travelRuntime } from '@/services/travel/runtime';
import { observeTravelReminderTaps } from '@/services/travel/reminderNative';

/** Root host: the OS scheduler must track sign-out even when Travel is closed. */
export function TravelLifecycleMount() {
  const flags = useFeatureFlags();
  const enabled = travelPilotAvailable(flags);
  const router = useRouter();
  const queryClient = useQueryClient();
  React.useEffect(() => {
    travelRuntime.setEnabled(enabled);
    const clearRetiredCaches = async () => {
      const identity = getScopeState();
      if (identity.status !== 'AUTHENTICATED' && identity.status !== 'ANONYMOUS') return;
      const owner = identity.status === 'AUTHENTICATED' ? identity.userId : null;
      const predicate = (query: { queryKey: readonly unknown[] }) => {
        const key = query.queryKey;
        return (key[0] === 'travel-journey-v1' || key[0] === 'travel-flight-status-v1' || key[0] === 'travel-intelligence-v2') && key[1] !== owner;
      };
      await queryClient.cancelQueries({ predicate });
      if (getScopeState() === identity) queryClient.removeQueries({ predicate });
    };
    const sync = () => { void travelRuntime.sync(); void clearRetiredCaches(); };
    // Raw identity transitions fire even while the older namespace-isolation
    // flag is off. Phase-2 namespace cleanup alone would miss A → B there.
    const unsubscribe = subscribeScopeState(sync);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    sync();
    return () => {
      unsubscribe(); foreground.remove();
      travelRuntime.setEnabled(false);
      void travelRuntime.sync();
    };
  }, [enabled, queryClient]);
  React.useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let remove: (() => void) | undefined;
    void observeTravelReminderTaps(async (hash, createdAt) => {
      await scopeResolved();
      if (!stopped && await travelRuntime.canOpenReminder(hash, createdAt) && !stopped) router.push('/travel' as never);
    }).then(unsubscribe => { if (stopped) unsubscribe(); else remove = unsubscribe; }).catch(() => {});
    return () => { stopped = true; remove?.(); };
  }, [enabled, router]);
  return <TravelIntelligenceLifecycle enabled={enabled} />;
}
