/**
 * EditorialScanScreen — SCAN, The Tool (E6-B, founder authorization 2026-08-30).
 *
 * The Editorial OS composition of the SAME Scan truth, on BLACK stock. Every
 * value comes from the services E6-A protected and E6-B0 corrected; nothing is
 * re-derived, no metric is added, no claim is made.
 *
 * ═══ THE PRODUCT LAW THIS SCREEN EXISTS TO HONOUR ═══
 *
 *   "Scan is The Tool, not The Diagnostician."
 *
 * The camera reads a barcode. It takes no photograph, stores none, transmits
 * none. Nothing about the member is sensed. The danger of a premium editorial
 * register on THIS surface is that authority reads as measurement — so the
 * composition's job is to make the member able to tell apart:
 *
 *   OBSERVED        the symbol we decoded — and nothing else
 *   ON FILE         product facts looked up, with their evidence quality
 *   CALCULATED      arithmetic over product data alone
 *   YOUR STATE      the member's own canonical context
 *   CONTEXTUALIZED  the two evaluated together — PRODUCT MATCH
 *
 * That separation is STRUCTURAL — section eyebrows and rules, not a legend or
 * a badge on every value. A member should never have to decode the screen to
 * be told the truth by it.
 *
 * FOUNDER RULINGS ENFORCED HERE (locked by editorialScanLaw.test.ts):
 *  D1 — PRODUCT MATCH, never a hydration/health/recovery/readiness score. The
 *       value never renders without "Contextualized for this Moment".
 *  D2 — barcode registration marks, not photographic capture grammar.
 *  D3 — provenance consumed as E6-B0 defined it; nothing upgraded, and brand
 *       never touches it.
 *  D4 — no physiological assertion; explanation is about the COMPARISON.
 *  D5 — UNKNOWN prints the dash and no bar; a measured zero prints 0.
 *  D6 — no brand-conditional copy, CTA or hierarchy. The alternative renders
 *       from the canonical field whatever brand won, and NO CHANGE NEEDED is a
 *       real outcome.
 *
 * ═══ E6-A PRODUCER CONTRACT ═══
 * This screen is registered in SCAN_EXPERIENCE_SCREENS, so all three producer
 * contracts run against it. `runScan` below mirrors the production structure
 * deliberately and exactly: the re-entrancy guard precedes both producers, the
 * `receipt_scanned` emit and the `postScan` client write fire ONCE and only
 * inside `if (out.ok)`, and speech is torn down on unmount. Recognition is not
 * consumption — this screen writes no intake.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';

import { useRouter } from 'expo-router';

import { af } from '@/theme';
import { AFScreen } from '@/components/ui';
import { AddDrinkModal } from '@/components/AddDrinkModal';
import { CameraScanModal } from '@/components/CameraScanModal';
import { CycleSuccessOverlay } from '@/components/CycleSuccessOverlay';
import { DECISION_GUARD_MAX_DOSE_OZ } from '@/config/hydroStateModel';
import { PRODUCTS } from '@/data/products';
import { DRINK_CATEGORIES } from '@/data/drinkCatalog';
import { emit } from '@/analytics/event_dispatcher';
import { usePostScan } from '@/hooks/useServerHistory';
import { speak as speakCoach, stopSpeaking } from '@/services/textToSpeech';
import { fireMoment, hapticSelection } from '@/services/haptics';
import { scan } from '@/services/hydrationScanService';
import { listSimulatableBarcodes } from '@/services/productRecognitionService';
import { PREVIEW_SCAN_ENABLED } from '@/services/demoMode';
import { attributeProvenance } from '@/services/comparisonEngine';
import { buildScanCoachScript } from '@/services/scanCoachVoice';
import { useCoachMode, shouldSpeak } from '@/services/coachMode';
import { useAppStore } from '@/store/useAppStore';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { edInkFor, edRhythm, edStock, edType } from '@/theme/editorialTokens';
import type { ScanOutcome, ScanSource } from '@/types/scan';
import type { CompareProduct } from '@/types/comparison';

import { EdCaption, EdEvidenceLine, EdKicker, EdRule, EdStatement, EdSurface, useEdSettle } from '../index';
import { EdReturn } from '../moments/EdReturn';
import { EdIntakeConfirm } from './EdIntakeConfirm';
import { EdProductFactors, type ProductFactor } from './EdProductFactors';
import { EdRegistrationTarget } from './EdRegistrationTarget';
import {
  CLASS_LABEL,
  coverageNote,
  matchQualifier,
  observedLabel,
} from './editorialScanPresentation';

export function EditorialScanScreen() {
  const { t } = useTranslation();
  const ink = edInkFor('black');
  const settle = useEdSettle();
  const { state, logIntake, undoIntake, dismissSuccess } = useAppStore();

  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  // PARITY (not new capability): both of these exist on the production Scan
  // surface. Activating `editorial_scan_enabled` swaps this screen in for
  // HydrationScanScreenV2, which holds the app's ONLY navigation to
  // /urine-check and its ONLY mount of AddDrinkModal — so without them here,
  // turning the flag on deletes the Urine Hydration Check and manual drink
  // logging from the whole app.
  const [addDrinkOpen, setAddDrinkOpen] = useState(false);
  const router = useRouter();
  const postScanMut = usePostScan();

  // ── RP-6 (ruling R4) · the intake lifecycle ──────────────────────────
  // recognition → review → quantity → member confirmation → idempotent
  // intake → undo. Recognition awards ZERO credit: nothing below runs from
  // the scan path — only from the member's explicit confirmation.
  const OZ_STEP = 2;
  // The member's single-confirm ceiling is the documented client UI max
  // (64 oz — api-server intakeSchema: 'client UI max is 64oz'), NOT the
  // Decision Guard's rejection envelope: the guard bound is the forgery
  // threshold, three times any plausible single intake. The guard ceiling
  // still clamps above as defense-in-depth.
  const MAX_LOG_OZ = Math.min(64, DECISION_GUARD_MAX_DOSE_OZ);
  const [qtyOz, setQtyOz] = useState(0);
  const [loggedCycleId, setLoggedCycleId] = useState<string | null>(null);

  // Mirrors HydrationScanScreenV2's onConfirmDrink: same category lookup, same
  // logIntake call, same overrides. Copied rather than reinvented so the two
  // surfaces cannot drift into logging the same drink differently.
  const onConfirmDrink = useCallback(async (args: {
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
    await logIntake(cat.fluidType, {
      source: 'scan',
      ozOverride: args.effectiveOz,
      displayNameOverride: `${args.displayName} · ${args.enteredOz} oz`,
      categoryId: args.categoryId,
    });
  }, [logIntake]);
  const [undone, setUndone] = useState(false);
  // One write on screen at a time — drives busy states AND freezes SCAN
  // AGAIN so a slow round-trip cannot race a rescan (see the epoch below).
  const [writeInFlight, setWriteInFlight] = useState(false);
  // Cross-product attribution guard (Wave-2 review): a confirm/undo started
  // against product A must never paint its RECORDED/REMOVED state onto
  // product B's lifecycle. The epoch advances with every new result; a
  // resolution from an older epoch is discarded.
  const lifecycleEpochRef = useRef(0);
  // A ref, not state: two same-frame taps both close over a pre-render
  // logIntake whose own isCompletingCycle guard has not seen the first tap
  // yet (the HomeScreenV2 duplicate-log lesson, verbatim).
  const confirmInFlightRef = useRef(false);

  // ── PRODUCER 3 · speech teardown (E6-A) ──────────────────────────────
  // Stop any in-flight narrative if the screen unmounts mid-sentence.
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);
  const handleCoachStop = useCallback(() => {
    stopSpeaking();
  }, []);

  const coachMode = useCoachMode();

  const runScan = async (source: ScanSource) => {
    if (scanning) return;
    setScanning(true);
    if (Platform.OS !== 'web') hapticSelection();
    try {
      const out = await scan(
        source,
        state.engineOutput,
        state.userState,
        state.profileIdentity,
        { hydroScan2: false },
      );
      setOutcome(out);
      if (out.ok) {
        // ── PRODUCER 1 · activation event (E6-A) ──────────────────────
        // Consent-gated inside `emit`; fire-and-forget so a slow network
        // never stalls the result.
        void emit('receipt_scanned', { sourceKind: source.kind });
        // ── PRODUCER 2 · client scan write (E6-A) ─────────────────────
        // Best-effort — the UI never blocks on it. The canonical payload,
        // field for field.
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
          recommendedProductId: out.result.recommendation.alternativeProductId ?? null,
        });
        if (out.result.verdict === 'avoid' || out.result.verdict === 'suboptimal') {
          fireMoment('state_transition');
        }
      }
    } finally {
      setScanning(false);
    }
  };

  const result = outcome?.ok ? outcome.result : null;

  // A new result resets the lifecycle: quantity returns to the product's own
  // serving size (bounded by the Decision Guard ceiling), and any previous
  // log/undo state belongs to the previous product.
  useEffect(() => {
    lifecycleEpochRef.current += 1;
    const fluid = result?.product.fluidType;
    setQtyOz(fluid ? Math.min(PRODUCTS[fluid].ozPerServing, MAX_LOG_OZ) : 0);
    setLoggedCycleId(null);
    setUndone(false);
  }, [result]);

  const onAdjustQty = useCallback((deltaOz: number) => {
    setQtyOz((prev) => Math.max(OZ_STEP, Math.min(MAX_LOG_OZ, prev + deltaOz)));
  }, [MAX_LOG_OZ]);

  // THE ONE WRITE in this layer (locked by editorialScanLaw): the member's
  // explicit confirmation, carrying the reviewed quantity and the PRODUCT's
  // fluid type — never hardcoded water (ruling R4).
  const onConfirmLog = async () => {
    const fluid = result?.product.fluidType;
    if (!result || !fluid) return;
    if (confirmInFlightRef.current || state.isCompletingCycle || state.showCycleSuccess) return;
    confirmInFlightRef.current = true;
    const epoch = lifecycleEpochRef.current;
    setWriteInFlight(true);
    try {
      // flavorLabel: the scanned identity travels with the write. Without it
      // every stick SKU logs as the catalog default flavor (watermelon) and
      // the score's flavor-specific impacts land on the wrong product
      // (Wave-2 review: Soursop Edge scored as watermelon).
      const cycleId = await logIntake(fluid, {
        source: 'scan',
        ozOverride: qtyOz,
        flavorLabel: result.product.productName,
      });
      if (lifecycleEpochRef.current !== epoch) return;
      if (cycleId) {
        setLoggedCycleId(cycleId);
        setUndone(false);
      }
    } finally {
      confirmInFlightRef.current = false;
      setWriteInFlight(false);
    }
  };

  const onUndoLog = async () => {
    if (!loggedCycleId || confirmInFlightRef.current) return;
    confirmInFlightRef.current = true;
    const epoch = lifecycleEpochRef.current;
    setWriteInFlight(true);
    try {
      const ok = await undoIntake(loggedCycleId);
      if (lifecycleEpochRef.current !== epoch) return;
      if (ok) {
        setLoggedCycleId(null);
        setUndone(true);
      }
    } finally {
      confirmInFlightRef.current = false;
      setWriteInFlight(false);
    }
  };

  // The coach mirror, spoken only in the member's chosen posture. It explains
  // the comparison; it authors no instruction (DR-013).
  useEffect(() => {
    if (!result) return;
    const script = buildScanCoachScript(result, undefined);
    if (script && shouldSpeak(coachMode)) speakCoach(script.headline);
  }, [result, coachMode]);

  // Announce the result once, on arrival. iOS needs the explicit call; the
  // guard keeps it to the transition rather than every re-render.
  const announcedRef = useRef(false);
  useEffect(() => {
    if (!result) {
      announcedRef.current = false;
      return;
    }
    if (announcedRef.current) return;
    announcedRef.current = true;
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(result.product.productName);
  }, [result]);

  const catalogRow = result
    ? ({
        id: result.product.productId,
        hydrationSpeed: result.product.hydrationSpeed,
        electrolytes: result.product.electrolyteDensity,
        sugar: result.product.sugarLevel,
        absorptionRate: result.product.performanceFit,
        recoveryEfficiency: result.product.recoveryFit,
        // Carry the declared map through. Without it `attributeProvenance`
        // could only ever infer from null-ness, so a future VERIFIED (or an
        // explicit UNKNOWN) would be invisible to this screen.
        provenance: result.product.provenance,
      } as unknown as CompareProduct)
    : null;

  const factors: ProductFactor[] = result && catalogRow
    ? [
        { label: 'Uptake speed', value: result.product.hydrationSpeed, provenance: attributeProvenance(catalogRow, 'hydrationSpeed'), testID: 'ed-scan-factor-speed' },
        { label: 'Electrolytes', value: result.product.electrolyteDensity, provenance: attributeProvenance(catalogRow, 'electrolytes'), testID: 'ed-scan-factor-electrolytes' },
        // Sugar is the one inverted axis: higher is WORSE. Every other row in
        // this column is higher-is-better, so the polarity is stated in the
        // label rather than left for the member to infer.
        { label: 'Sugar load (lower is better)', value: result.product.sugarLevel, provenance: attributeProvenance(catalogRow, 'sugar'), testID: 'ed-scan-factor-sugar' },
        // `performanceFit` is the MEAN of speed and absorption — a derived
        // value, not the on-file absorption attribute. Labelling it
        // "Absorption" under an ON FILE eyebrow classified a CALCULATED number
        // as LOOKED UP, which is precisely the distinction this screen exists
        // to make. Named for what it is.
        { label: 'Performance blend', value: result.product.performanceFit, provenance: attributeProvenance(catalogRow, 'absorptionRate'), testID: 'ed-scan-factor-absorption' },
        { label: 'Recovery profile', value: result.product.recoveryFit, provenance: attributeProvenance(catalogRow, 'recoveryEfficiency'), testID: 'ed-scan-factor-recovery' },
      ]
    : [];

  const knownCount = factors.filter((f) => f.value != null).length;
  const coverage = result ? coverageNote(knownCount, factors.length) : null;

  return (
    <EdSurface stock="black" style={styles.fill}>
      <StatusBar style="light" />
      <AFScreen scroll style={styles.canvas} contentContainerStyle={styles.content}>
        <Animated.View style={settle}>
          <EdReturn now={new Date()} />
          <EdCaption text="AFORCE · THE TOOL" />
          <EdRule />
          <EdStatement accessibilityRole="header">Scan</EdStatement>

          {/* ── OBSERVED · the symbol, and nothing else ─────────────── */}
          {!result ? (
            <>
              <Pressable
                onPress={() => setCameraOpen(true)}
                disabled={scanning || Platform.OS === 'web'}
                accessibilityRole="button"
                accessibilityLabel="Open the barcode reader"
                accessibilityState={{ disabled: scanning || Platform.OS === 'web' }}
                hitSlop={8}
                testID="ed-scan-target"
              >
                <EdRegistrationTarget
                  label={scanning ? 'READING' : 'POINT AT BARCODE'}
                  note="BARCODE DETECTION · ON DEVICE"
                  testID="ed-scan-registration"
                />
              </Pressable>
              <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 18 }]}>
                The reader decodes the code on the pack. It does not read anything about you.
              </Text>

              {/* OTHER WAYS — parity with the production screen's disclosure
                  sheet. Presentation differs (a plain editorial row, not a
                  sheet); the capabilities are identical. */}
              <Pressable
                onPress={() => setAddDrinkOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('hydroScan2.v2.log_any_title')}
                hitSlop={8}
                style={styles.target}
                testID="ed-scan-add-drink"
              >
                <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>ADD A DRINK MANUALLY</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/urine-check' as never)}
                accessibilityRole="button"
                accessibilityLabel={t('hydroScan2.v2.urine_check_title')}
                hitSlop={8}
                style={styles.target}
                testID="ed-scan-urine-check"
              >
                <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>HYDRATION CHECK</Text>
              </Pressable>

              {/* PREVIEW — dev/demo only, exactly as the production screen has
                  it. `PREVIEW_SCAN_ENABLED` folds to false in a release
                  bundle, so this is unreachable rather than merely hidden:
                  a simulated scan persists to real history. Carried over so
                  the flag-ON surface is not less inspectable than the one it
                  replaces. */}
              {PREVIEW_SCAN_ENABLED ? (
                <View style={styles.section} testID="ed-scan-preview">
                  <EdCaption text="PREVIEW · DEV ONLY" />
                  {/* No slice. BARCODE_INDEX lists every AForce code before
                      any rival, so a truncated list showed AForce products
                      ONLY — the exact copy hierarchy D6 forbids, and it made
                      rivals and plain water unreachable for inspection. */}
                  {listSimulatableBarcodes().map((b) => (
                    <Pressable
                      key={b.code}
                      onPress={() => void runScan({ kind: 'barcode', rawValue: b.code })}
                      disabled={scanning}
                      accessibilityRole="button"
                      accessibilityLabel={`Simulate a scan of ${b.label}`}
                      hitSlop={6}
                      style={styles.target}
                      testID={`ed-scan-preview-${b.productId}`}
                    >
                      <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
                        {b.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {/* ── FAILED · honest, and never a fabricated product ─────── */}
          {outcome && !outcome.ok ? (
            <View style={styles.section} testID="ed-scan-failure">
              {/* The message is its own accessible node. Wrapping the whole
                  block (including the retry Pressable) in `accessible` flattened
                  the button out of the a11y tree entirely — the member was told
                  the scan failed and given no reachable way to try again. */}
              <View
                accessible
                accessibilityLiveRegion="assertive"
                accessibilityLabel={outcome.failure.message}
              >
                <EdCaption text="NOT RECOGNIZED" />
                <Text style={[edType.body as TextStyle, { color: ink.quiet, marginTop: 8 }]}>
                  {outcome.failure.message}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setOutcome(null);
                  setCameraOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Try the reader again"
                hitSlop={8}
                style={styles.target}
                testID="ed-scan-retry"
              >
                <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>TRY AGAIN</Text>
              </Pressable>
              {/* The service's failure copy says "Try manual search or rescan."
                  AddDrinkModal IS that manual search (it has its own query
                  field), so the sentence is only honest while this is
                  reachable. Restoring the action rather than softening the
                  copy keeps both Scan surfaces telling the truth. */}
              <Pressable
                onPress={() => { setOutcome(null); setAddDrinkOpen(true); }}
                accessibilityRole="button"
                accessibilityLabel={t('hydroScan2.v2.log_any_title')}
                hitSlop={8}
                style={styles.target}
                testID="ed-scan-failure-add-drink"
              >
                <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>SEARCH MANUALLY</Text>
              </Pressable>
            </View>
          ) : null}

          {result ? (
            <>
              {/* ── IDENTIFIED ─────────────────────────────────────── */}
              <View style={styles.section} testID="ed-scan-identified">
                <EdCaption text={CLASS_LABEL.observed} />
                <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 6 }]}>
                  {observedLabel(result.source.kind)}
                </Text>
                <EdStatement role="command" style={styles.productName}>
                  {result.product.productName}
                </EdStatement>
                <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet }]}>
                  {result.product.brand}
                </Text>
              </View>

              {/* ── CONTEXTUALIZED · PRODUCT MATCH ─────────────────── */}
              <EdRule style={styles.spaced} />
              <View style={styles.section} testID="ed-scan-match">
                <EdCaption text={CLASS_LABEL.contextualized} />
                <View
                  accessible
                  accessibilityLabel={
                    result.currentFitScore == null
                      ? `Product match not available. ${matchQualifier()}.`
                      : `Product match ${result.currentFitScore} out of 100. ${matchQualifier()}. Evaluated against your ${result.evaluatedAgainstState} state.`
                  }
                  style={styles.matchRow}
                >
                  <Text
                    maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
                    style={[edType.numberHero as TextStyle, { color: result.currentFitScore == null ? ink.quiet : ink.primary }]}
                  >
                    {result.currentFitScore == null ? '—' : result.currentFitScore}
                  </Text>
                  <View style={styles.matchLabel}>
                    <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
                      PRODUCT MATCH
                    </Text>
                    <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 4 }]}>
                      {matchQualifier()}
                    </Text>
                  </View>
                </View>
                <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 12 }]}>
                  {CLASS_LABEL.memberState}: {result.evaluatedAgainstState}
                </Text>
                {coverage ? (
                  <Text
                    style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 8 }]}
                    testID="ed-scan-coverage"
                  >
                    {coverage}
                  </Text>
                ) : null}
              </View>

              {/* ── EXPLANATION · about the comparison, not the body ────
                  ATTRIBUTION: when an alternative was nominated, the service's
                  `detail` is that ALTERNATIVE's whyItFits, not the scanned
                  product's. Rendering it here read as praise for the thing
                  that just ranked lower — "This product ranked lower…"
                  followed by "Strong electrolyte and absorption profile." It
                  is therefore shown with the alternative it actually
                  describes, and only the scanned product's own explanation
                  appears here. */}
              <View style={styles.section} testID="ed-scan-explanation">
                <Text style={[edType.body as TextStyle, { color: ink.primary }]}>
                  {result.recommendation.headline}
                </Text>
                {result.recommendation.detail && !result.recommendation.alternativeProductId ? (
                  <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 10 }]}>
                    {result.recommendation.detail}
                  </Text>
                ) : null}
              </View>

              {/* ── ON FILE · product factors with their evidence ───── */}
              <EdRule style={styles.spaced} />
              <View style={styles.section} testID="ed-scan-factors">
                <EdCaption text={CLASS_LABEL.lookedUp} />
                <EdProductFactors factors={factors} />
              </View>

              {/* ── ALTERNATIVE or NO CHANGE NEEDED ─────────────────── */}
              <View style={styles.section} testID="ed-scan-outcome">
                {/* The outcome comes from the canonical field E6-B0 added, not
                    from inferring it out of the absence of an alternative — and
                    the alternative renders whatever brand won it (D6). */}
                {/* A product with NO known attribute was never compared, so
                    "no change needed" would be a conclusion drawn from
                    absence — the D5 failure in words rather than numbers. */}
                <EdCaption
                  text={
                    result.currentFitScore == null
                      ? 'NOT ENOUGH ON FILE TO COMPARE'
                      : result.recommendation.noChangeNeeded
                        ? 'NO CHANGE NEEDED'
                        : 'STRONGER ON FILE'
                  }
                />
                <EdKicker text={result.recommendation.command} />
                {result.recommendation.detail && result.recommendation.alternativeProductId ? (
                  <Text
                    style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 10 }]}
                    testID="ed-scan-alternative-detail"
                  >
                    {result.recommendation.detail}
                  </Text>
                ) : null}
              </View>

              {/* ── REVIEW & CONFIRM (RP-6, ruling R4) ───────────────
                  Subordinate and outcome-gated — exactly V2's gate: the
                  canonical recommendation says logging makes sense AND the
                  catalog knows what fluid this product logs as. Recognition
                  never opens this block; only the outcome does. */}
              {result.recommendation.shouldLog && result.product.fluidType ? (
                <EdIntakeConfirm
                  productName={result.product.productName}
                  oz={qtyOz}
                  minOz={OZ_STEP}
                  maxOz={MAX_LOG_OZ}
                  stepOz={OZ_STEP}
                  busy={state.isCompletingCycle || writeInFlight}
                  logged={loggedCycleId != null}
                  undoable={loggedCycleId != null && /^intake-\d+$/.test(loggedCycleId)}
                  undone={undone}
                  onAdjust={onAdjustQty}
                  onConfirm={() => {
                    void onConfirmLog();
                  }}
                  onUndo={() => {
                    void onUndoLog();
                  }}
                />
              ) : null}

              {/* Scan again. Without this the screen was a dead end after a
                  result: the reader opener lived in the `!result` branch, so
                  the only way to scan a second product was to leave the route
                  and come back. */}
              <Pressable
                onPress={() => {
                  setOutcome(null);
                  setCameraOpen(true);
                }}
                disabled={writeInFlight}
                accessibilityRole="button"
                accessibilityLabel="Scan another product"
                accessibilityState={{ disabled: writeInFlight }}
                hitSlop={8}
                style={styles.target}
                testID="ed-scan-again"
              >
                <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>SCAN AGAIN</Text>
              </Pressable>

              {/* Only offered while something can actually be stopped — an
                  inert control is worse than none. */}
              {shouldSpeak(coachMode) ? (
                <Pressable
                  onPress={handleCoachStop}
                  accessibilityRole="button"
                  accessibilityLabel="Stop the spoken explanation"
                  hitSlop={8}
                  style={styles.target}
                  testID="ed-scan-coach-stop"
                >
                  <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>STOP AUDIO</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          <View style={styles.folio}>
            <EdEvidenceLine parts={[t('hydroScan2.v2.disclaimer')]} />
          </View>
        </Animated.View>
      </AFScreen>

      <AddDrinkModal
        visible={addDrinkOpen}
        accentColor={af.green}
        onCancel={() => setAddDrinkOpen(false)}
        onConfirm={onConfirmDrink}
      />

      <CameraScanModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={(res) => {
          setCameraOpen(false);
          void runScan({ kind: res.kind === 'qr' ? 'qr' : 'barcode', rawValue: res.data });
        }}
      />
      {/* Durable success confirmation — the S21 contract: every reachable
          non-silent intake writer mounts the overlay locally, so a capped
          score can never make a landed write look like nothing happened. */}
      {state.showCycleSuccess && state.lastCycleResult && (
        <CycleSuccessOverlay result={state.lastCycleResult} onDismiss={dismissSuccess} />
      )}
    </EdSurface>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: edStock.black },
  /** AFScreen paints af.canvas on its own shell; the stock is restated so the
   *  ground is never a coincidence (the E5 paper defect, generalized). */
  canvas: { backgroundColor: edStock.black },
  content: { paddingBottom: edRhythm.minTarget * 2 },
  section: { marginTop: 26 },
  spaced: { marginTop: 26 },
  productName: { marginTop: 10 },
  matchRow: { flexDirection: 'row', alignItems: 'baseline', columnGap: 16, flexWrap: 'wrap', marginTop: 10 },
  matchLabel: { flexShrink: 1 },
  target: {
    marginTop: 22,
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  folio: { marginTop: 34 },
});
