/**
 * Protocol — AForce Protocol screen.
 * Shows: active protocol stage, steps, weekly compliance, command history timeline.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';

import { GradientBackground } from '@/components/GradientBackground';
import { useAppStore } from '@/store/useAppStore';
import { Colors, getStateColors } from '@/theme/colors';
import { formatTimeAgo } from '@/data/mockData';
import type { HistoryEntry } from '@/types';
import { deriveProtocol } from '@/services/mockApi';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { WEB_TOP_PADDING, WEB_BOTTOM_PADDING, TAB_BAR_HEIGHT } from '@/constants/layout';

export default function ProtocolScreen() {
  const { state } = useAppStore();
  const { history, engineOutput, userState } = state;
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  // Derive the active protocol synchronously from live store state so
  // the Depletion Correction stage flips the moment the engine score
  // crosses a threshold (no async fetch, no useEffect race, no loading
  // flash on tab switch). `deriveProtocol` reads several fields from
  // both `userState` and `engineOutput`, so depend on the full objects
  // — cherry-picking deps is brittle and skips legitimate updates if
  // the function ever starts reading another field.
  const protocol = useMemo(
    () => deriveProtocol(userState, engineOutput),
    [userState, engineOutput],
  );

  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT;
  const stateColor = engineOutput.performanceState.color;

  // Recovery momentum — compares the two most recent history scores so
  // the section header can quietly surface whether the user is trending
  // up, holding steady, or sliding. Drives the small label next to
  // "Command history" and feeds future intelligence widgets.
  const historyTrendLabel = useMemo(() => {
    if (history.length < 2) return 'Awaiting signal';
    const latest = history[0]?.score ?? 0;
    const prior = history[1]?.score ?? 0;
    const delta = latest - prior;
    if (delta > 1) return 'Recovery trending upward';
    if (delta < -1) return 'Hydration softening';
    return 'Hydration stable';
  }, [history]);

  return (
    <View style={styles.root}>
      <GradientBackground>
        <FlatList<HistoryEntry>
          // Force a remount when the column count changes — FlatList
          // can't safely transition between numColumns values without
          // a fresh key.
          key={layout.isWide ? 'history-2col' : 'history-1col'}
          data={history}
          keyExtractor={(item) => item.id}
          numColumns={layout.isWide ? 2 : 1}
          columnWrapperStyle={layout.isWide ? styles.historyColumnWrapper : undefined}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: topPadding + 8,
              paddingBottom: bottomPadding + 16,
              ...(layout.isWide
                ? { maxWidth: layout.contentMaxWidth, alignSelf: 'center', width: '100%' }
                : null),
            },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.eyebrow}>Protocol</Text>
              <Text style={styles.title}>AForce Protocol</Text>

              {/* Current stage — derived synchronously from engineOutput
                  so it updates in real time on every score change. */}
              <View style={[styles.stageCard, { borderColor: `${stateColor}33` }]}>
                <View style={styles.stageHeader}>
                  <Text style={[styles.stageLabel, { color: stateColor }]}>Stage</Text>
                  <View style={[styles.stagePill, { backgroundColor: `${stateColor}14`, borderColor: `${stateColor}40` }]}>
                    <Text style={[styles.stagePillText, { color: stateColor }]}>Active</Text>
                  </View>
                </View>
                <Text style={styles.stageName}>{protocol.stage}</Text>
                <Text style={styles.stageDesc}>{protocol.description}</Text>

                {/* Steps */}
                <View style={styles.stepsList}>
                  {protocol.steps.map((step) => (
                    <View key={step.id} style={styles.stepRow}>
                      <View style={[
                        styles.stepDot,
                        { backgroundColor: step.complete ? stateColor : 'transparent', borderColor: stateColor },
                      ]}>
                        {step.complete && <Icon name="check" size={10} color="#000" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stepLabel, step.complete && styles.stepLabelDone]}>{step.label}</Text>
                        <Text style={styles.stepWindow}>{step.window}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={[styles.stageFooter, { borderTopColor: Colors.border.subtle }]}>
                  <View style={styles.footerCol}>
                    <Text style={styles.footerLabel}>Next recheck</Text>
                    <Text style={[styles.footerValue, { color: stateColor }]}>
                      {protocol.nextRecheckMinutes} min
                    </Text>
                  </View>
                  <View style={styles.footerSep} />
                  <View style={styles.footerCol}>
                    <Text style={styles.footerLabel}>Recovery consistency</Text>
                    <Text style={[styles.footerValue, { color: Colors.states.PEAK.primary }]}>
                      {protocol.weeklyCompliancePct}%
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <SummaryCard label="Hydration goal" value={`${userState.dailyTarget}/${userState.dailyTarget} units`} color={stateColor} />
                <SummaryCard label="Recovery completed" value={`${userState.unitsConsumedToday}/${userState.dailyTarget} units`} color={stateColor} />
                <SummaryCard label="Streak" value={`${userState.complianceStreak}d`} color={Colors.states.PEAK.primary} />
              </View>

              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Command history</Text>
                <Text style={styles.sectionTrend}>{historyTrendLabel}</Text>
              </View>
            </View>
          }
          renderItem={({ item, index }) => {
            const prev = history[index + 1];
            const delta = prev ? item.score - prev.score : null;
            return (
              <View style={layout.isWide ? styles.historyCellWide : undefined}>
                <HistoryRow entry={item} delta={delta} />
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="clock" size={32} color={Colors.text.muted} />
              <Text style={styles.emptyText}>Recovery log is empty. Complete your first cycle to begin tracking.</Text>
            </View>
          }
        />
      </GradientBackground>
    </View>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.summaryCard, { borderColor: `${color}22` }]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function HistoryRow({ entry, delta }: { entry: HistoryEntry; delta: number | null }) {
  const stateColors = getStateColors(entry.state);
  const color = stateColors.primary;
  // Recovery direction chip — only render when we have a previous entry
  // to compare against and the score actually moved.
  const trend =
    delta == null || delta === 0
      ? null
      : delta > 0
        ? { icon: 'trending-up' as const, color: Colors.states.PEAK.primary, sign: '+' }
        : { icon: 'trending-down' as const, color: Colors.states.RECOVERING.primary, sign: '' };
  return (
    <View style={styles.historyRow}>
      <View style={styles.timelineColumn}>
        <View style={[styles.timelineDot, { backgroundColor: color, borderColor: `${color}55` }]} />
        <View style={[styles.timelineLine, { backgroundColor: Colors.border.subtle }]} />
      </View>
      <View style={[styles.historyCard, { borderColor: Colors.border.subtle }]}>
        <View style={styles.historyCardHeader}>
          <View style={[styles.historyStateBadge, { backgroundColor: `${color}14`, borderColor: `${color}33` }]}>
            <Text style={[styles.historyState, { color }]}>{entry.state}</Text>
          </View>
          <View style={styles.historyMeta}>
            {trend && (
              <View style={[styles.trendChip, { borderColor: `${trend.color}40` }]}>
                <Icon name={trend.icon} size={11} color={trend.color} />
                <Text style={[styles.trendText, { color: trend.color }]}>
                  {trend.sign}{delta}
                </Text>
              </View>
            )}
            <Text style={styles.historyScore}>{entry.score}</Text>
            <Text style={styles.historyTime}>{formatTimeAgo(entry.timestamp)}</Text>
          </View>
        </View>
        <Text style={styles.historyAction} numberOfLines={2}>{entry.action}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20 },
  header: { marginBottom: 8 },
  eyebrow: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.muted,
    letterSpacing: 0.2, marginBottom: 6, marginTop: 8,
  },
  title: {
    fontSize: 28, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary,
    letterSpacing: -0.5, marginBottom: 20,
  },
  stageCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  stageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6,
  },
  stageLabel: {
    fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.2,
  },
  stagePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1,
  },
  stagePillText: {
    fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.2,
  },
  stageName: {
    fontSize: 22, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary,
    letterSpacing: -0.4, marginBottom: 8,
  },
  stageDesc: {
    fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text.secondary,
    lineHeight: 18, marginBottom: 14,
  },
  stepsList: { gap: 10, marginBottom: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text.primary,
  },
  stepLabelDone: { color: Colors.text.secondary, textDecorationLine: 'line-through' },
  stepWindow: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted,
  },
  stageFooter: {
    flexDirection: 'row',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  footerCol: { flex: 1 },
  footerSep: { width: 1, backgroundColor: Colors.border.subtle, marginHorizontal: 8 },
  footerLabel: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted,
    letterSpacing: 0.2, marginBottom: 4,
  },
  footerValue: { fontSize: 16, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.background.card, borderRadius: 12,
    borderWidth: 1, padding: 14, alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted,
    letterSpacing: 0.1, marginBottom: 6, textAlign: 'center',
  },
  summaryValue: { fontSize: 15, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.muted,
    letterSpacing: 0.2,
  },
  sectionTrend: {
    fontSize: 11, fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary, letterSpacing: 0.1,
  },
  historyRow: { flexDirection: 'row', gap: 14, marginBottom: 2 },
  timelineColumn: { alignItems: 'center', width: 16, paddingTop: 16 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, zIndex: 1 },
  timelineLine: { flex: 1, width: 1, marginTop: 4, minHeight: 32 },
  historyCard: {
    flex: 1, backgroundColor: Colors.background.card, borderRadius: 14,
    borderWidth: 1, padding: 14, marginBottom: 8,
  },
  historyCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  historyStateBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100, borderWidth: 1,
  },
  historyState: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.2 },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyScore: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary, letterSpacing: -0.2 },
  historyTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted },
  trendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 100, borderWidth: StyleSheet.hairlineWidth,
  },
  trendText: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: -0.1 },
  historyAction: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text.secondary, lineHeight: 18,
  },
  // Two-column history grid — used only on Fold-open / tablet via
  // FlatList numColumns=2. Each cell takes half the available width
  // (minus the gap) so the timeline rows still get their column +
  // card the same way as on a phone.
  historyColumnWrapper: {
    gap: 12,
  },
  historyCellWide: {
    flex: 1,
  },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text.muted, textAlign: 'center' },
});
