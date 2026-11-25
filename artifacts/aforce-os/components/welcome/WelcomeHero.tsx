/**
 * WelcomeHero — AFORCE OS cold-launch "front door".
 *
 * Shown after the cold-launch cinematic (components/opening/OpeningSequence.tsx).
 * It is mounted as an overlay in app/_layout.tsx (AppShell), UNDER the cinematic
 * (zIndex 999 vs the cinematic's 1000), so when the cinematic fades out it
 * crossfades into this opaque surface with no black flash and no app
 * bleed-through. It touches NO routing itself; the buttons call back into
 * AppShell, which navigates and dismisses.
 *
 * Founder direction, 2026-11-22: this screen uses the new style. It is the
 * same layout as the promise screen a signed-out member lands on
 * (components/auth/PromiseScreen.tsx): the mark, one promise, two ways in.
 * The earlier design (full-bleed portrait, Archivo Black wordmark, a red
 * "GET STARTED" pill) is retired. Where the two buttons go is unchanged.
 *
 * Pure presentation: nothing here awards, mutates, or reads a score.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PromiseView } from '@/components/auth/PromiseScreen';
import { af } from '@/theme';

interface Props {
  /** Flips true once the cinematic has finished. While false the screen stays
   *  inert behind the cinematic: no taps and no screen-reader focus. */
  active: boolean;
  /** Primary button — routes into the existing onboarding flow. */
  onGetStarted: () => void;
  /** Secondary button — routes into the existing sign-in route. */
  onSignIn: () => void;
}

export function WelcomeHero({ active, onGetStarted, onSignIn }: Props) {
  return (
    <View
      style={styles.root}
      pointerEvents={active ? 'auto' : 'none'}
      accessibilityViewIsModal={active}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      testID="welcome-hero"
    >
      <PromiseView onCreate={onGetStarted} onSignIn={onSignIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: af.canvas,
    zIndex: 999,
    elevation: 999,
  },
});
