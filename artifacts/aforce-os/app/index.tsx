import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '@clerk/expo';

import { DEMO_MODE } from '@/services/demoMode';

const ONBOARDING_DONE_KEY = 'aforce.hasCompletedOnboarding';

/**
 * Root entry — gates first-open routing AND Clerk sign-in.
 *
 * Phase 2 (Profile + Units + Login) added the missing auth gate. Prior
 * to this, `(auth)/_layout.tsx` claimed "the root _layout decides
 * whether to show this group or (tabs) based on isSignedIn" — but the
 * decision logic didn't exist, so the sign-in stack was unreachable by
 * normal navigation and signed-out users landed straight in `(tabs)`.
 *
 * Resolution order, top to bottom:
 *
 *   1. Wait for Clerk's `useAuth().isLoaded` AND the AsyncStorage
 *      onboarding flag to resolve. Render a black canvas while we wait
 *      so the splash stays visually continuous.
 *   2. If the user is NOT signed in AND DEMO_MODE is OFF → redirect
 *      to `/(auth)/sign-in`. DEMO_MODE remains a deliberate escape
 *      hatch for pitch / marketing screenshots (see services/demoMode).
 *   3. Otherwise route on onboarding completion: `/onboarding` on first
 *      launch, else `/(tabs)`. The cinematic intro is the cold-launch
 *      OpeningSequence overlay, so there is no separate welcome lobby.
 */
export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  const [onboarded, setOnboarded] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ONBOARDING_DONE_KEY)
      .then((v) => { if (!cancelled) setOnboarded(v === 'true'); })
      .catch(() => { if (!cancelled) setOnboarded(true); });
    return () => { cancelled = true; };
  }, []);

  // Black canvas while Clerk + AsyncStorage resolve — keeps the
  // splash visually continuous instead of flashing the tab bar.
  if (!isLoaded || onboarded === null) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  if (!isSignedIn && !DEMO_MODE) {
    return <Redirect href={'/(auth)/sign-in' as never} />;
  }

  return <Redirect href={(onboarded ? '/(tabs)' : '/onboarding') as never} />;
}
