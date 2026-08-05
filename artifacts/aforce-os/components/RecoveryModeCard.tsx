/**
 * RecoveryModeCard — Post-drinking recovery surface.
 *
 * Renders during the 8h Recovery Mode window. Shows the recovery
 * checklist (water, AForce RTD, sleep), an estimated morning recovery
 * time, and a calm headline. Voice tone: protective, never moralizing.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useTranslation } from 'react-i18next';

import { Colors } from '../theme/colors';
import { af } from '../theme';

interface Props {
  /**
   * Minutes remaining in the 8h Recovery window. Reframed in chunk #3c
   * to be purely a time-since-session-end value — no BAC math is
   * involved any more. Kept the prop name to avoid churning every
   * callsite; rename in a follow-up if/when the API is stabilised.
   */
  timeToClearMinutes: number;
}

const STEPS: { key: string; icon: IconName }[] = [
  { key: 'social.recovery_step_water', icon: 'droplet' },
  { key: 'social.recovery_step_rtd',   icon: 'zap' },
  { key: 'social.recovery_step_sleep', icon: 'moon' },
];

const AMBER = af.amber; // RC-2 Ruling E: #F4B23F retired to the approved af.amber (#FFA01E)
const TEAL = '#7CD3E5';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatRecovery(minutes: number, t: (key: string, opts?: any) => string): string {
  if (minutes <= 0) return t('social.recovery_morning_clear');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  // Window-remaining strings, framed as a recovery countdown rather
  // than a BAC clear-time. The translation keys are reused from the
  // existing bundle to avoid a full i18n migration this pass — the
  // surrounding context now reads as "X remaining in window".
  if (h === 0) return `${m}m remaining`;
  if (m === 0) return `${h}h remaining`;
  return `${h}h ${m}m remaining`;
}

export function RecoveryModeCard({ timeToClearMinutes }: Props) {
  const { t } = useTranslation();

  return (
    <View style={[styles.card, { borderColor: `${TEAL}40` }]} testID="recovery-mode-card">
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${TEAL}26` }]}>
          <Icon name="sunrise" size={18} color={TEAL} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: TEAL }]}>{t('social.recovery_card_title')}</Text>
          <Text style={styles.title}>{t('social.recovery_morning_estimate')}</Text>
          <Text style={styles.estimate}>{formatRecovery(timeToClearMinutes, t)}</Text>
        </View>
      </View>

      <View style={styles.stepsBlock}>
        <Text style={[styles.stepsLabel, { color: AMBER }]}>{t('social.recovery_steps_label')}</Text>
        {STEPS.map((s) => (
          <View key={s.key} style={styles.stepRow}>
            <Icon name={s.icon} size={14} color={AMBER} style={styles.stepIcon} />
            <Text style={styles.stepText}>{t(s.key)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.disclaimer}>
        Recovery is a directional signal, not a medical metric.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(124,211,229,0.07)',
    padding: 14,
    marginBottom: 12,
    gap: 12,
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
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.65)',
  },
  estimate: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    marginTop: 2,
  },
  stepsBlock: {
    gap: 6,
  },
  stepsLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepIcon: { width: 18 },
  stepText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  disclaimer: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 14,
  },
});
