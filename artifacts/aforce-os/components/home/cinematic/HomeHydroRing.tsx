/**
 * HomeHydroRing — the HydroState ring on Home (prototype: 104pt, a thin track,
 * a warm-white arc, fine tick marks inside, and one small dot at the arc's end).
 * Presentation only; it draws the value it is given.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

export const HOME_RING_SIZE = 104;
const STROKE = 4;
const TICKS = 48;

export interface HomeHydroRingProps {
  /** 0–1. */
  progress: number;
  value: string;
  label: string;
  size?: number;
  accessibilityLabel: string;
}

export function HomeHydroRing({ progress, value, label, size = HOME_RING_SIZE, accessibilityLabel }: HomeHydroRingProps) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const c = size / 2;
  const r = c - STROKE / 2 - 2;
  const circumference = 2 * Math.PI * r;
  const end = -Math.PI / 2 + p * 2 * Math.PI;
  const tickOuter = r - 8;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
    >
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={af.surfacePressed} strokeWidth={STROKE} fill="none" />
        {Array.from({ length: TICKS }).map((_, i) => {
          const a = (i / TICKS) * 2 * Math.PI;
          const major = i % 4 === 0;
          const inner = tickOuter - (major ? 5 : 3);
          return (
            <Line
              key={i}
              x1={c + Math.cos(a) * inner}
              y1={c + Math.sin(a) * inner}
              x2={c + Math.cos(a) * tickOuter}
              y2={c + Math.sin(a) * tickOuter}
              stroke={af.textTertiary}
              strokeOpacity={major ? 0.55 : 0.28}
              strokeWidth={1}
            />
          );
        })}
        {p > 0 ? (
          <>
            <Circle
              cx={c}
              cy={c}
              r={r}
              stroke={af.textPrimary}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference * p} ${circumference}`}
              transform={`rotate(-90 ${c} ${c})`}
            />
            <Circle cx={c + Math.cos(end) * r} cy={c + Math.sin(end) * r} r={4} fill={af.red} />
          </>
        ) : null}
      </Svg>
      <View style={styles.centre} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.value} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{value}</Text>
        <Text style={styles.label} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{label.toUpperCase()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: 'Inter_300Light', fontSize: 28, lineHeight: 32, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  label: { fontFamily: 'IBMPlexMono_500Medium', fontSize: 7.5, letterSpacing: 1.1, color: af.textSecondary, marginTop: 2 },
});
