import React from 'react';
import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';

import { RemembersScreen } from '@/components/remembers/RemembersScreen';
import { preparationPreviewEnabled } from '@/services/preparationAccess';
import { getScopeState, subscribeScopeState } from '@/services/userScope';

/** Internal builds only, the same gate as Replay itself. Signed-in member only:
 * the lessons shown belong to that account's storage on this phone. */
export default function RemembersRoute() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const scope = React.useSyncExternalStore(subscribeScopeState, getScopeState, getScopeState);
  if (!preparationPreviewEnabled()) return <Redirect href="/" />;
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (scope.status !== 'AUTHENTICATED' || scope.userId !== userId) return <Redirect href="/" />;
  return <RemembersScreen key={userId} />;
}
