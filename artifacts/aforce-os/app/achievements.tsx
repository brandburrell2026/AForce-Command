/**
 * achievements route — Phase 3 redesign when `spec_achievements` is on, else legacy.
 */
import { AchievementsScreen } from '@/screens/AchievementsScreen';
import { AchievementsScreenV2 } from '@/components/achievements/AchievementsScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function AchievementsScreenRoute() {
  return useAppStore().state.featureFlags.spec_achievements ? <AchievementsScreenV2 /> : <AchievementsScreen />;
}
