/**
 * BiometricIntelligenceStack — three-card stack sitting under the
 * water-cycle/last-intake row on Home:
 *
 *   1. Sweat Loss        — projected fluid + sodium loss, efficiency
 *   2. Performance Forecast — predictive AI insight + trajectory
 *   3. Recovery Load     — accumulated strain + heat/env load
 *
 * All three derive from existing UserState + ScoreEngineOutput via
 * services/biometricIntelligence.ts — no fake data introduced.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BiometricCard } from './BiometricCard';
import {
  deriveSweatLoss,
  derivePerformanceForecast,
  deriveRecoveryLoad,
  type Trajectory,
  type StrainLevel,
} from '../../services/biometricIntelligence';
import { useEngineSlice, useUserSlice } from '../../store/slices';
import { Colors } from '../../theme/colors';
import { getHeatBandFromCelsius } from '../../utils/heatBand';

const TRAJECTORY_ARROW: Record<Trajectory, string> = {
  rising: '↑',
  stable: '→',
  declining: '↓',
};

const STRAIN_COLOR: Record<StrainLevel, string> = {
  low: Colors.states.PEAK.primary,
  moderate: Colors.states.BALANCED.primary,
  elevated: Colors.states.RECOVERING.primary,
  high: Colors.states.DEPLETED.primary,
};

const STRAIN_LABEL: Record<StrainLevel, string> = {
  low: 'Minimal load',
  moderate: 'Moderate load',
  elevated: 'Elevated strain',
  high: 'High strain',
};

function BiometricIntelligenceStackImpl() {
  const engine = useEngineSlice();
  const user = useUserSlice();

  const sweat = React.useMemo(() => deriveSweatLoss(user), [user]);
  const forecast = React.useMemo(
    () => derivePerformanceForecast(engine, user),
    [engine, user],
  );
  const heatBand = getHeatBandFromCelsius(user.weatherTempC);
  const load = React.useMemo(
    () => deriveRecoveryLoad(user, engine, heatBand),
    [user, engine, heatBand],
  );

  // Sweat Loss — efficiency-tinted hero (≥100% peak, ≥60% balanced,
  // anything below = recovering tint).
  const efficiencyColor =
    sweat.efficiencyPct >= 100 ? Colors.states.PEAK.primary
    : sweat.efficiencyPct >= 60 ? Colors.states.BALANCED.primary
    : Colors.states.RECOVERING.primary;

  // Forecast — trajectory drives the accent + arrow color.
  const trajectoryColor =
    forecast.trajectory === 'rising' ? Colors.states.PEAK.primary
    : forecast.trajectory === 'declining' ? Colors.states.DEPLETED.primary
    : Colors.states.BALANCED.primary;

  return (
    <View style={styles.wrap} testID="home-biometric-intelligence">
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>BIOMETRIC INTELLIGENCE</Text>
        <Text style={styles.sectionDot}>·</Text>
        <Text style={styles.sectionLive}>LIVE</Text>
      </View>

      <BiometricCard
        testID="card-sweat-loss"
        eyebrow="SWEAT LOSS"
        accent={efficiencyColor}
        icon="droplet"
        heroValue={`${sweat.fluidLossOz} oz`}
        heroLabel={`projected · ${sweat.intensity} intensity`}
        subline={
          sweat.efficiencyPct >= 100
            ? `Replacement on track · ${sweat.efficiencyPct}% efficiency`
            : `Replacement gap · ${100 - sweat.efficiencyPct}% behind loss`
        }
        confidence={sweat.confidence}
        metrics={[
          { label: 'SODIUM', value: `${sweat.sodiumLossMg} mg` },
          { label: 'EFFICIENCY', value: `${sweat.efficiencyPct}%`, valueColor: efficiencyColor },
          { label: 'INTENSITY', value: capitalize(sweat.intensity) },
        ]}
      />

      <View style={styles.gap} />

      <BiometricCard
        testID="card-performance-forecast"
        eyebrow="PERFORMANCE FORECAST"
        accent={trajectoryColor}
        icon="trending-up"
        heroValue={`${engine.score} ${TRAJECTORY_ARROW[forecast.trajectory]}`}
        heroLabel={forecast.headline}
        subline={forecast.projection}
        metrics={[
          { label: 'TRAJECTORY', value: capitalize(forecast.trajectory), valueColor: trajectoryColor },
          {
            label: 'DECAY',
            value: `${engine.prediction.decayPerMinute.toFixed(2)} pts/min`,
          },
          {
            label: 'NEXT WINDOW',
            value: forecast.deficitAt ?? '—',
          },
        ]}
      />

      <View style={styles.gap} />

      <BiometricCard
        testID="card-recovery-load"
        eyebrow="RECOVERY LOAD"
        accent={STRAIN_COLOR[load.strain]}
        icon="activity"
        heroValue={`${load.loadScore}`}
        heroLabel={STRAIN_LABEL[load.strain]}
        subline={load.headline}
        metrics={[
          { label: 'HEAT', value: `${load.heatImpact}%`, valueColor: load.heatImpact >= 60 ? Colors.states.DEPLETED.primary : undefined },
          { label: 'ENVIRONMENT', value: `${load.environmentalLoad}%` },
          { label: 'HYDRATION', value: `${load.hydrationStress}%` },
        ]}
      />
    </View>
  );
}

export const BiometricIntelligenceStack = React.memo(BiometricIntelligenceStackImpl);

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.text.secondary,
    letterSpacing: 2.5,
  },
  sectionDot: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.text.muted,
  },
  sectionLive: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.accent.primary,
    letterSpacing: 2.5,
  },
  gap: { height: 10 },
});
