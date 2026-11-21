import React from 'react';
import { useAuth } from '@clerk/expo';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { OneBreathScreen } from '@/components/oneBreath/OneBreathScreen';
import { ConfirmMomentScreen } from '@/components/oneBreath/ConfirmMomentScreen';
import { getScopeState, subscribeScopeState } from '@/services/userScope';
import { useMomentsFirstExperience } from '@/hooks/useMomentsFirstExperience';
import { MomentPreparationScreen } from '@/components/oneBreath/MomentPreparationScreen';
import { preparationPreviewEnabled } from '@/services/preparationAccess';
import { OneBreathConversationScreen } from '@/components/oneBreath/OneBreathConversationScreen';
import { hydrateMoments, useMomentsStore } from '@/services/momentsStore';
import { oneBreathOpensConversation } from '@/utils/oneBreath/conversationRoute';

/** Public shell stays review-only; internal confirmation uses the existing account-scoped store. */
export default function OneBreathRoute() {
  const { momentId, proposal } = useLocalSearchParams<{ momentId?: string; proposal?: string }>();
  const enabled = useMomentsFirstExperience();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const scope = React.useSyncExternalStore(subscribeScopeState, getScopeState, getScopeState);
  if (!enabled) return <OneBreathScreen />;
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (scope.status !== 'AUTHENTICATED' || scope.userId !== userId) return <Redirect href="/" />;
  if (preparationPreviewEnabled()) return <InternalOneBreath key={`${userId}:${momentId ?? "new"}`} momentId={momentId} proposal={proposal} />;
  return preparationPreviewEnabled() ? <MomentPreparationScreen key={`${userId}:${momentId ?? "new"}`} context="one_breath" /> : <ConfirmMomentScreen key={userId} />;
}

/**
 * Internal builds: a new plan opens on the conversation; a Moment that already
 * exists keeps its own screens (Lock In, Quiet, Return, Replay). The choice is
 * made once per visit, so sealing a plan in the conversation does not swap the
 * screen out from under the member.
 */
function InternalOneBreath({ momentId, proposal }: { momentId?: string; proposal?: string }) {
  const store = useMomentsStore();
  React.useEffect(() => {
    if (!store.hydrated) void hydrateMoments();
  }, [store.hydrated]);
  const [conversation, setConversation] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (conversation !== null || !store.hydrated) return;
    setConversation(oneBreathOpensConversation({ internal: true, momentId, proposal, hydrated: true, moments: store.moments }));
  }, [conversation, store.hydrated, store.moments, momentId, proposal]);
  if (momentId || proposal) return <MomentPreparationScreen context="one_breath" />;
  if (conversation === null) return null;
  return conversation ? <OneBreathConversationScreen /> : <MomentPreparationScreen context="one_breath" />;
}
