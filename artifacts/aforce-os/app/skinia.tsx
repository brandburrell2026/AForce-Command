import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  const [retryKey, setRetryKey] = useState(0);
  const cohort = useSkinIACohortAccess(flags.advanced_visual_intelligence_enabled, retryKey);
  const decision = resolveSkinIARouteDecision({
    featureEnabled: flags.advanced_visual_intelligence_enabled,
    internalTestflight: process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true',
    cohort,
  });
  const [captureOpen, setCaptureOpen] = useState(false);
  if (decision === 'WAIT') return <SkinIAAccessCheck />;
  if (flags.advanced_visual_intelligence_enabled && process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true' && cohort.status === 'DENIED' && (cohort.reason === 'ACCESS_TIMED_OUT' || cohort.reason === 'ACCESS_UNAVAILABLE')) {
    return <SkinIAAccessCheck unavailable onRetry={() => setRetryKey((key) => key + 1)} />;
  }
  if (decision === 'DENY') return <Redirect href="/(tabs)/profile" />;
  if (captureOpen) return <SkinIACameraCaptureScreen onExit={() => setCaptureOpen(false)} />;
  return <AdvancedVisualIntelligenceScreen onBeginCapture={() => setCaptureOpen(true)} />;
}

function SkinIAAccessCheck({ unavailable = false, onRetry }: { unavailable?: boolean; onRetry?: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} accessibilityLabel="Checking SkinIA internal access">
      <Text style={styles.wordmark}>AFORCE</Text>
      <Text style={styles.kicker}>SKINIA VISUAL CHECK / INTERNAL TESTFLIGHT</Text>
      <Text style={styles.title}>{unavailable ? 'Access check unavailable.' : 'Checking access.'}</Text>
      <Text style={styles.body}>{unavailable ? 'We could not verify internal access. Check your connection and try again. No camera access has started.' : 'No camera access has started.'}</Text>
      {unavailable && onRetry ? <Pressable accessibilityRole="button" accessibilityLabel="Retry SkinIA access check" onPress={onRetry} style={styles.action}><Text style={styles.actionText}>Try again</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={() => router.replace('/(tabs)')} style={styles.back}><Text style={styles.backText}>Back to home</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: edStock.black, paddingHorizontal: 32 },
  wordmark: { ...edType.caption, color: edAccent.red, fontWeight: '700' },
  kicker: { ...edType.micro, color: edAccent.red, marginTop: 64 },
  title: { ...edType.statement, color: edInk.ivory, marginTop: 14 },
  body: { ...edType.bodySmall, color: edInk.quietOnBlack, marginTop: 10 },
  action: { backgroundColor: edInk.ivory, marginTop: 32, padding: 18 },
  actionText: { ...edType.bodySmall, color: edStock.black },
  back: { marginTop: 24, paddingVertical: 12 },
  backText: { ...edType.bodySmall, color: edInk.ivory },
});
