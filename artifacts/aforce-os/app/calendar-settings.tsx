/**
 * /calendar-settings — CONNECT CALENDAR (Phase 3b, DR-011). Non-tab
 * root-Stack route; requires BOTH moments flags (both OFF in production —
 * activation additionally blocked pending Legal+Privacy per PR-002 5.2).
 */
import { Redirect } from 'expo-router';

import { ConnectCalendarScreen } from '@/components/moments/ConnectCalendarScreen';
import { useAppStore } from '@/store/useAppStore';

export default function CalendarSettingsRoute() {
  const flags = useAppStore().state.featureFlags;
  if (!flags.moments_enabled || !flags.moments_calendar_enabled) return <Redirect href="/" />;
  return <ConnectCalendarScreen />;
}
