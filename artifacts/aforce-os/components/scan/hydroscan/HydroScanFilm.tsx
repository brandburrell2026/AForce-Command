/**
 * HydroScan, laid out as the "Scan. Confirm. Done." film lays it out
 * (founder direction 2026-11-23; docs/hydroscan/RULING-CHANGE-2026-11-23.md).
 * Used only by the flagged label reader.
 *
 * Presentation only. Every word and number shown here is handed in by the
 * reader from what it actually resolved: a field it did not resolve arrives as
 * null and is drawn as a dash. Nothing in this file reads the camera, saves a
 * drink, or shows a score.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { AFMark } from '@/components/ui/AFMark';
import { af, withAlpha } from '@/theme/afTokens';
import {
  activeChip,
  drunkOz,
  fillChips,
  ozToMl,
  remainingShare,
  shareFromTrack,
  shareWords,
  type FillChipId,
} from '@/utils/hydroscan/fillAmount';
import { STAGE_LABEL, type Box, type LockStage, type Readout } from '@/utils/hydroscan/lockOn';

const MONO = 'IBMPlexMono_500Medium';
const SEMI = 'Inter_600SemiBold';
const MEDIUM = 'Inter_500Medium';
const REGULAR = 'Inter_400Regular';
const LIGHT = 'Inter_300Light';
const VEIL = withAlpha(af.canvas, 0.6);
const MARK = withAlpha(af.textPrimary, 0.92);
const DASH = '—';

export const FILM_COPY = {
  light: 'LIGHT',
  steady: 'STEADY',
  inFrame: 'IN FRAME',
  drink: 'DRINK',
  size: 'SIZE',
  level: 'LEVEL',
  match: 'MATCH',
  modeDrink: 'Drink',
  modeBarcode: 'Barcode',
  modeType: 'Type it',
  hintDrink: 'Point at what you’re drinking',
  hintBarcode: 'Point at the barcode',
  hintReading: 'Reading…',
  hintStarting: 'Starting the camera',
  capture: 'Read now',
  looksLike: 'LOOKS LIKE',
  wrongDrink: 'Wrong drink',
  differentSize: 'Different size',
  someoneElses: 'Someone else’s',
  nothingLogged: 'Nothing is logged yet. You’ll set how much you drank.',
  continue: 'Continue',
  sizeNotRead: 'Size not read',
  amountTitle: 'How much did you drink?',
  amountBody: 'Drag to where the drink is now, or tap an amount.',
  review: 'Review',
  reviewCaption: 'REVIEW',
  rowDrink: 'Drink',
  rowAmount: 'Amount you drank',
  reviewNote: 'Logged only when you tap the button. You can undo right after.',
} as const;

// ─── The camera screen ──────────────────────────────────────────────

function Dot({ on, label }: { on: boolean | null; label: string }) {
  return (
    <View style={s.cue} accessible accessibilityLabel={`${label}: ${on == null ? 'not measured' : on ? 'good' : 'not yet'}`}>
      <View style={[s.cueDot, on === true && s.cueDotOn, on == null && s.cueDotUnknown]} />
      <Text style={[s.cueText, on === true && s.cueTextOn]}>{label}</Text>
    </View>
  );
}

function Bars({ count }: { count: 0 | 2 | 3 }) {
  return (
    <View style={s.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[s.bar, i < count && s.barOn]} />
      ))}
    </View>
  );
}

function Field({ label, value, bars }: { label: string; value: string | null; bars?: 0 | 2 | 3 }) {
  return (
    <View style={s.field} accessible accessibilityLabel={`${label}: ${value ?? 'not read'}`}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldValueRow}>
        {bars ? <Bars count={bars} /> : null}
        <Text style={s.fieldValue}>{value ?? DASH}</Text>
      </View>
    </View>
  );
}

/** Light, Steady and In frame; the stage; and the four fields the reader resolved. */
export function HydroScanStatus({
  top,
  stage,
  cues,
  readout,
}: {
  top: number;
  stage: LockStage;
  cues: { light: boolean | null; steady: boolean | null; inFrame: boolean | null };
  readout: Readout;
}) {
  return (
    <View pointerEvents="none" style={[s.status, { top }]} testID="hydroscan-film-status">
      <View style={s.cueRow}>
        <Dot on={cues.light} label={FILM_COPY.light} />
        <Dot on={cues.steady} label={FILM_COPY.steady} />
        <Dot on={cues.inFrame} label={FILM_COPY.inFrame} />
        <View style={s.grow} />
        <View style={s.cue} accessible accessibilityLiveRegion="polite" accessibilityLabel={STAGE_LABEL[stage]}>
          <View style={[s.cueDot, stage === 'locked' ? s.stageLocked : stage === 'reading' ? s.cueDotOn : null]} />
          <Text style={[s.cueText, s.cueTextOn]} testID="hydroscan-film-stage">{STAGE_LABEL[stage]}</Text>
        </View>
      </View>
      <View style={s.panel}>
        <Field label={FILM_COPY.drink} value={readout.drink} />
        <Field label={FILM_COPY.size} value={readout.size} />
        <Field label={FILM_COPY.level} value={readout.level} />
        <Field label={FILM_COPY.match} value={readout.match} bars={readout.match ? readout.bars : undefined} />
      </View>
    </View>
  );
}

