/**
 * HydrationScreenV2 — the Phase 2 · S5 Hydration redesign (spec §8.2), rendered
 * when `spec_hydration` is on. A live hydration dashboard (vs. the legacy
 * Performance Timeline): intake ring → water/target + electrolytes + recovery →
 * Scan a drink / Log manually → recent intake → a 7-day strip.
 *
 * Same store data as everywhere else; logging goes through the sanctioned
 * `logIntake` action (no scoring change). The legacy Performance Timeline is
 * PRESERVED behind the flag-off path (founder ruling: relocate, never delete).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

import {
  AFScreen,
  AFTopBar,
  AFCard,
  AFProgressRing,
  AFPrimaryButton,
  AFSecondaryButton,
  AFSectionLabel,
  AFListRow,
  AFStatusBadge,
  AFEmptyState,
} from '@/components/ui';
import { af, afType } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { useEngineSlice, useActionsSlice } from '@/store/slices';
import { formatTimeAgo } from '@/data/mockData';
import type { FluidType, IntakeEvent } from '@/types';

interface HydrationActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
}

const FLUID_LABEL: Record<FluidType, string> = {
  water: 'Water',
  aforce_stick: 'AForce Stick',
  aforce_rtd: 'AForce RTD',
  aforce_canister: 'AForce Canister',
  aforce_bulk_bag: 'AForce Bulk',
};

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function HydrationScreenV2() {
  const router = useRouter();
  const { state } = useAppStore();
  const engine = useEngineSlice();
  const { logIntake } = useActionsSlice<HydrationActions>();
  const { userState } = state;

  const pct =
    userState.ozTarget > 0
      ? Math.max(0, Math.min(1, userState.ozConsumedToday / userState.ozTarget))
      : 0;
  const recent: IntakeEvent[] = (userState.intakeEvents ?? []).slice(0, 5);
  const streak = Math.max(0, Math.min(7, userState.complianceStreak));
  const todayIdx = new Date(userState.lastIntakeTime).getDay();

  return (
    <AFScreen scroll>
      <AFTopBar eyebrow="Today" title="Hydration" />

      {/* Intake ring + stats */}
      <AFCard variant="raised" style={styles.mainCard}>
        <View style={styles.ringRow}>
          <AFProgressRing progress={pct} size={110} stroke={9}>
            <Text style={styles.ringPct}>{Math.round(pct * 100)}%</Text>
          </AFProgressRing>
          <View style={styles.stats}>
            <Stat label="Water logged" value={`${Math.round(userState.ozConsumedToday)} of ${userState.ozTarget} oz`} />
            <Stat label="Electrolytes" value={`${userState.aforceUnitsToday} servings`} />
            <View style={styles.recoveryRow}>
              <Text style={styles.statLabel}>RECOVERY</Text>
              <AFStatusBadge
                label={titleCase(engine.performanceState.level)}
                tone={engine.performanceState.level === 'DEPLETED' ? 'critical' : 'neutral'}
                icon={null}
              />
            </View>
          </View>
        </View>
      </AFCard>

      {/* Actions */}
      <View style={styles.actions}>
        <AFPrimaryButton label="Scan a drink" icon="camera" onPress={() => router.push('/scan')} />
        <AFSecondaryButton label="Log manually" onPress={() => void logIntake('water')} />
      </View>

      {/* Recent intake */}
      <View style={styles.section}>
        <AFSectionLabel label="Recent intake" />
        {recent.length === 0 ? (
          <AFCard>
            <AFEmptyState
              icon="droplet"
              title="Nothing logged yet"
              message="Scan or log a drink to start today's intake."
            />
          </AFCard>
        ) : (
          <AFCard padded={false} style={styles.recentCard}>
            {recent.map((e, i) => (
              <AFListRow
                key={e.id}
                icon={e.fluidType === 'water' ? 'droplet' : 'zap'}
                title={FLUID_LABEL[e.fluidType] ?? 'Drink'}
                subtitle={formatTimeAgo(e.loggedAt)}
                value={`${Math.round(e.oz)} oz`}
              />
            ))}
          </AFCard>
        )}
      </View>

      {/* 7-day strip (streak, honest) */}
      <View style={styles.section}>
        <AFSectionLabel label="This week" />
        <View style={styles.strip}>
          {DAYS.map((d, i) => {
            // Fill the most recent `streak` days up to and including today.
            const daysBack = (todayIdx - i + 7) % 7;
            const filled = daysBack < streak;
            const isToday = i === todayIdx;
            return (
              <View key={i} style={styles.dayCol}>
                <View
                  style={[
                    styles.dayDot,
                    filled && styles.dayDotFilled,
                    isToday && styles.dayDotToday,
                  ]}
                />
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{d}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </AFScreen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function titleCase(level: string): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  mainCard: { marginTop: 20 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringPct: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  stats: { flex: 1, gap: 12 },
  stat: { gap: 2 },
  statLabel: { ...afType.eyebrow, color: af.textTertiary },
  statValue: { ...afType.bodyStrong, color: af.textPrimary },
  recoveryRow: { gap: 4, alignItems: 'flex-start' },
  actions: { marginTop: 20, gap: 12 },
  section: { marginTop: 28, gap: 12 },
  recentCard: { paddingHorizontal: 16 },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 8, flex: 1 },
  dayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: 'transparent',
  },
  dayDotFilled: { backgroundColor: af.red, borderColor: af.red },
  dayDotToday: { borderColor: af.textPrimary },
  dayLabel: { ...afType.caption, color: af.textTertiary },
  dayLabelToday: { color: af.textPrimary },
});
