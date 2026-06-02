import { Redirect } from 'expo-router';
import RingHomeScreen from '@/screens/RingHomeScreen';
import { useFlagsSlice } from '@/store/slices';

/**
 * Hardware-gated route. Until `ring_enabled` is flipped on
 * (admin toggle in Profile, or remote-config in prod), this route is
 * unreachable — any deep link bounces back to home. Lets us ship v1
 * without the Ring while keeping the screens in-tree for the next
 * release.
 */
export default function RingRoute() {
  const flags = useFlagsSlice();
  if (!flags.ring_enabled) return <Redirect href="/" />;
  return <RingHomeScreen />;
}
