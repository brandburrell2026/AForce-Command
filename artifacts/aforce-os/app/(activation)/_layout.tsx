/**
 * Activation stack — full-screen onboarding funnel that sits in
 * front of the dashboard until First Command is complete.
 *
 * Spec Rule #9 — "Do not open dashboard." Routing into and out
 * of this group is owned by welcome.tsx (entry) and
 * complete.tsx (exit → /(tabs)).
 */
import { Stack } from 'expo-router';

export default function ActivationLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
        gestureEnabled: false,
        animation: 'fade',
      }}
    />
  );
}
