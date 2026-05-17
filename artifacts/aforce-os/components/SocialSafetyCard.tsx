/**
 * SocialSafetyCard — Legal & transportation protection card.
 *
 * Renders only when `prompt.show === true` (impairment ≥ MODERATE per
 * `legalSafetyService`). Severity drives accent color:
 *   caution  → amber
 *   warning  → crimson-amber
 *   critical → crimson
 *
 * SAFETY: Always shows the "not a legal/medical determination" footer.
 * Never says the user is "safe to drive" — only escalates the
 * recommendation away from driving.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme/colors';
import type { TransportationSafetyPrompt, TransportationSeverity } from '../types';

interface Props {
  prompt: TransportationSafetyPrompt;
}

const ACCENT: Record<TransportationSeverity, string> = {
  info:     '#9D7CFB',
  caution:  '#F4B23F',
  warning:  '#FB7C7C',
  critical: '#E63946',
};

const ICON: Record<TransportationSeverity, IconName> = {
  info:     'info',
  caution:  'alert-circle',
  warning:  'alert-triangle',
  critical: 'alert-octagon',
};

export function SocialSafetyCard({ prompt }: Props) {
  const { t } = useTranslation();
  if (!prompt.show) return null;
  const accent = ACCENT[prompt.severity];

  return (
    <View
      style={[
        styles.card,
        { borderColor: `${accent}55`, backgroundColor: `${accent}14` },
      ]}
      accessibilityRole="alert"
      testID="social-safety-card"
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${accent}26` }]}>
          <Icon name={ICON[prompt.severity]} size={18} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: accent }]}>{t('social.safety_title')}</Text>
          <Text style={styles.title}>{t(prompt.titleKey)}</Text>
        </View>
      </View>

      <Text style={styles.body}>{t(prompt.bodyKey)}</Text>

      <View style={styles.transportRow}>
        <Icon name="navigation" size={14} color={accent} />
        <Text style={[styles.transportText, { color: accent }]}>
          {t('social.safety_transportation')}
        </Text>
      </View>

      {prompt.stopDrinking && (
        <View style={styles.stopRow}>
          <Icon name="slash" size={13} color={accent} />
          <Text style={[styles.stopText, { color: accent }]}>
            {t('social.safety_stop_drinking')}
          </Text>
        </View>
      )}

      <Text style={styles.disclaimer}>{t(prompt.disclaimerKey)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    lineHeight: 19,
  },
  body: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
    marginTop: 2,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  transportText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  disclaimer: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 14,
    marginTop: 4,
  },
});
