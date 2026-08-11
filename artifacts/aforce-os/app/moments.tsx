/**
 * /moments — AForce Moments overview (Phase 2). Non-tab root-Stack route
 * (weekly-report pattern); flag-gated: `moments_enabled` OFF in production
 * redirects home.
 */
import { Redirect } from 'expo-router';

import { MomentsScreen } from '@/components/moments/MomentsScreen';
import { useAppStore } from '@/store/useAppStore';

export default function MomentsRoute() {
  const enabled = useAppStore().state.featureFlags.moments_enabled;
  if (!enabled) return <Redirect href="/" />;
  return <MomentsScreen />;
}
