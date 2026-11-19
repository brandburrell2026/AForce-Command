/**
 * WorldPhotoHero — the photograph behind the top of a screen, as in the
 * approved prototype: edge to edge, fading into the canvas so the title
 * reads on it. WorldPhotoThumb is the small square on a card.
 *
 * Both draw nothing when there is no photograph to show (a public build, or
 * no scene), so a screen that uses them looks exactly as it did.
 *
 * The hero is laid behind the content, not around it: put it first inside
 * the scrolling content and follow the top row with <WorldPhotoGap />.
 */
import React from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { af, withAlpha } from '@/theme';

export const WORLD_HERO_HEIGHT = 420;
/** Space between a screen's top row and its title, so the title sits at the photograph's foot. */
export const WORLD_HERO_GAP = 150;

export function WorldPhotoHero({
  source,
  bleed = 0,
  height = WORLD_HERO_HEIGHT,
  lift = 0,
  dim = false,
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
  testID?: string;
}) {
  if (source == null) return null;
  return (
    <View
      pointerEvents="none"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.hero, { top: -lift, left: -bleed, right: -bleed, height: height + lift }]}
      testID={testID}
    >
      <Image source={source} style={styles.fill} resizeMode="cover" />
      <LinearGradient
        colors={
          dim
            ? [withAlpha(af.canvas, 0.7), withAlpha(af.canvas, 0.55), withAlpha(af.canvas, 0.6), withAlpha(af.canvas, 0.85), af.canvas]
            : [withAlpha(af.canvas, 0.6), withAlpha(af.canvas, 0.1), withAlpha(af.canvas, 0.05), withAlpha(af.canvas, 0.6), af.canvas]
        }
        locations={[0, 0.22, 0.42, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
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
