/**
 * Editorial OS core primitives — stocks, furniture, rules, statements,
 * numbers, command presentation (E1 foundation; spec
 * docs/aforce-editorial-os-spec-v1.html).
 *
 * PRESENTATION-ONLY CONTRACT (founder boundary, 2026-08-29): every
 * primitive here renders strings and numbers HANDED TO IT. Nothing in this
 * layer computes, rewrites, derives, or defaults product truth — no
 * HydroState math, no command authorship, no fallback copy that implies a
 * reading exists. The one presentation default is the truthful neutral:
 * an absent number renders as an em-dash (see editorialLogic).
 *
 * Accessibility (superior to visual fidelity, by ruling):
 * - Every Text scales with Dynamic Type. `allowFontScaling={false}` is
 *   BANNED in this directory (locked by editorialFoundation.test.ts).
 *   Oversized numerals cap at the existing house boundary
 *   AF_MAX_DISPLAY_FONT_SCALE (1.35) — the same cap the accepted af layer
 *   uses — while body/caption/micro scale without limit and layouts
 *   reflow, not shrink.
 * - Caps live ONLY in the caption/micro furniture voice, applied via
 *   text passed already-tracked through `edType.caption`/`edType.micro`
 *   styles; statements are sentence case by rule.
 * - E1 ships no interactive primitives — targets/hitSlop rules land with
 *   the first interactive migration step (E2+), gated by edRhythm.minTarget.
 */
import React from 'react';
import { StyleSheet, Text, type TextStyle, View, type ViewProps, type ViewStyle } from 'react-native';

import {
  AF_MAX_DISPLAY_FONT_SCALE,
} from '@/theme';
import {
  edAccent,
  edInkFor,
  edRhythm,
  edStock,
  edType,
  type EdStockName,
} from '@/theme/editorialTokens';

import { edFolioIndex, edNumberDisplay, splitMirrorWord } from './editorialLogic';

export const EdStockContext = React.createContext<EdStockName>('black');

/** The stock the nearest EdSurface established (defaults to the black OS ground). */
export function useEdStock(): EdStockName {
  return React.useContext(EdStockContext);
}

export function useEdInk() {
  return edInkFor(useEdStock());
}

/**
 * EdSurface — a run of one stock. `black` is the OS ground (Direction B);
 * `paper` is the Feature register (Direction A). Stocks never mix on one
 * screen except through EdStockTurn (instruments.tsx).
 */
export function EdSurface({
  stock = 'black',
  style,
  children,
  ...rest
}: ViewProps & { stock?: EdStockName }) {
  return (
    <EdStockContext.Provider value={stock}>
      <View
        style={[{ backgroundColor: stock === 'paper' ? edStock.paper : edStock.black }, style]}
        {...rest}
      >
        {children}
      </View>
    </EdStockContext.Provider>
  );
}

/** Hairline rule — the editorial layer's separator (rules replace cards). */
export function EdRule({ style }: { style?: ViewStyle }) {
  const ink = useEdInk();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.rule, { backgroundColor: ink.rule }, style]}
    />
  );
}

/**
 * EdMasthead — top furniture: left/right mono captions over a hairline
 * ("AFORCE OS · THURSDAY" ··· "MEMBER 0001").
 */
export function EdMasthead({ left, right }: { left: string; right?: string }) {
  const ink = useEdInk();
  return (
    <View>
      <View style={styles.mastheadRow}>
        <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>{left}</Text>
        {right ? <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>{right}</Text> : null}
      </View>
      <EdRule style={{ marginTop: 10, marginBottom: 0 }} />
    </View>
  );
}

/**
 * EdFolio — bottom furniture: page index + closing label
 * ("02 / 07" ··· "HYDRATION IS A SYSTEM").
 */
export function EdFolio({ index, total, label }: { index: number; total: number; label?: string }) {
  const ink = useEdInk();
  return (
    <View>
      <EdRule style={{ marginBottom: 10, marginTop: 0 }} />
      <View style={styles.mastheadRow}>
        <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{edFolioIndex(index, total)}</Text>
        {label ? <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{label}</Text> : null}
      </View>
    </View>
  );
}

/**
 * EdEyebrow — micro furniture label with a leading state dot. `tone`
 * carries the two accent meanings: red = live/identity, lockIn = the
 * committed state (rare by rule). Color is never the sole carrier — the
 * label text itself names the state.
 */
export function EdEyebrow({ label, tone }: { label: string; tone?: 'red' | 'lockIn' }) {
  const ink = useEdInk();
  const dot = tone === 'lockIn' ? edAccent.lockIn : tone === 'red' ? edAccent.red : null;
  return (
    <View style={styles.eyebrowRow}>
      {dot ? <View style={[styles.eyebrowDot, { backgroundColor: dot }]} /> : null}
      <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{label}</Text>
    </View>
  );
}

/** EdKicker — the deck's em-rule lead-in ("— Tonight decides tomorrow."). */
export function EdKicker({ text }: { text: string }) {
  const ink = useEdInk();
  return (
    <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet }]}>
      <Text style={{ color: edAccent.red }}>{'— '}</Text>
      {text}
    </Text>
  );
}

