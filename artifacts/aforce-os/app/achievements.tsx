/**
 * Achievements route.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { AchievementsScreenV2 } from '@/components/achievements/AchievementsScreenV2';

export default function AchievementsScreenRoute() {
  return <AchievementsScreenV2 />;
}
