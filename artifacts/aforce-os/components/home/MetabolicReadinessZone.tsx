/**
 * MetabolicReadinessZone — the single store seam for the Athlete-tier
 * Metabolic Readiness card on Home.
 *
 * Responsibilities (and only these):
 *   • Feature-flag gate — renders nothing unless `metabolic_readiness_enabled`
 *     is on, so the card is purely additive / hideable.
 *   • Entitlement check — `hasFeature(subscription, 'metabolic_readiness')`
 *     decides live-vs-locked. Non-entitled taps route to the Athlete plan.
 *   • Data — `useMetabolicReadiness()` (read-only projection of the hydration
 *     + recovery engines). This surface never awards or mutates score.
 *
 * All rendering lives in the pure MetabolicReadinessCard.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useFlagsSlice, useSubscriptionSlice } from '@/store/slices';
import { useMetabolicReadiness } from '@/hooks/useMetabolicReadiness';
import { hasFeature } from '@/featureFlags/subscriptionGate';

import { MetabolicReadinessCard } from './MetabolicReadinessCard';

function MetabolicReadinessZoneInner() {
  const router = useRouter();
  const subscription = useSubscriptionSlice();
  const snapshot = useMetabolicReadiness();
  const entitled = hasFeature(subscription, 'metabolic_readiness');

  return (
    <View style={styles.wrap}>
      <MetabolicReadinessCard
        entitled={entitled}
        muscle={snapshot.muscleReadiness}
        cognitive={snapshot.cognitiveReadiness}
        onUpgrade={() =>
          router.push({ pathname: '/subscription', params: { planId: 'athlete' } })
        }
      />
    </View>
  );
}

export function MetabolicReadinessZone() {
  const flags = useFlagsSlice();
  if (!flags.metabolic_readiness_enabled) return null;
  return <MetabolicReadinessZoneInner />;
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
});
