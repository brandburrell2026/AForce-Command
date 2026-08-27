/**
 * Leaderboard route.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { LeaderboardScreenV2 } from '@/components/leaderboard/LeaderboardScreenV2';

export default function LeaderboardRoute() {
  return <LeaderboardScreenV2 />;
}
