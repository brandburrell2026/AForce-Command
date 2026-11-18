/**
 * Profile tab.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { ProfileScreenV2 } from '@/components/profile/ProfileScreenV2';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function ProfileRoute() {
  // SS-18: a render crash here must not blank the whole app.
  return (
    <ScreenErrorBoundary screen="profile">
      <ProfileScreenV2 />
    </ScreenErrorBoundary>
  );
}
