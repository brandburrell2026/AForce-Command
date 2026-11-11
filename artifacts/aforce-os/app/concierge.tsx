/**
 * /concierge — AForce Concierge (Section 64 conversational surface).
 *
 * Flag-guarded at the route seam like /moments and /recovery-coach: with
 * `ai_concierge_enabled` off the route redirects Home, so a stale deep link
 * never opens a dark surface.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { ConciergeScreen } from '@/components/concierge/ConciergeScreen';
import { useFeatureFlags } from '@/store/useAppStore';

export default function ConciergeRoute() {
  const flags = useFeatureFlags();
  if (!flags.ai_concierge_enabled) return <Redirect href="/" />;
  return <ConciergeScreen />;
}
