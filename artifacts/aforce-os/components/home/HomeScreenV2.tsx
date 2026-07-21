/**
 * HomeScreenV2 — the Phase 2 · S3 Home redesign (spec §8.2), rendered only when
 * `spec_home` is on. The spec's reduced hierarchy: wordmark + freshness →
 * dominant readiness value with a thin arc → one "Your next move" command card →
 * three quiet signal metrics. One score, one command, one CTA.
 *
 * Same live engine data as the legacy Home (score, command, signals) — no
 * scoring change (statusColor/scoringEngine untouched). Tapping the arc opens
 * the existing score-breakdown ("insights") drill-in; the richer detail zones
 * from the legacy Home are PRESERVED there and in the legacy screen (founder
 * ruling: relocate, never delete) and fold into S4 Readiness Insights.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useUser } from '@clerk/expo';

import {
  AFScreen,
  AFReadinessArc,
  AFCommandCard,
  AFSectionLabel,
} from '@/components/ui';
import { af, afType } from '@/theme';
import { ScoreBreakdownSheet } from '@/components/ScoreBreakdownSheet';
import { useAppStore } from '@/store/useAppStore';
import { useEngineSlice, useActionsSlice } from '@/store/slices';
import { parseEngineActionCopy } from '@/utils/recovery/recoveryCommandFromStore';
import type { FluidType } from '@/types';

interface HomeActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
}

function heatLabel(heatLoad: number): string {
  if (heatLoad >= 60) return 'High';
  if (heatLoad >= 30) return 'Moderate';
  return 'Low';
}

function titleCase(level: string): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

/** Compact signal tile — fixed-width column so word values never collide. */
function Signal({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.signal}>
      <Text style={styles.signalLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.signalValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export function HomeScreenV2() {
  const { state } = useAppStore();
  const engine = useEngineSlice();
  const { logIntake } = useActionsSlice<HomeActions>();
  const clerkUser = useUser().user;
  const [breakdownOpen, setBreakdownOpen] = React.useState(false);

  const { userState } = state;
  const score = Math.max(0, Math.min(100, Math.round(engine.score)));
  const { title, instruction } = parseEngineActionCopy(engine.command.action);
  const hydrationPct =
    userState.dailyTarget > 0
      ? Math.round((userState.unitsConsumedToday / userState.dailyTarget) * 100)
      : 0;
  const greeting = clerkUser?.firstName ?? 'there';

  return (
    <AFScreen scroll>
      {/* Wordmark + freshness */}
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome, {greeting}</Text>
        <Text style={styles.brand}>AForce OS</Text>
        <Text style={styles.freshness}>Updated just now</Text>
      </View>

      {/* Dominant readiness value + thin arc (tap → insights) */}
      <Pressable
        style={styles.arcWrap}
        onPress={() => setBreakdownOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Readiness ${score} of 100. Tap for insights.`}
        testID="home-readiness-arc"
      >
        <AFReadinessArc score={score} size={240}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.scoreLabel}>READINESS</Text>
          <Text style={styles.stateLabel}>{engine.performanceState.level}</Text>
        </AFReadinessArc>
      </Pressable>

      {/* One command */}
      <AFCommandCard
        title={title || 'Start with water'}
        instruction={instruction}
        primaryLabel="Log water"
        onPrimary={() => {
          void logIntake('water', { silent: true });
        }}
        rationale={engine.command.explanation || undefined}
      />

      {/* Three quiet signals */}
      <View style={styles.signalsSection}>
        <AFSectionLabel label="Signals" />
        <View style={styles.signals}>
          <Signal label="Hydration" value={`${hydrationPct}%`} />
          <Signal label="Heat" value={heatLabel(userState.heatLoad)} />
          <Signal label="Recovery" value={titleCase(engine.performanceState.level)} />
        </View>
      </View>

      <View style={{ height: 40 }} />

      <ScoreBreakdownSheet
        visible={breakdownOpen}
        onDismiss={() => setBreakdownOpen(false)}
        score={score}
        contributions={engine.breakdown}
        performanceState={engine.performanceState}
      />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 8, marginBottom: 8 },
  welcome: { ...afType.secondary, color: af.textTertiary },
  brand: { ...afType.title1, color: af.textPrimary },
  freshness: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  arcWrap: { alignItems: 'center', marginVertical: 24 },
  score: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  scoreLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  stateLabel: { ...afType.caption, color: af.red, marginTop: 6 },
  signalsSection: { marginTop: 28, gap: 12 },
  signals: { flexDirection: 'row', gap: 12 },
  signal: {
    flex: 1,
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
  },
  signalLabel: { ...afType.eyebrow, color: af.textTertiary },
  signalValue: { ...afType.title3, color: af.textPrimary },
});
