/**
 * ConversationalCoachMount — Section 64 Step 2 proactive coach mount.
 *
 * Voice-only side-effect (renders nothing), mounted in AppShell next to the
 * other voice mounts. Outer flag gate: when `conversational_intelligence_enabled`
 * is OFF this returns null BEFORE the §64 hook — and therefore every store read,
 * effect, and speak — can run. That is the flag-off inert lock: byte-identical to
 * today with the feature dark. The coach is only active once the front door is
 * dismissed (`openingDone`).
 *
 * Score-Protection: dispatches nothing, never touches score.
 */
import React from 'react';

import { useFeatureFlags } from '@/store/useAppStore';
import { useConversationalCoach } from '@/hooks/useConversationalCoach';

export function ConversationalCoachMount({ openingDone }: { openingDone: boolean }) {
  const flags = useFeatureFlags();
  if (!flags.conversational_intelligence_enabled) return null;
  return <ConversationalCoachMountInner openingDone={openingDone} />;
}

function ConversationalCoachMountInner({ openingDone }: { openingDone: boolean }) {
  useConversationalCoach(openingDone);
  return null;
}
