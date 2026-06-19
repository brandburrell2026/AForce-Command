/**
 * PerformanceAgeZone — the single store seam for the Performance Age™ card
 * on Home.
 *
 * Responsibilities (and only these):
 *   • Feature-flag gate — renders nothing unless `performance_age_enabled`
 *     is on, so the card is purely additive / hideable (Build 100% · Show
 *     10%). It ships OFF in the production binary like Metabolic Readiness.
 *   • Data — `usePerformanceAge()` (read-only projection of the hydration +
 *     recovery engines and the analytics layer). This surface never awards
 *     or mutates score.
 *
 * Unlike Metabolic Readiness there is NO entitlement gate: Performance Age
 * is the primary consumer headline metric, so once the flag is lit it is
 * available to every member. All rendering lives in the pure
 * PerformanceAgeCard.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useFlagsSlice } from '@/store/slices';
import { usePerformanceAge } from '@/hooks/usePerformanceAge';

import { PerformanceAgeCard } from './PerformanceAgeCard';

function PerformanceAgeZoneInner() {
  const router = useRouter();
  const snapshot = usePerformanceAge();

  return (
    <View style={styles.wrap}>
      <PerformanceAgeCard
        result={snapshot.result}
        weeklyTrend={snapshot.weeklyTrend}
        monthlyTrend={snapshot.monthlyTrend}
        onAddProfile={() => router.push('/profile')}
      />
    </View>
  );
}

export function PerformanceAgeZone() {
  const flags = useFlagsSlice();
  if (!flags.performance_age_enabled) return null;
  return <PerformanceAgeZoneInner />;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
});
