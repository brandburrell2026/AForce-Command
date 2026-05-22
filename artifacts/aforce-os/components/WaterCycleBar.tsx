/**
 * WaterCycleBar — 8-cell horizontal progress bar showing completed cycles.
 * Animates when a new unit is completed.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import type { PerformanceState } from '../types';
import { Colors } from '../theme/colors';

interface Props {
  unitsConsumed: number;
  dailyTarget: number;
  performanceState: PerformanceState;
}

const CELL_COUNT = 8;

function Cell({
  index,
  filled,
  color,
  isNew,
}: {
  index: number;
  filled: boolean;
  color: string;
  isNew: boolean;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(filled ? 1 : 0);
  const cellScale = useSharedValue(filled ? 1 : 0.85);

  useEffect(() => {
    if (filled && isNew) {
      // Animate fill for newly filled cells
      opacity.value = withDelay(index * 40, withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }));
      cellScale.value = withDelay(
        index * 40,
        withSpring(1, { damping: 12, stiffness: 200 })
      );
      scale.value = withDelay(
        index * 40,
        withSpring(1.15, { damping: 10, stiffness: 300 }, () => {
          scale.value = withSpring(1, { damping: 14, stiffness: 200 });
        })
      );
    } else {
      opacity.value = withTiming(filled ? 1 : 0, { duration: 200 });
      cellScale.value = withTiming(filled ? 1 : 0.85, { duration: 200 });
    }
  }, [filled, isNew]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * cellScale.value }],
    opacity: filled ? 1 : 0.15,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.cell, animStyle]}>
      {/* Empty cell base */}
      <View style={[styles.cellBase, { borderColor: filled ? color : Colors.border.medium }]} />
      {/* Filled overlay */}
      {filled && (
        <Animated.View
          style={[
            styles.cellFill,
            { backgroundColor: color },
            fillStyle,
          ]}
        />
      )}
    </Animated.View>
  );
}

export function WaterCycleBar({ unitsConsumed, dailyTarget, performanceState }: Props) {
  const { color } = performanceState;
  const prevCount = React.useRef(unitsConsumed);
  const isNew = unitsConsumed > prevCount.current;

  React.useEffect(() => {
    prevCount.current = unitsConsumed;
  }, [unitsConsumed]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Water cycle</Text>
        <Text style={[styles.count, { color }]}>
          {unitsConsumed} / {dailyTarget}
        </Text>
      </View>
      {/* Cells row bleeds out to the card edges via negative margin so
          the 8 cells stretch the full section width rather than sitting
          inside the 20px inner gutter. Header still respects the gutter. */}
      <View style={styles.cells}>
        {Array.from({ length: CELL_COUNT }).map((_, i) => (
          <Cell
            key={i}
            index={i}
            filled={i < unitsConsumed}
            color={color}
            isNew={isNew && i === unitsConsumed - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
    letterSpacing: 0.2,
  },
  count: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.2,
  },
  cells: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginHorizontal: -8,
  },
  cell: {
    flex: 1,
    height: 32,
    borderRadius: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  cellBase: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
    borderWidth: 1,
    backgroundColor: Colors.fill.light,
  },
  cellFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
  },
});
