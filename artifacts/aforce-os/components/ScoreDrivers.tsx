/**
 * ScoreDrivers — the plain-language explainability layer.
 *
 * Renders the four simple drivers (Water · Sleep · Heat · Recovery) as
 * signed pills with a single trust-building sentence each. No formulas,
 * no clinical terms — this is the "why" a normal person reads first. The
 * detailed contribution rows still live below it in the breakdown sheet
 * for anyone who wants the full picture.
 *
 * VS 3.0 P2: presentation-only migration onto the af.* system (was legacy
 * Colors.* + hardcoded Inter_* strings + `${color}NN` opacity hacks). Same
 * drivers, same copy, same layout — brand tokens + AA-clean colors.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { af, afType, afAlpha, withAlpha } from '../theme';
import type { ScoreDriver } from '../utils/scoring/drivers';
import { formatDriverDelta } from '../utils/scoring/drivers';

interface Props {
  drivers: ScoreDriver[];
}

/** Positive → brand green, negative → AA-clean red text, neutral → tertiary. */
function colorFor(direction: ScoreDriver['direction']): string {
  if (direction === 'positive') return af.green;
  if (direction === 'negative') return af.redText;
  return af.textTertiary;
}

export function ScoreDrivers({ drivers }: Props) {
  if (drivers.length === 0) return null;
  return (
    <View testID="score-drivers" style={styles.container}>
      <Text style={styles.label}>WHAT&apos;S MOVING YOUR SCORE</Text>
      <View style={styles.list}>
        {drivers.map((d) => {
          const color = colorFor(d.direction);
          return (
            <View key={d.id} style={styles.row}>
              <View
                style={[
                  styles.pill,
                  { borderColor: withAlpha(color, afAlpha.a24), backgroundColor: withAlpha(color, afAlpha.a08) },
                ]}
              >
                <Text style={[styles.pillLabel, { color }]}>{d.label}</Text>
                <Text style={[styles.pillDelta, { color }]}>{formatDriverDelta(d.delta)}</Text>
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
  container: { marginBottom: 18 },
  label: { ...afType.eyebrow, color: af.textTertiary, marginBottom: 12 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 92,
  },
  pillLabel: { ...afType.microLabel },
  pillDelta: { ...afType.microLabel, fontVariant: ['tabular-nums'] },
  text: { ...afType.caption, flex: 1, color: af.textSecondary },
});

export default ScoreDrivers;
