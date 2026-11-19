/**
 * SealRing — the hold-to-seal ring, drawn as the approved prototype draws it:
 * a 150pt ring with a quiet track, and an arc that fills while the member
 * holds. Warm white for One Breath, blue for a Social Moment.
 *
 * Presentation only. It draws the progress value it is given. It starts
 * nothing, saves nothing and seals nothing: the hold, its 1.2 seconds and the
 * approval all stay with the screen.
 */
import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";

export const SEAL_RING_SIZE = 150;
const STROKE = 6;
const RADIUS = SEAL_RING_SIZE / 2 - STROKE - 1;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function SealRing({
  progress,
  social,
  children,
}: {
  /** 0 → 1 while the member holds. */
  progress: Animated.Value;
  social: boolean;
  children?: React.ReactNode;
}) {
  const c = SEAL_RING_SIZE / 2;
  return (
    <View style={s.wrap}>
      <Svg width={SEAL_RING_SIZE} height={SEAL_RING_SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={RADIUS} stroke={T.rule} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={c}
          cy={c}
          r={RADIUS}
          stroke={social ? T.blueHi : T.bone}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE, 0] })}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: SEAL_RING_SIZE, height: SEAL_RING_SIZE, alignItems: "center", justifyContent: "center" },
});
