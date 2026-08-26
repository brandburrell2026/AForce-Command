/**
 * /moments-plan — PREPARE MY DAY (Phase 2). Non-tab root-Stack route;
 * flag-gated: `moments_enabled` OFF in production redirects home.
 */
import { Redirect } from 'expo-router';

import { PrepareMyDayScreen } from '@/components/moments/PrepareMyDayScreen';
import { useAppStore } from '@/store/useAppStore';

export default function MomentsPlanRoute() {
  const enabled = useAppStore().state.featureFlags.moments_enabled;
  if (!enabled) return <Redirect href="/" />;
  return <PrepareMyDayScreen />;
}
