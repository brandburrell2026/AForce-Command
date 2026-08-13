/**
 * /night-out — canonical AForce Night Out Protocol route (NO-b).
 *
 * Authorization-gated: renders only when Night Out is authorized for this
 * context (restricted flag ON + approved internal-preview context). Otherwise it
 * redirects, so unauthorized / production users can neither see nor enter
 * Night Out.
 *
 * NO-c: the canonical target is now the Water-First command experience
 * (`NightOutCommandScreen`) — HYDROSTATE → NOW → NEXT → LATER, one dominant
 * action, no alcohol. Authorization is enforced here. Rendering changes no
 * scoring/session state.
 *
 * Build-61 correction (device QA, P1): the unauthorized landing moved from the
 * Protocol tab to Circle. Night Out is a SOCIAL entry point; depositing a
 * member on Protocol turned Protocol into a catch-all drawer for whatever else
 * the app could not place. Protocol's job is TODAY / NEXT / WHY / PROGRESS —
 * Circle owns community. Circle (route name `competition`) renders no redirect
 * of its own, so it is terminal and no loop is possible.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { useFeatureFlags } from '@/store/useAppStore';
import { isNightOutEnabled, nightOutInternalPreviewContext } from '@/services/nightOut/access';
import NightOutCommandScreen from '@/screens/NightOutCommandScreen';

export default function NightOutRoute() {
  const flags = useFeatureFlags();
  if (!isNightOutEnabled(flags, nightOutInternalPreviewContext())) {
    return <Redirect href="/(tabs)/competition" />;
  }
  return <NightOutCommandScreen />;
}
