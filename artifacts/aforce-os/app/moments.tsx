/**
 * /moments — AForce Moments overview (Phase 2). Non-tab root-Stack route
 * (weekly-report pattern); flag-gated: `moments_enabled` OFF in production
 * redirects home. When `editorial_moments_enabled` is on (E3, founder ruling
 * 2026-08-29) the Editorial OS "The Day" composition renders instead;
 * `MomentsScreen` remains the live flag-OFF rollback branch.
 */
import { Redirect } from 'expo-router';

import { EditorialMomentsScreen } from '@/components/editorial/moments/EditorialMomentsScreen';
import { MomentsScreen } from '@/components/moments/MomentsScreen';
import { useAppStore } from '@/store/useAppStore';

export default function MomentsRoute() {
  const flags = useAppStore().state.featureFlags;
  if (!flags.moments_enabled) return <Redirect href="/" />;
  return flags.editorial_moments_enabled ? <EditorialMomentsScreen /> : <MomentsScreen />;
}
