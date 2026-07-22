/**
 * PerformanceMemoryGovernanceCard — the read-only governance surface for
 * Performance Memory™.
 *
 * It projects the unified Performance Memory snapshot (via the pure
 * `useUnifiedPerformanceMemory` hook) into a summarized, human-readable
 * read-out plus per-source coverage so a member can see exactly what the app
 * has observed about their behaviour. The single "Delete" action calls
 * `clearPerformanceMemoryCapture()`, which permanently erases the three
 * locally-captured observational streams (travel / caffeine / self-reported
 * priority).
 *
 * Score-Protection: this card is display + delete ONLY. It dispatches nothing
 * into the hydration reducer and never awards, reads-into, mutates, or
 * fabricates score. Mounted behind `performance_memory_governance_enabled`;
 * capture itself is always-on and independent of this flag.
 *
 * Self-contained so it can drop into the existing Profile settings card
 * without adding navigation (replit.md build lock).
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Colors } from '@/theme/colors';
import { Icon, type IconName } from '@/components/Icon';
import { useUnifiedPerformanceMemory } from '@/hooks/useUnifiedPerformanceMemory';
import { clearPerformanceMemoryCapture } from '@/services/performanceMemoryCapture';

/** Coverage hint: "{n} observed", or a neutral empty-state string. */
function coverageHint(t: TFunction, available: boolean, sampleSize: number): string {
  if (!available || sampleSize <= 0) return t('settings.common.no_data');
  return t('settings.perfMemory.observed', { count: sampleSize });
}

/** Localized "day"/"days" word by count. */
function dayWord(t: TFunction, n: number): string {
  return n === 1 ? t('settings.common.day') : t('settings.common.days');
}

function MemoryRow(props: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
}) {
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

export function PerformanceMemoryGovernanceCard() {
  const { t } = useTranslation();
  const memory = useUnifiedPerformanceMemory();
  const [busy, setBusy] = React.useState(false);

  const runDelete = React.useCallback(async () => {
    setBusy(true);
    try {
      await clearPerformanceMemoryCapture();
    } finally {
      setBusy(false);
    }
  }, []);

  const onDelete = React.useCallback(() => {
    if (Platform.OS === 'web') {
      void runDelete();
      return;
    }
    Alert.alert(
      t('settings.perfMemory.delete_title'),
      t('settings.perfMemory.delete_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.analyticsConsent.delete_confirm'),
          style: 'destructive',
          onPress: () => {
            void runDelete();
          },
        },
      ],
    );
  }, [runDelete]);

  const {
    hydrationPatterns: hp,
    caffeinePatterns: cp,
    travelPatterns: tp,
    userPriorities: up,
    completionHistory: ch,
    checkInHistory: cih,
    recoveryPatterns: rp,
    performanceAgeHistory: pah,
    lastUpdated,
  } = memory;

  const updatedLabel =
    lastUpdated == null
      ? t('settings.perfMemory.no_memory')
      : t('settings.perfMemory.updated', { date: new Date(lastUpdated).toLocaleDateString() });

  return (
    <View style={styles.wrap} testID="performance-memory-governance">
      <View style={styles.header}>
        <Icon name="activity" size={16} color={Colors.text.secondary} />
        <View style={styles.textWrap}>
          <Text style={styles.title}>{t('settings.perfMemory.title')}</Text>
          <Text style={styles.subTitle}>{t('settings.perfMemory.subtitle')}</Text>
        </View>
      </View>

      <View style={styles.list}>
        <MemoryRow
          icon="droplet"
          label={t('settings.perfMemory.row_hydration')}
          value={`${hp.totalLogs}`}
          hint={t('settings.perfMemory.hint_active', {
            count: hp.daysActive,
            days: dayWord(t, hp.daysActive),
            coverage: coverageHint(t, hp.coverage.available, hp.coverage.sampleSize),
          })}
        />
        <MemoryRow
          icon="coffee"
          label={t('settings.perfMemory.row_caffeine')}
          value={`${cp.totalLogs}`}
          hint={t('settings.perfMemory.hint_days_cov', {
            count: cp.daysWithCaffeine,
            days: dayWord(t, cp.daysWithCaffeine),
            coverage: coverageHint(t, cp.coverage.available, cp.coverage.sampleSize),
          })}
        />
        <MemoryRow
          icon="navigation"
          label={t('settings.perfMemory.row_travel')}
          value={`${tp.travelDays}`}
          hint={coverageHint(t, tp.coverage.available, tp.coverage.sampleSize)}
        />
        <MemoryRow
          icon="target"
          label={t('settings.perfMemory.row_priority')}
          value={up.topGoal ?? '—'}
          hint={t('settings.perfMemory.hint_days_cov', {
            count: up.daysRecorded,
            days: dayWord(t, up.daysRecorded),
            coverage: coverageHint(t, up.coverage.available, up.coverage.sampleSize),
          })}
        />
        <MemoryRow
          icon="check-circle"
          label={t('settings.perfMemory.row_completion')}
          value={ch.total > 0 ? `${ch.followed}/${ch.total}` : '—'}
          hint={coverageHint(t, ch.coverage.available, ch.coverage.sampleSize)}
        />
        <MemoryRow
          icon="calendar"
          label={t('settings.perfMemory.row_checkins')}
          value={`${cih.entriesLogged}`}
          hint={t('settings.perfMemory.hint_streak', { count: cih.streak, days: dayWord(t, cih.streak) })}
        />
        <MemoryRow
          icon="battery"
          label={t('settings.perfMemory.row_recovery')}
          value={rp.available && rp.recovery != null ? `${Math.round(rp.recovery)}` : '—'}
          hint={rp.available && rp.trend ? rp.trend : t('settings.common.no_data')}
        />
        <MemoryRow
          icon="trending-up"
          label={t('settings.perfMemory.row_perf_age')}
          value={pah.latest != null ? `${pah.latest}` : '—'}
          hint={t('settings.perfMemory.hint_days_cov', {
            count: pah.daysOfHistory,
            days: dayWord(t, pah.daysOfHistory),
            coverage: coverageHint(t, pah.coverage.available, pah.coverage.sampleSize),
          })}
        />
      </View>

      <Text style={styles.updated}>{updatedLabel}</Text>

      <Pressable
        onPress={onDelete}
        disabled={busy}
        style={styles.deleteBtn}
        accessibilityRole="button"
        accessibilityLabel={t('settings.perfMemory.delete_a11y')}
        testID="performance-memory-delete"
      >
        <Text style={styles.deleteLabel}>{t('settings.perfMemory.delete_btn')}</Text>
      </Pressable>
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
  deleteBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  deleteLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.2,
    color: '#FF2800',
  },
});

export default PerformanceMemoryGovernanceCard;
