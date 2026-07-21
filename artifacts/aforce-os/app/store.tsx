/**
 * Store route — renders the Phase 3 redesign when `spec_store` is on, else the
 * untouched legacy storefront. Flipping the flag is the go-live switch.
 */
import StoreScreen from '@/screens/StoreScreen';
import { StoreScreenV2 } from '@/components/store/StoreScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function StoreRoute() {
  const specStore = useAppStore().state.featureFlags.spec_store;
  return specStore ? <StoreScreenV2 /> : <StoreScreen />;
}
