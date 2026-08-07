/**
 * BiometricCard — shared chrome for the three Biometric Intelligence
 * cards (Sweat Loss / Performance Forecast / Recovery Load).
 *
 * Pure visual scaffold: tracked uppercase eyebrow with a colored
 * status dot, hero metric row, optional sub-headline, and an optional
 * 3-cell footer metric row. No state, no data fetching — props in,
 * card out.
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Icon, type IconName } from '../Icon';
import { af, afType, Typography } from '../../theme';
import { AFStatPair } from '../ui/AFStatPair';

export interface BiometricFooterMetric {
  label: string;
  value: string;
  /** Optional override tint for the value (defaults to white). */
  valueColor?: string;
}

interface Props {
  eyebrow: string;
  /** Status dot + heroValue tint. Use an af.* state accent (af.green/cyan/amber/red). */
  accent: string;
  icon: IconName;
  /** Big hero metric — e.g. "82 oz" or "84 ↑". */
  heroValue: string;
  /** Sub-line below the hero metric. */
  heroLabel: string;
  /** Optional 3rd line for AI/forecast copy. */
  subline?: string;
  /** Optional 3-cell footer. */
  metrics?: BiometricFooterMetric[];
  /** When 'low', the card visually dims to signal weak inputs. */
  confidence?: 'high' | 'low';
  style?: ViewStyle;
  testID?: string;
}

function BiometricCardImpl({
  eyebrow,
  accent,
  icon,
  heroValue,
  heroLabel,
  subline,
  metrics,
  confidence = 'high',
  style,
  testID,
}: Props) {
  const dim = confidence === 'low';
  return (
    <View
      style={[styles.card, dim && styles.cardDim, style]}
      testID={testID}
      accessibilityRole="summary"
    >
      <View style={styles.eyebrowRow}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Icon name={icon} size={12} color={accent} />
        <Text style={[styles.eyebrowText, { color: accent }]}>{eyebrow}</Text>
        {dim && <Text style={styles.estBadge}>EST</Text>}
      </View>

      <View style={styles.heroRow}>
        <Text style={[styles.heroValue, { color: accent }]}>{heroValue}</Text>
        <Text style={styles.heroLabel}>{heroLabel}</Text>
      </View>

      {subline ? <Text style={styles.subline}>{subline}</Text> : null}

      {metrics && metrics.length > 0 ? (
        <View style={styles.footer}>
          {metrics.map((m, idx) => (
            <React.Fragment key={m.label}>
              {idx > 0 ? <View style={styles.footerDivider} /> : null}
              <AFStatPair
                label={m.label}
                value={m.value}
                direction="column"
                style={styles.footerCell}
                labelStyle={styles.footerLabel}
                valueStyle={[styles.footerValue, m.valueColor ? { color: m.valueColor } : null]}
              />
            </React.Fragment>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const BiometricCard = React.memo(BiometricCardImpl);

const styles = StyleSheet.create({
  card: {
    backgroundColor: af.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: af.divider,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  cardDim: { opacity: 0.62 },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowText: {
    flex: 1,
    ...afType.eyebrow,
  },
  estBadge: {
    ...afType.microLabel,
    letterSpacing: 1.8,
    color: af.textTertiary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: af.divider,
  },

  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  heroValue: {
    ...afType.title1,
    fontFamily: Typography.fonts.bold,
    letterSpacing: -1.2,
  },
  heroLabel: {
    flex: 1,
    ...afType.caption,
    fontFamily: Typography.fonts.medium,
    letterSpacing: 0.1,
    color: af.textSecondary,
  },

  subline: {
    ...afType.caption,
    fontFamily: Typography.fonts.medium,
    letterSpacing: 0.1,
    color: af.textSecondary,
    marginTop: 10,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: af.divider,
  },
  footerCell: { flex: 1 },
  footerDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: af.divider,
    marginHorizontal: 10,
  },
  footerLabel: {
    ...afType.tab,
    letterSpacing: 1.4,
    color: af.textSecondary,
    marginBottom: 3,
  },
  footerValue: {
    ...afType.caption,
    fontFamily: Typography.fonts.semibold,
    letterSpacing: -0.1,
    color: af.textPrimary,
  },
});
