/**
 * LiveStatusStrip — Top status bar showing live contextual signals.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PerformanceState } from '../types';
import { Colors } from '../theme/colors';
import { phantomSignalData } from '../data/mockData';
import {
  getCurrentCityClimate,
  getCurrentCityClimateSync,
  type CityClimate,
} from '../services/cityClimateService';

interface Props {
  performanceState: PerformanceState;
  unitsToday: number;
  dailyTarget: number;
}

export function LiveStatusStrip({ performanceState, unitsToday, dailyTarget }: Props) {
  const { color } = performanceState;
  const { heartRateBPM, activityLabel, lastSyncLabel } = phantomSignalData;
  // City climate is the source of truth for ambient temp + humidity now.
  // Render the cached/mock snapshot immediately, then upgrade to live data
  // (geolocation + Open-Meteo) once it lands. Refresh every 10 minutes
  // while the screen is mounted; the service layer also caches.
  const [climate, setClimate] = React.useState<CityClimate>(() => getCurrentCityClimateSync());
  React.useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await getCurrentCityClimate();
        if (!cancelled) setClimate(next);
      } catch {
        // service swallows errors and falls back to mock — nothing to do
      }
    };
    void refresh();
    const id = setInterval(refresh, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>LIVE</Text>
        </View>
        <View style={styles.cityPill}>
          <Feather name="map-pin" size={10} color={Colors.text.muted} />
          <Text style={styles.cityText} numberOfLines={1}>
            {climate.city}, {climate.region}
          </Text>
        </View>
        <Text style={styles.syncText}>{lastSyncLabel}</Text>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Feather name="activity" size={11} color={Colors.text.muted} />
          <Text style={styles.metricText}>{heartRateBPM} bpm</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.metric}>
          <Feather name="thermometer" size={11} color={Colors.text.muted} />
          <Text style={styles.metricText}>{climate.tempF}°F</Text>
        </View>
        <View style={styles.separator} />
        <View
          style={styles.metric}
          accessibilityLabel={`Humidity ${climate.humidityPct} percent in ${climate.city}`}
          testID="live-humidity"
        >
          <Feather name="droplet" size={11} color={Colors.text.muted} />
          <Text style={styles.metricText}>{climate.humidityPct}% RH</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.metric}>
          <Text style={styles.metricText}>{unitsToday}/{dailyTarget} units</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: Colors.fill.light,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  cityText: {
    flexShrink: 1,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary,
    letterSpacing: 0.6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.fill.light,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: Colors.border.subtle,
  },
  syncText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
  },
});
