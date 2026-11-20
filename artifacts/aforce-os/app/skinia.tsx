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
import { af } from '@/theme';
import { SkinIABackButton } from '@/components/advancedVisual/SkinIABackButton';

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
  const router = useRouter();
  // Back goes to wherever the member came from; Profile when there is nothing behind.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'));
  if (decision === 'WAIT') return <SkinIAAccessCheck />;
  if (flags.advanced_visual_intelligence_enabled && process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true' && cohort.status === 'DENIED' && (cohort.reason === 'ACCESS_TIMED_OUT' || cohort.reason === 'ACCESS_UNAVAILABLE')) {
    return <SkinIAAccessCheck unavailable onRetry={() => setRetryKey((key) => key + 1)} />;
  }
  if (decision === 'DENY') return <Redirect href="/(tabs)/profile" />;
  if (captureOpen) return <SkinIACameraCaptureScreen onExit={() => setCaptureOpen(false)} />;
  return <AdvancedVisualIntelligenceScreen onBeginCapture={() => setCaptureOpen(true)} onBack={goBack} />;
}

function SkinIAAccessCheck({ unavailable = false, onRetry }: { unavailable?: boolean; onRetry?: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} accessibilityLabel="Checking SkinIA internal access">
      <SkinIABackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
      <Text style={styles.kicker}>SKINIA VISUAL CHECK / INTERNAL TESTFLIGHT</Text>
      <Text style={styles.title}>{unavailable ? 'Access check unavailable.' : 'Checking access.'}</Text>
      <Text style={styles.body}>{unavailable ? 'We could not verify internal access. Check your connection and try again. No camera access has started.' : 'No camera access has started.'}</Text>
      {unavailable && onRetry ? <Pressable accessibilityRole="button" accessibilityLabel="Retry SkinIA access check" onPress={onRetry} style={styles.action}><Text style={styles.actionText}>Try again</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Back to home" onPress={() => router.replace('/(tabs)')} style={styles.back}><Text style={styles.backText}>Back to home</Text></Pressable>
    </View>
  );
}

const MONO = 'IBMPlexMono_500Medium';
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: af.canvas, paddingHorizontal: 24 },
  kicker: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.8, color: af.textTertiary, marginTop: 32 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 32, lineHeight: 37, letterSpacing: -0.8, color: af.textPrimary, marginTop: 12 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 23, color: af.textSecondary, marginTop: 12 },
  action: { minHeight: 52, borderRadius: 26, backgroundColor: af.primaryFill, alignItems: 'center', justifyContent: 'center', marginTop: 28, paddingHorizontal: 20 },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: af.onPrimaryFill },
  back: { minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: af.divider, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 20 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: af.textPrimary },
});
