import { Redirect } from 'expo-router';
import { PhantomBandScreen } from '@/screens/PhantomBandScreen';
import { useFlagsSlice } from '@/store/slices';

/**
 * Hardware-gated route. Until `phantom_wearable_enabled` is flipped on,
 * the Phantom Band screen is unreachable — any deep link bounces back
 * to home. v1 launch ships without the band.
 */
export default function PhantomRoute() {
  const flags = useFlagsSlice();
  if (!flags.phantom_wearable_enabled) return <Redirect href="/" />;
  return <PhantomBandScreen />;
}
