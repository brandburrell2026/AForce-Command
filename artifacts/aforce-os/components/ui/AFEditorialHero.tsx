/**
 * AFEditorialHero — full-bleed editorial photography with a gradient scrim and
 * a content-safe zone (spec §3.5, §5). The "editorial cinema" register for
 * welcome / milestone / weekly-insight moments — NOT for routine metrics.
 *
 * The scrim guarantees the eyebrow/title/subtitle + CTA slot stay legible over
 * any crop (spec §8.1: "photography must retain a readable scrim at all crops").
 */
import React from 'react';
import {
  ImageBackground,
  View,
  Text,
  StyleSheet,
  type ImageSourcePropType,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { af, afType, afLayout } from '@/theme';

export interface AFEditorialHeroProps {
  source: ImageSourcePropType;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  /** CTA slot rendered in the content-safe zone below the copy. */
  children?: React.ReactNode;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AFEditorialHero({
  source,
  title,
  eyebrow,
  subtitle,
  children,
  height,
  style,
  testID,
}: AFEditorialHeroProps) {
  return (
    <ImageBackground
      source={source}
      style={[styles.hero, height ? { height } : styles.fill, style]}
      testID={testID}
    >
      <LinearGradient
        colors={['transparent', 'rgba(5,5,6,0.35)', af.canvas]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.safeZone}>
        {eyebrow && <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>}
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {children && <View style={styles.cta}>{children}</View>}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  hero: { justifyContent: 'flex-end', overflow: 'hidden' },
  fill: { flex: 1 },
  safeZone: { padding: afLayout.screenPaddingX, gap: 6 },
  eyebrow: { ...afType.eyebrow, color: af.red },
  title: { ...afType.displayHero, color: af.textPrimary },
  subtitle: { ...afType.body, color: af.textSecondary, marginTop: 2 },
  cta: { marginTop: 20, gap: 12 },
});
