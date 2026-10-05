/**
 * /concierge/memory — what the concierge remembers (see / edit / forget).
 * Same flag guard as /concierge.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { ConciergeMemoryScreen } from '@/components/concierge/ConciergeMemoryScreen';
import { useFeatureFlags } from '@/store/useAppStore';

export default function ConciergeMemoryRoute() {
  const flags = useFeatureFlags();
  if (!flags.ai_concierge_enabled) return <Redirect href="/" />;
  return <ConciergeMemoryScreen />;
}
