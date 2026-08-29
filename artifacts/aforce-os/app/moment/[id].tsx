/**
 * /moment/[id] — the flagship Moment Detail / Ritual screen (Phase 1).
 * Deep-linkable per-moment; flag-gated: `moments_enabled` OFF in production
 * redirects home. Unknown ids redirect to the Moments overview. When
 * `editorial_moments_enabled` is on (E3, founder ruling 2026-08-29) the
 * Editorial OS "Performance Story" composition renders instead;
 * `MomentDetailScreen` remains the live flag-OFF rollback branch.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { AFScreen } from '@/components/ui';
import { EditorialMomentDetailScreen } from '@/components/editorial/moments/EditorialMomentDetailScreen';
import { MomentDetailScreen } from '@/components/moments/MomentDetailScreen';
import { MomentRitualSkeleton } from '@/components/moments/MomentsSkeleton';
import { useMomentsData } from '@/components/moments/useMomentsData';
import { useAppStore } from '@/store/useAppStore';

export default function MomentDetailRoute() {
  const flags = useAppStore().state.featureFlags;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const data = useMomentsData();
  if (!flags.moments_enabled) return <Redirect href="/" />;
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
  const rec = data.recFor(moment);
  return flags.editorial_moments_enabled ? (
    <EditorialMomentDetailScreen moment={moment} rec={rec} nowIso={data.nowIso} />
  ) : (
    <MomentDetailScreen moment={moment} rec={rec} nowIso={data.nowIso} />
  );
}
