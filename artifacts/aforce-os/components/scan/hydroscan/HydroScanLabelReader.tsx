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
import { AppState, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraView as CameraViewType, PictureRef } from 'expo-camera';

import { type DrinkCategoryId } from '@/data/drinkCatalog';
import { hydroScanLabelTextAvailable, recognizeLabelFrame, type HydroScanFrame } from '@/modules/hydroscan-label-text';
import { removeRecordedDrink } from '@/services/realApi';
import type { ScanSource } from '@/types/scan';
import { RECORDED_DRINK_DETAIL, RECORDED_DRINK_TITLE } from '@/utils/hydration/drinkRoute';
import { availableCategoryOrder } from '@/utils/hydration/drinkAvailability';
import { parseCustomOz, planAmountStep, type AmountChoice } from '@/utils/hydroscan/amountOptions';
import { loggableOz, ozToMl } from '@/utils/hydroscan/fillAmount';
import { boxOnView, hasLight, isSteady, lockPill, lockStage, matchedBy, readout, reliableBounds, type Box } from '@/utils/hydroscan/lockOn';
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

import { HydroScanSheet } from './HydroScanChrome';
import {
  FILM_COPY,
  HydroScanBrackets,
  HydroScanFillAmount,
  HydroScanFilmFoot,
  HydroScanHint,
  HydroScanLooksLike,
  HydroScanReview,
  HydroScanStatus,
  type FilmMode,
} from './HydroScanFilm';
import {
  HydroScanLabelAlcoholUnavailable,
  HydroScanLabelAmount,
  HydroScanLabelCameraOff,
  HydroScanLabelQuestion,
  HydroScanLabelSaveFailed,
  HydroScanLabelSizeEdit,
  HydroScanLabelTypeGrid,
  LABEL_COPY,
} from './HydroScanLabelSheets';
import { HydroScanLogged, UNKNOWN_DRINK_AMOUNTS_OZ } from './HydroScanUnknown';

/** About one sample a second. */
export const SAMPLE_INTERVAL_MS = 1000;
/** How long the lock is held on screen before the card rises, as in the film. */
export const LOCK_HOLD_MS = 900;
/** The shape of a portrait still, used until the reader reports the real one. */
const PORTRAIT_ASPECT = 3 / 4;
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

