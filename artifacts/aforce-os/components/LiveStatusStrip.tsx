/**
 * LiveStatusStrip — Two-line ambient + body strip.
 *
 * Layout (per latest design direction):
 *   Line 1 (climate):  outside temp · outside humidity · city, region
 *   Line 2 (body):     bpm · units consumed / target
 *
 * City climate is auto-detected via cityClimateService (geolocation +
 * Open-Meteo); falls back to a cached mock snapshot until live data lands.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';
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
  const { heartRateBPM } = phantomSignalData;
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
      {/* Line 1 — outside temp · outside humidity · city */}
      <View style={styles.row}>
        <View style={styles.metric}>
          <Icon name="thermometer" size={11} color={Colors.text.muted} />
          <Text style={styles.metricText}>{climate.tempF}°F</Text>
        </View>
        <View style={styles.separator} />
        <View
          style={styles.metric}
          accessibilityLabel={`Humidity ${climate.humidityPct} percent in ${climate.city}`}
          testID="live-humidity"
        >
          <Icon name="droplet" size={11} color={Colors.text.muted} />
          <Text style={styles.metricText}>{climate.humidityPct}% RH</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.metric}>
          <Icon name="map-pin" size={11} color={Colors.text.muted} />
          <Text style={styles.metricText} numberOfLines={1}>
            {climate.city}, {climate.region}
          </Text>
        </View>
        {climate.source === 'mock' && <Text style={styles.estTag}>est.</Text>}
      </View>

      {/* Line 2 — bpm · units */}
      <View style={styles.row}>
        <View style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>LIVE</Text>
        </View>
        <View style={styles.metric}>
          <Icon name="activity" size={11} color={Colors.text.muted} />
          <Text style={styles.metricText}>{heartRateBPM} bpm</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.metric}>
          <Text style={styles.metricText}>{unitsToday}/{dailyTarget} units</Text>
        </View>
      </View>

      {/* Line 3 — performance framing: what the environment is doing to the body */}
      <Text style={styles.insight} numberOfLines={1} testID="live-insight">
        {climate.hydrationInsight}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.fill.light,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  metricText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    flexShrink: 1,
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: Colors.border.subtle,
  },
  estTag: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  insight: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 0.4,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
