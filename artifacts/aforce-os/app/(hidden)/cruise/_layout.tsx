/**
 * Hidden Cruise sub-app — Rule #15.
 *
 * Five named surfaces (Journey / Port / Pre-Port / Excursion /
 * Recovery) built behind the wall. No tab-bar entry, no public link.
 * Every screen in this group is gated on the `spec_cruise` feature
 * flag (added in Rule #17). When the flag is off, navigating here
 * silently redirects to the app root.
 *
 * The legacy `app/cruise.tsx` (CruiseModeScreen) remains untouched —
 * this group is additive architecture, not a replacement.
 */

import React from 'react';
import { Redirect, Stack } from 'expo-router';

import { Colors } from '@/theme/colors';
import { useFeatureFlags } from '@/store/useAppStore';

export default function HiddenCruiseLayout() {
  const flags = useFeatureFlags();

  if (!flags.spec_cruise) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background.primary },
        animation: 'fade',
      }}>
      <Stack.Screen name="journey" />
      <Stack.Screen name="port" />
      <Stack.Screen name="pre-port" />
      <Stack.Screen name="excursion" />
      <Stack.Screen name="recovery" />
    </Stack>
  );
}
