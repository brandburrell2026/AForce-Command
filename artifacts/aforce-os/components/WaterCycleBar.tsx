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
  withRepeat,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import type { PerformanceState } from '../types';
import { Colors } from '../theme/colors';
import { useReducedMotion } from '@/hooks/useReducedMotion';

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

  // "You are here" caret: a tiny downward-pointing chevron that hovers
  // above the next cell the user needs to fill. Drives a slow 1.8s
  // vertical breath so the marker feels alive (matches the rest of the
  // home zone's ambient motion). Hidden once the day is complete.
  const nextIdx = unitsConsumed < CELL_COUNT ? unitsConsumed : -1;
  const caretY = useSharedValue(0);
  const caretOpacity = useSharedValue(0);
  // RC-1 Wave-2A gating fix: the vertical "breathe" loop below was an
  // ungated `withRepeat(..., -1)` with no reduced-motion check and no
  // unmount cleanup. Pattern mirrors WhoopSnapshotCard's connection-dot
  // gate — hold a static frame under reduced motion, cancelAnimation always
  // on unmount/re-run.
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (nextIdx < 0) {
      cancelAnimation(caretY);
      caretOpacity.value = withTiming(0, { duration: 300 });
      return () => cancelAnimation(caretY);
    }
    if (reducedMotion) {
      cancelAnimation(caretY);
      caretOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
      caretY.value = 0.5; // static mid-frame — no breathing loop
      return () => cancelAnimation(caretY);
    }
    caretOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    caretY.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(caretY);
  }, [nextIdx, caretOpacity, caretY, reducedMotion]);
  const caretStyle = useAnimatedStyle(() => ({
    opacity: caretOpacity.value,
    transform: [{ translateY: -2 + caretY.value * 4 }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Water cycle</Text>
        <Text style={[styles.count, { color }]}>
          {unitsConsumed} / {dailyTarget}
        </Text>
      </View>
      {/* Cells row. Above it sits the floating caret marker that points
          down at the next-to-fill cell. The caret is positioned by
          percentage so it stays aligned regardless of available width. */}
      <View style={styles.cellsWrap}>
        {nextIdx >= 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.caret,
              caretStyle,
              {
                left: `${((nextIdx + 0.5) / CELL_COUNT) * 100}%`,
              },
            ]}
          >
            <View
              style={[
                styles.caretTriangle,
                { borderTopColor: color, shadowColor: color },
              ]}
            />
          </Animated.View>
        )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Full-bleed: no side margins, no side borders. The card stretches
    // edge-to-edge across the entire section so there is no black gutter
    // flanking the Water Cycle. Hairlines kept on top + bottom only so
    // the section still reads as a contained block in the stack.
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
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
  cellsWrap: {
    // Reserves space for the floating caret marker above the cells so
    // it doesn't collide with the header row.
    paddingTop: 14,
    position: 'relative',
  },
  cells: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  caret: {
    position: 'absolute',
    top: 0,
    marginLeft: -5, // half the triangle base so center lines up exactly
    alignItems: 'center',
    justifyContent: 'center',
    width: 10,
    height: 10,
    // Soft glow so the marker reads as luminous, not flat.
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  caretTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
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
