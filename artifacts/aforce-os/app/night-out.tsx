/**
 * /night-out — canonical AForce Night Out Protocol route (NO-b).
 *
 * Authorization-gated: renders only when Night Out is authorized for this
 * context (restricted flag ON + approved internal-preview context). Otherwise it
 * redirects to the Protocol tab, so unauthorized / production users can neither
 * see nor enter Night Out, and no loop is possible (Protocol is a terminal tab).
 *
 * NO-b is naming + placement + visibility only. The interim target is the
 * EXISTING screen (renamed to Night Out); the active command experience (pre-
 * session / timer / START WATER) is built in NO-c. No scoring, alcohol, intake,
 * or session state is changed here.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { useFeatureFlags } from '@/store/useAppStore';
import { isNightOutEnabled, nightOutInternalPreviewContext } from '@/services/nightOut/access';
import SocialModeV2Screen from '@/screens/SocialModeV2Screen';

export default function NightOutRoute() {
  const flags = useFeatureFlags();
  if (!isNightOutEnabled(flags, nightOutInternalPreviewContext())) {
    return <Redirect href="/(tabs)/protocol" />;
  }
  return <SocialModeV2Screen />;
}
