import { Redirect } from 'expo-router';
import { AdvancedVisualIntelligenceScreen } from '@/components/advancedVisual/AdvancedVisualIntelligenceScreen';
import { useFlagsSlice } from '@/store/slices';
import { isSkinIAAccessAllowed, useSkinIACohortAccess } from '@/services/skiniaCohortAccess';

/**
 * Advanced Visual Intelligence™ stays dark by default. The approved shell is
 * intentionally unreachable unless a future authorized release flag is set;
 * even then it has no camera or image capability.
 */
export default function SkiniaRoute() {
  const flags = useFlagsSlice();
  const cohort = useSkinIACohortAccess(flags.advanced_visual_intelligence_enabled);
  const allowed = isSkinIAAccessAllowed({
    featureEnabled: flags.advanced_visual_intelligence_enabled,
    internalTestflight: process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true',
    cohort,
  });
  if (!allowed) return <Redirect href="/(tabs)/profile" />;
  return <AdvancedVisualIntelligenceScreen />;
}
