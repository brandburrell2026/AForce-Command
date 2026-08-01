/**
 * /night-out — canonical AForce Night Out Protocol route (NO-b).
 *
 * Authorization-gated: renders only when Night Out is authorized for this
 * context (restricted flag ON + approved internal-preview context). Otherwise it
 * redirects to the Protocol tab, so unauthorized / production users can neither
 * see nor enter Night Out, and no loop is possible (Protocol is a terminal tab).
 *
 * NO-c: the canonical target is now the Water-First command experience
 * (`NightOutCommandScreen`) — HYDROSTATE → NOW → NEXT → LATER, one dominant
 * action, no alcohol. Authorization is enforced here: unauthorized / production
 * users are redirected to Protocol (terminal — no loop). Rendering changes no
 * scoring/session state.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { useFeatureFlags } from '@/store/useAppStore';
import { isNightOutEnabled, nightOutInternalPreviewContext } from '@/services/nightOut/access';
import NightOutCommandScreen from '@/screens/NightOutCommandScreen';

export default function NightOutRoute() {
  const flags = useFeatureFlags();
  if (!isNightOutEnabled(flags, nightOutInternalPreviewContext())) {
    return <Redirect href="/(tabs)/protocol" />;
  }
  return <NightOutCommandScreen />;
}
