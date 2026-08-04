/**
 * CoachModeVoiceSync — mirrors the effective Coach Mode into the
 * `services/textToSpeech` choke point.
 *
 * `services/coachMode.ts` (silent/ambient/spoken) is a React
 * context/AsyncStorage-backed setting: `useCoachMode()` combines the
 * user's stored picker choice with the `spec_coachV2` feature flag
 * (returns 'spoken' — today's behavior — until the flag is on). But
 * `services/textToSpeech.speak()` is a plain function called from many
 * non-hook call sites (hooks, the app-store provider's voice effect,
 * overlays), so it can't call `useCoachMode()` itself.
 *
 * This is a tiny read-only bridge — same pattern as
 * `ActivationDeepLinkObserver` / `CommandLedgerSyncMount` in
 * `app/_layout.tsx` — that reads the live mode via hooks and pushes it
 * into `textToSpeech`'s module-level singleton via
 * `setEffectiveCoachMode()`. Mounted once, inside `<AppProvider>`, in
 * `app/_layout.tsx`. Renders nothing; never dispatches.
 *
 * Deliberately its OWN file rather than living inside `store/useAppStore.tsx`
 * or `services/coachMode.ts`: `coachMode.ts` already imports
 * `useFeatureFlags` from `store/useAppStore`, so wiring this from either of
 * those two files would create a store↔service import cycle. A leaf
 * component that imports from both, mounted by a third file, avoids it.
 */
import React from 'react';

import { useFeatureFlags } from '@/store/useAppStore';
import { resolveEffectiveCoachMode, useCoachModeSetting } from '@/services/coachMode';
import { setEffectiveCoachMode } from '@/services/textToSpeech';

export function CoachModeVoiceSync(): null {
  const flags = useFeatureFlags();
  const storedMode = useCoachModeSetting();
  // Same shared formula useCoachMode() uses — see resolveEffectiveCoachMode's
  // doc comment for why it's factored out instead of duplicated here.
  const effective = resolveEffectiveCoachMode(flags.spec_coachV2, storedMode);

  React.useEffect(() => {
    setEffectiveCoachMode(effective);
  }, [effective]);

  return null;
}

export default CoachModeVoiceSync;
