/**
 * LiveStatusLine — `▲ +N pts · LAST Ns · VERB` strip rendered between
 * the orb's status label and the consequence line.
 *
 * Purely presentational. All inputs come from the `useScoreTrend` hook
 * and the pure `getStatusVerb` mapping in `services/statusVerb.ts`.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TrendDirection } from '../../hooks/useScoreTrend';
import type { StatusVerb } from '../../services/statusVerb';
import { Colors } from '../../theme/colors';

interface Props {
  direction: TrendDirection;
  delta: number;
  ageSec: number;
  verb: StatusVerb;
  /** Tint that drives arrow + verb color (matches orb accent). */
  accent: string;
  testID?: string;
}

const ARROW: Record<TrendDirection, string> = {
  rising: '▲',
  falling: '▼',
  flat: '●',
};

function formatAge(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  return `${m}m`;
}

function LiveStatusLineImpl({ direction, delta, ageSec, verb, accent, testID }: Props) {
  // For 'flat' / freshly-mounted (no window yet), show just the verb
  // so we don't render meaningless "+0 · 0s".
  const showWindow = direction !== 'flat' && ageSec >= 5;

  return (
    <View style={styles.row} testID={testID} accessibilityLabel={`Trend ${verb}`}>
      <Text style={[styles.arrow, { color: accent }]}>{ARROW[direction]}</Text>
      {showWindow ? (
        <>
          <Text style={[styles.delta, { color: accent }]}>
            {delta > 0 ? '+' : ''}{delta} pts
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.window}>LAST {formatAge(ageSec)}</Text>
          <Text style={styles.dot}>·</Text>
        </>
      ) : null}
      <Text style={[styles.verb, { color: accent }]}>{verb}</Text>
    </View>
  );
}

export const LiveStatusLine = React.memo(LiveStatusLineImpl);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
  },
  arrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  delta: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  dot: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.text.muted,
  },
  window: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
  },
  verb: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.2,
  },
});
