/**
 * Auth stack — sign-in / sign-up screens for the AForce OS Expo app.
 * Mounted under (auth) so expo-router treats it as its own group;
 * the root _layout decides whether to show this group or the (tabs)
 * group based on Clerk's `isSignedIn` state.
 */

import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
