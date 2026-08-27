/**
 * Profile tab.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { ProfileScreenV2 } from '@/components/profile/ProfileScreenV2';

export default function ProfileRoute() {
  return <ProfileScreenV2 />;
}
