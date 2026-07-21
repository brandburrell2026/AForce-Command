/**
 * Notifications route — Phase 3 redesign when `spec_notifScreen` is on, else the
 * preserved legacy screen. Both read/write the notificationSettings store slice.
 */
import { NotificationsLegacy } from '@/components/notifications/NotificationsLegacy';
import { NotificationsScreenV2 } from '@/components/notifications/NotificationsScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function NotificationsRoute() {
  return useAppStore().state.featureFlags.spec_notifScreen ? <NotificationsScreenV2 /> : <NotificationsLegacy />;
}
