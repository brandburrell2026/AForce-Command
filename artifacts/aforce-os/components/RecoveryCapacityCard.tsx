/**
 * RecoveryCapacityCard — the canonical replacement for `BACEstimateCard`.
 *
 * Renders the 0–100 Recovery Capacity Score with its AForce Brand System (v2.1.0)
 * band colour (Peak teal / Stable deep blue / Declining amber /
 * Critical Ferrari crimson `#FF2800`) and the three component
 * contributions that produced it (AutoPilot / Hydration / Environment).
 *
 * No BAC numbers, no impairment tiers, no transportation prompts —
 * those were retired with the Social→Recovery refactor.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  Easing, interpolate, interpolateColor, cancelAnimation,
} from 'react-native-reanimated';

import { Icon } from './Icon';
import { Colors } from '../theme/colors';
import type { RecoveryCapacityScore } from '../services/recoveryCapacity';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  recovery: RecoveryCapacityScore;
}

/** Subtle wash colour derived from the band hex so the card glows in its band. */
function tintFor(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function RecoveryCapacityCard({ recovery }: Props) {
  const { score, meta, contributions } = recovery;
  const borderColor = tintFor(meta.color, 0.45);
  const fillColor = tintFor(meta.color, 0.08);

  // ─── Chunk #7a polish ─────────────────────────────────────────────
  // Smooth color cross-fade when the recovery band changes (e.g.
  // Stable → Declining). We animate a 0→1 progress, snapshot the
  // previous color, and interpolate to the current one over 600ms.
  const prevColorRef = React.useRef<string>(meta.color);
  const colorProg = useSharedValue(1);
  useEffect(() => {
    if (prevColorRef.current === meta.color) return;
    colorProg.value = 0;
    colorProg.value = withTiming(1, {
      duration: 600,
      easing: Easing.inOut(Easing.cubic),
    });
    prevColorRef.current = meta.color;
  }, [meta.color, colorProg]);
  const scoreColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(colorProg.value, [0, 1], [prevColorRef.current, meta.color]),
  }));

  // Ambient halo behind the score number — soft 3s breathing tied to
  // band color. Adds the "alive data" feel without box-shadows.
  //
  // RC-1 fix (P0): this was an ungated infinite `withRepeat(..., -1)` loop
  // with no reduced-motion check and no teardown — it ran forever, including
  // for users who have motion reduction on, and kept animating on
  // Reanimated's UI thread past unmount. Pattern mirrors
  // components/WhoopSnapshotCard.tsx:118-165 — gate on the shared
  // hooks/useReducedMotion, and cancelAnimation in both the static branch
  // and the unmount cleanup.
  const reducedMotion = useReducedMotion();
  const halo = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      // Static alternative: settle at the oscillation's midpoint — no
      // breathing loop — rather than freezing at either visual extreme.
      cancelAnimation(halo);
      halo.value = 0.5;
    } else {
      halo.value = withRepeat(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
        -1, true,
      );
    }
    return () => {
      cancelAnimation(halo);
    };
  }, [halo, reducedMotion]);
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 1], [0.18, 0.42]),
    transform: [{ scale: interpolate(halo.value, [0, 1], [0.92, 1.08]) }],
  }));

  return (
    <View
      style={[styles.card, { borderColor, backgroundColor: fillColor }]}
      testID="recovery-capacity-card"
    >
      <View style={styles.headerRow}>
        <Text style={[styles.eyebrow, { color: meta.color }]}>RECOVERY CAPACITY</Text>
        <View style={[styles.bandChip, { borderColor }]}>
          <Text style={[styles.bandChipText, { color: meta.color }]}>
            {meta.label.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scoreWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.halo, { backgroundColor: meta.color }, haloStyle]}
          />
          <Animated.Text style={[styles.score, scoreColorStyle]}>{score}</Animated.Text>
        </View>
        <Text style={styles.scoreUnit}>/100</Text>
      </View>

      <View style={styles.breakdownRow}>
        <Breakdown
          icon="zap"
          label="AUTOPILOT"
          value={Math.round(contributions.autoPilot)}
          max={60}
        />
        <Breakdown
          icon="droplet"
          label="HYDRATION"
          value={Math.round(contributions.hydrationCompliance)}
          max={25}
        />
        <Breakdown
          icon="thermometer"
          label="ENVIRONMENT"
          value={Math.round(contributions.environmental)}
          max={15}
        />
      </View>

      <Text style={styles.disclaimer}>
        Recovery Capacity is an estimated performance and hydration indicator based on user inputs and environmental factors.
      </Text>
    </View>
  );
}

function Breakdown({
  icon,
  label,
  value,
  max,
}: {
  icon: string;
  label: string;
  value: number;
  max: number;
}) {
  return (
    <View style={styles.breakdownItem}>
      <Icon name={icon} size="xs" color="rgba(255,255,255,0.92)" />
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownValue}>
        {value}
        <Text style={styles.breakdownMax}> / {max}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.8,
  },
  bandChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  bandChipText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  scoreWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 96,
    // Soft radial-ish wash — kept low alpha; band color tints it live.
    opacity: 0.3,
  },
  score: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1.5,
    lineHeight: 52,
  },
  scoreUnit: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.55)',
    marginLeft: 4,
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  breakdownLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
  },
  breakdownValue: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  breakdownMax: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.45)',
  },
  disclaimer: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.42)',
    lineHeight: 14,
    marginTop: 12,
    letterSpacing: 0.2,
  },
});