const DEFAULT_FRAME = { width: 180, heightShare: 0.44, aspect: 0.5 };

/**
 * Four corner marks with measurement ticks down the left. They sit in the
 * middle of the screen until the reader hands in where the drink is, then
 * settle around it; with no reliable bounds they go back to the middle.
 */
export function HydroScanBrackets({
  bounds,
  locked,
  sizeLabel,
  area,
}: {
  /** In points, relative to the screen; null when the reader has no reliable bounds. */
  bounds: Box | null;
  locked: boolean;
  /** "12 FL OZ", shown beside the frame once the size is read. */
  sizeLabel: string | null;
  area: { width: number; height: number };
}) {
  const rest = React.useMemo<Box>(() => {
    const h = Math.min(DEFAULT_FRAME.width / DEFAULT_FRAME.aspect, area.height * DEFAULT_FRAME.heightShare);
    const w = h * DEFAULT_FRAME.aspect;
    return { x: (area.width - w) / 2, y: (area.height - h) / 2 - 10, width: w, height: h };
  }, [area.width, area.height]);
  const target = bounds ?? rest;
  const x = useRef(new Animated.Value(target.x)).current;
  const y = useRef(new Animated.Value(target.y)).current;
  const w = useRef(new Animated.Value(target.width)).current;
  const h = useRef(new Animated.Value(target.height)).current;

  useEffect(() => {
    const to = (v: Animated.Value, toValue: number) =>
      Animated.timing(v, { toValue, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    Animated.parallel([to(x, target.x), to(y, target.y), to(w, target.width), to(h, target.height)]).start();
  }, [target.x, target.y, target.width, target.height, x, y, w, h]);

  if (area.width <= 0 || area.height <= 0) return null;
  const tone = locked ? af.red : MARK;
  return (
    <Animated.View pointerEvents="none" style={[s.frame, { left: x, top: y, width: w, height: h }]} testID="hydroscan-film-brackets">
      <View style={[s.corner, s.tl, { borderColor: tone }]} />
      <View style={[s.corner, s.tr, { borderColor: tone }]} />
      <View style={[s.corner, s.bl, { borderColor: tone }]} />
      <View style={[s.corner, s.br, { borderColor: tone }]} />
      <View style={s.ticks}>
        {Array.from({ length: 21 }, (_, i) => (
          <View key={i} style={[s.tick, i % 5 === 0 && s.tickLong]} />
        ))}
      </View>
      {sizeLabel ? (
        <View style={s.sizeTag}>
          <Text style={s.sizeTagText}>{sizeLabel}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** The one line under the frame: what to do, or what was locked. */
export function HydroScanHint({ text, locked, bottom }: { text: string; locked: boolean; bottom: number }) {
  return (
    <View pointerEvents="none" style={[s.hintWrap, { bottom }]}>
      <View style={[s.hint, locked && s.hintLocked]} accessible accessibilityLiveRegion="polite" accessibilityLabel={text}>
        <View style={[s.hintDot, locked && s.hintDotLocked]} />
        <Text style={[s.hintText, locked && s.hintTextLocked]} testID="hydroscan-film-hint">{text}</Text>
      </View>
    </View>
  );
}

export type FilmMode = 'drink' | 'barcode';

/** Drink, Barcode and Type it, then the round N–И button that asks for a read now. */
export function HydroScanFilmFoot({
  mode,
  onMode,
  onType,
  onCapture,
  captureDisabled,
}: {
  mode: FilmMode;
  onMode: (m: FilmMode) => void;
  onType: () => void;
  onCapture: () => void;
  captureDisabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const items: { key: string; label: string; onPress: () => void; on: boolean }[] = [
    { key: 'drink', label: FILM_COPY.modeDrink, onPress: () => onMode('drink'), on: mode === 'drink' },
    { key: 'barcode', label: FILM_COPY.modeBarcode, onPress: () => onMode('barcode'), on: mode === 'barcode' },
    { key: 'type', label: FILM_COPY.modeType, onPress: onType, on: false },
  ];
  return (
    <View style={[s.foot, { paddingBottom: Math.max(insets.bottom, 14) + 10 }]} testID="hydroscan-film-foot">
      <View style={s.seg} accessibilityRole="tablist">
        {items.map((m) => (
          <Pressable
            key={m.key}
            accessibilityRole="button"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: m.on }}
            onPress={m.onPress}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[s.segBtn, m.on && s.segOn]}
            testID={`hydroscan-film-mode-${m.key}`}
          >
            <Text style={[s.segText, m.on && s.segTextOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={FILM_COPY.capture}
        accessibilityState={{ disabled: !!captureDisabled }}
        disabled={captureDisabled}
        onPress={onCapture}
        style={({ pressed }) => [s.capture, pressed && s.capturePressed, captureDisabled && s.captureOff]}
        testID="hydroscan-film-capture"
      >
        <View style={s.captureInner}>
          <AFMark size={15} decorative />
        </View>
      </Pressable>
    </View>
  );
}

// ─── "Looks like" ───────────────────────────────────────────────────

function Chip({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.chip, pressed && s.pressed]} testID={testID}>
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );
}

function Primary({ label, onPress, disabled, testID }: { label: string; onPress: () => void; disabled?: boolean; testID: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.primary, pressed && s.pressed, disabled && s.primaryOff]}
      testID={testID}
    >
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  );
}

/** The card that rises over the camera once the reader locks. The drink stays in view above it. */
export function HydroScanLooksLike({
  name,
  sizeLine,
  matchedBy,
  bars,
  notice,
  onWrongDrink,
  onDifferentSize,
  onSomeoneElses,
  onContinue,
}: {
  name: string;
  /** "12 fl oz · 355 mL", or null when the size was not read. */
  sizeLine: string | null;
  matchedBy: string | null;
  bars: 0 | 2 | 3;
  /** e.g. the AFORCE "not verified yet" line. */
  notice: string | null;
  onWrongDrink: () => void;
  onDifferentSize: () => void;
  onSomeoneElses: () => void;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [rise]);
  return (
    <Animated.View
      style={[
        s.card,
        { paddingBottom: Math.max(insets.bottom, 14) + 16, opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] },
      ]}
      testID="hydroscan-film-card"
    >
      <View accessible accessibilityLiveRegion="polite">
        <Text style={s.eyebrow}>{FILM_COPY.looksLike}</Text>
        <Text accessibilityRole="header" style={s.cardTitle} testID="hydroscan-film-card-name">{name}</Text>
        <Text style={s.cardSize} testID="hydroscan-film-card-size">{sizeLine ?? FILM_COPY.sizeNotRead}</Text>
        {matchedBy ? (
          <View style={s.matchRow}>
            <Bars count={bars} />
            <Text style={s.matchText} testID="hydroscan-film-card-match">{matchedBy}</Text>
          </View>
        ) : null}
        {notice ? <Text style={s.notice} testID="hydroscan-film-card-notice">{notice}</Text> : null}
      </View>
      <View style={s.chips}>
        <Chip label={FILM_COPY.wrongDrink} onPress={onWrongDrink} testID="hydroscan-film-wrong-drink" />
        <Chip label={FILM_COPY.differentSize} onPress={onDifferentSize} testID="hydroscan-film-different-size" />
        <Chip label={FILM_COPY.someoneElses} onPress={onSomeoneElses} testID="hydroscan-film-someone-elses" />
      </View>
      <Text style={s.quiet}>{FILM_COPY.nothingLogged}</Text>
      <Primary label={FILM_COPY.continue} onPress={onContinue} testID="hydroscan-film-continue" />
    </Animated.View>
  );
}

// ─── "How much did you drink?" ──────────────────────────────────────

const BOTTLE =
  'M38 2 h24 a3 3 0 0 1 3 3 v13 a3 3 0 0 1 -3 3 v6 c0 9 22 14 22 34 v118 a14 14 0 0 1 -14 14 h-40 a14 14 0 0 1 -14 -14 v-118 c0 -20 22 -25 22 -34 v-6 a3 3 0 0 1 -3 -3 v-13 a3 3 0 0 1 3 -3 z';
const CAN =
  'M26 6 h48 a6 6 0 0 1 6 6 v4 c0 4 4 5 4 10 v142 c0 5 -4 6 -4 10 v4 a6 6 0 0 1 -6 6 h-48 a6 6 0 0 1 -6 -6 v-4 c0 -4 -4 -5 -4 -10 v-142 c0 -5 4 -6 4 -10 v-4 a6 6 0 0 1 6 -6 z';
/** The part of the drawing that holds the drink, in the 100 by 194 drawing. */
const BODY = { top: 30, bottom: 190 };

function Container({ shape, remaining, onDragTo }: { shape: 'bottle' | 'can'; remaining: number; onDragTo: (remaining: number) => void }) {
  const fill = useRef(new Animated.Value(remaining)).current;
  const [level, setLevel] = useState(remaining);
  const heightRef = useRef(1);
  useEffect(() => {
    const id = fill.addListener(({ value }) => setLevel(value));
    Animated.timing(fill, { toValue: remaining, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => fill.removeListener(id);
  }, [remaining, fill]);
  const dragRef = useRef(onDragTo);
  dragRef.current = onDragTo;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => dragRef.current(levelAt(e.nativeEvent.locationY, heightRef.current)),
      onPanResponderMove: (e) => dragRef.current(levelAt(e.nativeEvent.locationY, heightRef.current)),
    }),
  ).current;
  const span = BODY.bottom - BODY.top;
  const lineY = BODY.bottom - span * level;
  return (
    <View
      style={s.container}
      onLayout={(e: LayoutChangeEvent) => {
        heightRef.current = Math.max(1, e.nativeEvent.layout.height);
      }}
      {...pan.panHandlers}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="hydroscan-film-container"
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 194" pointerEvents="none">
        <Defs>
          <ClipPath id="hydroscan-shape">
            <Path d={shape === 'bottle' ? BOTTLE : CAN} />
          </ClipPath>
        </Defs>
        <Rect x={0} y={lineY} width={100} height={Math.max(0, 194 - lineY)} fill={withAlpha(af.blueText, 0.6)} clipPath="url(#hydroscan-shape)" />
        <Path d={shape === 'bottle' ? BOTTLE : CAN} fill="none" stroke={MARK} strokeWidth={1.4} />
        {level > 0.005 && level < 0.995 ? <Rect x={2} y={lineY - 0.7} width={96} height={1.4} fill={af.textPrimary} /> : null}
      </Svg>
    </View>
  );
}

function levelAt(locationY: number, height: number): number {
  const top = (BODY.top / 194) * height;
  const bottom = (BODY.bottom / 194) * height;
  const t = (bottom - locationY) / Math.max(1, bottom - top);
  return Math.min(1, Math.max(0, t));
}

function Track({ share, onShare }: { share: number; onShare: (share: number) => void }) {
  const widthRef = useRef(1);
  const cb = useRef(onShare);
  cb.current = onShare;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => cb.current(shareFromTrack(e.nativeEvent.locationX / widthRef.current)),
      onPanResponderMove: (e) => cb.current(shareFromTrack(e.nativeEvent.locationX / widthRef.current)),
    }),
  ).current;
  return (
    <View
      style={s.track}
      onLayout={(e: LayoutChangeEvent) => {
        widthRef.current = Math.max(1, e.nativeEvent.layout.width);
      }}
      {...pan.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Amount you drank"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const step = e.nativeEvent.actionName === 'increment' ? 0.05 : -0.05;
        cb.current(shareFromTrack(share + step));
      }}
      testID="hydroscan-film-track"
    >
      <View pointerEvents="none" style={s.trackLine} />
      <View pointerEvents="none" style={[s.trackDone, { width: `${share * 100}%` }]} />
      <View pointerEvents="none" style={[s.thumb, { left: `${share * 100}%` }]} />
    </View>
  );
}

