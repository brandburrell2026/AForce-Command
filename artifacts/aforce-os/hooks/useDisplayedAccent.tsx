/**
 * useDisplayedAccent — shared tween for the home screen's score-driven UI.
 *
 * Why this exists:
 *   The orb's score number is animated (counts up/down over ~900ms via
 *   `AnimatedScore`). Without this hook, every other state-tinted
 *   element on the home screen (AI Coach card, prediction strip,
 *   "Become AForce" CTA) recolors INSTANTLY when the engine reports a
 *   new band — so the AI Coach turns green while the displayed number
 *   is still rolling up through the amber band.
 *
 *   This provider runs ONE tween from the engine's previous score to
 *   the new score, exposes the rounded in-flight value, and derives a
 *   band-correct accent from it. Every consumer that calls
 *   `useDisplayedAccent()` recolors on the same animation frame the
 *   orb digit changes — so the AI Coach colour change is locked in
 *   step with the score change the user actually sees.
 *
 *   Outside the provider (e.g. on the Protocol or Check screens),
 *   `useDisplayedAccent()` returns `null`, and consumers fall back to
 *   the engine's instantaneous accent. Both paths are valid — the
 *   provider is opt-in per screen.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  useSharedValue,
  withTiming,
  withSequence,
  useAnimatedReaction,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

import { levelForScore, accentForLevel, type BandAccent } from '../utils/scoreBand';

/**
 * Module-level flag — the dynamic state boot animation should fire
 * once per cold start, not every time the home tab gains focus or the
 * provider remounts (e.g. after switching tabs and back).
 */
let bootPlayed = false;

/** Test-only reset hook. */
export function __resetBootForTests(): void {
  bootPlayed = false;
}

export interface DisplayedAccent extends BandAccent {
  /** The currently-rendered score (in-flight tween value, rounded). */
  displayedScore: number;
}

const DisplayedAccentContext = createContext<DisplayedAccent | null>(null);

interface ProviderProps {
  /** Target score from the engine. Tween animates from previous to this. */
  score: number;
  /** Tween duration in ms. Match `AnimatedScore` (default 900). */
  durationMs?: number;
  children: React.ReactNode;
}

/**
 * Wraps the home screen so every state-tinted child can read the
 * displayed score and its derived accent. Mount once at the screen
 * root, after the engine slice is available.
 */
export function DisplayedAccentProvider({ score, durationMs = 900, children }: ProviderProps) {
  // Dynamic state boot — on cold start, sweep the ring 0 → 100 → score
  // so it visibly passes through every band (red → amber → teal → lime)
  // and then settles into the user's actual state. After that first
  // sequence, behaviour returns to the standard "tween from previous
  // to new" pattern. The boot only fires once per app session.
  const bootThisMount = useRef(!bootPlayed);
  const animated = useSharedValue(bootThisMount.current ? 0 : score);
  const [displayed, setDisplayed] = useState(bootThisMount.current ? 0 : score);
  const hasBooted = useRef(!bootThisMount.current);

  useEffect(() => {
    if (!hasBooted.current) {
      // Phase 1: 0 → 100  (sweep through every band)
      // Phase 2: 100 → score (settle into the user's actual band)
      // Easing.inOut feels intentional, not jittery, on both phases.
      const sweepMs = 1300;
      const settleMs = 700;
      animated.value = withSequence(
        withTiming(100, { duration: sweepMs, easing: Easing.inOut(Easing.cubic) }),
        withTiming(score, { duration: settleMs, easing: Easing.out(Easing.cubic) }),
      );
      hasBooted.current = true;
      bootPlayed = true;
      return;
    }
    animated.value = withTiming(score, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [score, durationMs]);

  // Bridge the worklet shared-value into JS state so React renders.
  // Math.round matches the visible digit on the orb.
  useAnimatedReaction(
    () => animated.value,
    (v) => runOnJS(setDisplayed)(Math.round(v)),
  );

  const accent = accentForLevel(levelForScore(displayed));
  const value: DisplayedAccent = {
    displayedScore: displayed,
    level: accent.level,
    primary: accent.primary,
    glow: accent.glow,
  };

  return (
    <DisplayedAccentContext.Provider value={value}>
      {children}
    </DisplayedAccentContext.Provider>
  );
}

/**
 * Returns the current displayed accent, or `null` when not inside a
 * `<DisplayedAccentProvider/>`. Consumers should fall back to the
 * engine's instantaneous performanceState in that case.
 */
export function useDisplayedAccent(): DisplayedAccent | null {
  return useContext(DisplayedAccentContext);
}
