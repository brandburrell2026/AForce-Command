/**
 * Leaderboard route — Phase 3 redesign when `spec_leaderboard` is on, else legacy.
 */
import { LeaderboardScreen } from '@/screens/LeaderboardScreen';
import { LeaderboardScreenV2 } from '@/components/leaderboard/LeaderboardScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function LeaderboardRoute() {
  return useAppStore().state.featureFlags.spec_leaderboard ? <LeaderboardScreenV2 /> : <LeaderboardScreen />;
}
