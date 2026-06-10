/**
 * HomeDashboard — composes the redesigned Home command surfaces below
 * the Readiness orb:
 *   Daily Ritual · Hydration Status · Today's Protocol · Streak ·
 *   Athlete Mode · Membership.
 *
 * This is the single seam between the live store and the (otherwise
 * pure / presentational) home cards. Every value handed down is a
 * read-only projection of behaviour the user already produced — the
 * derivations live in utils/homeDashboard and never award score or
 * fabricate progress (Score-Protection contract).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useEngineSlice, useUserSlice, useIntakeSlice } from '@/store/slices';
import { useAppStore } from '@/store/useAppStore';
import { buildSnapshot } from '@/services/competitionEngine';
import { PLAN_BY_ID, SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';
import {
  deriveRitualSteps,
  deriveTodaysProtocol,
  deriveAthleteMode,
  hydrationPercent,
  type PerformanceLevel,
} from '@/utils/homeDashboard';

import { RitualRail } from './RitualRail';
import { HydrationStatusCard } from './HydrationStatusCard';
import { TodaysProtocol } from './TodaysProtocol';
import { StreakCard } from './StreakCard';
import { AthleteModeCard } from './AthleteModeCard';
import { MembershipCard } from './MembershipCard';

const RECOVERY_LABEL: Record<PerformanceLevel, string> = {
  PEAK: 'Optimal',
  BALANCED: 'Steady',
  RECOVERING: 'Rebuilding',
  DEPLETED: 'Needed',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  canceled: 'Inactive',
  paused: 'Paused',
};

// Tier ladder order is the catalog order (core → … → elite).
const PLAN_ORDER = SUBSCRIPTION_PLANS.map((p) => p.id);

export function HomeDashboard() {
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const intake = useIntakeSlice();
  const { state } = useAppStore();

  const units = Math.max(0, Math.round(userState.unitsConsumedToday ?? 0));
  const target = Math.max(1, Math.round(userState.dailyTarget ?? 8));
  const level = engine.performanceState.level as PerformanceLevel;
  const streak = Math.max(0, userState.complianceStreak ?? 0);

  const ritual = React.useMemo(
    () =>
      deriveRitualSteps({
        unitsConsumedToday: units,
        dailyTarget: target,
        performanceLevel: level,
      }),
    [units, target, level],
  );

  const protocol = React.useMemo(
    () => deriveTodaysProtocol({ unitsConsumedToday: units, dailyTarget: target }),
    [units, target],
  );

  const athlete = React.useMemo(() => deriveAthleteMode(streak), [streak]);
  const pct = hydrationPercent(units, target);

  // Electrolyte servings logged in the live 24h window (AForce sticks /
  // cans / RTDs). Pure count of real intake events — never inflated.
  const electrolyteUnits = React.useMemo(() => {
    const events = intake.recentEvents ?? [];
    return events.filter(
      (e) => typeof e.fluidType === 'string' && e.fluidType.startsWith('aforce'),
    ).length;
  }, [intake.recentEvents]);

  // Real community rank — same synchronous competition snapshot the
  // Community tab uses, so the number is consistent across surfaces.
  const snapshot = React.useMemo(
    () =>
      buildSnapshot({
        liveUserScore: engine.score,
        liveCompliance: Math.min(1, units / target),
        liveConsistency: Math.min(100, streak * 12),
        liveStateLabel: level,
      }),
    [engine.score, units, target, streak, level],
  );
  const communityRank = snapshot.context?.globalRank ?? null;

  const planId = state.subscription.planId;
  const planName = PLAN_BY_ID[planId]?.name ?? 'Core';
  const statusLabel = STATUS_LABEL[state.subscription.status] ?? 'Inactive';
  const tierIndex = Math.max(0, PLAN_ORDER.indexOf(planId));

  return (
    <View style={styles.wrap}>
      <RitualRail steps={ritual} />
      <HydrationStatusCard
        percent={pct}
        water={`${units} / ${target}`}
        electrolytes={String(electrolyteUnits)}
        recovery={RECOVERY_LABEL[level] ?? 'Steady'}
      />
      <TodaysProtocol blocks={protocol} />
      <StreakCard streakDays={streak} />
      <AthleteModeCard mode={athlete} />
      <MembershipCard
        planName={planName}
        statusLabel={statusLabel}
        tierIndex={tierIndex}
        tierCount={PLAN_ORDER.length}
        communityRank={communityRank}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28 },
});
