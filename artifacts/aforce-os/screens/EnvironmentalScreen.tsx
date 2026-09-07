/**
 * ENVIRONMENTAL — the Visual OS surface.
 *
 *     HOME = THE BODY.  ENVIRONMENT = THE WORLD AROUND THE BODY.
 *
 * The field carries the meaning; this file explains it in as few words as the
 * truth allows. Every string and number below comes from
 * `buildEnvironmentalView`, which is itself law-bound — the screen cannot
 * fabricate, because it has nothing to fabricate FROM.
 *
 * ── THE FOUR REFINEMENTS ───────────────────────────────────────────────────
 *
 * 1. SIGNATURE — lives in `EnvironmentalField` (the N–И seam as light).
 * 2. UNRESOLVED — INSUFFICIENT's headline dissolves through a gradient mask
 *    rather than being clipped, so it reads as deliberate incompleteness
 *    rather than a layout accident.
 * 3. SIGNAL LINE — secondary factors sit ON the field as one quiet line, not
 *    a bordered table. Each remains an individual accessible element with its
 *    value intact, so scanability and truth survive the visual change.
 * 4. AUTHORITY — the AForce block is a different PLANE: its own opaque
 *    surface, its own inset, a Signal Red spine, and a hard gap. It should
 *    read as another intelligence entering the screen, never as something
 *    Environmental authored.
 *
 * ── WHAT THIS SCREEN MAY NOT DO ────────────────────────────────────────────
 *
 * It never authors an action. The AForce block renders the canonical
 * `engineOutput.command` from the store — a different object, produced by a
 * different authority — and the environmental view model has no field an
 * action could occupy.
 *
 * ── I18N GATE (deferred, deliberately) ─────────────────────────────────────
 *
 * Copy is English constants in `environmentalPresentation`. The repo carries
 * ELEVEN locales; translating language while the visual direction was still
 * being shaped would have translated a moving target. THIS SURFACE MUST NOT
 * BECOME MEMBER-FACING UNTIL THAT COPY IS IN THE LOCALIZATION SYSTEM — the
 * presentation flag stays false in production until then.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from 'react-i18next';

import { af, afType, afLayout, withAlpha } from '@/theme';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme/afTokens';
import { useEngineSlice, useFlagsSlice } from '@/store/slices';
import { EnvironmentalField } from '@/components/environment/EnvironmentalField';
import {
  buildEnvironmentalView,
  type EnvironmentalView,
} from '@/utils/environment/environmentalPresentation';
import {
  interpretEnvironment,
  type EnvironmentalState,
} from '@/utils/environment/environmentalInterpretation';
import { readingsFromLocationSnapshot } from '@/utils/environment/environmentalAdapter';
import { getLocationSnapshotSync } from '@/services/locationIntelligenceService';

/** State accent. Never the ONLY carrier — see `stateWord` and the field. */
const ACCENT: Record<EnvironmentalState, string> = {
  clear: af.textSecondary,
  aware: af.cyan,
  prepare: af.amber,
  caution: af.redText,
  insufficient: af.textTertiary,
};

// ─── Pieces ─────────────────────────────────────────────────────────────────

/**
 * REFINEMENT 2 — the headline dissolves instead of being cropped.
 *
 * A gradient mask fades the glyphs into the field. The word is complete in the
 * accessibility tree; only its RENDERING is unresolved, which is the point:
 * the type is doing what the evidence is doing.
 */
