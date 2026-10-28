import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useFeatureFlags } from '@/store/useAppStore';
import { travelPilotAvailable } from '@/featureFlags/flags';
import { TravelScreen } from '@/components/travel/TravelScreen';

export default function TravelRoute() {
  const flags = useFeatureFlags();
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!travelPilotAvailable(flags)) return <Redirect href="/" />;
  if (!isLoaded) return null;
  if (!isSignedIn || !userId) return <Redirect href="/(auth)/sign-in" />;
  // Account changes discard form input and operation errors immediately.
  return <TravelScreen key={userId} />;
}
