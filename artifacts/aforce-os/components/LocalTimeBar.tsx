/**
 * LocalTimeBar — Date + time pill rendered at the top of the home
 * screen, formatted in the device's local time zone.
 *
 * Uses Intl.DateTimeFormat so the abbreviation (PDT, EST, GMT+9, etc.)
 * comes from the device locale rather than a hard-coded zone. The
 * timestamp re-renders every 30 seconds so the minute display stays
 * accurate without burning cycles.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

function getTimeZoneAbbrev(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZoneName: 'short',
    }).formatToParts(date);
    const tz = parts.find((p) => p.type === 'timeZoneName');
    if (tz?.value) return tz.value;
  } catch {
    // fall through
  }
  // Fallback: derive from the IANA zone (e.g. "America/Los_Angeles" → "Los Angeles")
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone?.split('/').pop()?.replace(/_/g, ' ') ?? '';
  } catch {
    return '';
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function LocalTimeBar() {
  const [now, setNow] = React.useState<Date>(() => new Date());

  React.useEffect(() => {
    // Re-render every 30s so the minute display stays current.
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = formatDate(now);
  const timeLabel = formatTime(now);
  const tzLabel = getTimeZoneAbbrev(now);

  return (
    <View style={styles.row} accessibilityRole="text" testID="local-time-bar">
      <Feather name="clock" size={11} color={Colors.text.muted} />
      <Text style={styles.text} numberOfLines={1}>
        {dateLabel}
        <Text style={styles.dim}>  ·  </Text>
        {timeLabel}
        {tzLabel ? <Text style={styles.dim}> {tzLabel}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 8,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary,
    letterSpacing: 0.6,
  },
  dim: {
    color: Colors.text.muted,
  },
});
