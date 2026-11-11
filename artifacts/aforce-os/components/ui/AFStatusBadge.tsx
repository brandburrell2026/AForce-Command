/**
 * AFStatusBadge — a compact status pill: text + tone color, optional semantic
 * icon (spec §5). Never relies on color alone — the LABEL carries the meaning
 * (the tone word is also spoken in the accessibility label), and a caller can
 * add the tone's icon with `icon` (spec §3.1 / §11).
 *
 * Black Issue: an OUTLINED pill — transparent fill, 1pt tone border, tracked
 * mono micro caps ("OPTIMAL", "COMING SOON"). No icon unless asked for.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType } from '@/theme';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';

export type AFStatusTone = 'neutral' | 'positive' | 'caution' | 'info' | 'critical';

// Pill fill + border tone (brand tint). critical keeps frozen Signal Red.
const TONE_COLOR: Record<AFStatusTone, string> = {
  neutral: af.textSecondary,
  positive: af.green,
  caution: af.amber,
  info: af.cyan,
  critical: af.red,
};

// Label + icon color. Only `critical` differs: Signal Red as text fails WCAG AA
// (~2.9:1 on the tinted pill), so the label/icon use the lightened redText while
// the pill fill/border stay the brand red above. Others already pass AA.
const TONE_TEXT_COLOR: Record<AFStatusTone, string> = {
  ...TONE_COLOR,
  critical: af.redText,
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
  /**
   * Icon inside the pill: `true` = the tone's own glyph, an IconName = that
   * glyph, omitted/null = text only (default).
   */
  icon?: IconName | true | null;
  /** 'outline' (default) = transparent fill; 'filled' = tone fill, on-tone text. */
  variant?: 'outline' | 'filled';
  testID?: string;
}

export function AFStatusBadge({ label, tone = 'neutral', icon, variant = 'outline', testID }: AFStatusBadgeProps) {
  const eyebrowType = useAFEyebrowType();
  const color = TONE_COLOR[tone];
  const filled = variant === 'filled';
  const textColor = filled ? (tone === 'critical' ? af.onRed : af.canvas) : TONE_TEXT_COLOR[tone];
  const glyph = icon === true ? TONE_ICON[tone] : icon || null;
  return (
    <View
      style={[styles.pill, { borderColor: color, backgroundColor: filled ? color : 'transparent' }]}
      accessibilityRole="text"
      accessibilityLabel={`${tone}: ${label}`}
      testID={testID}
    >
      {glyph && <Icon name={glyph} size={10} color={textColor} />}
      <Text style={[[styles.label, eyebrowType], { color: textColor }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  // 11pt mono (afType.eyebrow): the reference pill reads ~9pt, but a word
  // that carries status stays at the 11pt legibility floor (review S3).
  label: { ...afType.eyebrow },
});
