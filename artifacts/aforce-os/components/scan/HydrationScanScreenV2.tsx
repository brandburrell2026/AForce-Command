/**
 * Hydration Scan screen.
 *
 * Premium scan-to-decide surface. On native this drives the Expo Camera
 * barcode scanner; a manual search field is the fallback on every platform.
 * The mock "PREVIEW SCAN" tray is dev/demo-only (PREVIEW_SCAN_ENABLED) —
 * a simulated scan persists like a real one, so members must never be able
 * to author one.
 *
 * The screen itself is fully wired: scan → recognize → score under the
 * comparison engine → recommend → log intake into the live store.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Platform, Pressable, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AFDisclosureSheet, AFListRow } from '@/components/ui';
import { AFModal } from '@/components/ui/AFModal';
import { useRouter } from 'expo-router';
import { hapticNotify, hapticSelection } from '@/services/haptics';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { fireMoment } from '@/services/haptics';
import { Icon } from '@/components/Icon';

import { GradientBackground } from '@/components/GradientBackground';
import { ScanResultCard } from '@/components/ScanResultCard';
import { ScanAICoachCard } from '@/components/ScanAICoachCard';
import { ProductFitCard } from '@/components/ProductFitCard';
import { DataBehindThisSheet } from '@/components/DataBehindThisSheet';
import { gatherDataBehindSignals } from '@/utils/confidence/gatherDataBehindSignals';
import { useCommandConfidence } from '@/hooks/useCommandConfidence';
import { AForceReplacementCard } from '@/components/AForceReplacementCard';
import { CameraScanModal } from '@/components/CameraScanModal';
import { AddDrinkModal } from '@/components/AddDrinkModal';
import { SmartCaptureModal } from '@/components/SmartCaptureModal';
import { WhyThisForYouCard } from '@/components/WhyThisForYouCard';
import { SuperfoodSignalsCard } from '@/components/SuperfoodSignalsCard';
import { derivePersonalizationSignals } from '@/utils/personalizationSignals';
import { DRINK_CATEGORIES } from '@/data/drinkCatalog';
import { af, withAlpha } from '@/theme';
import { styles, verdictColor, impactColor, toTextSafeColor, formatRelativeTime } from './scanKit';
import { useAppStore } from '@/store/useAppStore';
import { scan } from '@/services/hydrationScanService';
import { PREVIEW_SCAN_ENABLED } from '@/services/demoMode';
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

export function HydrationScanScreenV2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const reducedMotion = useReducedMotion();
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
  const [otherWaysOpen, setOtherWaysOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [addDrinkOpen, setAddDrinkOpen] = useState(false);
  const [smartCaptureOpen, setSmartCaptureOpen] = useState(false);
  // Preview Scan tray — split into "Other Brands" (competitor SKUs) and
  // "AForce Products" (the 9 flavor × format shelf SKUs). The AForce tab
  // also exposes a dropdown picker that lists every AForce product by
  // full name for evaluators who want to pick one explicitly.
  const [previewTab, setPreviewTab] = useState<'other' | 'aforce'>('aforce');
  const [aforcePickerOpen, setAforcePickerOpen] = useState(false);

  // Show-10 slice ① on HydroScan Fit — the DATA BEHIND THIS tap-through. Gated
  // by spec_confidenceDetailSheet; when on, ProductFitCard's Command Confidence
  // badge becomes tappable and opens the sheet, seeded from the same command
  // read (confidence) + the biometric signals behind it. NO §56 (CR-1-gated).
  const detailSheetEnabled = state.featureFlags.spec_confidenceDetailSheet;
  const commandConfidence = useCommandConfidence() ?? null;
  const [dataBehindOpen, setDataBehindOpen] = useState(false);
  const dataBehindSignals = useMemo(
    () => (detailSheetEnabled ? gatherDataBehindSignals(state.userState.biometrics) : []),
    [detailSheetEnabled, state.userState.biometrics],
  );

  // SIGNATURE MOMENT — HYDRATION COMPLETION. Fires after a successful log:
  // fades a PEAK tint over the screen, lands the `hydration_logged` haptic, and
  // pops back to Home ~800ms later. Per spec §11: 20% PEAK over 300ms then
  // router.back() at 800ms, so the acknowledgement is felt before the screen
  // leaves. This is the only moment in Phase 1 where the member changed
  // something about their body, so it is the one that most earns a haptic —
  // and it is now the ONLY thing a scan vibrates for (see runScan below).
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
      // The flash is finite, but a back-nav during it would otherwise leave the
      // tween running on the UI thread past unmount (Wave-4 rule: nothing
      // animates for a screen that is gone).
      cancelAnimation(flashOpacity);
    };
  }, [flashOpacity]);
  const triggerSuccessFlash = useCallback(() => {
    // Reduced motion: the acknowledgment (haptic moment + auto-back) stays;
    // only the tween is withheld. Previously this animated unconditionally —
    // the screen's only breach of the afMotion reduced-motion rule.
    if (!reducedMotion) flashOpacity.value = withSequence(
      withTiming(0.2, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }),
    );
    fireMoment('hydration_logged');
    if (flashTimeoutRef.current !== null) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      flashTimeoutRef.current = null;
      router.back();
    }, 800);
  }, [flashOpacity, router, reducedMotion]);
  const postScanMut = usePostScan();
  const { data: serverScans } = useScanHistory(20);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom;

  // Wave-5 REMOVAL — the scan ring no longer pulses.
  //
  // Wave-4 found this as two ungated, un-torn-down `withRepeat(..., -1)` loops
  // and Wave-5 round 1 gated them. This round finishes the job: per the
  // founder's motion brief, constant pulsing is REMOVED rather than tuned down,
  // and a viewfinder does not need a heartbeat to say it is armed — the live
  // camera preview inside it already does. Deleting it also takes the last
  // unbounded UI-thread loop off the scan surface, so an open scanner now costs
  // nothing per frame while it waits.
  //
  // The ring itself stays: it is the framing target. It is simply a static
  // stroke now, drawn at the resting scale/opacity the reduced-motion branch
  // already used — so a reduced-motion member sees exactly what everyone sees.
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
    if (Platform.OS !== 'web') hapticSelection();
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
        // MEANINGFUL STATE TRANSITION — and only when there is one. A good
        // verdict used to buzz too, which made every single scan vibrate; the
        // result card arriving is acknowledgement enough for "this is fine".
        // A poor verdict is AForce changing its read of the member's next
        // move, so that one still reaches the hand.
        if (out.result.verdict === 'avoid' || out.result.verdict === 'suboptimal') {
          fireMoment('state_transition');
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
    hapticSelection();
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
        hapticNotify('success');
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
      await logIntake(fluid, { source: 'scan' });
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
      await logIntake(fluid, { source: 'scan' });
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
      if (Platform.OS !== 'web') hapticSelection();
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
        hapticNotify('success');
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
        source: 'scan',
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
        source: 'scan',
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
        source: 'scan',
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
          contentContainerStyle={[styles.content, { paddingTop: topPadding + 8, paddingBottom: tabClearance }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')}>
              <Icon name="chevron-left" size={20} color={af.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t('hydroScan2.v2.eyebrow')}</Text>
              <Text style={styles.title}>{t('hydroScan2.v2.title')}</Text>
            </View>
            {/* S2-8: the HydroState band pill is gone — one state, one
                verdict, and Home owns it. This screen is a tool. */}
          </View>

          {/* Camera viewfinder — tap to open native camera on device */}
          <Pressable
            onPress={openCamera}
            disabled={Platform.OS === 'web' || scanning}
            accessibilityRole="button"
            accessibilityLabel={t('hydroScan2.v2.open_camera_a11y')}
            style={({ pressed }) => [
              styles.viewfinder,
              { opacity: Platform.OS === 'web' ? 1 : pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.ring} />
            <View style={styles.reticule}>
              <View style={[styles.cornerTL, styles.corner]} />
              <View style={[styles.cornerTR, styles.corner]} />
              <View style={[styles.cornerBL, styles.corner]} />
              <View style={[styles.cornerBR, styles.corner]} />
              <Icon
                name={Platform.OS === 'web' ? 'maximize' : 'camera'}
                size={28}
                color={scanning ? af.green : withAlpha(af.textPrimary, 0.6)}
              />
            </View>
            <Text style={styles.viewfinderLabel}>
              {scanning ? t('hydroScan2.v2.viewfinder_identifying') : Platform.OS === 'web' ? t('hydroScan2.v2.viewfinder_preview') : t('hydroScan2.v2.viewfinder_tap')}
            </Text>
          </Pressable>

          {/* Preview Scan tray + its SKU picker — DEV/DEMO ONLY.
              A simulated scan writes the same persisted history a real one does,
              so a shipped tray would let a member author scan records for
              products they never held. PREVIEW_SCAN_ENABLED folds to false in a
              release bundle, which removes the only two entry points into
              runScan() that no product in hand can back. */}
          {PREVIEW_SCAN_ENABLED && (
            <>
              {/* Tabbed: AForce Products + Other Brands. AForce tab shows the
                  9 flavor × format shelf SKUs and a dropdown picker for the
                  full list. */}
              <View style={styles.trayCard}>
                <View style={styles.trayHeader}>
                  <Icon name="zap" size={12} color={af.textTertiary} />
                  <Text style={styles.trayHeaderText}>{t('hydroScan2.v2.preview_scan')}</Text>
                </View>

                <View style={styles.tabRow}>
                  <Pressable
                    onPress={() => setPreviewTab('aforce')}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: previewTab === 'aforce' }}
                    style={[styles.tabPill, previewTab === 'aforce' && styles.tabPillActive]}
                    testID="preview-tab-aforce"
                  >
                    <Text style={[styles.tabPillText, previewTab === 'aforce' && styles.tabPillTextActive]}>
                      {t('hydroScan2.v2.tab_aforce')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPreviewTab('other')}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: previewTab === 'other' }}
                    style={[styles.tabPill, previewTab === 'other' && styles.tabPillActive]}
                    testID="preview-tab-other"
                  >
                    <Text style={[styles.tabPillText, previewTab === 'other' && styles.tabPillTextActive]}>
                      {t('hydroScan2.v2.tab_other')}
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
                    <Icon name="list" size={14} color={af.green} />
                    <Text style={[styles.chipText, { color: af.green, flexShrink: 1 }]}>
                      {t('hydroScan2.v2.select_aforce_product')}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={styles.trayChips}>
                    {otherBrandChips.map((it) => (
                      <Pressable
                        key={it.code}
                        onPress={() => runScan({ kind: 'barcode', rawValue: it.code })}
                        disabled={scanning}
                        accessibilityRole="button"
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
              <AFModal
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
                      <Text style={styles.pickerTitle}>{t('hydroScan2.v2.picker_title')}</Text>
                      <Pressable
                        onPress={() => setAforcePickerOpen(false)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('hydroScan2.v2.close_picker_a11y')}
                      >
                        <Icon name="x" size={18} color={af.textPrimary} />
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
                            pressed && { backgroundColor: af.surface },
                          ]}
                          testID={`preview-aforce-picker-row-${p.productId}`}
                        >
                          <Text style={styles.pickerRowText}>{p.name}</Text>
                          <Icon name="chevron-right" size={14} color={af.textTertiary} />
                        </Pressable>
                      ))}
                    </ScrollView>
                  </Pressable>
                </Pressable>
              </AFModal>
            </>
          )}

          {/* Manual search — looks up AForce products via the comparison engine */}
          <View style={styles.manualCard}>
            <Text style={styles.manualLabel}>{t('hydroScan2.v2.manual_search')}</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                value={manualQuery}
                onChangeText={setManualQuery}
                placeholder={t('hydroScan2.v2.manual_placeholder')}
                placeholderTextColor={af.textTertiary}
                onSubmitEditing={onManualSubmit}
                returnKeyType="search"
              />
              <Pressable onPress={onManualSubmit} style={styles.manualBtn} disabled={scanning} accessibilityRole="button" accessibilityLabel={t('hydroScan2.v2.search_a11y')}>
                <Icon name="search" size={14} color={af.textPrimary} />
              </Pressable>
            </View>
          </View>

          {/* S2-8: LOG ANY DRINK / SMART CAPTURE / URINE CHECK were three
              full-width blocks in the identical shape as each other (and as
              the hero) — a four-way command pileup differing only by border
              hue. One quiet entry now opens them as a disclosure; the
              viewfinder is the sole hero. Handlers unchanged. */}
          <AFListRow
            icon="plus-circle"
            title={t('hydroScan2.v2.other_ways_title')}
            subtitle={t('hydroScan2.v2.other_ways_hint')}
            disclosure
            onPress={() => setOtherWaysOpen(true)}
            testID="hydroscan-other-ways"
          />

          {/* Result region */}
          {outcome?.ok === false && (
            <View style={styles.errorCard} accessibilityLiveRegion="assertive">
              <Icon name="alert-triangle" size={14} color={af.amber} />
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
                  accessibilityLabel={t('hydroScan2.v2.recovery_strip_a11y', {
                    recovery: recoveryLayer.recovery,
                    pressure: recoveryLayer.pressure,
                    trend: recoveryLayer.trend,
                  })}
                >
                  <Text
                    style={styles.recoveryStripText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {t('hydroScan2.v2.recovery_strip', {
                      recovery: recoveryLayer.recovery,
                      pressure: recoveryLayer.pressure,
                      trend: t(
                        recoveryLayer.trend === 'rising'
                          ? 'hydroScan2.v2.trend_rising'
                          : recoveryLayer.trend === 'declining'
                            ? 'hydroScan2.v2.trend_declining'
                            : 'hydroScan2.v2.trend_flat',
                      ),
                    })}
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
                  accentColor={af.red}
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
                  accessibilityRole="button"
                  accessibilityState={{ busy: logging }}
                  style={({ pressed }) => [
                    styles.primaryCta,
                    {
                      borderColor: af.green,
                      opacity: logging ? 0.6 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Icon name="check-circle" size={16} color={af.green} />
                  <Text style={[styles.primaryCtaText, { color: af.green }]}>
                    {logging ? t('hydroScan2.v2.logging') : t('hydroScan2.v2.log_product', { name: result.product.productName.toUpperCase() })}
                  </Text>
                </Pressable>
              )}

              <ProductFitCard
                result={result}
                onConfidencePress={detailSheetEnabled ? () => setDataBehindOpen(true) : undefined}
              />

            </>
          )}

          {!result && !outcome && (
            <View style={styles.emptyCard}>
              <Icon name="camera" size={20} color={af.textTertiary} />
              <Text style={styles.emptyTitle}>{t('hydroScan2.v2.empty_title')}</Text>
              {/* The web hint points AT the preview tray, so it may only be
                  shown when the tray is actually mounted; otherwise the
                  empty state would instruct a member to tap something that
                  is not on the screen. */}
              <Text style={styles.emptyHint}>
                {Platform.OS === 'web' && PREVIEW_SCAN_ENABLED
                  ? t('hydroScan2.v2.empty_hint_web')
                  : t('hydroScan2.v2.empty_hint_native')}
              </Text>
            </View>
          )}

          {/* Server-backed recent scans — proves persistence across reloads. */}
          {serverScans && serverScans.length > 0 && (
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Icon name="clock" size={12} color={af.textTertiary} />
                <Text style={styles.historyHeaderText}>{t('hydroScan2.v2.recent_scans')}</Text>
                <Text style={styles.historySync}>{t('hydroScan2.v2.synced')}</Text>
              </View>
              {serverScans.slice(0, 5).map((s) => (
                <View key={s.id} style={styles.historyRow}>
                  <View style={[styles.historyDot, { backgroundColor: verdictColor(s.verdict) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle} numberOfLines={1}>{s.productName}</Text>
                    <Text style={styles.historyMeta} numberOfLines={1}>
                      {formatRelativeTime(s.loggedAt, t)} · {t('hydroScan2.v2.history_fit', { score: s.fitScore })}
                    </Text>
                  </View>
                  <Text style={[styles.historyVerdict, { color: toTextSafeColor(verdictColor(s.verdict)) }]}>
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
                <Icon name="droplet" size={12} color={af.textTertiary} />
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
                      {formatRelativeTime(e.scannedAt, t)} · {t(`hydroScan2.consumption.${e.consumption}`)}
                    </Text>
                  </View>
                  <Text style={[styles.historyVerdict, { color: toTextSafeColor(impactColor(e.impactLevel)) }]}>
                    {t(IMPACT_I18N_KEY[e.impactLevel])}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.scanDisclaimer}>{t('hydroScan2.v2.disclaimer')}</Text>
        </ScrollView>

        <AFDisclosureSheet
          visible={otherWaysOpen}
          onClose={() => setOtherWaysOpen(false)}
          title={t('hydroScan2.v2.other_ways_title')}
          testID="hydroscan-other-ways-sheet"
        >
          <AFListRow
            icon="plus-circle"
            title={t('hydroScan2.v2.log_any_title')}
            subtitle={t('hydroScan2.v2.log_any_hint')}
            onPress={() => { setOtherWaysOpen(false); setAddDrinkOpen(true); }}
            testID="hydroscan-log-any-drink"
          />
          <AFListRow
            icon="camera"
            title={t('hydroScan2.v2.smart_capture_title')}
            subtitle={t('hydroScan2.v2.smart_capture_hint')}
            onPress={() => { setOtherWaysOpen(false); setSmartCaptureOpen(true); }}
            testID="hydroscan-smart-capture"
          />
          <AFListRow
            icon="droplet"
            title={t('hydroScan2.v2.urine_check_title')}
            subtitle={t('hydroScan2.v2.urine_check_hint')}
            onPress={() => { setOtherWaysOpen(false); router.push('/urine-check' as never); }}
            testID="hydroscan-urine-check"
          />
        </AFDisclosureSheet>
      </GradientBackground>
      {/* Success flash overlay — pointerEvents='none' so it never blocks
          taps mid-fade. Tinted PEAK so a successful log feels rewarded. */}
      <Animated.View pointerEvents="none" style={[styles.flashOverlay, flashStyle]} />

      <DataBehindThisSheet
        visible={dataBehindOpen}
        onDismiss={() => setDataBehindOpen(false)}
        confidence={commandConfidence}
        signals={dataBehindSignals}
      />

      <CameraScanModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={onCameraScan}
      />

      <AddDrinkModal
        visible={addDrinkOpen}
        accentColor={af.green}
        onCancel={() => setAddDrinkOpen(false)}
        onConfirm={onConfirmDrink}
      />

      <SmartCaptureModal
        visible={smartCaptureOpen}
        accentColor={af.red}
        personalization={personalization}
        onCancel={() => setSmartCaptureOpen(false)}
        onLogCorrection={onSmartCaptureLog}
      />
    </View>
  );
}