/** The container that empties as the member drags or taps. Nothing is chosen to begin with. */
export function HydroScanFillAmount({
  header,
  shape,
  containerOz,
  share,
  onShare,
  onReview,
  onBack,
}: {
  /** "WATER · 16.9 FL OZ". */
  header: string;
  shape: 'bottle' | 'can';
  containerOz: number;
  /** Share of the container drunk, 0..1; null until the member chooses. */
  share: number | null;
  onShare: (share: number) => void;
  onReview: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const value = share ?? 0;
  const oz = drunkOz(containerOz, value);
  const chosen = share != null && oz > 0;
  const on: FillChipId | null = share == null ? null : activeChip(containerOz, value);
  return (
    <View style={[s.page, { paddingTop: Math.max(insets.top, 12) + 4, paddingBottom: Math.max(insets.bottom, 14) + 12 }]} testID="hydroscan-film-amount">
      <View style={s.pageTop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={s.back} testID="hydroscan-film-amount-back">
          <Icon name="chevron-left" size={20} color={af.textPrimary} />
        </Pressable>
        <Text style={s.pageHeader}>{header}</Text>
        <View style={s.back} />
      </View>
      <Text accessibilityRole="header" style={s.pageTitle}>{FILM_COPY.amountTitle}</Text>
      <Text style={s.pageBody}>{FILM_COPY.amountBody}</Text>
      <View style={s.amountRow}>
        <Container shape={shape} remaining={remainingShare(value)} onDragTo={(left) => onShare(shareFromTrack(1 - left))} />
        <View style={s.amountReadout} accessible accessibilityLiveRegion="polite" accessibilityLabel={chosen ? `${oz} fluid ounces, ${ozToMl(oz)} millilitres` : 'No amount chosen'}>
          <Text style={s.amountNumber} testID="hydroscan-film-amount-oz">{chosen ? String(oz) : DASH}</Text>
          <Text style={s.amountUnit}>{chosen ? `fl oz · ${ozToMl(oz)} mL` : 'fl oz'}</Text>
          <Text style={s.amountWords}>{chosen ? shareWords(value) : ''}</Text>
        </View>
      </View>
      <Track share={value} onShare={onShare} />
      <View style={s.fillChips}>
        {fillChips(containerOz).map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={c.accessibilityLabel}
            accessibilityState={{ selected: on === c.id }}
            onPress={() => onShare(c.share)}
            style={[s.fillChip, on === c.id && s.fillChipOn]}
            testID={`hydroscan-film-chip-${c.id}`}
          >
            <Text style={s.fillChipText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
      <Primary label={FILM_COPY.review} onPress={onReview} disabled={!chosen} testID="hydroscan-film-review" />
    </View>
  );
}

// ─── Review ─────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.reviewRow} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={s.reviewLabel}>{label}</Text>
      <Text style={s.reviewValue}>{value}</Text>
    </View>
  );
}

/** What is about to be logged. The button is the only thing that saves. */
export function HydroScanReview({
  title,
  drink,
  amount,
  note,
  logLabel,
  busy,
  onLog,
  onBack,
}: {
  /** "8.5 fl oz of water". */
  title: string;
  drink: string;
  /** "8.5 fl oz · 251 mL". */
  amount: string;
  /** The hydration rules' own words for a drink that does not move HydroState. Empty for water. */
  note: string;
  /** "Log 8.5 fl oz". */
  logLabel: string;
  busy: boolean;
  onLog: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.page, { paddingTop: Math.max(insets.top, 12) + 4, paddingBottom: Math.max(insets.bottom, 14) + 12 }]} testID="hydroscan-film-review-page">
      <View style={s.pageTop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={10} style={s.back} testID="hydroscan-film-review-back">
          <Icon name="chevron-left" size={20} color={af.textPrimary} />
        </Pressable>
        <Text style={s.pageHeader}>{FILM_COPY.reviewCaption}</Text>
        <View style={s.back} />
      </View>
      <Text accessibilityRole="header" style={s.pageTitle} testID="hydroscan-film-review-title">{title}</Text>
      <View style={s.reviewRows}>
        <ReviewRow label={FILM_COPY.rowDrink} value={drink} />
        <ReviewRow label={FILM_COPY.rowAmount} value={amount} />
      </View>
      {note ? <Text style={s.pageBody}>{note}</Text> : null}
      <Text style={s.pageBody}>{FILM_COPY.reviewNote}</Text>
      <View style={s.grow} />
      <Primary label={logLabel} onPress={onLog} disabled={busy} testID="hydroscan-film-log" />
    </View>
  );
}

const s = StyleSheet.create({
  grow: { flex: 1 },
  pressed: { opacity: 0.82 },

  status: { position: 'absolute', left: 18, right: 18 },
  cueRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 20 },
  cue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cueDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: withAlpha(af.textPrimary, 0.28) },
  cueDotOn: { backgroundColor: af.textPrimary },
  cueDotUnknown: { backgroundColor: 'transparent', borderWidth: 1, borderColor: withAlpha(af.textPrimary, 0.4) },
  stageLocked: { backgroundColor: af.red },
  cueText: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.4, color: withAlpha(af.textPrimary, 0.5) },
  cueTextOn: { color: af.textPrimary },
  panel: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: VEIL, rowGap: 8 },
  field: { width: '50%' },
  fieldLabel: { fontFamily: MONO, fontSize: 8, letterSpacing: 1.4, color: withAlpha(af.textPrimary, 0.5) },
  fieldValueRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 6, height: 14 },
  fieldValue: { fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.2, color: af.textPrimary },
  bars: { flexDirection: 'row', gap: 2 },
  bar: { width: 9, height: 2.5, borderRadius: 1, backgroundColor: withAlpha(af.textPrimary, 0.25) },
  barOn: { backgroundColor: af.textPrimary },

  frame: { position: 'absolute' },
  corner: { position: 'absolute', width: 22, height: 22 },
  tl: { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 10 },
  ticks: { position: 'absolute', left: -14, top: 26, bottom: 26, justifyContent: 'space-between', alignItems: 'flex-end' },
  tick: { width: 4, height: 1, backgroundColor: withAlpha(af.textPrimary, 0.45) },
  tickLong: { width: 8, backgroundColor: withAlpha(af.textPrimary, 0.8) },
  sizeTag: { position: 'absolute', right: -74, top: '46%', width: 66, height: 20, borderRadius: 6, backgroundColor: VEIL, alignItems: 'center', justifyContent: 'center' },
  sizeTagText: { fontFamily: MONO, fontSize: 8.5, letterSpacing: 1.2, color: af.textPrimary },

  hintWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: VEIL },
  hintLocked: { backgroundColor: af.primaryFill },
  hintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: af.textPrimary },
  hintDotLocked: { backgroundColor: af.red },
  hintText: { fontFamily: MEDIUM, fontSize: 12.5, color: af.textPrimary },
  hintTextLocked: { color: af.onPrimaryFill },

  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 18, alignItems: 'center', backgroundColor: withAlpha(af.canvas, 0.72) },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: withAlpha(af.canvas, 0.62) },
  segBtn: { minHeight: 44, minWidth: 78, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: af.primaryFill },
  segText: { fontFamily: SEMI, fontSize: 13, color: af.textPrimary },
  segTextOn: { color: af.onPrimaryFill },
  capture: { marginTop: 14, width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: af.textPrimary, alignItems: 'center', justifyContent: 'center' },
  capturePressed: { transform: [{ scale: 0.95 }] },
  captureOff: { opacity: 0.45 },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: af.primaryFill, alignItems: 'center', justifyContent: 'center' },

  card: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 20, paddingHorizontal: 20, backgroundColor: af.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: af.divider },
  eyebrow: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.8, color: af.textTertiary },
  cardTitle: { marginTop: 8, fontFamily: SEMI, fontSize: 24, lineHeight: 29, letterSpacing: -0.3, color: af.textPrimary },
  cardSize: { marginTop: 6, fontFamily: REGULAR, fontSize: 14, color: af.textSecondary },
  matchRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchText: { fontFamily: MEDIUM, fontSize: 13, color: af.textPrimary },
  notice: { marginTop: 10, fontFamily: MONO, fontSize: 10, letterSpacing: 1.4, color: af.textSecondary },
  chips: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: af.border, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: MEDIUM, fontSize: 13, color: af.textPrimary },
  quiet: { marginTop: 14, marginBottom: 14, fontFamily: REGULAR, fontSize: 13, lineHeight: 18, color: af.textSecondary },
  primary: { minHeight: 52, borderRadius: 26, backgroundColor: af.primaryFill, alignItems: 'center', justifyContent: 'center' },
  primaryOff: { opacity: 0.4 },
  primaryText: { fontFamily: SEMI, fontSize: 15, color: af.onPrimaryFill },

  page: { ...StyleSheet.absoluteFillObject, backgroundColor: af.canvas, paddingHorizontal: 22 },
  pageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46 },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  pageHeader: { fontFamily: MONO, fontSize: 10.5, letterSpacing: 2, color: af.textPrimary },
  pageTitle: { marginTop: 14, fontFamily: SEMI, fontSize: 26, lineHeight: 31, letterSpacing: -0.4, color: af.textPrimary },
  pageBody: { marginTop: 8, fontFamily: REGULAR, fontSize: 13.5, lineHeight: 19, color: af.textSecondary },
  amountRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 22 },
  container: { width: 132, aspectRatio: 100 / 194 },
  amountReadout: { flex: 1 },
  amountNumber: { fontFamily: LIGHT, fontSize: 64, lineHeight: 68, letterSpacing: -2, color: af.textPrimary },
  amountUnit: { marginTop: 2, fontFamily: REGULAR, fontSize: 13, color: af.textSecondary },
  amountWords: { marginTop: 6, fontFamily: REGULAR, fontSize: 13, color: af.textTertiary },
  track: { marginTop: 26, height: 44, justifyContent: 'center' },
  trackLine: { height: 2, borderRadius: 1, backgroundColor: af.border },
  trackDone: { position: 'absolute', left: 0, height: 2, borderRadius: 1, backgroundColor: af.textPrimary },
  thumb: { position: 'absolute', marginLeft: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: af.primaryFill },
  fillChips: { marginTop: 10, marginBottom: 18, flexDirection: 'row', gap: 8 },
  fillChip: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: af.border, alignItems: 'center', justifyContent: 'center' },
  fillChipOn: { borderColor: af.textPrimary, backgroundColor: af.surfacePressed },
  fillChipText: { fontFamily: MEDIUM, fontSize: 14, color: af.textPrimary },

  reviewRows: { marginTop: 18, borderTopWidth: 1, borderTopColor: af.divider },
  reviewRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: af.divider },
  reviewLabel: { fontFamily: REGULAR, fontSize: 14, color: af.textSecondary },
  reviewValue: { fontFamily: MEDIUM, fontSize: 14, color: af.textPrimary },
});
