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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform, Pressable, TextInput, Modal,
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
import { Icon } from '../components/Icon';

import { GradientBackground } from '@/components/GradientBackground';
import { ScanResultCard } from '@/components/ScanResultCard';
import { ScanAICoachCard } from '@/components/ScanAICoachCard';
import { ProductFitCard } from '@/components/ProductFitCard';
import { AForceReplacementCard } from '@/components/AForceReplacementCard';
import { CameraScanModal } from '@/components/CameraScanModal';
import { AddDrinkModal } from '@/components/AddDrinkModal';
import { SmartCaptureModal } from '@/components/SmartCaptureModal';
import { WhyThisForYouCard } from '@/components/WhyThisForYouCard';
import { SuperfoodSignalsCard } from '@/components/SuperfoodSignalsCard';
import { derivePersonalizationSignals } from '@/utils/personalizationSignals';
import { DRINK_CATEGORIES } from '@/data/drinkCatalog';
import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';
import { scan } from '@/services/hydrationScanService';
import { emit } from '@/analytics/event_dispatcher';
import { listSimulatableBarcodes, AFORCE_SHELF_SKUS } from '@/services/productRecognitionService';
import { buildScanCoachScript } from '@/services/scanCoachVoice';
import { speak as speakCoach, stopSpeaking } from '@/services/textToSpeech';
import { useCoachMode, shouldSpeak, shouldHaptic } from '@/services/coachMode';
import { useRecoverySnapshotFromStore } from '@/services/useRecoverySnapshot';
import { COMPARE_PRODUCTS } from '@/data/productDatabase';
import { usePostScan, useScanHistory } from '@/hooks/useServerHistory';
import { useTranslation } from 'react-i18next';
import { HydrationImpactCard } from '@/components/hydroScan/HydrationImpactCard';
import { TimingGuidanceCard } from '@/components/hydroScan/TimingGuidanceCard';
import { ConsumptionPrompt } from '@/components/hydroScan/ConsumptionPrompt';
import { UnknownProductFlow, type UnknownProductRecord } from '@/components/hydroScan/UnknownProductFlow';
import { useHydroScanHistory } from '@/hooks/useHydroScanHistory';
import type { HydroScanHistoryInput } from '@/services/hydroScanHistory';
import { unknownProductImpact } from '@/utils/impact/unknownImpact';
import { IMPACT_I18N_KEY } from '@/utils/impact/hydroScanCopy';
import type {
  ConsumptionStatus,
  ScanOutcome,
  ScanResult,
  ScanSource,
} from '@/types/scan';
import type { PerformanceLevel } from '@/types';

