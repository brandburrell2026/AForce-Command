import { Redirect } from 'expo-router';
import { useState } from 'react';
import { AdvancedVisualIntelligenceScreen } from '@/components/advancedVisual/AdvancedVisualIntelligenceScreen';
import { SkinIACameraCaptureScreen } from '@/components/advancedVisual/SkinIACameraCaptureScreen';
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
  const [captureOpen, setCaptureOpen] = useState(false);
  if (!allowed) return <Redirect href="/(tabs)/profile" />;
  if (captureOpen) return <SkinIACameraCaptureScreen onExit={() => setCaptureOpen(false)} />;
  return <AdvancedVisualIntelligenceScreen onBeginCapture={() => setCaptureOpen(true)} />;
}
