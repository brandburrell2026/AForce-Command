/**
 * Hydration Scan screen.
 *
 * Premium scan-to-decide surface. On native this would drive an
 * Expo Camera barcode scanner; in the workspace preview (web) we ship
 * a mock scan tray that lets the user (or test runner) trigger any
 * known barcode, plus a manual search field as a fallback.
 *
 * The screen itself is fully wired: scan → recognize → score under the
 * comparison engine → recommend → log intake into the live store.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform, Pressable, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { GradientBackground } from '@/components/GradientBackground';
import { ScanResultCard } from '@/components/ScanResultCard';
import { ProductFitCard } from '@/components/ProductFitCard';
import { AForceReplacementCard } from '@/components/AForceReplacementCard';
import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';
import { scan } from '@/services/hydrationScanService';
import { listSimulatableBarcodes } from '@/services/productRecognitionService';
import type { ScanOutcome, ScanResult, ScanSource } from '@/types/scan';

export default function HydrationScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, logIntake } = useAppStore();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [scanning, setScanning] = useState(false);
  const [logging, setLogging] = useState(false);
  const [manualQuery, setManualQuery] = useState('');

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom;

  // Pulsing scan ring
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.7);
  useEffect(() => {
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1400, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 1400, easing: Easing.in(Easing.cubic) }),
      ),
      -1,
      false,
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 1400 }),
        withTiming(0.7, { duration: 1400 }),
      ),
      -1,
      false,
    );
  }, [ringScale, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const simulatable = useMemo(() => listSimulatableBarcodes(), []);

  const runScan = async (source: ScanSource) => {
    if (scanning) return;
    setScanning(true);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    try {
      const out = await scan(source, state.engineOutput, state.userState);
      setOutcome(out);
      if (out.ok && Platform.OS !== 'web') {
        Haptics.notificationAsync(
          out.result.verdict === 'avoid' || out.result.verdict === 'suboptimal'
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
    } finally {
      setScanning(false);
    }
  };

  const result: ScanResult | null = outcome?.ok ? outcome.result : null;

  const onLogScanned = async () => {
    if (!result) return;
    const fluid = result.product.fluidType;
    if (!fluid) return;
    setLogging(true);
    try {
      await logIntake(fluid);
    } finally {
      setLogging(false);
    }
  };

  const onLogReplacement = async () => {
    if (!result?.recommendation.aforceEquivalentId) return;
    // The replacement id IS the FluidType for AForce items in our catalog.
    const fluid = result.recommendation.aforceEquivalentId as
      | 'aforce_stick' | 'aforce_rtd' | 'aforce_canister' | 'aforce_bulk_bag';
    setLogging(true);
    try {
      await logIntake(fluid);
    } finally {
      setLogging(false);
    }
  };

  const onManualSubmit = () => {
    const q = manualQuery.trim();
    if (!q) return;
    runScan({ kind: 'manual', rawValue: q });
  };

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
              <Feather name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>SCAN TO DECIDE</Text>
              <Text style={styles.title}>Hydration Scan</Text>
            </View>
            <View style={styles.statePill}>
              <View style={[styles.dot, { backgroundColor: state.engineOutput.performanceState.color }]} />
              <Text style={[styles.stateText, { color: state.engineOutput.performanceState.color }]}>
                {state.engineOutput.performanceState.level}
              </Text>
            </View>
          </View>

          {/* Camera viewfinder (mock) */}
          <View style={styles.viewfinder}>
            <Animated.View style={[styles.ring, ringStyle]} />
            <View style={styles.reticule}>
              <View style={[styles.cornerTL, styles.corner]} />
              <View style={[styles.cornerTR, styles.corner]} />
              <View style={[styles.cornerBL, styles.corner]} />
              <View style={[styles.cornerBR, styles.corner]} />
              <Feather
                name="maximize"
                size={28}
                color={scanning ? Colors.states.PEAK.primary : `${Colors.text.primary}66`}
              />
            </View>
            <Text style={styles.viewfinderLabel}>
              {scanning ? 'IDENTIFYING…' : Platform.OS === 'web' ? 'PREVIEW MODE — USE MOCK SCAN' : 'POINT AT BARCODE OR QR'}
            </Text>
          </View>

          {/* Mock scan tray */}
          <View style={styles.trayCard}>
            <View style={styles.trayHeader}>
              <Feather name="zap" size={12} color={Colors.text.muted} />
              <Text style={styles.trayHeaderText}>SIMULATE SCAN</Text>
            </View>
            <View style={styles.trayChips}>
              {simulatable.slice(0, 6).map((it) => (
                <Pressable
                  key={it.code}
                  onPress={() => runScan({ kind: 'barcode', rawValue: it.code })}
                  disabled={scanning}
                  style={({ pressed }) => [
                    styles.chip,
                    { opacity: scanning ? 0.5 : pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={styles.chipText} numberOfLines={1}>{it.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => runScan({ kind: 'qr', rawValue: 'aforce://product/aforce_stick' })}
              disabled={scanning}
              style={({ pressed }) => [
                styles.qrChip,
                { opacity: scanning ? 0.5 : pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="grid" size={12} color={Colors.states.PEAK.primary} />
              <Text style={[styles.chipText, { color: Colors.states.PEAK.primary }]}>
                QR — aforce://product/aforce_stick
              </Text>
            </Pressable>
          </View>

          {/* Manual search fallback */}
          <View style={styles.manualCard}>
            <Text style={styles.manualLabel}>MANUAL SEARCH</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                value={manualQuery}
                onChangeText={setManualQuery}
                placeholder="Search product or brand"
                placeholderTextColor={Colors.text.muted}
                onSubmitEditing={onManualSubmit}
                returnKeyType="search"
              />
              <Pressable onPress={onManualSubmit} style={styles.manualBtn} disabled={scanning}>
                <Feather name="search" size={14} color={Colors.text.primary} />
              </Pressable>
            </View>
          </View>

          {/* Result region */}
          {outcome?.ok === false && (
            <View style={styles.errorCard}>
              <Feather name="alert-triangle" size={14} color={Colors.states.RECOVERING.primary} />
              <Text style={styles.errorText}>{outcome.failure.message}</Text>
            </View>
          )}

          {result && (
            <>
              <ScanResultCard result={result} />

              {result.recommendation.aforceEquivalentId && (
                <AForceReplacementCard
                  result={result}
                  onTakeAction={onLogReplacement}
                  isLogging={logging}
                />
              )}

              {result.recommendation.shouldLog && result.product.fluidType && (
                <Pressable
                  onPress={onLogScanned}
                  disabled={logging}
                  style={({ pressed }) => [
                    styles.primaryCta,
                    {
                      borderColor: Colors.states.PEAK.primary,
                      opacity: logging ? 0.6 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Feather name="check-circle" size={16} color={Colors.states.PEAK.primary} />
                  <Text style={[styles.primaryCtaText, { color: Colors.states.PEAK.primary }]}>
                    {logging ? 'LOGGING…' : `LOG ${result.product.productName.toUpperCase()}`}
                  </Text>
                </Pressable>
              )}

              <ProductFitCard result={result} />

              <Pressable
                onPress={() => router.push('/compare')}
                style={({ pressed }) => [
                  styles.secondaryCta,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="bar-chart-2" size={14} color={Colors.text.primary} />
                <Text style={styles.secondaryCtaText}>VIEW FULL COMPARISON</Text>
              </Pressable>
            </>
          )}

          {!result && !outcome && (
            <View style={styles.emptyCard}>
              <Feather name="camera" size={20} color={Colors.text.muted} />
              <Text style={styles.emptyTitle}>Awaiting scan</Text>
              <Text style={styles.emptyHint}>
                Tap a product above to simulate a barcode scan, or search by name.
              </Text>
            </View>
          )}
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20, gap: 14 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2.5 },
  title: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.6, marginTop: 2 },
  statePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stateText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },

  viewfinder: {
    height: 200, borderRadius: 22,
    backgroundColor: '#05090E', borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  ring: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    borderWidth: 1, borderColor: `${Colors.states.PEAK.primary}55`,
  },
  reticule: {
    width: 140, height: 140, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
  },
  corner: {
    position: 'absolute', width: 22, height: 22,
    borderColor: `${Colors.states.PEAK.primary}AA`, borderWidth: 2,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  viewfinderLabel: {
    position: 'absolute', bottom: 14,
    fontSize: 10, fontFamily: 'Inter_700Bold',
    color: Colors.text.muted, letterSpacing: 2,
  },

  trayCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border.subtle,
    padding: 14, gap: 10,
  },
  trayHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trayHeaderText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.8 },
  trayChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
  },
  chipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary },
  qrChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1, borderColor: `${Colors.states.PEAK.primary}55`,
    backgroundColor: `${Colors.states.PEAK.primary}10`,
    alignSelf: 'flex-start',
  },

  manualCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border.subtle,
    padding: 14, gap: 8,
  },
  manualLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.8 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1, height: 42, borderRadius: 10,
    paddingHorizontal: 12, color: Colors.text.primary,
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
    fontFamily: 'Inter_500Medium', fontSize: 13,
  },
  manualBtn: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.fill.medium,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.states.RECOVERING.primary}14`,
    borderColor: `${Colors.states.RECOVERING.primary}55`,
    borderWidth: 1, borderRadius: 14, padding: 12,
  },
  errorText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.primary, flex: 1 },

  primaryCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    backgroundColor: Colors.background.elevated,
  },
  primaryCtaText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },

  secondaryCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.background.card,
  },
  secondaryCtaText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: 1.2 },

  emptyCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border.subtle,
    padding: 22, alignItems: 'center', gap: 6,
  },
  emptyTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text.primary, marginTop: 4 },
  emptyHint: {
    fontSize: 12, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, textAlign: 'center', lineHeight: 17,
  },
});
