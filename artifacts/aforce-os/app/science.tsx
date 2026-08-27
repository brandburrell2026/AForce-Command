/**
 * Science route.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { ScienceScreenV2 } from '@/components/science/ScienceScreenV2';

export default function ScienceScreenRoute() {
  return <ScienceScreenV2 />;
}
