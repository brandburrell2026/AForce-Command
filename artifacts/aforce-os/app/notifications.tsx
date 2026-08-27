/**
 * Notifications route — reads/writes the notificationSettings store slice.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { NotificationsScreenV2 } from '@/components/notifications/NotificationsScreenV2';

export default function NotificationsRoute() {
  return <NotificationsScreenV2 />;
}
