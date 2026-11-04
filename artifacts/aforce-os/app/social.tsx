import React from 'react';
import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { MomentPreparationScreen } from '@/components/oneBreath/MomentPreparationScreen';
import { getScopeState, subscribeScopeState } from '@/services/userScope';
import { preparationPreviewEnabled } from '@/services/preparationAccess';

export default function SocialRoute() {
  const {isLoaded,isSignedIn,userId}=useAuth();
  const scope=React.useSyncExternalStore(subscribeScopeState,getScopeState,getScopeState);
  if(!preparationPreviewEnabled())return <Redirect href="/"/>;
  if(!isLoaded)return null;
  if(!isSignedIn)return <Redirect href="/(auth)/sign-in"/>;
  if(scope.status!=='AUTHENTICATED'||scope.userId!==userId)return <Redirect href="/"/>;
  return <MomentPreparationScreen key={userId} context="social"/>;
}
