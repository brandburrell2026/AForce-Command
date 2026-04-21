/**
 * ComparisonList — ranked list of comparison results.
 * Splits view into "Why AForce Wins" vs "Full Comparison" via parent toggle.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import type { CompareResult } from '../types/comparison';
import { ComparisonCard } from './ComparisonCard';

interface Props {
  results: CompareResult[];
  /** When true, only show AForce + the top non-AForce alternative. */
  whyAForceWins?: boolean;
}

export function ComparisonList({ results, whyAForceWins = false }: Props) {
  const visible = React.useMemo(() => {
    if (!whyAForceWins) return results;
    const aforce = results.filter(r => r.product.isAForce);
    const otherTop = results.find(r => !r.product.isAForce);
    const merged = otherTop ? [...aforce, otherTop] : aforce;
    return merged.sort((a, b) => b.fitScore - a.fitScore);
  }, [results, whyAForceWins]);

  return (
    <View style={styles.list}>
      {visible.map((r, i) => (
        <ComparisonCard
          key={r.product.id}
          result={r}
          isWinner={r.rank === 1}
          delayMs={i * 60}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 4 },
});