export default function HydrationScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, logIntake } = useAppStore();
  const { t } = useTranslation();
  // HydroScan 2.0™ — flag-gated profile-aware layer (OFF in prod, ON in demo).
  const hydroScan2 = state.featureFlags.hydro_scan_2_enabled;
  const hydroScanHistory = useHydroScanHistory();
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [scanning, setScanning] = useState(false);
  const [logging, setLogging] = useState(false);
  // Advisory-only consumption capture (Score-Protection: never logs intake).
  const [consumption, setConsumption] = useState<ConsumptionStatus | null>(null);
  // True once the current unknown-product flow has been saved to history.
  const [unknownSaved, setUnknownSaved] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [addDrinkOpen, setAddDrinkOpen] = useState(false);
  const [smartCaptureOpen, setSmartCaptureOpen] = useState(false);
  // Preview Scan tray — split into "Other Brands" (competitor SKUs) and
  // "AForce Products" (the 9 flavor × format shelf SKUs). The AForce tab
  // also exposes a dropdown picker that lists every AForce product by
  // full name for evaluators who want to pick one explicitly.
  const [previewTab, setPreviewTab] = useState<'other' | 'aforce'>('aforce');
  const [aforcePickerOpen, setAforcePickerOpen] = useState(false);

  // Success flash overlay — fires after a successful log, fades a PEAK
  // tint over the screen, plays a Success haptic, and pops back to Home
  // ~800ms later. Per spec §11: 20% PEAK over 300ms + Haptics.Success
  // then router.back() at 800ms so the user gets a satisfying confirmation
  // moment before returning to the dashboard.
  const flashOpacity = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  // Track the pending router.back() so a manual back-nav (or unmount)
  // mid-flash can clear it and avoid a phantom navigation on a
  // disposed component.
  const flashTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current !== null) {
        clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, []);
  const triggerSuccessFlash = useCallback(() => {
    flashOpacity.value = withSequence(
      withTiming(0.2, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }),
    );
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (flashTimeoutRef.current !== null) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      flashTimeoutRef.current = null;
      router.back();
    }, 800);
  }, [flashOpacity, router]);
  const postScanMut = usePostScan();
  const { data: serverScans } = useScanHistory(20);

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

  // Other-brand chips for the "Other Brands" tab — every simulatable
  // barcode whose product is NOT an AForce SKU. Keeps the preview varied
  // (Gatorade / LMNT / Liquid IV / Pedialyte / Prime / Water).
  const otherBrandChips = useMemo(() => {
    return simulatable.filter((it) => {
      const p = COMPARE_PRODUCTS.find((cp) => cp.id === it.productId);
      return p ? !p.isAForce : true;
    });
  }, [simulatable]);

  // AForce chip list — the 9 flavor × format shelf SKUs in stable order.
  // shortLabel strips "AForce " for a compact chip ("Berry Blast + Dulse
  // Stick"). Routed via QR slug so we don't need a separate barcode lookup.
  const aforceSkuChips = useMemo(() => {
    return AFORCE_SHELF_SKUS
      .map((id) => COMPARE_PRODUCTS.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((p) => ({
        productId: p.id,
        shortLabel: p.name.replace(/^AForce\s+/i, ''),
      }));
  }, []);

  // Picker rows — same 9 SKUs but with the full "AForce …" name for the
  // dropdown modal opened from the "Select from all AForce products" CTA.
  const aforcePickerRows = useMemo(() => {
    return AFORCE_SHELF_SKUS
      .map((id) => COMPARE_PRODUCTS.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((p) => ({ productId: p.id, name: p.name }));
  }, []);

  const runScan = async (source: ScanSource) => {
    if (scanning) return;
    setScanning(true);
    // Reset advisory capture for the new scan.
    setConsumption(null);
    setUnknownSaved(false);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    try {
      const out = await scan(
        source,
        state.engineOutput,
        state.userState,
        state.profileIdentity,
        { hydroScan2 },
      );
      setOutcome(out);
      if (out.ok) {
        // Internal analytics pipeline (Task #39) — a real receipt/product
        // scan completed. sourceKind distinguishes barcode / qr / manual.
        // Consent-gated + best-effort; never blocks the scan UX.
        void emit('receipt_scanned', { sourceKind: source.kind });
        // Persist to server (best-effort — UI never blocks on this).
        postScanMut.mutate({
          loggedAt: new Date().toISOString(),
          source: source.kind === 'qr' ? 'qr' : source.kind === 'manual' ? 'manual' : 'barcode',
          rawValue: source.rawValue,
          productId: out.result.product.productId,
          productName: out.result.product.productName,
          brand: out.result.product.brand ?? null,
          isAForce: out.result.product.isAForce,
          verdict: out.result.verdict,
          fitScore: out.result.currentFitScore,
          scoreBefore: state.engineOutput.score,
          scoreAfter: state.engineOutput.score,
          performanceState: state.engineOutput.performanceState.level,
          recommendedProductId: out.result.recommendation.aforceEquivalentId ?? null,
        });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(
            out.result.verdict === 'avoid' || out.result.verdict === 'suboptimal'
              ? Haptics.NotificationFeedbackType.Warning
              : Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
        }
      }
    } finally {
      setScanning(false);
    }
  };

  const onCameraScan = (r: { data: string; kind: 'barcode' | 'qr' }) => {
    setCameraOpen(false);
    runScan({ kind: r.kind, rawValue: r.data });
  };

  const openCamera = () => {
    if (Platform.OS === 'web') return;
    Haptics.selectionAsync().catch(() => {});
    setCameraOpen(true);
  };

  const result: ScanResult | null = outcome?.ok ? outcome.result : null;

  // Recovery Layer — null in production (flag default OFF). When on,
  // a one-line context strip annotates the scan verdict with the
  // user's current recovery + pressure so the call is framed against
  // their state, not just the product.
  const recoveryLayer = useRecoverySnapshotFromStore();

  // Live personalization snapshot — passed into SmartCaptureModal so the
  // "Why this for you" chips appear inside the AI capture result too.
  // Re-derived on every render against the current store state; pure math
  // so cost is negligible.
  const personalization = useMemo(
    () => derivePersonalizationSignals({
      userState: state.userState,
      engineOutput: state.engineOutput,
      profileIdentity: state.profileIdentity,
      recentIntake: state.userState.intakeEvents ?? null,
    }),
    [state.userState, state.engineOutput, state.profileIdentity],
  );

  // Resolve the AForce equivalent (if recommended) + build the AI Coach
  // narrative once per scan. Pure derivation — re-computed only when the
  // scan changes, so the spoken transcript is stable for replay.
  const aforceEquivalent = useMemo(() => {
    const id = result?.recommendation.aforceEquivalentId;
    if (!id) return undefined;
    return COMPARE_PRODUCTS.find((p) => p.id === id);
  }, [result?.recommendation.aforceEquivalentId]);

  const coachScript = useMemo(
    () => (result ? buildScanCoachScript(result, aforceEquivalent) : null),
    [result, aforceEquivalent],
  );

  // Stop any in-flight speech if the screen unmounts mid-narrative.
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Coach Mode handoff (Spec Rule #12): the scan verdict respects the
  // user's voice posture. In 'spoken' mode the existing ElevenLabs +
  // fallback TTS path runs. In 'ambient' mode we suppress speech but
  // still fire a single confirmation haptic so the user feels the
  // verdict land. In 'silent' mode the card stays fully quiet — the
  // visible side-by-side narrative is the only output.
  const coachMode = useCoachMode();
  const handleCoachSpeak = useCallback(
    (text: string, level: PerformanceLevel) => {
      if (shouldSpeak(coachMode)) {
        speakCoach(text, { level });
        return;
      }
      if (shouldHaptic(coachMode) && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    },
    [coachMode],
  );
  const handleCoachStop = useCallback(() => {
    stopSpeaking();
  }, []);

  const onLogScanned = async () => {
    if (!result) return;
    const fluid = result.product.fluidType;
    if (!fluid) return;
    setLogging(true);
    try {
      await logIntake(fluid);
      triggerSuccessFlash();
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
      triggerSuccessFlash();
    } finally {
      setLogging(false);
    }
  };

  const onManualSubmit = () => {
    const q = manualQuery.trim();
    if (!q) return;
    runScan({ kind: 'manual', rawValue: q });
  };

  // ── HydroScan 2.0™ advisory recorders (Score-Protection) ──────────────
  // These write ONLY to the local HydroScan History store. They never call
  // logIntake and never dispatch a reducer action, so consumption capture
  // can never touch a hydration point, performance band, or recovery score.
  const onSelectConsumption = useCallback(
    (status: ConsumptionStatus) => {
      setConsumption(status);
      if (!result) return;
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      const entry: HydroScanHistoryInput = {
        scannedAt: result.scannedAt,
        productName: result.product.productName,
        brand: result.product.brand,
        isAForce: result.product.isAForce,
        category: result.product.category,
        consumption: status,
        impactLevel: result.hydrationImpact?.level ?? 'NEUTRAL',
        timingLevel: result.timingGuidance?.level ?? 'GOOD_TIMING',
      };
      void hydroScanHistory.record(entry);
    },
    [result, hydroScanHistory],
  );

  const onRecordUnknown = useCallback(
    (record: UnknownProductRecord) => {
      const { impactLevel, timingLevel } = unknownProductImpact(record.type);
      const entry: HydroScanHistoryInput = {
        scannedAt: new Date().toISOString(),
        productName: t(`hydroScan2.unknown.type.${record.type}`),
        isAForce: false,
        unknownType: record.type,
        approxOz: record.approxOz,
        consumption: record.consumption,
        impactLevel,
        timingLevel,
      };
      void hydroScanHistory.record(entry);
      setUnknownSaved(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    },
    [hydroScanHistory, t],
  );

  // Shared handler for any modal that confirms a drink (AddDrinkModal +
  // SmartCaptureModal's "Log Correction" button). Logs through the
  // existing intake pipeline with category-correct hydration coefficient
  // applied to ozOverride and the real drink preserved in history.
  const logDrinkFromModal = async (args: {
    categoryId: string;
    name: string;
    displayName: string;
    enteredOz: number;
    effectiveOz: number;
    hydrationCoefficient: number;
  }) => {
    const cat = DRINK_CATEGORIES[args.categoryId as keyof typeof DRINK_CATEGORIES];
    if (!cat) return;
    setLogging(true);
    try {
      await logIntake(cat.fluidType, {
        ozOverride: args.effectiveOz,
        displayNameOverride: `${args.displayName} \u00b7 ${args.enteredOz} oz`,
        categoryId: args.categoryId,
      });
      triggerSuccessFlash();
    } finally {
      setLogging(false);
    }
  };

  // AddDrinkModal handler — logs any of the 13 supported drink categories
  // (water, coffee, tea, sports/energy drinks, social intake, custom, etc.)
  // via the existing intake pipeline. Score impact uses the per-category
  // hydration coefficient so a 12 oz coffee logs ≈10.2 oz water-equivalent
  // while the history label preserves the real drink name.
  const onConfirmDrink = async (args: {
    categoryId: string;
    name: string;
    displayName: string;
    enteredOz: number;
    effectiveOz: number;
    hydrationCoefficient: number;
  }) => {
    setAddDrinkOpen(false);
    const cat = DRINK_CATEGORIES[args.categoryId as keyof typeof DRINK_CATEGORIES];
    if (!cat) return;
    setLogging(true);
    try {
      await logIntake(cat.fluidType, {
        ozOverride: args.effectiveOz,
        displayNameOverride: `${args.displayName} · ${args.enteredOz} oz`,
        categoryId: args.categoryId,
      });
      triggerSuccessFlash();
    } finally {
      setLogging(false);
    }
  };

  // SmartCaptureModal "LOG CORRECTION" — same logging path as onConfirmDrink
  // but sourced from the AI's correctionRecommendation rather than a
  // manual category pick.
  const onSmartCaptureLog = async (args: {
    categoryId: string;
    name: string;
    displayName: string;
    enteredOz: number;
    effectiveOz: number;
    hydrationCoefficient: number;
  }) => {
    setSmartCaptureOpen(false);
    const cat = DRINK_CATEGORIES[args.categoryId as keyof typeof DRINK_CATEGORIES];
    if (!cat) return;
    setLogging(true);
    try {
      await logIntake(cat.fluidType, {
        ozOverride: args.effectiveOz,
        displayNameOverride: `${args.displayName} · ${args.enteredOz} oz`,
        categoryId: args.categoryId,
      });
      triggerSuccessFlash();
    } finally {
      setLogging(false);
    }
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
              <Icon name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>SCAN TO DECIDE</Text>
              <Text style={styles.title}>AForce Scan</Text>
            </View>
            <View style={styles.statePill}>
              <View style={[styles.dot, { backgroundColor: state.engineOutput.performanceState.color }]} />
              <Text style={[styles.stateText, { color: state.engineOutput.performanceState.color }]}>
                {state.engineOutput.performanceState.level}
              </Text>
            </View>
          </View>

          {/* Camera viewfinder — tap to open native camera on device */}
          <Pressable
            onPress={openCamera}
            disabled={Platform.OS === 'web' || scanning}
            style={({ pressed }) => [
              styles.viewfinder,
              { opacity: Platform.OS === 'web' ? 1 : pressed ? 0.85 : 1 },
            ]}
          >
            <Animated.View style={[styles.ring, ringStyle]} />
            <View style={styles.reticule}>
              <View style={[styles.cornerTL, styles.corner]} />
              <View style={[styles.cornerTR, styles.corner]} />
              <View style={[styles.cornerBL, styles.corner]} />
              <View style={[styles.cornerBR, styles.corner]} />
              <Icon
                name={Platform.OS === 'web' ? 'maximize' : 'camera'}
                size={28}
                color={scanning ? Colors.states.PEAK.primary : `${Colors.text.primary}99`}
              />
            </View>
            <Text style={styles.viewfinderLabel}>
              {scanning ? 'IDENTIFYING…' : Platform.OS === 'web' ? 'PREVIEW MODE — TEST RESULTS USING SAMPLE INPUT' : 'TAP TO OPEN CAMERA'}
            </Text>
          </Pressable>

          {/* Preview Scan tray — tabbed: AForce Products + Other Brands.
              AForce tab shows the 9 flavor × format shelf SKUs and a
              dropdown picker for the full list. */}
          <View style={styles.trayCard}>
            <View style={styles.trayHeader}>
              <Icon name="zap" size={12} color={Colors.text.muted} />
              <Text style={styles.trayHeaderText}>PREVIEW SCAN</Text>
            </View>

            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setPreviewTab('aforce')}
                style={[styles.tabPill, previewTab === 'aforce' && styles.tabPillActive]}
                testID="preview-tab-aforce"
              >
                <Text style={[styles.tabPillText, previewTab === 'aforce' && styles.tabPillTextActive]}>
                  AForce Products
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPreviewTab('other')}
                style={[styles.tabPill, previewTab === 'other' && styles.tabPillActive]}
                testID="preview-tab-other"
              >
                <Text style={[styles.tabPillText, previewTab === 'other' && styles.tabPillTextActive]}>
                  Other Brands
                </Text>
              </Pressable>
            </View>

            {previewTab === 'aforce' ? (
              <Pressable
                onPress={() => setAforcePickerOpen(true)}
                disabled={scanning}
                style={({ pressed }) => [
                  styles.pickerCta,
                  { opacity: scanning ? 0.5 : pressed ? 0.85 : 1 },
                ]}
                testID="preview-aforce-picker-open"
              >
                <Icon name="list" size={14} color={Colors.states.PEAK.primary} />
                <Text style={[styles.chipText, { color: Colors.states.PEAK.primary }]}>
                  Select an AForce product
                </Text>
              </Pressable>
            ) : (
              <View style={styles.trayChips}>
                {otherBrandChips.map((it) => (
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
            )}
          </View>

          {/* AForce product picker modal — full list from AFORCE_SHELF_SKUS. */}
          <Modal
            visible={aforcePickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setAforcePickerOpen(false)}
          >
            <Pressable
              style={styles.pickerBackdrop}
              onPress={() => setAforcePickerOpen(false)}
            >
              <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>AForce Products</Text>
                  <Pressable
                    onPress={() => setAforcePickerOpen(false)}
                    hitSlop={10}
                    accessibilityLabel="Close picker"
                  >
                    <Icon name="x" size={18} color={Colors.text.primary} />
                  </Pressable>
                </View>
                <ScrollView style={{ maxHeight: 420 }}>
                  {aforcePickerRows.map((p) => (
                    <Pressable
                      key={p.productId}
                      onPress={() => {
                        setAforcePickerOpen(false);
                        runScan({ kind: 'qr', rawValue: `aforce://product/${p.productId}` });
                      }}
                      style={({ pressed }) => [
                        styles.pickerRow,
                        pressed && { backgroundColor: Colors.fill.light },
                      ]}
                      testID={`preview-aforce-picker-row-${p.productId}`}
                    >
                      <Text style={styles.pickerRowText}>{p.name}</Text>
                      <Icon name="chevron-right" size={14} color={Colors.text.muted} />
                    </Pressable>
                  ))}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Manual search — looks up AForce products via the comparison engine */}
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
                <Icon name="search" size={14} color={Colors.text.primary} />
              </Pressable>
            </View>
          </View>

          {/* Personalized Hydration Intelligence — log any drink across the
              13 supported categories with the correct hydration coefficient
              applied. Custom drinks supported. */}
          <Pressable
            onPress={() => setAddDrinkOpen(true)}
            disabled={logging}
            style={({ pressed }) => [
              styles.logAnyCta,
              {
                borderColor: Colors.states.PEAK.primary,
                opacity: logging ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Log any drink — coffee, tea, sports drinks, social intake, custom"
            testID="hydroscan-log-any-drink"
          >
            <Icon name="plus-circle" size={16} color={Colors.states.PEAK.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.logAnyTitle, { color: Colors.states.PEAK.primary }]}>
                LOG ANY DRINK
              </Text>
              <Text style={styles.logAnyHint}>
                Coffee · Tea · Sports · Energy · Social · Custom
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={Colors.states.PEAK.primary} />
          </Pressable>

          {/* Smart Capture — AI-powered photo analysis for hydration demand,
              recovery load, stimulants, acidic burden + correction. Same CTA
              shape as LOG ANY DRINK but tinted with the WHOOP lime accent
              to signal it's the premium AI surface. */}
          <Pressable
            onPress={() => setSmartCaptureOpen(true)}
            disabled={logging}
            style={({ pressed }) => [
              styles.logAnyCta,
              {
                borderColor: Colors.accent.primary,
                opacity: logging ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Smart Capture — photograph a food or drink for AI hydration analysis"
            testID="hydroscan-smart-capture"
          >
            <Icon name="camera" size={16} color={Colors.accent.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.logAnyTitle, { color: Colors.accent.primary }]}>
                SMART CAPTURE
              </Text>
              <Text style={styles.logAnyHint}>
                Snap any food or drink · AI estimates load + correction
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={Colors.accent.primary} />
          </Pressable>

          {/* Urine Hydration Check — simple color-based signal. Not a
              medical test. Same CTA shape as the two above, tinted
              with the BALANCED status color to signal it's a passive
              read rather than an active scan. */}
          <Pressable
            onPress={() => router.push('/urine-check' as never)}
            disabled={logging}
            style={({ pressed }) => [
              styles.logAnyCta,
              {
                borderColor: Colors.states.BALANCED.primary,
                opacity: logging ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Urine Hydration Check — use urine color as a simple hydration signal"
            testID="hydroscan-urine-check"
          >
            <Icon name="droplet" size={16} color={Colors.states.BALANCED.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.logAnyTitle, { color: Colors.states.BALANCED.primary }]}>
                URINE HYDRATION CHECK
              </Text>
              <Text style={styles.logAnyHint}>
                Simple color read · Not a medical test
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={Colors.states.BALANCED.primary} />
          </Pressable>

          {/* Result region */}
          {outcome?.ok === false && (
            <View style={styles.errorCard}>
              <Icon name="alert-triangle" size={14} color={Colors.states.RECOVERING.primary} />
              <Text style={styles.errorText}>{outcome.failure.message}</Text>
            </View>
          )}

          {/* Never-dead-end: a failed scan still gives the user a path to
              record what they had. Advisory only — never logs intake. */}
          {hydroScan2 && outcome?.ok === false && (
            <UnknownProductFlow onRecord={onRecordUnknown} saved={unknownSaved} />
          )}

          {result && (
            <>
              <ScanResultCard result={result} />

              {/* HydroScan 2.0™ — profile-aware impact + timing + advisory
                  consumption. Only present when the flag path populated the
                  result; all three are advisory (never mutate score). */}
              {hydroScan2 && result.hydrationImpact && (
                <HydrationImpactCard impact={result.hydrationImpact} />
              )}
              {hydroScan2 && result.timingGuidance && (
                <TimingGuidanceCard timing={result.timingGuidance} />
              )}
              {hydroScan2 && result.hydrationImpact && (
                <ConsumptionPrompt selected={consumption} onSelect={onSelectConsumption} />
              )}

              {recoveryLayer ? (
                <View
                  style={styles.recoveryStrip}
                  testID="scan-recovery-strip"
                  accessible
                  accessibilityLabel={`Recovery ${recoveryLayer.recovery}. Pressure ${recoveryLayer.pressure}. Trend ${recoveryLayer.trend}.`}
                >
                  <Text
                    style={styles.recoveryStripText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    RECOVERY {recoveryLayer.recovery}  ·  PRESSURE {recoveryLayer.pressure}  ·  {
                      recoveryLayer.trend === 'rising' ? 'TREND ↑'
                      : recoveryLayer.trend === 'declining' ? 'TREND ↓'
                      : 'TREND —'
                    }
                  </Text>
                </View>
              ) : null}

              {coachScript && (
                <ScanAICoachCard
                  script={coachScript}
                  scanKey={result.scannedAt}
                  level={result.evaluatedAgainstState}
                  score={state.engineOutput.score}
                  scannedName={result.product.productName}
                  aforceName={aforceEquivalent?.name}
                  onSpeak={handleCoachSpeak}
                  onStop={handleCoachStop}
                />
              )}

              {result.recommendation.personalization && (
                <WhyThisForYouCard
                  personalization={result.recommendation.personalization}
                  accentColor={Colors.accent.primary}
                />
              )}

              {result.recommendation.superfoodSignals && (
                <SuperfoodSignalsCard
                  block={result.recommendation.superfoodSignals}
                />
              )}

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
                  <Icon name="check-circle" size={16} color={Colors.states.PEAK.primary} />
                  <Text style={[styles.primaryCtaText, { color: Colors.states.PEAK.primary }]}>
                    {logging ? 'LOGGING…' : `LOG ${result.product.productName.toUpperCase()}`}
                  </Text>
                </Pressable>
              )}

              <ProductFitCard result={result} />

            </>
          )}

          {!result && !outcome && (
            <View style={styles.emptyCard}>
              <Icon name="camera" size={20} color={Colors.text.muted} />
              <Text style={styles.emptyTitle}>Awaiting scan</Text>
              <Text style={styles.emptyHint}>
                {Platform.OS === 'web'
                  ? 'Tap a product above to simulate a barcode scan, or search by name.'
                  : 'Tap the viewfinder to open the camera, or use simulate scan.'}
              </Text>
            </View>
          )}

          {/* Server-backed recent scans — proves persistence across reloads. */}
          {serverScans && serverScans.length > 0 && (
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Icon name="clock" size={12} color={Colors.text.muted} />
                <Text style={styles.historyHeaderText}>RECENT SCANS</Text>
                <Text style={styles.historySync}>SYNCED</Text>
              </View>
              {serverScans.slice(0, 5).map((s) => (
                <View key={s.id} style={styles.historyRow}>
                  <View style={[styles.historyDot, { backgroundColor: verdictColor(s.verdict) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle} numberOfLines={1}>{s.productName}</Text>
                    <Text style={styles.historyMeta} numberOfLines={1}>
                      {formatRelativeTime(s.loggedAt)} · fit {s.fitScore}
                    </Text>
                  </View>
                  <Text style={[styles.historyVerdict, { color: verdictColor(s.verdict) }]}>
                    {s.verdict.toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* HydroScan 2.0™ — local, advisory scan history. Records what was
              scanned + whether it was consumed; carries no score. */}
          {hydroScan2 && hydroScanHistory.entries.length > 0 && (
            <View style={styles.historyCard} testID="hydroscan2-history">
              <View style={styles.historyHeader}>
                <Icon name="droplet" size={12} color={Colors.text.muted} />
                <Text style={styles.historyHeaderText}>{t('hydroScan2.history.title')}</Text>
                <Text style={styles.historyAdvisory}>{t('hydroScan2.history.advisory')}</Text>
              </View>
              {hydroScanHistory.entries.slice(0, 6).map((e) => (
                <View key={e.id} style={styles.historyRow}>
                  <View
                    style={[styles.historyDot, { backgroundColor: impactColor(e.impactLevel) }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle} numberOfLines={1}>
                      {e.productName}
                    </Text>
                    <Text style={styles.historyMeta} numberOfLines={1}>
                      {formatRelativeTime(e.scannedAt)} · {t(`hydroScan2.consumption.${e.consumption}`)}
                    </Text>
                  </View>
                  <Text style={[styles.historyVerdict, { color: impactColor(e.impactLevel) }]}>
                    {t(IMPACT_I18N_KEY[e.impactLevel])}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.scanDisclaimer}>
            Scan provides performance and hydration guidance only. It is not intended to diagnose, treat, cure, or prevent medical conditions.
          </Text>
        </ScrollView>
      </GradientBackground>
      {/* Success flash overlay — pointerEvents='none' so it never blocks
          taps mid-fade. Tinted PEAK so a successful log feels rewarded. */}
      <Animated.View pointerEvents="none" style={[styles.flashOverlay, flashStyle]} />

      <CameraScanModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={onCameraScan}
      />

      <AddDrinkModal
        visible={addDrinkOpen}
        accentColor={Colors.states.PEAK.primary}
        onCancel={() => setAddDrinkOpen(false)}
        onConfirm={onConfirmDrink}
      />

      <SmartCaptureModal
        visible={smartCaptureOpen}
        accentColor={Colors.accent.primary}
        personalization={personalization}
        onCancel={() => setSmartCaptureOpen(false)}
        onLogCorrection={onSmartCaptureLog}
      />
    </View>
  );
}

function verdictColor(v: string): string {
  switch (v) {
    case 'optimal': return Colors.states.PEAK.primary;
    case 'strong': return Colors.states.PEAK.primary;
    case 'acceptable': return Colors.states.RECOVERING.primary;
    case 'suboptimal': return Colors.states.DEPLETED.primary;
    case 'avoid': return Colors.states.DEPLETED.primary;
    default: return Colors.text.muted;
  }
}

function impactColor(level: string): string {
  switch (level) {
    case 'HIGH_SUPPORT': return Colors.states.PEAK.primary;
    case 'NEUTRAL': return Colors.states.BALANCED.primary;
    case 'MODERATE_IMPACT': return Colors.states.RECOVERING.primary;
    case 'HIGH_IMPACT': return Colors.states.DEPLETED.primary;
    default: return Colors.text.muted;
  }
}

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.states.PEAK.primary,
  },
  content: { paddingHorizontal: 20, gap: 14 },

  historyCard: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
    gap: 10,
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyHeaderText: {
    flex: 1,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.text.muted,
    fontWeight: '700',
  },
  historySync: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.states.PEAK.primary,
    fontWeight: '700',
  },
  historyAdvisory: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.text.muted,
    fontWeight: '700',
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyDot: { width: 6, height: 6, borderRadius: 3 },
  historyTitle: { fontSize: 13, color: Colors.text.primary, fontWeight: '600' },
  historyMeta: { fontSize: 11, color: Colors.text.muted, marginTop: 2 },
  historyVerdict: { fontSize: 10, letterSpacing: 1, fontWeight: '700' },

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
  tabRow: {
    flexDirection: 'row', gap: 6,
    padding: 3,
    borderRadius: 100,
    backgroundColor: Colors.fill.light,
    alignSelf: 'flex-start',
  },
  tabPill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100,
  },
  tabPillActive: {
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.medium,
  },
  tabPillText: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted, letterSpacing: 0.4,
  },
  tabPillTextActive: {
    color: Colors.text.primary,
  },
  pickerCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 100, borderWidth: 1,
    borderColor: `${Colors.states.PEAK.primary}55`,
    backgroundColor: `${Colors.states.PEAK.primary}10`,
    alignSelf: 'flex-start',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: Colors.border.subtle,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
    marginBottom: 4,
  },
  pickerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14, letterSpacing: 1.2,
    color: Colors.text.primary,
    textTransform: 'uppercase',
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
  },
  pickerRowText: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.text.primary,
  },

  compareCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, marginVertical: 12,
    borderRadius: 14, borderWidth: 1,
    borderColor: `${Colors.states.PEAK.primary}55`,
    backgroundColor: `${Colors.states.PEAK.primary}10`,
  },
  compareWithAforceCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
    borderColor: `${Colors.states.PEAK.primary}66`,
    backgroundColor: `${Colors.states.PEAK.primary}14`,
  },
  compareWithAforceText: {
    flex: 1,
    fontSize: 11, fontFamily: 'Inter_700Bold',
    color: Colors.states.PEAK.primary, letterSpacing: 1.4,
  },
  compareCtaTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary, letterSpacing: 1.4,
  },
  compareCtaSub: {
    fontSize: 10, fontFamily: 'Inter_500Medium',
    color: Colors.text.muted, marginTop: 2, letterSpacing: 0.2,
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

  logAnyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1,
    backgroundColor: Colors.background.card,
  },
  logAnyTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2,
  },
  logAnyHint: {
    fontSize: 10, fontFamily: 'Inter_500Medium',
    color: Colors.text.muted, marginTop: 3, letterSpacing: 0.3,
  },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${Colors.states.RECOVERING.primary}14`,
    borderColor: `${Colors.states.RECOVERING.primary}55`,
    borderWidth: 1, borderRadius: 14, padding: 12,
  },
  errorText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.primary, flex: 1 },

  recoveryStrip: {
    alignSelf: 'stretch', maxWidth: '100%',
    marginTop: 4, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.subtle,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  recoveryStripText: {
    fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.6,
    color: Colors.text.secondary, flexShrink: 1,
  },

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
  scanDisclaimer: {
    fontSize: 10, fontFamily: 'Inter_400Regular',
    color: Colors.text.muted, textAlign: 'center',
    lineHeight: 14, letterSpacing: 0.2,
    marginTop: 18, marginBottom: 6,
    paddingHorizontal: 8,
  },
});
