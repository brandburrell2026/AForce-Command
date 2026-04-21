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
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
  withSequence,
} from "react-native-reanimated";

import type { HeatRiskBand, HeatVisualMode } from "../types/heat";
import { HEAT_BANDS } from "../services/heatRiskEngine";

interface Props {
  band: HeatRiskBand;
  size?: number;
}

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

export function HeatPulse({ band, size = 180 }: Props) {
  const display = HEAT_BANDS.find((b) => b.band === band) ?? HEAT_BANDS[0];
  const cfg = CONFIG[display.visualMode];

  const inner = useSharedValue(cfg.innerScaleFrom);
  const outer = useSharedValue(cfg.outerScaleFrom);
  const flash = useSharedValue(1);

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
  }));
  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outer.value }],
    opacity: cfg.ringOpacity * flash.value,
  }));
  const ringTwoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outer.value * 0.85 }],
    opacity: (cfg.ringOpacity * 0.7) * flash.value,
  }));

  const color = display.color;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2, borderColor: color },
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
            borderColor: color,
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
            backgroundColor: color,
            shadowColor: color,
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
