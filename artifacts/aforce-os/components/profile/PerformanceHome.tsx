/**
 * PerformanceHome — the Performance section of Profile, laid out as the
 * approved prototype: the status line, then one short card of links.
 *
 * Every block that used to sit on the section still exists; each row opens
 * the view that holds it, unchanged (`PERFORMANCE_VIEW_BLOCKS`).
 *
 * Not drawn: the prototype's "Your Moments" strip. The gallery behind it is
 * not built, so the screen does not promise one. "Modes and checks" is not in
 * the prototype; it stays so its tools remain reachable.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { af } from '@/theme';
import { useMomentsData } from '@/components/moments/useMomentsData';
import { homeStatusLine } from '@/components/home/cinematic/homeCinematicLogic';

export type PerformanceViewId = 'remembers' | 'tools';

/** The blocks each view holds, by the names they are declared under. */
export const PERFORMANCE_VIEW_BLOCKS: Record<PerformanceViewId, readonly string[]> = {
  remembers: ['performanceProfileBlock'],
  tools: ['protocolToolsCard'],
};

export const PERFORMANCE_VIEW_TITLE: Record<PerformanceViewId, string> = {
  remembers: 'What AFORCE remembers',
  tools: 'Modes and checks',
};

interface RowProps {
  title: string;
  sub: string;
  onPress: () => void;
  testID: string;
  last?: boolean;
}

function Row({ title, sub, onPress, testID, last }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => [styles.row, !last && styles.ruled, pressed && styles.pressed]}
      testID={testID}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={af.textTertiary} />
    </Pressable>
  );
}

export interface PerformanceHomeProps {
  onOpen: (view: PerformanceViewId) => void;
  /** Opens the science page. */
  onOpenHow: () => void;
}

export function PerformanceHome({ onOpen, onOpenHow }: PerformanceHomeProps) {
  const moments = useMomentsData();
  const statusLine = homeStatusLine(
    moments.hydrated ? moments.surfaced : [],
    moments.hydrated ? moments.next ?? null : null,
  );
  return (
    <View testID="profile-performance-home">
      {statusLine ? (
        <View style={styles.statusLine}>
          <View style={styles.statusLeft}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{statusLine.left.toUpperCase()}</Text>
          </View>
          <Text style={[styles.statusText, styles.statusRight]}>{statusLine.right.toUpperCase()}</Text>
        </View>
      ) : null}
      <Text style={styles.note}>Private. No counts, no streaks.</Text>
      <View style={styles.card}>
        <Row
          title="What AFORCE remembers"
          sub="Your target, body weight and wake time"
          onPress={() => onOpen('remembers')}
          testID="performance-row-remembers"
        />
        <Row title="How AFORCE works" sub="Read it" onPress={onOpenHow} testID="performance-row-how" />
        <Row
          title="Modes and checks"
          sub="Reports, sensors and tools"
          onPress={() => onOpen('tools')}
          testID="performance-row-tools"
          last
        />
      </View>
    </View>
  );
}

/** "‹ Performance" and the view's name, above the blocks of an opened view. */
export function PerformanceViewHeader({ view, onBack }: { view: PerformanceViewId; onBack: () => void }) {
  return (
    <View style={styles.viewHeader}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to Performance"
        hitSlop={8}
        style={styles.back}
        testID="performance-view-back"
      >
        <Icon name="chevron-left" size={18} color={af.textPrimary} />
        <Text style={styles.backText}>Performance</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.viewTitle}>{PERFORMANCE_VIEW_TITLE[view].toUpperCase()}</Text>
    </View>
  );
}

const MONO = 'IBMPlexMono_400Regular';

const styles = StyleSheet.create({
  statusLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: af.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: af.textTertiary },
  statusText: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.5, color: af.textSecondary },
  statusRight: { color: af.textPrimary },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary, marginBottom: 18 },
  card: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20, paddingHorizontal: 18, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 12 },
  ruled: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: af.divider },
  pressed: { opacity: 0.72 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 17, color: af.textSecondary },
  viewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  viewTitle: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
});
