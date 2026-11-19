/**
 * Gentle hydration — its own screen, opened from Profile.
 *
 * The controls used to sit in the middle of the Hydration tab. The approved
 * prototype's Hydration tab does not have them, so they live here. Nothing
 * about the feature changed: the same card, the same private-to-this-device
 * storage, the same age check before the optional GLP-1 context is shown.
 */
import React from 'react';
import { Redirect, useRouter } from 'expo-router';
import { AFScreen, AFTopBar } from '@/components/ui';
import { useAppStore, useFeatureFlags } from '@/store/useAppStore';
import { GentleHydrationModeCard } from './GentleHydrationModeCard';

export function GentleHydrationScreen() {
  const router = useRouter();
  const flags = useFeatureFlags();
  const { state } = useAppStore();
  // A birth year alone cannot confirm whether someone who turns 18 this year
  // has already had their birthday. Keep the optional context hidden unless
  // the available data proves adulthood without that ambiguity.
  const showGlp1Context =
    typeof state.profileIdentity?.birthYear === 'number' &&
    new Date().getFullYear() - state.profileIdentity.birthYear > 18;
  const noop = React.useCallback(() => {}, []);

  if (!flags.gentle_hydration_mode_enabled) return <Redirect href="/" />;
  return (
    <AFScreen scroll testID="gentle-hydration-screen">
      <AFTopBar title="Gentle hydration" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <GentleHydrationModeCard showGlp1Context={showGlp1Context} onModeChange={noop} />
    </AFScreen>
  );
}
