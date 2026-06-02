/**
 * Auth stack — sign-in / sign-up screens for the AForce OS Expo app.
 *
 * Mounted under (auth) so expo-router treats it as its own group. The
 * root `app/index.tsx` decides whether to show this group or the
 * `(tabs)` group based on Clerk's `isSignedIn` state. As a defensive
 * second gate (Phase 2), this layout also bounces an authenticated
 * user straight to `(tabs)` if they ever land here — for example via
 * a deep link or a stale back-stack after sign-in.
 */

import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { View } from 'react-native';

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  if (isSignedIn) {
    return <Redirect href={'/(tabs)' as never} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
