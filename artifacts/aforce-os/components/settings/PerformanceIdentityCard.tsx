/**
 * PerformanceIdentityCard — INTERNAL raw-signal readout for Performance
 * Identity™ (Phase 2 foundation).
 *
 * This is a verification surface, not a product feature. It shows the RAW
 * behavioural signals a future archetype classifier would read, plus an
 * explicit "Classification — not assigned (inert)" banner so a reviewer can
 * confirm at a glance that NO archetype is being produced in this build. The
 * `archetype` / `confidence` values it renders come straight from the pure
 * `derivePerformanceIdentity`, which hardcodes them to null.
 *
 * Score-Protection: display ONLY. It dispatches nothing and never awards,
 * reads-into, mutates, or fabricates score. Mounted behind
 * `performance_identity_enabled` (OFF in the production binary).
 *
 * Self-contained so it can drop into the existing Profile settings card
 * without adding navigation (replit.md build lock).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { usePerformanceIdentity } from '@/hooks/usePerformanceIdentity';

function pct(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

function num(value: number | null): string {
  return value == null ? '—' : `${Math.round(value)}`;
}

function SignalRow(props: { icon: IconName; label: string; value: string; hint: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Icon name={props.icon} size={15} color={Colors.text.secondary} />
        <View style={styles.textWrap}>
          <Text style={styles.label}>{props.label}</Text>
          <Text style={styles.hint}>{props.hint}</Text>
        </View>
      </View>
      <Text style={styles.value}>{props.value}</Text>
    </View>
  );
}

export function PerformanceIdentityCard() {
  const { t } = useTranslation();
  const identity = usePerformanceIdentity();
  // Intentionally do NOT read archetype/confidence for display. The classifier
  // is inert in this build, and this surface is a verification readout that
  // shows raw signals, not verdicts — so the banner is unconditionally
  // "NOT ASSIGNED" and there is no display path that could ever render an
  // archetype, even if a future derivation regressed.
  const { supportingSignals: s, lastUpdated } = identity;

  const updatedLabel =
    lastUpdated == null
      ? t('settings.perfIdentity.no_signals')
      : t('settings.perfIdentity.signals_updated', { date: new Date(lastUpdated).toLocaleDateString() });

  const topGoalTypes =
    s.adherence.preferredCommandTypes.length > 0
      ? s.adherence.preferredCommandTypes.map((p) => p.commandType).join(', ')
      : t('settings.perfIdentity.none_yet');

  return (
    <View style={styles.wrap} testID="performance-identity">
      <View style={styles.header}>
        <Icon name="activity" size={16} color={Colors.text.secondary} />
        <View style={styles.textWrap}>
          <Text style={styles.title}>{t('settings.perfIdentity.title')}</Text>
          <Text style={styles.subTitle}>{t('settings.perfIdentity.subtitle')}</Text>
        </View>
      </View>

      {/* Inert classification banner — proves no verdict is produced. */}
      <View style={styles.banner} testID="performance-identity-classification">
        <Text style={styles.bannerLabel}>{t('settings.perfIdentity.classification')}</Text>
        <Text style={styles.bannerValue}>{t('settings.perfIdentity.not_assigned')}</Text>
        <Text style={styles.bannerHint}>{t('settings.perfIdentity.confidence_disabled')}</Text>
      </View>

      <View style={styles.list}>
        <SignalRow
          icon="droplet"
          label={t('settings.perfIdentity.row_consistency')}
          value={t('settings.perfIdentity.value_days', { count: s.consistency.hydrationDaysActive })}
          hint={t('settings.perfIdentity.hint_consistency', { logs: s.consistency.hydrationLogs, checkins: s.consistency.checkInEntries })}
        />
        <SignalRow
          icon="check-circle"
          label={t('settings.perfIdentity.row_completion')}
          value={pct(s.completionRate.allTimeRate)}
          hint={
            s.completionRate.total > 0
              ? t('settings.perfIdentity.hint_completion', { followed: s.completionRate.followed, total: s.completionRate.total })
              : t('settings.perfIdentity.no_commands')
          }
        />
        <SignalRow
          icon="battery"
          label={t('settings.perfIdentity.row_recovery')}
          value={num(s.recoveryBehavior.recovery)}
          hint={s.recoveryBehavior.available && s.recoveryBehavior.trend ? s.recoveryBehavior.trend : t('settings.common.no_data')}
        />
        <SignalRow
          icon="trending-up"
          label={t('settings.perfIdentity.row_streak')}
          value={t('settings.perfIdentity.value_days', { count: s.streakBehavior.executionStreak })}
          hint={t('settings.perfIdentity.hint_streak', {
            days: s.streakBehavior.checkInStreak,
            trend: s.streakBehavior.executionTrend ?? t('settings.perfIdentity.no_trend'),
          })}
        />
        <SignalRow
          icon="target"
          label={t('settings.perfIdentity.row_adherence')}
          value={pct(s.adherence.recentFollowedRate)}
          hint={t('settings.perfIdentity.hint_adherence', { types: topGoalTypes })}
        />
      </View>

      <Text style={styles.updated}>{updatedLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  subTitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.text.secondary,
  },
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.medium,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  bannerLabel: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Colors.text.muted,
    marginBottom: 3,
  },
  bannerValue: {
    fontFamily: 'IBMPlexMono_500Medium',
    fontSize: 14,
    letterSpacing: 0.3,
    color: Colors.text.primary,
  },
  bannerHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 14,
    color: Colors.text.secondary,
    marginTop: 3,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  textWrap: { flex: 1 },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.text.primary,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 14,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  value: {
    fontFamily: 'IBMPlexMono_500Medium',
    fontSize: 13,
    color: Colors.text.primary,
  },
  updated: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.3,
    color: Colors.text.muted,
    marginTop: 12,
    textTransform: 'uppercase',
  },
});

export default PerformanceIdentityCard;
