/**
 * HomeCinematic — the Home layout from App Spec v1.8.2 (Part 2 · Home,
 * "Home (cinematic, Nov 6)") and the "Every tab, one system." prototype.
 *
 *   Hero        mark + date, greeting, member photo (opens Profile); then the
 *               next Moment: when, its name in large type, its status.
 *   Next move   one panel: status line, HydroState ring, "Your next move",
 *               intake + last update, Log / Scan, "Why?" and the data source.
 *
 * Presentation only. Every string and number arrives as a prop from the
 * container; nothing here reads a store, computes a score or logs a drink.
 *
 * `photo` is the Moment's World photograph. It is optional: no licensed World
 * photography is in the app yet (spec register #20), so today the hero is
 * drawn on plain AFORCE Black and sizes to its content.
 */
import React from 'react';
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AFMark } from '@/components/ui/AFMark';
import { af, withAlpha, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { HomeHydroRing } from './HomeHydroRing';

export const HOME_HERO_PHOTO_HEIGHT = 540;
export const HOME_PANEL_OVERLAP = 44;

export interface HomeCinematicProps {
  dateLine: string;
  greeting: string;
  /** The member-photo button that opens Profile. */
  profileEntry?: React.ReactNode;

  momentEyebrow: string;
  momentTitle: string;
  momentStatus: string;
  onPressMoment: () => void;
  photo?: ImageSourcePropType;

  /** Null hides the status line (nothing planned). */
  statusLine: { left: string; right: string } | null;
  ring: { progress: number; value: string; label: string };
  ringAccessibilityLabel: string;
  moveTitle: string;
  intakeNote: string;
  /** One quiet line kept beside the reading (confidence), when there is one. */
  readingNote?: string;

  logLabel: string;
  onLog: () => void;
  logBusy?: boolean;
  scanLabel: string;
  onScan: () => void;

  /** The reason for the next move; the "Why?" link shows and hides it. */
  why?: string;
  /** e.g. "Apple Health · 6:12 PM". Hidden when there is no source. */
  sourceLine?: string;
  /** e.g. the last-known-delivery notice. */
  notice?: string;

  /** Banners, cards and quiet links the container keeps below the panel. */
  children?: React.ReactNode;
}

export function HomeCinematic(props: HomeCinematicProps) {
  const [whyOpen, setWhyOpen] = React.useState(false);
  const hasPhoto = props.photo != null;

  const heroContent = (
    <>
      <View style={styles.topRow}>
        <View style={styles.topText}>
          <View style={styles.dateRow}>
            <AFMark size={15} decorative />
            <Text style={styles.eyebrowBright}>{props.dateLine.toUpperCase()}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.greeting} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
            {props.greeting}
          </Text>
        </View>
        {props.profileEntry}
      </View>

      <Pressable
        onPress={props.onPressMoment}
        accessibilityRole="button"
        accessibilityLabel={`${props.momentTitle}. ${props.momentEyebrow}. ${props.momentStatus}`}
        style={({ pressed }) => [styles.moment, hasPhoto && styles.momentOnPhoto, pressed && styles.pressed]}
        testID="home-next-moment"
      >
        <Text style={styles.eyebrowBright}>{props.momentEyebrow.toUpperCase()}</Text>
        <Text style={styles.momentTitle} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
          {props.momentTitle}
        </Text>
        <Text style={styles.momentStatus}>{props.momentStatus} →</Text>
      </Pressable>
    </>
  );

  return (
    <View testID="home-cinematic">
      {hasPhoto ? (
        <ImageBackground source={props.photo!} style={styles.heroPhoto} resizeMode="cover" testID="home-hero-photo">
          <LinearGradient
            pointerEvents="none"
            colors={[withAlpha(af.canvas, 0.6), withAlpha(af.canvas, 0.1), withAlpha(af.canvas, 0), withAlpha(af.canvas, 0.55), af.canvas]}
            locations={[0, 0.24, 0.44, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
          {heroContent}
        </ImageBackground>
      ) : (
        <View style={styles.heroPlain}>{heroContent}</View>
      )}

      <View
        style={[styles.panel, hasPhoto && { marginTop: -HOME_PANEL_OVERLAP }]}
        accessibilityLabel="Your next move"
        testID="home-next-move"
      >
        {props.statusLine ? (
          <View style={styles.statusLine}>
            <View style={styles.statusLeft}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{props.statusLine.left.toUpperCase()}</Text>
            </View>
            <Text style={[styles.statusText, styles.statusRight]}>{props.statusLine.right.toUpperCase()}</Text>
          </View>
        ) : null}

        <View style={styles.moveRow}>
          <HomeHydroRing
            progress={props.ring.progress}
            value={props.ring.value}
            label={props.ring.label}
            accessibilityLabel={props.ringAccessibilityLabel}
          />
          <View style={styles.moveText}>
            <Text style={styles.eyebrow}>YOUR NEXT MOVE</Text>
            <Text style={styles.moveTitle} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{props.moveTitle}</Text>
            <Text style={styles.note}>{props.intakeNote}</Text>
            {props.readingNote ? <Text style={styles.note}>{props.readingNote}</Text> : null}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={props.onLog}
            disabled={props.logBusy}
            accessibilityRole="button"
            accessibilityLabel={props.logLabel}
            accessibilityState={{ disabled: Boolean(props.logBusy), busy: Boolean(props.logBusy) }}
            style={({ pressed }) => [styles.primary, (pressed || props.logBusy) && styles.pressed]}
            testID="home-log"
          >
            <Text style={styles.primaryLabel}>{props.logLabel}</Text>
          </Pressable>
          <Pressable
            onPress={props.onScan}
            accessibilityRole="button"
            accessibilityLabel={props.scanLabel}
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
            testID="home-scan"
          >
            <Text style={styles.ghostLabel}>Scan</Text>
          </Pressable>
        </View>

        <View style={styles.footRow}>
          {props.why ? (
            <Pressable
              onPress={() => setWhyOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: whyOpen }}
              hitSlop={10}
              style={styles.whyHit}
              testID="home-why"
            >
              <Text style={styles.why}>Why?</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {props.sourceLine ? (
            <View style={styles.source}>
              <View style={styles.sourceDot} />
              <Text style={styles.sourceText}>{props.sourceLine.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        {whyOpen && props.why ? <Text style={styles.whyBody} testID="home-why-body">{props.why}</Text> : null}
        {props.notice ? <Text style={styles.note} testID="home-notice">{props.notice}</Text> : null}
      </View>

      {props.children}
    </View>
  );
}

const MONO = 'IBMPlexMono_400Regular';

const styles = StyleSheet.create({
  heroPhoto: {
    height: HOME_HERO_PHOTO_HEIGHT,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-between',
    backgroundColor: af.canvas,
  },
  heroPlain: { paddingTop: 8, gap: 44, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  topText: { flexShrink: 1, gap: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
  // The prototype sets hero eyebrows a shade brighter than muted so they hold on a photo.
  eyebrowBright: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textPrimary, opacity: 0.92 },
  greeting: { fontFamily: 'Inter_600SemiBold', fontSize: 22, lineHeight: 26, letterSpacing: -0.44, color: af.textPrimary },
  moment: { gap: 0 },
  momentOnPhoto: { paddingBottom: 80 },
  momentTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 42,
    lineHeight: 43,
    letterSpacing: -0.84,
    color: af.textPrimary,
    marginTop: 10,
  },
  momentStatus: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textPrimary, opacity: 0.92, marginTop: 8 },
  pressed: { opacity: 0.72 },

  panel: {
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 20,
    gap: 18,
    marginBottom: 14,
  },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: af.divider,
    gap: 12,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: af.textTertiary },
  statusText: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.5, color: af.textSecondary },
  statusRight: { color: af.textPrimary },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  moveText: { flex: 1, gap: 6 },
  moveTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 24, lineHeight: 27, letterSpacing: -0.48, color: af.textPrimary },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  primary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: af.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.onPrimaryFill },
  ghost: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: af.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  ghostLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: af.textPrimary },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  whyHit: { minHeight: 28, justifyContent: 'center' },
  why: { fontFamily: 'Inter_400Regular', fontSize: 13, color: af.textSecondary, textDecorationLine: 'underline' },
  whyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  sourceDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: af.textPrimary },
  sourceText: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.3, color: af.textTertiary },
});

/** One quiet list at the foot of Home (Appendix G §3 · Home). */
export function HomeQuietList({ rows }: { rows: { label: string; onPress: () => void; testID?: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <View style={quiet.list} testID="home-quiet-list">
      {rows.map((row) => (
        <Pressable
          key={row.label}
          onPress={row.onPress}
          accessibilityRole="button"
          accessibilityLabel={row.label}
          style={({ pressed }) => [quiet.row, pressed && styles.pressed]}
          testID={row.testID}
        >
          <Text style={quiet.text}>{row.label}</Text>
          <Text style={quiet.arrow}>→</Text>
        </Pressable>
      ))}
    </View>
  );
}

const quiet = StyleSheet.create({
  list: { marginTop: 8, borderTopWidth: 1, borderTopColor: af.divider },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: af.divider,
  },
  text: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textSecondary },
  arrow: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textTertiary },
});