type Phase = 'reading' | 'pick' | 'sizeedit' | 'amount' | 'review' | 'alcohol' | 'failed' | 'done';

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
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<FilmMode>('drink');
  const [area, setArea] = useState({ width: 0, height: 0 });
  // Where the drink is and how the picture looked, from the last still only.
  const [seen, setSeen] = useState<{ box: Box | null; steady: boolean | null; light: boolean | null } | null>(null);
  const lastBoxRef = useRef<Box | null>(null);
  // The lock is held for a moment before the card rises.
  const [revealed, setRevealed] = useState(false);
  // Share of the container drunk, 0..1; null until the member chooses.
  const [share, setShare] = useState<number | null>(null);
  // After "Different size" from the Continue path, go on to the amount.
  const [sizeThenAmount, setSizeThenAmount] = useState(false);
  const sampleNowRef = useRef<(() => void) | null>(null);

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
    setSeen(null);
    lastBoxRef.current = null;
    setRevealed(false);
    setShare(null);
    setSizeThenAmount(false);
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
  // The preview stays on behind the lock and the card, so the drink stays in view.
  const previewActive = granted && !paused && appActive && phase === 'reading';
  const cameraActive = granted && !paused && appActive && phase === 'reading' && reading.status === 'reading';

  /** The box around the drink, the steadiness and the light, from one still. Nothing is kept beyond the last one. */
  const noteFrame = useCallback((frame: HydroScanFrame, epoch: number) => {
    if (epoch !== epochRef.current) return;
    const found = reliableBounds(frame.object, frame.lines);
    const onScreen = found ? boxOnView(found, frame.aspect ?? PORTRAIT_ASPECT, areaRef.current) : null;
    const steady = isSteady(lastBoxRef.current, found);
    lastBoxRef.current = found;
    setSeen({ box: onScreen, steady, light: hasLight(frame.brightness) });
  }, []);
  const areaRef = useRef(area);
  areaRef.current = area;

  // The lock holds for a beat, then the card rises. A drink that goes back to reading starts over.
  const locked = phase === 'reading' && reading.status === 'ready';
  useEffect(() => {
    if (!locked) {
      setRevealed(false);
      return undefined;
    }
    const t = setTimeout(() => setRevealed(true), LOCK_HOLD_MS);
    return () => clearTimeout(t);
  }, [locked]);

  // ── The sampler: one still about a second, never overlapping ──────────
  useEffect(() => {
    if (!cameraActive || !textOn) return;
    // Barcode mode reads the code only: no stills are taken.
    if (mode !== 'drink') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    const tick = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      const epoch = epochRef.current;
      let picture: PictureRef | undefined;
      try {
        const camera = cameraRef.current;
        if (!camera) return;
        // In-memory reference: no URI, no base64, no file.
        picture = await camera.takePictureAsync({ pictureRef: true, shutterSound: false, skipProcessing: true, quality: 0.4 });
        if (stopped || epoch !== epochRef.current) return;
        const frame = await recognizeLabelFrame(picture);
        if (stopped || epoch !== epochRef.current) return;
        if (frame) noteFrame(frame, epoch);
        const lines = frame ? frame.lines : null;
        if (lines) ingest({ lines }, epoch);
      } catch {
        // A missed sample is only a missed sample.
      } finally {
        try {
          picture?.release();
        } catch {
          // Nothing else holds the reference.
        }
        inFlight = false;
        if (!stopped) timer = setTimeout(() => void tick(), SAMPLE_INTERVAL_MS);
      }
    };
    timer = setTimeout(() => void tick(), 400);
    // The round button asks for a read now; it never overlaps one under way.
    sampleNowRef.current = () => {
      if (stopped || inFlight) return;
      if (timer) clearTimeout(timer);
      void tick();
    };
    return () => {
      stopped = true;
      sampleNowRef.current = null;
      if (timer) clearTimeout(timer);
    };
  }, [cameraActive, textOn, mode, ingest, noteFrame]);

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

  const fillOz = reading.volume.confidence === 'confirmed' && reading.volume.value != null && share != null ? loggableOz(reading.volume.value, share) : null;
  const useFill = plan.mode === 'container' && plan.containerOz != null;

  const selectedOz = (): number | null => {
    if (useFill) return fillOz;
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
    setShare(null);
    // Continue accepts the size on the card as the starting amount. With no size read, ask for it first.
    if (reading.volume.value == null) {
      setSizeThenAmount(true);
      setPhase('sizeedit');
      return;
    }
    if (reading.volume.confidence !== 'confirmed') setEvidence((e) => applyOverride(e, { volumeOz: reading.volume.value }));
    setPhase('amount');
  };
  const afterSize = () => {
    setPhase(sizeThenAmount ? 'amount' : 'reading');
    setSizeThenAmount(false);
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
  const sizeLine = reading.volume.value != null ? `${formatOz(reading.volume.value)} · ${ozToMl(reading.volume.value)} mL` : null;
  const showCard = locked && revealed;
  const showSheet = phase !== 'reading' || reading.status === 'question';
  // The amount and the review take the whole screen, as in the film.
  let page: React.ReactNode = null;
  if (phase === 'amount' && useFill && plan.containerOz != null) {
    page = (
      <HydroScanFillAmount
        header={[name, formatOz(plan.containerOz)].join(' · ').toUpperCase()}
        shape={reading.drinkType.value === 'water' ? 'bottle' : 'can'}
        containerOz={plan.containerOz}
        share={share}
        onShare={setShare}
        onReview={() => setPhase('review')}
        onBack={() => setPhase('reading')}
      />
    );
  } else if (phase === 'review' && fillOz != null) {
    const args = buildDrinkLogArgs(reading, fillOz);
    page = (
      <HydroScanReview
        title={`${formatOz(fillOz)} of ${name}`}
        drink={name}
        amount={`${formatOz(fillOz)} · ${ozToMl(fillOz)} mL`}
        note={args && args.categoryId !== 'water' ? `${RECORDED_DRINK_TITLE}. ${RECORDED_DRINK_DETAIL}` : ''}
        logLabel={`Log ${formatOz(fillOz)}`}
        busy={saving || !args}
        onLog={() => void doSave()}
        onBack={() => setPhase('amount')}
      />
    );
  }
  let sheet: React.ReactNode = null;
  if (page) {
    sheet = null;
  } else if (phase === 'pick') {
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
          afterSize();
        }}
        onCustomText={setSizeText}
        onCustomDone={() => {
          if (customSizeOz == null) return;
          setEvidence((e) => applyOverride(e, { volumeOz: customSizeOz }));
          afterSize();
        }}
        onNotSure={() => {
          setEvidence((e) => applyOverride(e, { volumeOz: null }));
          afterSize();
        }}
        onBack={() => {
          setSizeThenAmount(false);
          setPhase('reading');
        }}
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
    sheet = <HydroScanLabelSaveFailed busy={saving} onRetry={() => void doSave()} onBack={() => setPhase(useFill ? 'review' : 'amount')} />;
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
  }

  const stage = lockStage(reading);
  const hint = !permission
    ? FILM_COPY.hintStarting
    : locked
      ? lockPill(name)
      : reading.hint
        ? reading.hint
        : stage === 'reading'
          ? FILM_COPY.hintReading
          : mode === 'barcode' || !textOn
            ? FILM_COPY.hintBarcode
            : FILM_COPY.hintDrink;
  const cues = {
    light: seen ? seen.light : null,
    steady: seen ? seen.steady : null,
    inFrame: seen ? seen.box != null : null,
  };

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
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e: LayoutChangeEvent) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      testID="hydroscan-label-reader"
    >
      {granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          active={previewActive}
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES as never }}
          onBarcodeScanned={cameraActive ? handleBarcode : undefined}
        />
      ) : null}

      {page ? (
        page
      ) : showSheet ? (
        <HydroScanSheet testID="hydroscan-label-sheet">{sheet}</HydroScanSheet>
      ) : showCard ? (
        <HydroScanLooksLike
          name={name}
          sizeLine={sizeLine}
          matchedBy={matchedBy(reading)}
          bars={readout(reading).bars}
          notice={reading.packagingVerified === false ? LABEL_COPY.packagingUnverified : null}
          onWrongDrink={() => setPhase('pick')}
          onDifferentSize={() => setPhase('sizeedit')}
          onSomeoneElses={resetAll}
          onContinue={() => void onConfirm()}
        />
      ) : (
        <>
          <HydroScanStatus top={Math.max(insets.top, 12) + 62} stage={stage} cues={cues} readout={readout(reading)} />
          <HydroScanBrackets
            bounds={mode === 'drink' && seen ? seen.box : null}
            locked={locked}
            sizeLabel={readout(reading).size}
            area={area}
          />
          <HydroScanHint text={hint} locked={locked} bottom={Math.max(insets.bottom, 14) + 178} />
          <HydroScanFilmFoot
            mode={mode}
            onMode={(m) => {
              setMode(m);
              setSeen(null);
              lastBoxRef.current = null;
            }}
            onType={onType}
            onCapture={() => sampleNowRef.current?.()}
            captureDisabled={!cameraActive}
          />
        </>
      )}
    </View>
  );
}
