/**
 * AFStatusBadge — a compact status pill: semantic icon + text + tone color
 * (spec §5). Never relies on color alone — the icon + label carry the meaning
 * too (spec §3.1 / §11).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType } from '@/theme';

export type AFStatusTone = 'neutral' | 'positive' | 'caution' | 'info' | 'critical';

const TONE_COLOR: Record<AFStatusTone, string> = {
  neutral: af.textSecondary,
  positive: af.green,
  caution: af.amber,
  info: af.cyan,
  critical: af.red,
};

const TONE_ICON: Record<AFStatusTone, IconName> = {
  neutral: 'minus',
  positive: 'check-circle',
  caution: 'alert-triangle',
  info: 'info',
  critical: 'alert-circle',
};

export interface AFStatusBadgeProps {
  label: string;
  tone?: AFStatusTone;
  /** Override the tone's default icon. Pass null to hide the icon. */
  icon?: IconName | null;
  testID?: string;
}

export function AFStatusBadge({ label, tone = 'neutral', icon, testID }: AFStatusBadgeProps) {
  const color = TONE_COLOR[tone];
  const glyph = icon === null ? null : (icon ?? TONE_ICON[tone]);
  return (
    <View
      style={[styles.pill, { backgroundColor: `${hexish(color)}`, borderColor: color }]}
      accessibilityRole="text"
      accessibilityLabel={`${tone}: ${label}`}
      testID={testID}
    >
      {glyph && <Icon name={glyph} size={12} color={color} />}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

// Tone color at low alpha for the pill fill. Solid hex → rgba@0.12; already-rgba
// tokens are used as-is behind a faint scrim.
function hexish(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.12)`;
  }
  return 'rgba(255,255,255,0.04)';
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
  },
  label: { ...afType.caption },
});
