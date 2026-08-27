/**
 * Urine Check route.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { useRouter } from 'expo-router';
import { UrineCheckScreenV2 } from '@/components/urine/UrineCheckScreenV2';

export default function UrineCheckRoute() {
  const router = useRouter();
  return <UrineCheckScreenV2 onBack={() => router.back()} />;
}
