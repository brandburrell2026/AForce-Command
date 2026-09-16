import { Redirect } from 'expo-router';
import { AdvancedVisualIntelligenceScreen } from '@/components/advancedVisual/AdvancedVisualIntelligenceScreen';
import { useFlagsSlice } from '@/store/slices';

/**
 * Advanced Visual Intelligence™ stays dark by default. The approved shell is
 * intentionally unreachable unless a future authorized release flag is set;
 * even then it has no camera or image capability.
 */
export default function SkiniaRoute() {
  const flags = useFlagsSlice();
  if (!flags.advanced_visual_intelligence_enabled) return <Redirect href="/(tabs)/profile" />;
  return <AdvancedVisualIntelligenceScreen />;
}
