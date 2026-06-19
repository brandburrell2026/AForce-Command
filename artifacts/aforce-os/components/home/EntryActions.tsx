/**
 * EntryActions — bottom-zone "quick action" tile grid.
 *
 * Four 64×64 tiles, left-aligned:
 *   • Urine        — opens the urine-check flow (navigates away)
 *   • Sweat        — opens the Sweat Loss detail sheet (in-place)
 *   • Forecast     — opens the Performance Forecast detail sheet
 *   • Recovery     — opens the Recovery Load detail sheet
 *
 * The three biometric tiles each carry a small status dot in the
 * top-right corner tinted to the *live* card accent, so the tile row
 * doubles as an at-a-glance health strip without occupying the heavy
 * surface the stacked cards used to require.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Icon, type IconName } from '../Icon';

import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { Colors } from '../../theme/colors';
import { BiometricDetailSheet, type BiometricSheetPayload } from './BiometricDetailSheet';
import {
  deriveSweatLoss,
  derivePerformanceForecast,
  deriveRecoveryLoad,
  type Trajectory,
  type StrainLevel,
} from '../../services/biometricIntelligence';
import { useEngineSlice, useFlagsSlice, useUserSlice } from '../../store/slices';
import { getHeatBandFromCelsius } from '../../utils/heatBand';
import { useVoiceCheckIn } from '../../hooks/useVoiceCheckIn';
import { localDayKey } from '../../utils/voiceCheckIn';

type TileKey = 'urine' | 'sweat' | 'forecast' | 'recovery';

const TRAJECTORY_ARROW: Record<Trajectory, string> = {
  rising: '↑',
  stable: '→',
  declining: '↓',
};

const STRAIN_LABEL: Record<StrainLevel, string> = {
  low: 'Minimal load',
  moderate: 'Moderate load',
  elevated: 'Elevated strain',
  high: 'High strain',
};

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function EntryActionsImpl() {
  const router = useRouter();
  const engine = useEngineSlice();
  const user = useUserSlice();
  const flags = useFlagsSlice();
  const { latest } = useVoiceCheckIn();

  const [openKey, setOpenKey] = React.useState<TileKey | null>(null);

  // ── Live derivations (shared between tile accent + sheet body) ────
  const sweat = React.useMemo(() => deriveSweatLoss(user), [user]);

  // Today's morning Voice Check-In refines the forecast headline (copy-only,
  // flag-gated). Only TODAY'S report is used so a stale day never colors the
  // forecast; the trajectory/projection math is untouched either way.
  const checkIn = React.useMemo(() => {
    if (!flags.voice_checkin_enabled || !latest) return undefined;
    if (latest.dayKey !== localDayKey(new Date())) return undefined;
    return { energy: latest.answers.energy, stress: latest.answers.stress };
  }, [flags.voice_checkin_enabled, latest]);

  const forecast = React.useMemo(
    () => derivePerformanceForecast(engine, user, undefined, checkIn),
    [engine, user, checkIn],
  );
  const heatBand = getHeatBandFromCelsius(user.weatherTempC);
  const load = React.useMemo(
    () => deriveRecoveryLoad(user, engine, heatBand),
    [user, engine, heatBand],
  );

  const sweatAccent =
    sweat.efficiencyPct >= 100 ? Colors.states.PEAK.primary
    : sweat.efficiencyPct >= 60 ? Colors.states.BALANCED.primary
    : Colors.states.RECOVERING.primary;

  const trajectoryAccent =
    forecast.trajectory === 'rising' ? Colors.states.PEAK.primary
    : forecast.trajectory === 'declining' ? Colors.states.DEPLETED.primary
    : Colors.states.BALANCED.primary;

  const loadAccent =
    load.strain === 'low' ? Colors.states.PEAK.primary
    : load.strain === 'moderate' ? Colors.states.BALANCED.primary
    : load.strain === 'elevated' ? Colors.states.RECOVERING.primary
    : Colors.states.DEPLETED.primary;

  // Urine signal is the 1–8 darkness scale (lower = better hydration).
  // 1–3 light: PEAK · 4 mid: BALANCED · 5–6 dim: RECOVERING · 7–8 dark: DEPLETED.
  const urineAccent =
    user.urineSignal <= 3 ? Colors.states.PEAK.primary
    : user.urineSignal === 4 ? Colors.states.BALANCED.primary
    : user.urineSignal <= 6 ? Colors.states.RECOVERING.primary
    : Colors.states.DEPLETED.primary;

  // ── Sheet payload builders ────────────────────────────────────────
  const payload: BiometricSheetPayload | null = React.useMemo(() => {
    if (openKey === 'forecast') {
      return {
        eyebrow: 'PERFORMANCE FORECAST',
        accent: trajectoryAccent,
        icon: 'trending-up',
        heroValue: `${engine.score} ${TRAJECTORY_ARROW[forecast.trajectory]}`,
        heroLabel: forecast.headline,
        subline: forecast.projection,
        metrics: [
          { label: 'TRAJECTORY', value: capitalize(forecast.trajectory), valueColor: trajectoryAccent },
          { label: 'DECAY', value: `${engine.prediction.decayPerMinute.toFixed(2)} pts/min` },
          { label: 'NEXT WINDOW', value: forecast.deficitAt ?? '—' },
        ],
      };
    }
    if (openKey === 'recovery') {
      return {
        eyebrow: 'RECOVERY LOAD',
        accent: loadAccent,
        icon: 'activity',
        heroValue: `${load.loadScore}`,
        heroLabel: STRAIN_LABEL[load.strain],
        subline: load.headline,
        metrics: [
          {
            label: 'HEAT',
            value: `${load.heatImpact}%`,
            valueColor: load.heatImpact >= 60 ? Colors.states.DEPLETED.primary : undefined,
          },
          { label: 'ENVIRONMENT', value: `${load.environmentalLoad}%` },
          { label: 'HYDRATION', value: `${load.hydrationStress}%` },
        ],
      };
    }
    return null;
  }, [openKey, sweat, sweatAccent, forecast, trajectoryAccent, load, loadAccent, engine.score, engine.prediction.decayPerMinute]);

  const tiles: Array<{
    key: TileKey;
    icon: IconName;
    label: string;
    accent: string | null;
  }> = [
    { key: 'urine',    icon: 'droplet',       label: 'Urine',    accent: urineAccent },
    { key: 'sweat',    icon: 'cloud-drizzle', label: 'Sweat',    accent: sweatAccent },
    { key: 'forecast', icon: 'trending-up',   label: 'Forecast', accent: trajectoryAccent },
    { key: 'recovery', icon: 'activity',      label: 'Recovery', accent: loadAccent },
  ];

  const onTilePress = (key: TileKey) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    if (key === 'urine') {
      router.push('/urine-check');
      return;
    }
    if (key === 'sweat') {
      // Sweat Loss snapshot is now rendered inline at the top of the
      // Sweat Calculator screen — single unified surface.
      router.push('/sweat');
      return;
    }
    setOpenKey(key);
  };

  return (
    <>
      <View style={styles.actionRow}>
        {tiles.map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => onTilePress(item.key)}
            activeOpacity={0.85}
            style={styles.actionTile}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            testID={`home-tile-${item.key}`}
          >
            <Icon name={item.icon} size={28} color={Colors.text.primary} />
            <Text style={styles.tileLabel}>{item.label.toUpperCase()}</Text>
            {item.accent ? (
              <View style={[styles.statusDot, { backgroundColor: item.accent }]} />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
      <BiometricDetailSheet
        visible={openKey !== null}
        payload={payload}
        onDismiss={() => setOpenKey(null)}
      />
    </>
  );
}

export const EntryActions = React.memo(EntryActionsImpl);

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
  actionTile: {
    flex: 1, height: 76,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
    position: 'relative',
    gap: 6,
  },
  tileLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    letterSpacing: 1.2,
    color: Colors.text.secondary,
  },
  statusDot: {
    position: 'absolute',
    top: 7, right: 7,
    width: 7, height: 7, borderRadius: 4,
  },
});
