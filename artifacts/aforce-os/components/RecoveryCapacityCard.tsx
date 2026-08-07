/**
 * RecoveryCapacityCard — the canonical replacement for `BACEstimateCard`.
 *
 * Renders the 0–100 Recovery Capacity Score with its AForce Brand System band
 * colour (Peak teal / Stable deep blue / Declining amber / Critical crimson)
 * and the three component contributions that produced it (AutoPilot /
 * Hydration / Environment). The band colour is supplied at runtime via
 * `meta.color` (source of truth: services/recoveryCapacity.ts) — this card
 * never hardcodes a band hex.
 *
 * No BAC numbers, no impairment tiers, no transportation prompts —
 * those were retired with the Social→Recovery refactor.
 *
 * VS 3.0 P2: chrome-only migration onto the af.* system (Colors.* + Inter_*
 * strings + rgba(255,255,255,·) muted text → af tokens; the band-colour logic,
 * cross-fade, and reduced-motion halo gate are untouched).
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  Easing, interpolate, interpolateColor, cancelAnimation,
} from 'react-native-reanimated';

import { Icon } from './Icon';
import { af, afType, afAlpha, withAlpha, Typography } from '../theme';
import type { RecoveryCapacityScore } from '../services/recoveryCapacity';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AFStatPair } from './ui/AFStatPair';

interface Props {
  recovery: RecoveryCapacityScore;
}

export function RecoveryCapacityCard({ recovery }: Props) {
  const { score, meta, contributions } = recovery;
  // Subtle band-tinted washes derived from the (prop-supplied) band hex so the
  // card glows in its band. meta.color is always a clean 6-digit hex, which
  // satisfies withAlpha's strict contract.
  const borderColor = withAlpha(meta.color, afAlpha.a50);
  const fillColor = withAlpha(meta.color, afAlpha.a08);

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
      <Icon name={icon} size="xs" color={af.textSecondary} />
      <AFStatPair
        label={label}
        value={value}
        unit={`/ ${max}`}
        direction="column"
        style={styles.breakdownStat}
        labelStyle={styles.breakdownLabel}
        valueStyle={styles.breakdownValue}
        unitStyle={styles.breakdownMax}
      />
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
    ...afType.eyebrow,
    letterSpacing: 1.8,
  },
  bandChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  bandChipText: {
    ...afType.microLabel,
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
    // Score typeface doctrine: the hero numeral is a metric role (IBM Plex
    // Mono), matching ScoreBreakdownSheet + HomeScreenV2's displayScore — never
    // Inter. Size/tracking/line-height and the live band-color cross-fade are
    // unchanged.
    fontSize: 48,
    fontFamily: Typography.roles.metric,
    letterSpacing: -1.5,
    lineHeight: 52,
  },
  scoreUnit: {
    ...afType.caption,
    color: af.textTertiary,
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
  breakdownStat: {
    gap: 4,
  },
  breakdownLabel: {
    ...afType.microLabel,
    color: af.textTertiary,
    letterSpacing: 1.2,
  },
  breakdownValue: {
    ...afType.caption,
    fontFamily: Typography.fonts.bold,
    color: af.textPrimary,
  },
  breakdownMax: {
    ...afType.caption,
    color: af.textTertiary,
  },
  disclaimer: {
    ...afType.caption,
    color: af.textTertiary,
    marginTop: 12,
    letterSpacing: 0.2,
  },
});
