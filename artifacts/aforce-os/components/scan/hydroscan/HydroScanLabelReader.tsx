/**
 * HydroScan label reader (flagged: hydroscan_label_reader_enabled, internal).
 *
 * ONE camera that reads the barcode AND the visible label text, on the device,
 * so a member can point at the front of a can or bottle and log what they
 * drank. Founder-approved 2026-11-21 for this reader only (see
 * docs/hydroscan/RULING-CHANGE-2026-11-21.md). Images are temporary:
 *
 *  - a still is taken about once a second as an in-memory reference, handed to
 *    the on-device text module, and released in a `finally`;
 *  - no image, frame or raw label text is written to disk, uploaded, logged,
 *    sent to analytics or passed to any lookup. Only the barcode digits (or a
 *    catalog id the member confirmed) ever leave this component, as before;
 *  - samples never overlap, and they stop while a result or question is on
 *    screen, while Scan is paused or closed, and while the app is not active.
 *
 * Saving is the Scan screen's own `onSave` (drinkRoute: plain water on the
 * scored rail, everything else on the private drink log that can never move
 * HydroState). No HydroState ring is shown here (ruling D1).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CameraView as CameraViewType, PictureRef } from 'expo-camera';

import { af } from '@/theme/afTokens';
import { type DrinkCategoryId } from '@/data/drinkCatalog';
import { hydroScanLabelTextAvailable, recognizeLabelText } from '@/modules/hydroscan-label-text';
import { removeRecordedDrink } from '@/services/realApi';
import type { ScanSource } from '@/types/scan';
import { RECORDED_DRINK_DETAIL, RECORDED_DRINK_TITLE } from '@/utils/hydration/drinkRoute';
import { availableCategoryOrder } from '@/utils/hydration/drinkAvailability';
import { parseCustomOz, planAmountStep, type AmountChoice } from '@/utils/hydroscan/amountOptions';
import { loggableCatalogSource, resolveBarcodeCandidate, type ResolvedBarcode } from '@/utils/hydroscan/barcodeCandidate';
import {
  buildDrinkLogArgs,
  createLogGuard,
  drinkKey,
  undoSaved,
  canUndo,
  type DrinkLogArgs,
  type SavedDrink,
} from '@/utils/hydroscan/labelDrinkLog';
import {
  addSample,
  answerQuestion,
  applyOverride,
  createEvidence,
  displayNameFor,
  formatOz,
  readEvidence,
  type EvidenceState,
  type SampleInput,
} from '@/utils/hydroscan/labelEvidence';

import { HydroScanFoot, HydroScanFrame, HydroScanModes, HydroScanSheet } from './HydroScanChrome';
import {
  HydroScanLabelAlcoholUnavailable,
  HydroScanLabelAmount,
  HydroScanLabelCameraOff,
  HydroScanLabelCard,
  HydroScanLabelQuestion,
  HydroScanLabelSaveFailed,
  HydroScanLabelSizeEdit,
  HydroScanLabelTypeGrid,
  LABEL_COPY,
} from './HydroScanLabelSheets';
import { HydroScanLogged, UNKNOWN_DRINK_AMOUNTS_OZ } from './HydroScanUnknown';

/** About one sample a second. */
export const SAMPLE_INTERVAL_MS = 1000;
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr', 'pdf417', 'datamatrix'];
const COMMON_SIZES_OZ: readonly number[] = [8, 12, 16, 16.9, 20, 24, 32];

export type LabelSaveResult =
  | { readonly status: 'saved'; readonly route: 'water' | 'recorded'; readonly saved: SavedDrink | null }
  | { readonly status: 'failed' }
  | { readonly status: 'busy' };

export interface HydroScanLabelReaderProps {
  /** The Scan screen is showing something else, or a write is under way. */
  paused: boolean;
  torch: boolean;
  onRunning: (running: boolean) => void;
  /** "Type it": the screen opens its own drink entry. */
  onType: () => void;
  /** A product with its own logging flow (AFORCE, QR): the screen's existing result card takes over. */
  onHandOff: (source: ScanSource) => void;
  /** The screen's confirmed-drink write, with its duplicate guards. */
  onSave: (args: DrinkLogArgs) => Promise<LabelSaveResult>;
  /** The screen's existing intake undo, passed as a function (never called here before a log exists). */
  undoWater: (cycleId: string) => Promise<boolean>;
  /** Kept for the caller; the reader never logs alcohol whatever this says. */
  alcoholAllowed?: boolean;
}

type Phase = 'reading' | 'pick' | 'sizeedit' | 'amount' | 'alcohol' | 'failed' | 'done';

