/**
 * useAnimatedStatusColor — Reanimated hook that smoothly tweens the AI
 * Coach status color whenever the score crosses a band boundary.
 *
 *   const { snapshot, animatedPrimary, animatedGlow, intensitySV,
 *           animationSpeed } = useAnimatedStatusColor(engineOutput.score, {
 *             pressure: voiceIntensity === 'pressure',
 *           });
 *
 * - `snapshot` is the discrete StatusColor for the current score (changes
 *   only when the band changes — safe to use for non-animated styling).
 *
 * - `animatedPrimary` and `animatedGlow` are SharedValue<string> hex/rgba
 *   strings that interpolate over 400ms whenever the band changes. Use
 *   them inside `useAnimatedStyle` for buttery cross-band morphs.
 *
 * - `intensitySV` is a 0-1 SharedValue that pulses with the band's
 *   `animationSpeed` — pressure mode amplifies it. Wire it into halo
 *   opacity, voice-bar height, etc.
 *
 * - `animationSpeed` is the static multiplier (≥ 1 in pressure mode)
 *   for callers that drive their own `withTiming` durations.
 *
 * The hook does not subscribe to the store — pass `score` and `pressure`
 * explicitly so it stays presentational and easy to test.
 */

import React from 'react';
import {
  Easing,
  cancelAnimation,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import {
  BAND_INDEX_STOPS,
  GLOW_STOPS,
  GLOW_STOPS_PRESSURE,
  PRIMARY_STOPS,
  PRIMARY_STOPS_PRESSURE,
  type StatusColor,
  getStatusBandIndex,
  getStatusColor,
} from '../theme/statusColor';

/** Cross-band tween duration. Sits inside the 300-500ms spec window. */
export const STATUS_COLOR_TRANSITION_MS = 400;

export interface UseAnimatedStatusColorOptions {
  /** Pressure Mode — amplifies saturation, glow alpha, animation speed. */
  pressure?: boolean;
  /** Override the cross-band tween duration (defaults to 400ms). */
  transitionMs?: number;
}

export interface UseAnimatedStatusColorReturn {
  /** Discrete snapshot of the current band's full color contract. */
  snapshot: StatusColor;
  /** Tweened primary hex string. */
  animatedPrimary: SharedValue<string>;
  /** Tweened glow #RRGGBBAA string (with band-appropriate alpha baked in). */
  animatedGlow: SharedValue<string>;
  /** 0-1 oscillator that pulses at the band's animationSpeed. */
  intensitySV: SharedValue<number>;
  /** Static animation speed multiplier (worse band + pressure → faster). */
  animationSpeed: number;
}

export function useAnimatedStatusColor(
  score: number,
  opts: UseAnimatedStatusColorOptions = {},
): UseAnimatedStatusColorReturn {
  const pressure = opts.pressure === true;
  const transitionMs = opts.transitionMs ?? STATUS_COLOR_TRANSITION_MS;

  const snapshot = React.useMemo(
    () => getStatusColor(score, { pressure }),
    [score, pressure],
  );

  // Continuous 0..4 driver — tweens between band indices when score crosses
  // a boundary. Inside a single band the value holds steady (no churn).
  const bandIndexSV = useSharedValue<number>(getStatusBandIndex(score));
  React.useEffect(() => {
    const target = getStatusBandIndex(score);
    if (bandIndexSV.value !== target) {
      bandIndexSV.value = withTiming(target, {
        duration: transitionMs,
        easing: Easing.inOut(Easing.cubic),
      });
    }
  }, [score, transitionMs, bandIndexSV]);

  // 0..1 blend between baseline palette and Pressure Mode palette.
  const pressureSV = useSharedValue<number>(pressure ? 1 : 0);
  React.useEffect(() => {
    pressureSV.value = withTiming(pressure ? 1 : 0, {
      duration: transitionMs,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [pressure, transitionMs, pressureSV]);

  const inputRange = React.useMemo(() => [...BAND_INDEX_STOPS], []);
  const calmPrimaryStops = React.useMemo(() => [...PRIMARY_STOPS], []);
  const pressurePrimaryStops = React.useMemo(
    () => [...PRIMARY_STOPS_PRESSURE],
    [],
  );
  const calmGlowStops = React.useMemo(() => [...GLOW_STOPS], []);
  const pressureGlowStops = React.useMemo(() => [...GLOW_STOPS_PRESSURE], []);

  const animatedPrimary = useDerivedValue<string>(() => {
    const calm = interpolateColor(
      bandIndexSV.value,
      inputRange,
      calmPrimaryStops,
      'RGB',
    );
    const heat = interpolateColor(
      bandIndexSV.value,
      inputRange,
      pressurePrimaryStops,
      'RGB',
    );
    return interpolateColor(
      pressureSV.value,
      [0, 1],
      [calm as string, heat as string],
      'RGB',
    ) as string;
  }, [inputRange, calmPrimaryStops, pressurePrimaryStops]);

  const animatedGlow = useDerivedValue<string>(() => {
    const calm = interpolateColor(
      bandIndexSV.value,
      inputRange,
      calmGlowStops,
      'RGB',
    );
    const heat = interpolateColor(
      bandIndexSV.value,
      inputRange,
      pressureGlowStops,
      'RGB',
    );
    return interpolateColor(
      pressureSV.value,
      [0, 1],
      [calm as string, heat as string],
      'RGB',
    ) as string;
  }, [inputRange, calmGlowStops, pressureGlowStops]);

  // Intensity oscillator — pulses 0..1 at the band's animationSpeed. Worse
  // band = faster pulse; pressure mode multiplies on top via animationSpeed.
  const intensitySV = useSharedValue<number>(0);
  const speed = snapshot.animationSpeed;
  React.useEffect(() => {
    cancelAnimation(intensitySV);
    const halfPeriodMs = Math.max(180, Math.round(900 / speed));
    intensitySV.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: halfPeriodMs,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: halfPeriodMs,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(intensitySV);
  }, [speed, intensitySV]);

  return {
    snapshot,
    animatedPrimary,
    animatedGlow,
    intensitySV,
    animationSpeed: speed,
  };
}
