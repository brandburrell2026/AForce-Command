import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdvancedVisualIntelligenceScreen } from '@/components/advancedVisual/AdvancedVisualIntelligenceScreen';
import { SkinIACameraCaptureScreen } from '@/components/advancedVisual/SkinIACameraCaptureScreen';
import { resolveSkinIARouteDecision } from '@/services/skiniaCohortGate';
import { useFlagsSlice } from '@/store/slices';
import { useSkinIACohortAccess } from '@/services/skiniaCohortAccess';
import { edAccent, edInk, edStock, edType } from '@/theme/editorialTokens';

/**
 * Advanced Visual Intelligence™ stays dark by default. An internal build and
 * an explicit server cohort grant are required before the controlled camera
 * flow can render. A pending decision shows only a camera-free wait state.
 */
export default function SkiniaRoute() {
  const flags = useFlagsSlice();
  const cohort = useSkinIACohortAccess(flags.advanced_visual_intelligence_enabled);
  const decision = resolveSkinIARouteDecision({
    featureEnabled: flags.advanced_visual_intelligence_enabled,
    internalTestflight: process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true',
    cohort,
  });
  const [captureOpen, setCaptureOpen] = useState(false);
  if (decision === 'WAIT') return <SkinIAAccessCheck />;
  if (decision === 'DENY') return <Redirect href="/(tabs)/profile" />;
  if (captureOpen) return <SkinIACameraCaptureScreen onExit={() => setCaptureOpen(false)} />;
  return <AdvancedVisualIntelligenceScreen onBeginCapture={() => setCaptureOpen(true)} />;
}

function SkinIAAccessCheck() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} accessibilityLabel="Checking SkinIA internal access">
      <Text style={styles.wordmark}>AFORCE</Text>
      <Text style={styles.kicker}>SKINIA VISUAL CHECK / INTERNAL TESTFLIGHT</Text>
      <Text style={styles.title}>Checking access.</Text>
      <Text style={styles.body}>No camera access has started.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: edStock.black, paddingHorizontal: 32 },
  wordmark: { ...edType.caption, color: edAccent.red, fontWeight: '700' },
  kicker: { ...edType.micro, color: edAccent.red, marginTop: 64 },
  title: { ...edType.statement, color: edInk.ivory, marginTop: 14 },
  body: { ...edType.bodySmall, color: edInk.quietOnBlack, marginTop: 10 },
});
