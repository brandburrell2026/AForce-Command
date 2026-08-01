/**
 * /social — LEGACY compatibility route for the Night Out screen (NO-b / NO-b checks).
 *
 * Preserved as a deep-link / stored-data compatibility ALIAS (the tab button is
 * `href: null` in `_layout.tsx`, so it is never on the bar). It is now
 * authorization-gated so it cannot bypass Night Out's Founder/Internal-Preview
 * restriction (NO-10): when unauthorized it redirects to the Protocol tab
 * (terminal — no loop); when authorized it renders the Night Out screen, same as
 * the canonical `/night-out` route. No scoring/alcohol/session behavior changes;
 * opening the route never activates a session.
 */
import React from 'react';
import { Redirect } from 'expo-router';
import { useFeatureFlags } from '@/store/useAppStore';
import { isNightOutEnabled, nightOutInternalPreviewContext } from '@/services/nightOut/access';
import SocialModeV2Screen from '@/screens/SocialModeV2Screen';

export default function SocialLegacyAliasRoute() {
  const flags = useFeatureFlags();
  if (!isNightOutEnabled(flags, nightOutInternalPreviewContext())) {
    return <Redirect href="/(tabs)/protocol" />;
  }
  return <SocialModeV2Screen />;
}
