/**
 * Protocol — AForce Protocol screen.
 * Shows: active protocol stage, steps, weekly compliance, command history timeline.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { GradientBackground } from '@/components/GradientBackground';
import { useAppStore } from '@/store/useAppStore';
import { Colors, getStateColors } from '@/theme/colors';
import { formatTimeAgo } from '@/data/mockData';
import type { HistoryEntry } from '@/types';
import { fetchProtocol, ProtocolPayload } from '@/services/mockApi';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export default function ProtocolScreen() {
  const { state } = useAppStore();
  const { history, engineOutput, userState } = state;
  const insets = useSafeAreaInsets();
  const [protocol, setProtocol] = useState<ProtocolPayload | null>(null);
  const layout = useResponsiveLayout();

  useEffect(() => {
    let active = true;
    fetchProtocol(userState).then((p) => { if (active) setProtocol(p); });
    return () => { active = false; };
  }, [userState, engineOutput.score]);

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
              <Text style={styles.eyebrow}>PROTOCOL</Text>
              <Text style={styles.title}>AForce Protocol</Text>

              {/* Current stage */}
              {protocol ? (
                <View style={[styles.stageCard, { borderColor: `${stateColor}33` }]}>
                  <View style={styles.stageHeader}>
                    <Text style={[styles.stageLabel, { color: stateColor }]}>STAGE</Text>
                    <View style={[styles.stagePill, { backgroundColor: `${stateColor}1A`, borderColor: `${stateColor}55` }]}>
                      <Text style={[styles.stagePillText, { color: stateColor }]}>ACTIVE</Text>
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
                          {step.complete && <Feather name="check" size={10} color="#000" />}
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
                      <Text style={styles.footerLabel}>NEXT RECHECK</Text>
                      <Text style={[styles.footerValue, { color: stateColor }]}>
                        {protocol.nextRecheckMinutes} min
                      </Text>
                    </View>
                    <View style={styles.footerSep} />
                    <View style={styles.footerCol}>
                      <Text style={styles.footerLabel}>WEEKLY COMPLIANCE</Text>
                      <Text style={[styles.footerValue, { color: Colors.states.PEAK.primary }]}>
                        {protocol.weeklyCompliancePct}%
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.loading}>
                  <ActivityIndicator color={stateColor} />
                </View>
              )}

              <View style={styles.summaryRow}>
                <SummaryCard label="TARGET" value={`${userState.dailyTarget} units`} color={stateColor} />
                <SummaryCard label="COMPLETED" value={`${userState.unitsConsumedToday} units`} color={stateColor} />
                <SummaryCard label="STREAK" value={`${userState.complianceStreak}d`} color={Colors.states.PEAK.primary} />
              </View>

              <Text style={styles.sectionTitle}>COMMAND HISTORY</Text>
            </View>
          }
          renderItem={({ item }) => <HistoryRow entry={item} />}
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

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const stateColors = getStateColors(entry.state);
  const color = stateColors.primary;
  return (
    <View style={styles.historyRow}>
      <View style={styles.timelineColumn}>
        <View style={[styles.timelineDot, { backgroundColor: color, borderColor: `${color}55` }]} />
        <View style={[styles.timelineLine, { backgroundColor: Colors.border.subtle }]} />
      </View>
      <View style={[styles.historyCard, { borderColor: Colors.border.subtle }]}>
        <View style={styles.historyCardHeader}>
          <View style={[styles.historyStateBadge, { backgroundColor: `${color}1A`, borderColor: `${color}44` }]}>
            <Text style={[styles.historyState, { color }]}>{entry.state}</Text>
          </View>
          <View style={styles.historyMeta}>
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
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 3, marginBottom: 4, marginTop: 8,
  },
  title: {
    fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.text.primary,
    letterSpacing: -0.5, marginBottom: 18,
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
    fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.5,
  },
  stagePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1,
  },
  stagePillText: {
    fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5,
  },
  stageName: {
    fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary,
    letterSpacing: -0.4, marginBottom: 6,
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
    fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 1.5, marginBottom: 4,
  },
  footerValue: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  loading: { paddingVertical: 40, alignItems: 'center', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.background.card, borderRadius: 12,
    borderWidth: 1, padding: 14, alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 1.5, marginBottom: 6,
  },
  summaryValue: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  sectionTitle: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 2.5, marginBottom: 12,
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
  historyState: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyScore: { fontSize: 15, fontFamily: 'Inter_700Bold', color: Colors.text.primary },
  historyTime: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted },
  historyAction: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text.secondary, lineHeight: 18,
  },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text.muted, textAlign: 'center' },
});