function UnresolvedHeadline({ text }: { text: string }) {
  return (
    <View style={styles.unresolvedWrap} accessible accessibilityLabel={text.replace('\n', ' ')}>
      <Text
        style={[styles.openState, styles.unresolvedText]}
        maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
        accessibilityElementsHidden
      >
        {text}
      </Text>
      {/* The dissolve. A scrim graded from transparent into the canvas fades
          the glyphs INTO the field — deliberate incompleteness, not a crop.
          Uses the gradient primitive already in the bundle rather than adding
          a masking dependency for one effect. */}
      <LinearGradient
        colors={[withAlpha(af.canvas, 0), withAlpha(af.canvas, 0.55), withAlpha(af.canvas, 0.92)]}
        locations={[0.34, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

/** REFINEMENT 3 — one quiet line on the field, not a bordered table. */
function SignalLine({ rows }: { rows: EnvironmentalView['secondary'] }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.signalLine} testID="environmental-signal-line">
      {rows.map((r) => (
        <View
          key={r.signal}
          style={styles.signalItem}
          accessible
          // Each signal stays its own element so VoiceOver reads
          // "Air, good, 20" rather than one run-on sentence.
          accessibilityLabel={
            r.value == null ? `${r.label}, ${r.word}` : `${r.label}, ${r.word}, ${r.value}`
          }
        >
          <Text style={styles.signalLabel}>{r.label}</Text>
          <Text style={styles.signalWord} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
            {r.word}
            {r.value != null ? <Text style={styles.signalValue}>{`  ${r.value}`}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * REFINEMENT 4 — a separate intelligence plane.
 *
 * Opaque surface, its own inset, a Signal Red spine and a hard gap above. The
 * command text is `engineOutput.command.action` — the canonical authority's
 * own words, passed through untouched.
 */
function AForcePlane({ action, label }: { action: string; label: string }) {
  return (
    <View style={styles.planeGap}>
      <View style={styles.plane} testID="environmental-aforce-plane">
        <View style={styles.planeSpine} />
        <View style={styles.planeBody}>
          <Text style={styles.planeWho}>{label}</Text>
          <Text style={styles.planeAction} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
            {action}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export interface EnvironmentalScreenViewProps {
  readonly view: EnvironmentalView;
  /** The canonical RecoveryCommand action, or null. NEVER authored here. */
  readonly commandAction: string | null;
}

/**
 * The pure presentational screen — every state is reachable from props alone,
 * which is what makes the five deterministic renders possible.
 */
export function EnvironmentalScreenView({ view, commandAction }: EnvironmentalScreenViewProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const accent = ACCENT[view.state];
  const isInsufficient = view.state === 'insufficient';

  return (
    <View style={styles.root} testID={`environmental-screen-${view.state}`}>
      <EnvironmentalField state={view.state} />
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow} accessibilityRole="header">{t('environment.eyebrow')}</Text>

        <View style={styles.spacer} />

        {view.dominant ? (
          <>
            <Text style={[styles.stateLabel, { color: accent }]}>{view.stateWord}</Text>
            <View accessible accessibilityLabel={
              view.dominant.value == null
                ? `${view.dominant.label}, ${view.dominant.word}`
                : `${view.dominant.label}, ${view.dominant.word}, ${view.dominant.value}`
            }>
              <Text style={styles.dominantSignal} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
                {view.dominant.label}
              </Text>
              <View style={styles.dominantWordRow}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                <Text style={[styles.dominantWord, { color: accent }]}>{view.dominant.word}</Text>
                {view.dominant.value != null ? (
                  <Text style={styles.dominantValue}>{view.dominant.value}</Text>
                ) : null}
              </View>
            </View>
          </>
        ) : isInsufficient ? (
          <UnresolvedHeadline text={t('environment.unresolved_headline')} />
        ) : (
          // CLEAR — the state itself is the hero and the frame stays open.
          <Text style={styles.openState} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
            {view.stateWord}
          </Text>
        )}

        <Text style={styles.line} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
          {view.line}
        </Text>

        {commandAction != null
          ? <AForcePlane action={commandAction} label={t('environment.aforce')} />
          : null}

        <View style={styles.spacer} />

        <SignalLine rows={view.secondary} />

        {view.gaps.length > 0 ? (
          <View style={styles.gaps} testID="environmental-gaps">
            {view.gaps.map((g) => (
              <View key={g.label} style={styles.gapRow} accessible
                accessibilityLabel={`${g.label}. ${g.reason}`}>
                <Text style={styles.gapLabel}>{g.label}</Text>
                <Text style={styles.gapReason}>{g.reason}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.quality}>{view.signalQuality}</Text>
      </ScrollView>
    </View>
  );
}

/** The routed screen: flag gate, evidence, and the canonical command. */
export default function EnvironmentalScreen() {
  const engine = useEngineSlice();
  const flags = useFlagsSlice();
  const enabled = !!flags.environmental_surface_enabled;

  // Presentation is independently flagged from acquisition. With the flag off
  // the route is dead, so a stray deep link cannot reach an unreleased screen.
  if (!enabled) return <Redirect href={'/(tabs)/profile' as never} />;

  const now = Date.now();
  const readings = readingsFromLocationSnapshot(getLocationSnapshotSync() as never, now);
  const view = buildEnvironmentalView(interpretEnvironment(readings, now));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <EnvironmentalScreenView
        view={view}
        // THE AUTHORITY BOUNDARY. This string is the canonical command's own
        // words, read from the engine — Environmental has no action of its own
        // to offer, and `view` has no field one could live in.
        commandAction={view.showsCommand ? (engine.command?.action ?? null) : null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  content: {
    flexGrow: 1,
    paddingHorizontal: afLayout.screenPaddingX,
  },
  spacer: { flex: 1, minHeight: 24 },
  eyebrow: { ...afType.eyebrow, color: af.textTertiary },

  stateLabel: {
    ...afType.eyebrow, letterSpacing: 2, marginBottom: 12,
  },
  dominantSignal: {
    fontFamily: afType.displayHero.fontFamily, fontSize: 62, lineHeight: 60,
    letterSpacing: -1, color: af.textPrimary,
  },
  dominantWordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dominantWord: { ...afType.eyebrow, letterSpacing: 1.5 },
  dominantValue: { ...afType.caption, fontFamily: afType.displayScore.fontFamily, color: af.textSecondary },

  openState: {
    fontFamily: afType.displayHero.fontFamily, fontSize: 56, lineHeight: 56,
    letterSpacing: -1, color: af.textPrimary,
  },
  unresolvedWrap: { justifyContent: 'center' },
  unresolvedText: { color: withAlpha(af.textPrimary, 0.72) },

  line: {
    fontFamily: afType.displayHero.fontFamily, fontSize: 23, lineHeight: 28,
    color: af.textPrimary, marginTop: 20, maxWidth: 300,
  },

  // REFINEMENT 3 — a line on the field, not a table.
  signalLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 26, marginTop: 26 },
  signalItem: { minWidth: 64 },
  signalLabel: { ...afType.eyebrow, color: af.textTertiary },
  signalWord: { ...afType.microLabel, color: af.textSecondary, marginTop: 5 },
  signalValue: { fontFamily: afType.displayScore.fontFamily, color: af.textTertiary },

  // REFINEMENT 4 — a separate plane.
  planeGap: { marginTop: 30 },
  plane: {
    flexDirection: 'row', borderRadius: afLayout.radiusCard ?? 14, overflow: 'hidden',
    backgroundColor: af.surfaceRaised, borderWidth: 1, borderColor: af.border,
  },
  planeSpine: { width: 3, backgroundColor: af.red },
  planeBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 15 },
  planeWho: { ...afType.eyebrow, color: af.textTertiary, letterSpacing: 1.8 },
  planeAction: { ...afType.bodyStrong, color: af.textPrimary, marginTop: 6 },

  gaps: { marginTop: 24, gap: 8 },
  gapRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  gapLabel: { ...afType.eyebrow, color: af.textTertiary },
  gapReason: { ...afType.caption, color: af.textTertiary, flexShrink: 1, textAlign: 'right' },

  quality: { ...afType.caption, color: af.textTertiary, marginTop: 18 },
});
