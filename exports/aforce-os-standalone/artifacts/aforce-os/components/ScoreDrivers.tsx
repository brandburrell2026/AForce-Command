/**
 * ScoreDrivers — the plain-language explainability layer.
 *
 * Renders the four simple drivers (Water · Sleep · Heat · Recovery) as
 * signed pills with a single trust-building sentence each. No formulas,
 * no clinical terms — this is the "why" a normal person reads first. The
 * detailed contribution rows still live below it in the breakdown sheet
 * for anyone who wants the full picture.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '../theme/colors';
import type { ScoreDriver } from '../utils/scoring/drivers';
import { formatDriverDelta } from '../utils/scoring/drivers';

interface Props {
  drivers: ScoreDriver[];
}

function colorFor(direction: ScoreDriver['direction']): string {
  if (direction === 'positive') return Colors.states.PEAK.primary;
  if (direction === 'negative') return Colors.states.DEPLETED.primary;
  return Colors.text.muted;
}

export function ScoreDrivers({ drivers }: Props) {
  if (drivers.length === 0) return null;
  return (
    <View testID="score-drivers" style={styles.container}>
      <Text style={styles.label}>WHAT'S MOVING YOUR SCORE</Text>
      <View style={styles.list}>
        {drivers.map((d) => {
          const color = colorFor(d.direction);
          return (
            <View key={d.id} style={styles.row}>
              <View
                style={[
                  styles.pill,
                  { borderColor: `${color}40`, backgroundColor: `${color}14` },
                ]}
              >
                <Text style={[styles.pillLabel, { color }]}>{d.label}</Text>
                <Text style={[styles.pillDelta, { color }]}>
                  {formatDriverDelta(d.delta)}
                </Text>
              </View>
              <Text style={styles.text}>{d.text}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2,
    marginBottom: 12,
  },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 92,
  },
  pillLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  pillDelta: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    lineHeight: 18,
  },
});

export default ScoreDrivers;