/**
 * EdStatement — the display voice. Sentence case by rule; `role` picks the
 * scale step. Compose emphasis with EdAccent (the single red word) as a
 * child — never recolor whole statements.
 */
export function EdStatement({
  children,
  role = 'statement',
  style,
  accessibilityRole,
}: {
  children: React.ReactNode;
  role?: 'display' | 'statement' | 'command' | 'confirm';
  style?: TextStyle;
  /** Pass 'header' when this statement heads its screen — screen-reader
   *  users navigate by landmark, and an editorial screen with no header
   *  role has none. */
  accessibilityRole?: 'header';
}) {
  const ink = useEdInk();
  // All statement roles are display-voice: they cap at the existing house
  // boundary (AF_MAX_DISPLAY_FONT_SCALE, same as the accepted af layer) so a
  // single oversized word can never force an iOS mid-word break — body,
  // caption, and micro keep unlimited Dynamic Type and carry the reading.
  return (
    <Text
      accessibilityRole={accessibilityRole}
      maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
      style={[edType[role] as TextStyle, { color: ink.primary }, style]}
    >
      {children}
    </Text>
  );
}

/** The one red word inside a statement (deck emphasis grammar). */
export function EdAccent({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: edAccent.red }}>{children}</Text>;
}

/**
 * EdStateWord — И state language. Renders the word with its last N as the
 * mirrored glyph in red, in ONE text run (wraps as a word; no per-letter
 * splitting). Screen readers announce the true word.
 */
export function EdStateWord({ word, style }: { word: string; style?: TextStyle }) {
  const ink = useEdInk();
  const split = splitMirrorWord(word);
  return (
    <Text
      accessibilityLabel={word}
      style={[edType.caption as TextStyle, { color: ink.primary }, style]}
    >
      {split ? (
        <>
          {split.before}
          <Text style={{ color: edAccent.red }}>{split.glyph}</Text>
          {split.after}
        </>
      ) : (
        word
      )}
    </Text>
  );
}

/**
 * EdNumber — the editorial numeral. `value` is the measured reading or
 * null/undefined when no reading exists; the truthful neutral renders an
 * em-dash (never a fabricated zero). Hero numerals cap at the house
 * display-scale boundary and still reflow.
 */
export function EdNumber({
  value,
  unit,
  role = 'numberHero',
  caption,
}: {
  value: number | null | undefined;
  unit?: string;
  role?: 'numberHero' | 'numberFeature';
  caption?: string;
}) {
  const ink = useEdInk();
  const display = edNumberDisplay(value);
  const unmeasured = display === '—';
  return (
    <View accessible accessibilityLabel={unmeasured ? `${caption ?? 'value'}: no reading` : undefined}>
      <Text
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        style={[edType[role] as TextStyle, { color: unmeasured ? ink.quiet : ink.primary }]}
      >
        {display}
        {unit && !unmeasured ? (
          <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>{` ${unit}`}</Text>
        ) : null}
      </Text>
      {caption ? (
        <Text style={[edType.caption as TextStyle, { color: ink.quiet, marginTop: 6 }]}>{caption}</Text>
      ) : null}
    </View>
  );
}

/**
 * EdCommandBlock — presentation of THE command. `command` must be the
 * canonical RecoveryCommand string verbatim (or chartered Moments copy) —
 * this block never authors, rewrites, or defaults an instruction, and it
 * renders nothing when no command exists (absence is not a command).
 */
export function EdCommandBlock({
  kicker = 'Your command',
  command,
  evidence,
}: {
  kicker?: string;
  command: string;
  evidence?: string;
}) {
  const ink = useEdInk();
  if (!command) return null;
  return (
    <View>
      <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>
        <Text style={{ color: edAccent.red }}>{'— '}</Text>
        {kicker}
      </Text>
      <Text
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        style={[edType.command as TextStyle, { color: ink.primary, marginTop: 8 }]}
      >
        {command}
      </Text>
      {evidence ? (
        <Text style={[edType.caption as TextStyle, { color: ink.quiet, marginTop: 8 }]}>{evidence}</Text>
      ) : null}
    </View>
  );
}

/** EdCaption — quiet mono furniture line. */
export function EdCaption({ text, style }: { text: string; style?: TextStyle }) {
  const ink = useEdInk();
  return <Text style={[edType.caption as TextStyle, { color: ink.quiet }, style]}>{text}</Text>;
}

/**
 * EdEvidenceLine — provenance furniture ("SOURCE · SCAN 07:41 · CONFIDENCE
 * HIGH"). Evidence is information, not decoration — later migration steps
 * may move it behind progressive disclosure but never delete it.
 */
export function EdEvidenceLine({ parts }: { parts: string[] }) {
  const ink = useEdInk();
  return (
    <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{parts.join(' · ')}</Text>
  );
}

const styles = StyleSheet.create({
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: edRhythm.aroundRule,
    alignSelf: 'stretch',
  },
  mastheadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: 12,
    flexWrap: 'wrap',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  eyebrowDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
