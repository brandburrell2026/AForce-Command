import { Redirect } from 'expo-router';
import RingSportScreen from '@/screens/RingSportScreen';
import { useFlagsSlice } from '@/store/slices';

/**
 * Hardware-gated route. See `app/ring.tsx` for rationale.
 */
export default function RingSessionRoute() {
  const flags = useFlagsSlice();
  if (!flags.phantom_wearable_enabled) return <Redirect href="/" />;
  return <RingSportScreen />;
}
