/**
 * /moment/[id] — the flagship Moment Detail / Ritual screen (Phase 1).
 * Deep-linkable per-moment; flag-gated: `moments_enabled` OFF in production
 * redirects home. Unknown ids redirect to the Moments overview.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { AFScreen } from '@/components/ui';
import { MomentDetailScreen } from '@/components/moments/MomentDetailScreen';
import { MomentRitualSkeleton } from '@/components/moments/MomentsSkeleton';
import { useMomentsData } from '@/components/moments/useMomentsData';
import { useAppStore } from '@/store/useAppStore';

export default function MomentDetailRoute() {
  const enabled = useAppStore().state.featureFlags.moments_enabled;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const data = useMomentsData();
  if (!enabled) return <Redirect href="/" />;
  const moment = typeof id === 'string' ? data.momentById(id) : undefined;
  if (!moment) {
    // Await hydration before deciding the id is unknown. `return null` painted
    // a genuinely blank screen for the length of that wait — on a deep link
    // that is the FIRST thing the member sees, and a black screen reads as a
    // crash, not as a wait. The ritual's shape says "this is arriving".
    if (!data.hydrated) {
      return (
        <AFScreen scroll>
          <MomentRitualSkeleton />
        </AFScreen>
      );
    }
    return <Redirect href="/moments" />;
  }
  return <MomentDetailScreen moment={moment} rec={data.recFor(moment)} nowIso={data.nowIso} />;
}
