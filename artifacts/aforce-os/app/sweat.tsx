/**
 * Sweat Calculator route — renders the Phase 3 redesign when `spec_sweat` is on,
 * else the untouched legacy screen. Flipping the flag is the go-live switch.
 */
import SweatCalculatorScreen from '@/screens/SweatCalculatorScreen';
import { SweatCalculatorScreenV2 } from '@/components/sweat/SweatCalculatorScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function SweatRoute() {
  const specSweat = useAppStore().state.featureFlags.spec_sweat;
  return specSweat ? <SweatCalculatorScreenV2 /> : <SweatCalculatorScreen />;
}
