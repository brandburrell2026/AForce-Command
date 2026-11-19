/**
 * The World photograph pieces, as in the approved prototype.
 *
 *   WorldPhotoImage   the picture itself, with the prototype's slow drift:
 *                     it starts a touch enlarged and eases to rest. Once,
 *                     each time the picture changes; never with Reduce Motion.
 *   WorldPhotoHero    the picture behind the top of a screen, edge to edge,
 *                     fading into the canvas so the title reads on it.
 *   WorldPhotoGap     the space under a screen's top row when a hero shows.
 *   WorldPhotoThumb   the small square on a card (no drift).
 *
 * All draw nothing when there is no photograph to show (a public build, or
 * no scene), so a screen that uses them looks exactly as it did.
 *
 * The hero is laid behind the content, not around it: put it first inside
 * the scrolling content and follow the top row with <WorldPhotoGap />.
 */
import React from 'react';
import { AccessibilityInfo, Animated, Easing, Image, type ImageSourcePropType, type ImageStyle, type StyleProp, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { af, withAlpha } from '@/theme';

export const WORLD_HERO_HEIGHT = 420;
/** Space between a screen's top row and its title, so the title sits at the photograph's foot. */
export const WORLD_HERO_GAP = 150;

/** The prototype's drift: from 6% enlarged to rest, over six seconds. */
export const WORLD_DRIFT_FROM = 1.06;
export const WORLD_DRIFT_MS = 6000;

/** Reduce Motion, read from the system directly (this file must load without Reanimated). */
function useReduceMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => { if (live) setReduced(!!on); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => setReduced(!!on));
    return () => { live = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

export function WorldPhotoImage({
  source,
  style,
  fadeMs = 0,
  testID,
}: {
  source: ImageSourcePropType;
  style?: StyleProp<ImageStyle>;
  /** Fade the picture in over this long (One Breath's reveal). 0 = no fade. */
  fadeMs?: number;
  testID?: string;
}) {
  const reduced = useReduceMotion();
  const scale = React.useRef(new Animated.Value(reduced ? 1 : WORLD_DRIFT_FROM)).current;
  const opacity = React.useRef(new Animated.Value(reduced || fadeMs === 0 ? 1 : 0)).current;
  React.useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    scale.setValue(WORLD_DRIFT_FROM);
    const moves = [
      Animated.timing(scale, { toValue: 1, duration: WORLD_DRIFT_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ];
    if (fadeMs > 0) {
      opacity.setValue(0);
      moves.push(Animated.timing(opacity, { toValue: 1, duration: fadeMs, easing: Easing.out(Easing.cubic), useNativeDriver: true }));
    }
    const run = Animated.parallel(moves);
    run.start();
    return () => run.stop();
    // Runs again only when the picture itself changes.
  }, [source, reduced, fadeMs, scale, opacity]);
  return (
    <Animated.Image
      source={source}
      resizeMode="cover"
      style={[styles.fill, style, { opacity, transform: [{ scale }] }]}
      testID={testID}
    />
  );
}

/** How the photograph is darkened so what sits on it stays readable. */
export type WorldWash = 'hero' | 'dim' | 'breath' | 'breathQuiet';
const c = (a: number) => withAlpha(af.canvas, a);
const WASH: Record<WorldWash, { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] }> = {
  // A screen title at the photograph's foot.
  hero: { colors: [c(0.6), c(0.1), c(0.05), c(0.6), af.canvas], locations: [0, 0.22, 0.42, 0.72, 1] },
  // Controls or readings sit on the photograph.
  dim: { colors: [c(0.7), c(0.55), c(0.6), c(0.85), af.canvas], locations: [0, 0.22, 0.42, 0.72, 1] },
  // One Breath: the prototype's scene — clear at the top, gone by mid-screen.
  breath: { colors: [c(0.35), c(0.3), c(0.62), c(0.93), af.canvas], locations: [0, 0.2, 0.36, 0.5, 0.62] },
  // One Breath in Quiet: the same scene, turned right down.
  breathQuiet: { colors: [c(0.75), c(0.72), c(0.85), c(0.96), af.canvas], locations: [0, 0.2, 0.36, 0.5, 0.62] },
};

export function WorldPhotoHero({
  source,
  bleed = 0,
  height = WORLD_HERO_HEIGHT,
  lift = 0,
  dim = false,
  wash,
  fill = false,
  fadeMs = 0,
  testID = 'world-photo-hero',
}: {
  source: ImageSourcePropType | undefined;
  /** The screen's side padding, which the photograph runs past. */
  bleed?: number;
  height?: number;
  /** How far the photograph starts above its parent (a parent that sits below the status bar). */
  lift?: number;
  /** A darker wash, for screens whose controls or readings sit on the photograph. */
  dim?: boolean;
  /** Names the wash outright; wins over `dim`. */
  wash?: WorldWash;
  /** Cover the whole parent instead of a band at its top (One Breath). */
  fill?: boolean;
  fadeMs?: number;
  testID?: string;
}) {
  if (source == null) return null;
  const w = WASH[wash ?? (dim ? 'dim' : 'hero')];
  return (
    <View
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.hero,
        fill ? StyleSheet.absoluteFill : { top: -lift, left: -bleed, right: -bleed, height: height + lift },
      ]}
      testID={testID}
    >
      <WorldPhotoImage source={source} fadeMs={fadeMs} />
      <LinearGradient colors={w.colors} locations={w.locations} style={StyleSheet.absoluteFill} />
    </View>
  );
}

/** The gap under a screen's top row when a photograph is showing. */
export function WorldPhotoGap({ source, height = WORLD_HERO_GAP }: { source: ImageSourcePropType | undefined; height?: number }) {
  return source == null ? null : <View style={{ height }} />;
}

/** The prototype's 44pt square on a Home card. */
export function WorldPhotoThumb({ source, testID }: { source: ImageSourcePropType | undefined; testID?: string }) {
  if (source == null) return null;
  return (
    <Image
      source={source}
      style={styles.thumb}
      resizeMode="cover"
      accessibilityElementsHidden
      importantForAccessibility="no"
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  hero: { position: 'absolute', top: 0, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  thumb: { width: 44, height: 44, borderRadius: 12 },
});
