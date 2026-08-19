/**
 * /health-connected — mounts the (previously built, previously unmounted)
 * Connected Health surface. G5: the single Android entry point for
 * CONNECT HEALTH DATA lives inside the container; this route just gives the
 * surface an address. iOS renders the same surface (Apple/cloud rows) with no
 * Health Connect CTA — availability gating happens in the container.
 */
import { useRouter } from 'expo-router';
import { ConnectedHealthContainer } from '@/components/health/ConnectedHealthContainer';

export default function HealthConnectedRoute() {
  const router = useRouter();
  return <ConnectedHealthContainer onBack={() => router.back()} />;
}