export function HydroScanLabelReader(props: HydroScanLabelReaderProps) {
  if (Platform.OS === 'web') {
    return <HydroScanLabelCameraOff canAskAgain={false} onRequest={() => undefined} onType={props.onType} />;
  }
  return <HydroScanLabelReaderNative {...props} />;
}

function HydroScanLabelReaderNative({ paused, torch, onRunning, onType, onHandOff, onSave, undoWater }: HydroScanLabelReaderProps) {
  // Lazy require so web bundling never resolves the native module.
  const ExpoCamera = require('expo-camera') as typeof import('expo-camera');
  const { CameraView, useCameraPermissions } = ExpoCamera;
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraViewType | null>(null);

  const [evidence, setEvidence] = useState<EvidenceState>(createEvidence);
  const [phase, setPhase] = useState<Phase>('reading');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [amountId, setAmountId] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [sizeText, setSizeText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedDrink | null>(null);
  const [done, setDone] = useState<{ label: string; note: string; undone: boolean } | null>(null);

  // A new drink in view advances the epoch: results from an older one are dropped.
  const epochRef = useRef(0);
  const guardRef = useRef(createLogGuard());
  const lastBarcodeRef = useRef<{ data: string; at: number } | null>(null);
  const resolvedRef = useRef<{ code: string; resolved: ResolvedBarcode } | null>(null);
  const barcodeBusyRef = useRef(false);

  const textOn = useMemo(() => hydroScanLabelTextAvailable(), []);
  const reading = useMemo(() => readEvidence(evidence), [evidence]);
  const granted = !!permission?.granted;

  useEffect(() => {
    onRunning(granted);
    return () => onRunning(false);
  }, [granted, onRunning]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) requestPermission().catch(() => undefined);
  }, [permission, requestPermission]);

  // The camera and the sampler stop in the background and resume on return.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setAppActive(next === 'active'));
    return () => sub.remove();
  }, []);

  const resetAll = useCallback(() => {
    epochRef.current += 1;
    guardRef.current.reset();
    lastBarcodeRef.current = null;
    resolvedRef.current = null;
    setEvidence(createEvidence());
    setPhase('reading');
    setAmountId(null);
    setCustomText('');
    setSizeText('');
    setSaved(null);
    setDone(null);
    setSaving(false);
  }, []);

  // Coming back from a result, the typed entry or a hand-off: a fresh drink.
  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current && !paused) resetAll();
    wasPaused.current = paused;
  }, [paused, resetAll]);

  // Leaving Scan invalidates anything still in flight.
  useEffect(
    () => () => {
      epochRef.current += 1;
    },
    [],
  );

  const ingest = useCallback((sample: SampleInput, epoch: number) => {
    if (epoch !== epochRef.current) return;
    setEvidence((prev) => addSample(prev, sample));
  }, []);

  const undoingRef = useRef(false);
  const openRef = useRef(true);
  openRef.current = phase === 'reading' && reading.status === 'reading';
  const cameraActive = granted && !paused && appActive && phase === 'reading' && reading.status === 'reading';

  // ── The sampler: one still about a second, never overlapping ──────────
  useEffect(() => {
    if (!cameraActive || !textOn) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (stopped) return;
      const epoch = epochRef.current;
      let picture: PictureRef | undefined;
      try {
        const camera = cameraRef.current;
        if (!camera) return;
        // In-memory reference: no URI, no base64, no file.
        picture = await camera.takePictureAsync({ pictureRef: true, shutterSound: false, skipProcessing: true, quality: 0.4 });
        if (stopped || epoch !== epochRef.current) return;
        const lines = await recognizeLabelText(picture);
        if (stopped || epoch !== epochRef.current) return;
        if (lines) ingest({ lines }, epoch);
      } catch {
        // A missed sample is only a missed sample.
      } finally {
        try {
          picture?.release();
        } catch {
          // Nothing else holds the reference.
        }
        if (!stopped) timer = setTimeout(() => void tick(), SAMPLE_INTERVAL_MS);
      }
    };
    timer = setTimeout(() => void tick(), 400);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [cameraActive, textOn, ingest]);

  // ── The barcode: as fast as before ────────────────────────────────────
  const handleBarcode = useCallback(
    (event: { type: string; data: string }) => {
      const now = Date.now();
      const last = lastBarcodeRef.current;
      if (last && last.data === event.data && now - last.at < 1200) return;
      lastBarcodeRef.current = { data: event.data, at: now };
      if (event.type === 'qr') {
        onHandOff({ kind: 'qr', rawValue: event.data });
        return;
      }
      const cached = resolvedRef.current;
      const epoch = epochRef.current;
      const apply = (r: ResolvedBarcode) => {
        if (epoch !== epochRef.current) return;
        // A late result never changes a drink the member is already looking at.
        if (!openRef.current) return;
        if (r.handOff) onHandOff(r.handOff);
        else ingest({ barcode: r.candidate }, epoch);
      };
      if (cached && cached.code === event.data) {
        apply(cached.resolved);
        return;
      }
      if (barcodeBusyRef.current) return;
      barcodeBusyRef.current = true;
      void resolveBarcodeCandidate(event.data)
        .then((r) => {
          if (epoch === epochRef.current) resolvedRef.current = { code: event.data, resolved: r };
          apply(r);
        })
        .finally(() => {
          barcodeBusyRef.current = false;
        });
    },
    [ingest, onHandOff],
  );

  // ── Choices ───────────────────────────────────────────────────────────
  const plan = useMemo(() => planAmountStep(reading.volume, UNKNOWN_DRINK_AMOUNTS_OZ), [reading.volume]);
  const name = displayNameFor(reading);

  const selectedOz = (): number | null => {
    if (amountId == null) return null;
    if (amountId === 'custom') return parseCustomOz(customText);
    return plan.choices.find((c) => c.id === amountId)?.oz ?? null;
  };

  const onConfirm = async () => {
    const epoch = epochRef.current;
    // Alcohol is never logged from the reader until the founders' alcohol ruling and the age check (SS-26) exist.
    if (reading.drinkType.value === 'alcohol' || reading.traits.alcohol.value === 'alcoholic') {
      setPhase('alcohol');
      return;
    }
    // AFORCE and the app's loggable products keep their own logging flow.
    if (reading.catalogSource === 'compare' && reading.catalogProductId) {
      const source = await loggableCatalogSource(reading.catalogProductId);
      if (epoch !== epochRef.current) return;
      if (source) {
        onHandOff(source);
        return;
      }
    }
    setAmountId(null);
    setCustomText('');
    setPhase('amount');
  };

  const doSave = async () => {
    const oz = selectedOz();
    const args = oz == null ? null : buildDrinkLogArgs(reading, oz);
    if (!args) return;
    if (!guardRef.current.begin(drinkKey(args, epochRef.current))) return;
    setSaving(true);
    let result: LabelSaveResult;
    try {
      result = await onSave(args);
    } catch {
      result = { status: 'failed' };
    }
    const ok = result.status === 'saved';
    guardRef.current.settle(ok);
    setSaving(false);
    if (result.status === 'busy') return;
    if (result.status === 'saved') {
      setSaved(result.saved);
      setDone({
        label: `${formatOz(args.enteredOz)} ${args.displayName}`,
        note: result.route === 'recorded' ? `${RECORDED_DRINK_TITLE}. ${RECORDED_DRINK_DETAIL}` : '',
        undone: false,
      });
      setPhase('done');
    } else {
      setPhase('failed');
    }
  };

  const doUndo = async () => {
    if (saving || undoingRef.current || !canUndo(saved)) return;
    undoingRef.current = true;
    setSaving(true);
    let ok = false;
    try {
      ok = await undoSaved(saved, { undoWater, removeRecorded: removeRecordedDrink });
    } finally {
      undoingRef.current = false;
      setSaving(false);
    }
    if (ok) {
      setSaved(null);
      setDone((d) => (d ? { ...d, undone: true } : d));
    }
  };

  const confirmSize = () => {
    if (reading.volume.value != null) setEvidence((e) => applyOverride(e, { volumeOz: reading.volume.value }));
  };
  const customSizeOz = parseCustomOz(sizeText);
  const pickAmount = (c: AmountChoice) => setAmountId(c.id);

  // ── What is on screen ─────────────────────────────────────────────────
  const showSheet = phase !== 'reading' || reading.status !== 'reading';
  let sheet: React.ReactNode = null;
  if (phase === 'pick') {
    sheet = (
      <HydroScanLabelTypeGrid
        categories={availableCategoryOrder().filter((id): id is DrinkCategoryId => id !== 'custom' && id !== 'alcohol')}
        onPick={(id) => {
          setEvidence((e) => applyOverride(e, { drinkType: id }));
          setPhase('reading');
        }}
        onBack={() => setPhase('reading')}
        onType={onType}
      />
    );
  } else if (phase === 'sizeedit') {
    sheet = (
      <HydroScanLabelSizeEdit
        sizes={COMMON_SIZES_OZ}
        customText={sizeText}
        customValid={customSizeOz != null}
        onPick={(oz) => {
          setEvidence((e) => applyOverride(e, { volumeOz: oz }));
          setPhase('reading');
        }}
        onCustomText={setSizeText}
        onCustomDone={() => {
          if (customSizeOz == null) return;
          setEvidence((e) => applyOverride(e, { volumeOz: customSizeOz }));
          setPhase('reading');
        }}
        onNotSure={() => {
          setEvidence((e) => applyOverride(e, { volumeOz: null }));
          setPhase('reading');
        }}
        onBack={() => setPhase('reading')}
      />
    );
  } else if (phase === 'amount') {
    sheet = (
      <HydroScanLabelAmount
        name={name}
        plan={plan}
        selectedId={amountId}
        customText={customText}
        customValid={parseCustomOz(customText) != null}
        busy={saving}
        containerNote={plan.mode === 'container' && plan.containerOz != null ? `Container size ${formatOz(plan.containerOz)}.` : null}
        onSelect={pickAmount}
        onCustomText={setCustomText}
        onLog={() => void doSave()}
        onBack={() => setPhase('reading')}
      />
    );
  } else if (phase === 'alcohol') {
    sheet = <HydroScanLabelAlcoholUnavailable onScanAgain={resetAll} onType={onType} />;
  } else if (phase === 'failed') {
    sheet = <HydroScanLabelSaveFailed busy={saving} onRetry={() => void doSave()} onBack={() => setPhase('amount')} />;
  } else if (phase === 'done' && done) {
    sheet = (
      <HydroScanLogged
        label={done.label}
        note={done.note}
        state={done.undone ? 'undone' : 'logged'}
        busy={saving}
        onDone={resetAll}
        onUndo={!done.undone && canUndo(saved) ? () => void doUndo() : undefined}
      />
    );
  } else if (reading.status === 'question' && reading.question) {
    const q = reading.question;
    sheet = (
      <HydroScanLabelQuestion
        text={q.text}
        choices={q.choices}
        onChoose={(id) => setEvidence((e) => answerQuestion(e, q.id, id))}
        onType={onType}
        onScanAgain={resetAll}
      />
    );
  } else if (reading.status === 'ready') {
    sheet = (
      <HydroScanLabelCard
        reading={reading}
        onConfirm={() => void onConfirm()}
        onChangeType={() => setPhase('pick')}
        onChangeSize={() => setPhase('sizeedit')}
        onConfirmSize={confirmSize}
        onScanAgain={resetAll}
        onType={onType}
      />
    );
  }

  const frameHint = !permission
    ? LABEL_COPY.startingCamera
    : reading.hint
      ? reading.hint.toUpperCase()
      : reading.samples > 0 || reading.barcodeCode
        ? LABEL_COPY.reading
        : textOn
          ? LABEL_COPY.frameHint
          : LABEL_COPY.frameHintBarcodeOnly;

  if (permission && !granted) {
    return (
      <HydroScanLabelCameraOff
        canAskAgain={permission.canAskAgain}
        onRequest={() => {
          requestPermission().catch(() => undefined);
        }}
        onType={onType}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill} testID="hydroscan-label-reader">
      {granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          active={cameraActive}
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES as never }}
          onBarcodeScanned={cameraActive ? handleBarcode : undefined}
        />
      ) : null}

      {showSheet ? (
        <HydroScanSheet testID="hydroscan-label-sheet">{sheet}</HydroScanSheet>
      ) : (
        <>
          <HydroScanFrame hint={frameHint} note={textOn ? LABEL_COPY.frameNote : LABEL_COPY.frameNoteBarcodeOnly} />
          <HydroScanFoot>
            <HydroScanModes
              selected="label"
              modes={[
                { key: 'label', label: LABEL_COPY.modeLabel, accessibilityLabel: 'Label and barcode reader', onPress: () => undefined },
                { key: 'type', label: LABEL_COPY.typeIt, accessibilityLabel: 'Type your drink', onPress: onType },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick the kind of drink from a list"
              hitSlop={8}
              onPress={() => setPhase('pick')}
              style={s.pick}
              testID="hydroscan-label-pick-type"
            >
              <Text style={s.pickText}>{LABEL_COPY.pickType.toUpperCase()}</Text>
            </Pressable>
          </HydroScanFoot>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  pick: { marginTop: 10, minHeight: 44, justifyContent: 'center' },
  pickText: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 11, letterSpacing: 1.6, color: af.textPrimary },
});
