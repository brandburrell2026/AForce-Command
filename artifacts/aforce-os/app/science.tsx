/**
 * science route — Phase 3 redesign when `spec_science` is on, else legacy.
 */
import { ScienceScreen } from '@/screens/ScienceScreen';
import { ScienceScreenV2 } from '@/components/science/ScienceScreenV2';
import { useAppStore } from '@/store/useAppStore';

export default function ScienceScreenRoute() {
  return useAppStore().state.featureFlags.spec_science ? <ScienceScreenV2 /> : <ScienceScreen />;
}
