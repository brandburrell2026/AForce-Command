/**
 * /moment/[id] — the flagship Moment Detail / Ritual screen (Phase 1).
 * Deep-linkable per-moment; flag-gated: `moments_enabled` OFF in production
 * redirects home. Unknown ids redirect to the Moments overview.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { MomentDetailScreen } from '@/components/moments/MomentDetailScreen';
import { useMomentsData } from '@/components/moments/useMomentsData';
import { useAppStore } from '@/store/useAppStore';

export default function MomentDetailRoute() {
  const enabled = useAppStore().state.featureFlags.moments_enabled;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const data = useMomentsData();
  if (!enabled) return <Redirect href="/" />;
  const moment = typeof id === 'string' ? data.momentById(id) : undefined;
  if (!moment) {
    // Await hydration before deciding the id is unknown.
    if (!data.hydrated) return null;
    return <Redirect href="/moments" />;
  }
  return <MomentDetailScreen moment={moment} rec={data.recFor(moment)} nowIso={data.nowIso} />;
}
