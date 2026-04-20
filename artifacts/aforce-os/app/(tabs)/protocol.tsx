/**
 * Protocol Screen — Timeline of unit actions, state history, and streaks.
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { GradientBackground } from '@/components/GradientBackground';
import { useAppStore } from '@/store/useAppStore';
import { Colors, getStateColors } from '@/theme/colors';
import { formatTimeAgo, formatTime } from '@/data/mockData';
import type { HistoryEntry } from '@/types';

export default function ProtocolScreen() {
  const { state } = useAppStore();
  const { history, engineOutput, userState } = state;
  const insets = useSafeAreaInsets();

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84;

  const stateColor = engineOutput.performanceState.color;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <FlatList<HistoryEntry>
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              {/* Screen title */}
              <Text style={styles.eyebrow}>PROTOCOL</Text>
              <Text style={styles.title}>Today's Log</Text>

              {/* Summary cards */}
              <View style={styles.summaryRow}>
                <SummaryCard
                  label="TARGET"
                  value={`${userState.dailyTarget} units`}
                  color={stateColor}
                />
                <SummaryCard
                  label="COMPLETED"
                  value={`${userState.unitsConsumedToday} units`}
                  color={stateColor}
                />
                <SummaryCard
                  label="STREAK"
                  value={`${userState.complianceStreak}d`}
                  color={Colors.states.PEAK.primary}
                />
              </View>

              {/* Current state chip */}
              <View style={[styles.stateChip, { backgroundColor: `${stateColor}15`, borderColor: `${stateColor}33` }]}>
                <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
                <Text style={[styles.stateChipText, { color: stateColor }]}>
                  Currently {engineOutput.performanceState.level} — Score {engineOutput.score}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>COMMAND HISTORY</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <HistoryRow entry={item} isFirst={index === 0} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="clock" size={32} color={Colors.text.muted} />
              <Text style={styles.emptyText}>No history yet. Complete your first cycle.</Text>
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

function HistoryRow({ entry, isFirst }: { entry: HistoryEntry; isFirst: boolean }) {
  const stateColors = getStateColors(entry.state);
  const color = stateColors.primary;

  return (
    <View style={styles.historyRow}>
      {/* Timeline line */}
      <View style={styles.timelineColumn}>
        <View style={[styles.timelineDot, { backgroundColor: color, borderColor: `${color}44` }]} />
        <View style={[styles.timelineLine, { backgroundColor: Colors.border.subtle }]} />
      </View>

      {/* Content */}
      <View style={[styles.historyCard, { borderColor: Colors.border.subtle }]}>
        <View style={styles.historyCardHeader}>
          <View style={[styles.historyStateBadge, { backgroundColor: `${color}15`, borderColor: `${color}33` }]}>
            <Text style={[styles.historyState, { color }]}>{entry.state}</Text>
          </View>
          <View style={styles.historyMeta}>
            <Text style={styles.historyScore}>{entry.score}</Text>
            <Text style={styles.historyTime}>{formatTimeAgo(entry.timestamp)}</Text>
          </View>
        </View>
        <Text style={styles.historyAction} numberOfLines={2}>{entry.action}</Text>
        <Text style={styles.historyUnits}>
          <Feather name="droplet" size={10} color={Colors.text.muted} /> {entry.unitsTaken} unit{entry.unitsTaken > 1 ? 's' : ''} taken
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    paddingHorizontal: 20,
    gap: 0,
  },
  header: {
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 3,
    marginBottom: 4,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
  },
  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  stateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stateChipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 2,
  },
  timelineColumn: {
    alignItems: 'center',
    width: 16,
    paddingTop: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    zIndex: 1,
  },
  timelineLine: {
    flex: 1,
    width: 1,
    marginTop: 4,
    minHeight: 32,
  },
  historyCard: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyStateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  historyState: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyScore: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  historyTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
  historyAction: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  historyUnits: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
  empty: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    textAlign: 'center',
  },
});
