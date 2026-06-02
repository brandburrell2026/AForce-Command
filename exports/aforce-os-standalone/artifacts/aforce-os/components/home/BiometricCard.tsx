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
import { Colors } from '../../theme/colors';

export interface BiometricFooterMetric {
  label: string;
  value: string;
  /** Optional override tint for the value (defaults to white). */
  valueColor?: string;
}

interface Props {
  eyebrow: string;
  /** Status dot + heroValue tint. Use one of Colors.states.* primary. */
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
              <View style={styles.footerCell}>
                <Text style={styles.footerLabel}>{m.label}</Text>
                <Text style={[styles.footerValue, m.valueColor ? { color: m.valueColor } : null]}>
                  {m.value}
                </Text>
              </View>
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
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.medium,
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
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2.2,
  },
  estBadge: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.8,
    color: Colors.text.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.medium,
  },

  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  heroValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 34,
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  heroLabel: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.1,
  },

  subline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: 0.1,
    marginTop: 10,
    lineHeight: 18,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.subtle,
  },
  footerCell: { flex: 1 },
  footerDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: Colors.border.subtle,
    marginHorizontal: 10,
  },
  footerLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.text.secondary,
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  footerValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
});
