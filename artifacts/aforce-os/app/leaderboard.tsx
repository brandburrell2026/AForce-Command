/**
 * Leaderboard route.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { LeaderboardScreenV2 } from '@/components/leaderboard/LeaderboardScreenV2';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function LeaderboardRoute() {
  // SS-18: a render crash here must not blank the whole app.
  return (
    <ScreenErrorBoundary screen="leaderboard">
      <LeaderboardScreenV2 />
    </ScreenErrorBoundary>
  );
}
