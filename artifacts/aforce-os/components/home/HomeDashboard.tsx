/**
 * HomeDashboard — composes the Home command surface below the Readiness
 * orb. After the owner-approved trim this is just the Hydration Status
 * card; the Daily Ritual, Today's Protocol, Streak, Athlete Mode, and
 * Membership cards were removed from the home surface (their components
 * and derivations remain in the codebase, simply no longer rendered).
 *
 * This is the single seam between the live store and the (otherwise
 * pure / presentational) home card. Every value handed down is a
 * read-only projection of behaviour the user already produced — the
 * derivations live in utils/homeDashboard and never award score or
 * fabricate progress (Score-Protection contract).
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useEngineSlice, useUserSlice, useIntakeSlice } from '@/store/slices';
import { hydrationPercent, type PerformanceLevel } from '@/utils/homeDashboard';
import { useDisplayedAccent } from '@/hooks/useDisplayedAccent';
import { accentForScore } from '@/utils/scoreBand';

import { HydrationStatusCard } from './HydrationStatusCard';

const RECOVERY_LABEL: Record<PerformanceLevel, string> = {
  PEAK: 'Optimal',
  BALANCED: 'Steady',
  RECOVERING: 'Rebuilding',
  DEPLETED: 'Needed',
};

export function HomeDashboard() {
  const router = useRouter();
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const intake = useIntakeSlice();
  const displayedAccent = useDisplayedAccent();

  const units = Math.max(0, Math.round(userState.unitsConsumedToday ?? 0));
  const target = Math.max(1, Math.round(userState.dailyTarget ?? 8));
  const level = engine.performanceState.level as PerformanceLevel;

  const pct = hydrationPercent(units, target);

  // Reflect the SAME color the Readiness orb renders on the card's ring /
  // eyebrow / scan button. The orb tints from the displayed (tweened)
  // accent under DisplayedAccentProvider, so reading that here keeps the
  // card in lock-step with the orb's color as the score animates. Falls
  // back to the engine's instantaneous band accent if the provider is
  // ever absent.
  const scoreAccent = displayedAccent?.primary ?? accentForScore(engine.score).primary;

  // Electrolyte servings logged in the live 24h window (AForce sticks /
  // cans / RTDs). Pure count of real intake events — never inflated.
  const electrolyteUnits = React.useMemo(() => {
    const events = intake.recentEvents ?? [];
    return events.filter(
      (e) => typeof e.fluidType === 'string' && e.fluidType.startsWith('aforce'),
    ).length;
  }, [intake.recentEvents]);

  return (
    <View style={styles.wrap}>
      <HydrationStatusCard
        percent={pct}
        water={`${units} / ${target}`}
        electrolytes={String(electrolyteUnits)}
        recovery={RECOVERY_LABEL[level] ?? 'Steady'}
        accent={scoreAccent}
        onScan={() => router.push('/scan')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28 },
});
