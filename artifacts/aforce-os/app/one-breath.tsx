import React from 'react';
import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { OneBreathScreen } from '@/components/oneBreath/OneBreathScreen';
import { ConfirmMomentScreen } from '@/components/oneBreath/ConfirmMomentScreen';
import { getScopeState, subscribeScopeState } from '@/services/userScope';
import { useMomentsFirstExperience } from '@/hooks/useMomentsFirstExperience';

/** Public shell stays review-only; internal confirmation uses the existing account-scoped store. */
export default function OneBreathRoute() {
  const enabled = useMomentsFirstExperience();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const scope = React.useSyncExternalStore(subscribeScopeState, getScopeState, getScopeState);
  if (!enabled) return <OneBreathScreen />;
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (scope.status !== 'AUTHENTICATED' || scope.userId !== userId) return <Redirect href="/" />;
  return <ConfirmMomentScreen key={userId} />;
}
