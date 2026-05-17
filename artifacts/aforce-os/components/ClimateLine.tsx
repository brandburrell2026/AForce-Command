/**
 * ClimateLine — environment context strip for the One-Command OS home.
 *
 * Compact, single-row line showing where the user is and what the air is
 * doing to them: condition icon + temperature + relative humidity + city.
 * A second line carries the humidity-band hydration insight (muted).
 *
 * Behavior:
 *   - On mount we render the synchronous mock snapshot immediately so the
 *     line never flashes empty, then fire `getCurrentCityClimate()` in an
 *     effect to upgrade to a live, geolocated reading.
 *   - Permission requests + Open-Meteo fetch are owned by cityClimateService
 *     so this component is purely presentational.
 *   - Tapping opens the full Heat Risk screen for the deeper breakdown.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Colors } from '../theme/colors';
import {
  getCurrentCityClimate,
  getCurrentCityClimateSync,
  type CityClimate,
} from '../services/cityClimateService';

interface Props {
  onPress?: () => void;
}

const CONDITION_ICON: Record<CityClimate['condition'], IconName> = {
  clear:  'sun',
  cloudy: 'cloud',
  rain:   'cloud-rain',
  storm:  'cloud-lightning',
  humid:  'droplet',
  dry:    'wind',
};

export function ClimateLine({ onPress }: Props) {
  const [climate, setClimate] = React.useState<CityClimate>(() => getCurrentCityClimateSync());

  React.useEffect(() => {
    let cancelled = false;
    getCurrentCityClimate()
      .then((live) => { if (!cancelled) setClimate(live); })
      .catch(() => { /* keep mock snapshot on failure */ });
    return () => { cancelled = true; };
  }, []);

  const cityLabel = climate.region
    ? `${climate.city}, ${climate.region}`
    : climate.city;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.container}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Current climate: ${climate.tempF.toFixed(0)} degrees, ${climate.humidityPct.toFixed(0)} percent humidity in ${cityLabel}`}
      testID="climate-line"
    >
      <View style={styles.row}>
        <Icon name={CONDITION_ICON[climate.condition]} size={13} color={Colors.text.secondary} />
        <Text style={styles.metric}>{climate.tempF.toFixed(0)}°F</Text>
        <Text style={styles.sep}>·</Text>
        <Icon name="droplet" size={11} color={Colors.text.muted} />
        <Text style={styles.metric}>{climate.humidityPct.toFixed(0)}% RH</Text>
        <Text style={styles.sep}>·</Text>
        <Icon name="map-pin" size={11} color={Colors.text.muted} />
        <Text style={styles.city} numberOfLines={1}>{cityLabel}</Text>
        {climate.source === 'mock' && (
          <Text style={styles.mockTag}>·  est.</Text>
        )}
      </View>
      <Text style={styles.insight} numberOfLines={1}>
        {climate.hydrationInsight}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
  },
  metric: {
    color: Colors.text.secondary,
    fontSize: 12,
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  sep: {
    color: Colors.text.muted,
    fontSize: 12,
    marginHorizontal: 2,
  },
  city: {
    flexShrink: 1,
    color: Colors.text.secondary,
    fontSize: 12,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  mockTag: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 0.5,
    fontStyle: 'italic',
  },
  insight: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 0.4,
    fontStyle: 'italic',
  },
});

export default ClimateLine;
