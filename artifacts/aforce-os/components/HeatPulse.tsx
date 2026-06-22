/**
 * HeatPulse — animated radial pulse driven by heat risk band.
 *
 *   STABLE     -> subtle, slow breathe
 *   ELEVATED   -> warm glow, slightly faster
 *   WARNING    -> amber tension, tightening
 *   HIGH RISK  -> red tightening pulse
 *   CRITICAL   -> urgent red pulse with collapse effect (and flash)
 *
 * Pure visual. No external state. Animations driven by Reanimated.
 */

import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  withSequence,
  interpolateColor,
} from "react-native-reanimated";

import type { HeatRiskBand, HeatVisualMode } from "../types/heat";
import { HEAT_BANDS } from "../services/heatRiskEngine";

interface Props {
  band: HeatRiskBand;
  /**
   * Continuous risk score (0–100). When provided, the pulse color is
   * interpolated smoothly across band stops instead of snapping at band
   * boundaries — a score of 32 sits between STABLE (lime) and ELEVATED
   * (gold) and the orb renders the blended color, animating across as
   * the score moves. When omitted, the pulse falls back to the discrete
   * band color (legacy behavior).
   */
  score?: number;
  size?: number;
}

// Color stops aligned with HEAT_BANDS lower bounds (0/25/45/65/85) plus
// a max anchor at 100 to keep the gradient defined to the top of the
// scale. Kept here rather than reading from HEAT_BANDS so the visual
// gradient stays stable even if a band's color is tweaked for legibility.
const COLOR_STOPS_INPUT = [0, 25, 45, 65, 85, 100];
const COLOR_STOPS_OUTPUT = [
  "#1FA35A", // STABLE   — Soursop green
  "#FFC857", // ELEVATED — gold
  "#FFA01E", // WARNING  — amber
  "#FF5A1F", // HIGH     — red-orange
  "#FF2800", // CRITICAL — WHOOP recovery red
  "#FF2800",
];

interface ModeConfig {
  innerScaleFrom: number;
  innerScaleTo: number;
  outerScaleFrom: number;
  outerScaleTo: number;
  cycleMs: number;
  flash: boolean;
  collapse: boolean;
  innerOpacity: number;
  ringOpacity: number;
}

const CONFIG: Record<HeatVisualMode, ModeConfig> = {
  subtle: {
    innerScaleFrom: 0.96, innerScaleTo: 1.04,
    outerScaleFrom: 0.85, outerScaleTo: 1.18,
    cycleMs: 2400, flash: false, collapse: false,
    innerOpacity: 0.55, ringOpacity: 0.18,
  },
  warm_glow: {
    innerScaleFrom: 0.94, innerScaleTo: 1.08,
    outerScaleFrom: 0.82, outerScaleTo: 1.25,
    cycleMs: 1800, flash: false, collapse: false,
    innerOpacity: 0.62, ringOpacity: 0.22,
  },
  amber_tension: {
    innerScaleFrom: 0.9, innerScaleTo: 1.12,
    outerScaleFrom: 0.78, outerScaleTo: 1.32,
    cycleMs: 1300, flash: false, collapse: false,
    innerOpacity: 0.7, ringOpacity: 0.28,
  },
  red_tighten: {
    innerScaleFrom: 0.85, innerScaleTo: 1.18,
    outerScaleFrom: 0.72, outerScaleTo: 1.4,
    cycleMs: 900, flash: false, collapse: false,
    innerOpacity: 0.78, ringOpacity: 0.34,
  },
  red_collapse: {
    innerScaleFrom: 0.7, innerScaleTo: 1.25,
    outerScaleFrom: 0.6, outerScaleTo: 1.5,
    cycleMs: 700, flash: true, collapse: true,
    innerOpacity: 0.85, ringOpacity: 0.42,
  },
};

export function HeatPulse({ band, score, size = 180 }: Props) {
  const display = HEAT_BANDS.find((b) => b.band === band) ?? HEAT_BANDS[0];
  const cfg = CONFIG[display.visualMode];

  const inner = useSharedValue(cfg.innerScaleFrom);
  const outer = useSharedValue(cfg.outerScaleFrom);
  const flash = useSharedValue(1);

  // Drives continuous color interpolation. Initialized to the current
  // score so the first paint already lands on the right hue, then
  // animated on every change for a smooth crossfade.
  const colorScore = useSharedValue(
    typeof score === "number" ? Math.max(0, Math.min(100, score)) : -1,
  );
  useEffect(() => {
    if (typeof score !== "number") return;
    const clamped = Math.max(0, Math.min(100, score));
    colorScore.value = withTiming(clamped, {
      duration: 600,
      easing: Easing.inOut(Easing.quad),
    });
  }, [score, colorScore]);

  // When `score` is provided, derive a live color; otherwise fall back
  // to the discrete band color via a constant derived value so the
  // animated styles below can read uniformly.
  const liveColor = useDerivedValue(() => {
    if (colorScore.value < 0) return display.color;
    return interpolateColor(
      colorScore.value,
      COLOR_STOPS_INPUT,
      COLOR_STOPS_OUTPUT,
    );
  }, [display.color]);

  useEffect(() => {
    inner.value = cfg.innerScaleFrom;
    outer.value = cfg.outerScaleFrom;

    inner.value = withRepeat(
      withTiming(cfg.innerScaleTo, {
        duration: cfg.cycleMs,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
    outer.value = withRepeat(
      withTiming(cfg.outerScaleTo, {
        duration: cfg.cycleMs * 1.2,
        easing: Easing.out(Easing.cubic),
      }),
      -1,
      true,
    );
    if (cfg.flash) {
      flash.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 220, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      flash.value = 1;
    }

    return () => {
      cancelAnimation(inner);
      cancelAnimation(outer);
      cancelAnimation(flash);
    };
    // We intentionally rebind whenever the visual mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display.visualMode]);

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inner.value }],
    opacity: cfg.innerOpacity * flash.value,
    backgroundColor: liveColor.value,
    shadowColor: liveColor.value,
  }));
  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outer.value }],
    opacity: cfg.ringOpacity * flash.value,
    borderColor: liveColor.value,
  }));
  const ringTwoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outer.value * 0.85 }],
    opacity: (cfg.ringOpacity * 0.7) * flash.value,
    borderColor: liveColor.value,
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2 },
          outerStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          {
            position: "absolute",
            width: size, height: size,
            borderRadius: size / 2,
          },
          ringTwoStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.core,
          {
            width: size * 0.62,
            height: size * 0.62,
            borderRadius: size * 0.31,
          },
          innerStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  ring: {
    borderWidth: 1.5,
    backgroundColor: "transparent",
    position: "absolute",
  },
  core: {
    shadowOpacity: 0.6,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
});
