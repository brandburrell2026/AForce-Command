/**
 * HydrationHero — the top of the Hydration tab, laid out as in the approved
 * prototype: the member photo, "Hydration · today", today's ounces in large
 * light type, the one status line, the ring card and the two actions.
 *
 * Presentation only: every value arrives as a prop.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AFMark } from '@/components/ui/AFMark';
import { HomeHydroRing } from '@/components/home/cinematic/HomeHydroRing';
import { af, withAlpha, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

export const HYDRATION_RING_SIZE = 120;

export interface HydrationHeroProps {
  /** Right side of the top row: quick actions and the member photo. */
  topRight?: React.ReactNode;
  amount: string;
  line: string;
  statusLine: { left: string; right: string } | null;
  ring: { progress: number; value: string; label: string };
  ringAccessibilityLabel: string;
  percentLine: string;
  sourceLine: string;
  /**
   * What the target is, shown in a sheet from the "How the target works" link,
   * as in the prototype. The hero line above already calls it a starting
   * target (stop-ship RA-N8). Null hides the link.
   */
  targetExplanation?: string | null;
  scanLabel: string;
  onScan: () => void;
  logLabel: string;
  onLog: () => void;
  /** Banners that belong between the hero and the card. */
  children?: React.ReactNode;
}

export function HydrationHero(props: HydrationHeroProps) {
  const [sheet, setSheet] = React.useState(false);
  return (
    <View testID="hydration-cinematic">
      <View style={styles.topRow}>
        <View />
        <View style={styles.topRight}>{props.topRight}</View>
      </View>

      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <AFMark size={15} decorative />
          <Text style={styles.eyebrowBright}>HYDRATION · TODAY</Text>
        </View>
        <View
          style={styles.amountRow}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${props.amount} ounces ${props.line}`}
        >
          <Text style={styles.amount} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{props.amount}</Text>
          <Text style={styles.amountUnit} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>oz</Text>
        </View>
        <Text style={styles.heroLine}>{props.line}</Text>
      </View>

      {props.children}

      {props.statusLine ? (
        <View style={styles.statusLine} testID="hydration-status-line">
          <View style={styles.statusLeft}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{props.statusLine.left.toUpperCase()}</Text>
          </View>
          <Text style={[styles.statusText, styles.statusRight]}>{props.statusLine.right.toUpperCase()}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <HomeHydroRing
            size={HYDRATION_RING_SIZE}
            progress={props.ring.progress}
            value={props.ring.value}
            label={props.ring.label}
            accessibilityLabel={props.ringAccessibilityLabel}
          />
          <View style={styles.cardText}>
            <Text style={styles.percent}>{props.percentLine}</Text>
            <Text style={styles.note}>{props.sourceLine}</Text>
            {props.targetExplanation ? (
              <Pressable
                onPress={() => setSheet(true)}
                accessibilityRole="button"
                hitSlop={8}
                style={styles.linkHit}
                testID="hydration-target-link"
              >
                <Text style={styles.link}>How the target works</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.scrim} onPress={() => setSheet(false)} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={styles.sheet} testID="hydration-target-sheet">
          <View style={styles.grabber} />
          <Text accessibilityRole="header" style={styles.sheetTitle}>How the target works</Text>
          <Text style={styles.sheetBody}>{props.targetExplanation}</Text>
          <Pressable
            onPress={() => setSheet(false)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btnSolo, styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>Done</Text>
          </Pressable>
        </View>
      </Modal>

      <View style={styles.actions}>
        <Pressable
          onPress={props.onScan}
          accessibilityRole="button"
          accessibilityLabel={props.scanLabel}
          style={({ pressed }) => [styles.btn, styles.primary, pressed && styles.pressed]}
          testID="hydration-scan"
        >
          <Text style={styles.primaryLabel}>{props.scanLabel}</Text>
        </Pressable>
        <Pressable
          onPress={props.onLog}
          accessibilityRole="button"
          accessibilityLabel={props.logLabel}
          style={({ pressed }) => [styles.btn, styles.ghost, pressed && styles.pressed]}
          testID="hydration-log-manually"
        >
          <Text style={styles.ghostLabel}>{props.logLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One row of the Recent list: name, when, amount. */
export function HydrationRecentRow({ title, when, amount, last }: { title: string; when: string; amount: string; last?: boolean }) {
  return (
    <View style={[styles.recentRow, !last && styles.recentRuled]} accessible accessibilityLabel={`${title}, ${when}, ${amount}`}>
      <View style={styles.recentText}>
        <Text style={styles.recentTitle}>{title}</Text>
        <Text style={styles.note}>{when}</Text>
      </View>
      <Text style={styles.recentAmount}>{amount}</Text>
    </View>
  );
}

/** A small mono section label, muted, as in the reference ("RECENT", "HISTORY"). */
export function HydrationEyebrow({ label }: { label: string }) {
  return <Text style={styles.eyebrow}>{label.toUpperCase()}</Text>;
}

const MONO = 'IBMPlexMono_400Regular';

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hero: { paddingTop: 44, paddingBottom: 40 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary, marginBottom: 6 },
  eyebrowBright: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textPrimary, opacity: 0.92 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  amount: { fontFamily: 'Inter_300Light', fontSize: 96, lineHeight: 100, letterSpacing: -3.8, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  amountUnit: { fontFamily: 'Inter_300Light', fontSize: 28, color: af.textPrimary, marginLeft: 6 },
  heroLine: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textPrimary, opacity: 0.92, marginTop: 8 },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: af.textTertiary },
  statusText: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.5, color: af.textSecondary },
  statusRight: { color: af.textPrimary },
  card: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20, padding: 18, gap: 12, marginBottom: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  cardText: { flex: 1, gap: 6 },
  percent: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 21, color: af.textPrimary },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
  linkHit: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: 'Inter_400Regular', fontSize: 14, color: af.textPrimary, textDecorationLine: 'underline' },
  scrim: { flex: 1, backgroundColor: withAlpha(af.canvas, 0.6) },
  sheet: {
    backgroundColor: af.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: af.border, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34, gap: 14,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: af.surfacePressed, marginBottom: 6 },
  sheetTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 24, lineHeight: 27, letterSpacing: -0.48, color: af.textPrimary },
  sheetBody: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, color: af.textSecondary },
  btnSolo: { minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  btn: { flex: 1, minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primary: { backgroundColor: af.primaryFill },
  primaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.onPrimaryFill },
  ghost: { borderWidth: 1, borderColor: af.border },
  ghostLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  pressed: { opacity: 0.72 },
  recentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  recentRuled: { borderBottomWidth: 1, borderBottomColor: af.divider },
  recentText: { flexShrink: 1, gap: 2 },
  recentTitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  recentAmount: { fontFamily: 'Inter_400Regular', fontSize: 14, color: af.textPrimary, fontVariant: ['tabular-nums'] },
});
