import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { View } from 'react-native';

/**
 * Root entry — gates first-open routing.
 *
 * On the very first launch we route to `/welcome` (the cinematic
 * AFORCE OS intro). Once the user dismisses it via either CTA,
 * `aforce.welcomeSeen` is written to AsyncStorage and every
 * subsequent launch lands on the home tab directly.
 */
export default function Index() {
  const [target, setTarget] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem('aforce.welcomeSeen')
      .then((v) => { if (!cancelled) setTarget(v ? '/(tabs)' : '/welcome'); })
      .catch(() => { if (!cancelled) setTarget('/(tabs)'); });
    return () => { cancelled = true; };
  }, []);

  // Render nothing on a black canvas while we resolve the flag — keeps
  // the splash visually continuous instead of flashing the tab bar.
  if (!target) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  return <Redirect href={target as never} />;
}
