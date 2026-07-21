/**
 * Urine Check route — renders the Phase 3 redesign when `spec_urine` is on,
 * else the untouched legacy screen. Flipping the flag is the go-live switch.
 */
import { useRouter } from 'expo-router';
import UrineHydrationCheckScreen from '@/screens/UrineHydrationCheckScreen';
import { UrineCheckScreenV2 } from '@/components/urine/UrineCheckScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function UrineCheckRoute() {
  const router = useRouter();
  const specUrine = useAppStore().state.featureFlags.spec_urine;
  return specUrine ? (
    <UrineCheckScreenV2 onBack={() => router.back()} />
  ) : (
    <UrineHydrationCheckScreen />
  );
}
