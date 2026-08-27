/**
 * Sweat Calculator route.
 * Founder ruling 2026-08-27: the flag-OFF legacy fallback is retired
 * (fifteen-twin retirement); this route now renders the production screen
 * unconditionally.
 */
import { SweatCalculatorScreenV2 } from '@/components/sweat/SweatCalculatorScreenV2';

export default function SweatRoute() {
  return <SweatCalculatorScreenV2 />;
}
