/**
 * HydrationScreenV2 — the Phase 2 · S5 Hydration redesign (spec §8.2), rendered
 * when `spec_hydration` is on. A live hydration dashboard (vs. the legacy
 * Performance Timeline): intake ring → water/target + electrolytes + recovery →
 * Scan a drink / Log manually → recent intake → a 7-day strip.
 *
 * Same store data as everywhere else; logging goes through the sanctioned
 * `logIntake` action (no scoring change). The legacy Performance Timeline is
 * PRESERVED behind the flag-off path (founder ruling: relocate, never delete).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  AFScreen,
  AFTopBar,
  AFCard,
  AFProgressRing,
  AFPrimaryButton,
  AFSecondaryButton,
  AFSectionLabel,
  AFListRow,
  AFStatusBadge,
  AFEmptyState,
} from '@/components/ui';
import { af, afType } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { useEngineSlice, useActionsSlice } from '@/store/slices';
import { parseDoseOz } from '@/utils/recovery/recoveryCommandFromStore';
import { formatTimeAgo } from '@/data/mockData';
import type { FluidType, IntakeEvent } from '@/types';

interface HydrationActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
}

/** FluidType → i18n key suffix under hydration.v2.fluid_* (translated at render). */
const FLUID_KEY: Record<FluidType, string> = {
  water: 'fluid_water',
  aforce_stick: 'fluid_aforce_stick',
  aforce_rtd: 'fluid_aforce_rtd',
  aforce_canister: 'fluid_aforce_canister',
  aforce_bulk_bag: 'fluid_aforce_bulk_bag',
};

export function HydrationScreenV2() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { state } = useAppStore();
  const engine = useEngineSlice();
  const { logIntake } = useActionsSlice<HydrationActions>();
  const { userState } = state;

  const pct =
    userState.ozTarget > 0
      ? Math.max(0, Math.min(1, userState.ozConsumedToday / userState.ozTarget))
      : 0;
  const recent: IntakeEvent[] = (userState.intakeEvents ?? []).slice(0, 5);
  const streak = Math.max(0, Math.min(7, userState.complianceStreak));
  const todayIdx = new Date(userState.lastIntakeTime).getDay();

  // Locale-aware weekday initials, Sunday-indexed to match getDay(). 2023-01-01
  // was a Sunday; English narrow → S M T W T F S (unchanged), other locales
  // localize. Falls back to English initials if Intl narrow is unavailable.
  const weekdayInitials = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        try {
          return new Date(2023, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: 'narrow' });
        } catch {
          return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][i];
        }
      }),
    [i18n.language],
  );

  // Locale-aware full weekday names for screen readers — the narrow initial
  // ("S"/"M") is ambiguous spoken aloud.
  const weekdayLabels = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        try {
          return new Date(2023, 0, 1 + i).toLocaleDateString(i18n.language, { weekday: 'long' });
        } catch {
          return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i];
        }
      }),
    [i18n.language],
  );

  return (
    <AFScreen scroll>
      <AFTopBar eyebrow={t('hydration.v2.eyebrow')} title={t('hydration.v2.title')} />

      {/* Intake ring + stats */}
      <AFCard variant="raised" style={styles.mainCard}>
        <View style={styles.ringRow}>
          <AFProgressRing progress={pct} size={110} stroke={9}>
            <Text style={styles.ringPct}>{Math.round(pct * 100)}%</Text>
          </AFProgressRing>
          <View style={styles.stats}>
            <Stat
              label={t('hydration.v2.stat_water_logged')}
              value={t('hydration.v2.stat_water_value', {
                consumed: Math.round(userState.ozConsumedToday),
                target: userState.ozTarget,
              })}
            />
            <Stat
              label={t('hydration.v2.stat_electrolytes')}
              value={t('hydration.v2.stat_electrolytes_value', { count: userState.aforceUnitsToday })}
            />
            <View
              style={styles.recoveryRow}
              accessible
              accessibilityLabel={`${t('hydration.v2.recovery_label')} ${titleCase(engine.performanceState.level)}`}
            >
              <Text style={styles.statLabel}>{t('hydration.v2.recovery_label')}</Text>
              <AFStatusBadge
                label={titleCase(engine.performanceState.level)}
                tone={engine.performanceState.level === 'DEPLETED' ? 'critical' : 'neutral'}
                icon={null}
              />
            </View>
          </View>
        </View>
      </AFCard>

      {/* Actions */}
      <View style={styles.actions}>
        <AFPrimaryButton label={t('hydration.v2.scan_a_drink')} icon="camera" onPress={() => router.push('/scan')} />
        <AFSecondaryButton label={t('hydration.v2.log_manually')} onPress={() => void logIntake('water', { ozOverride: parseDoseOz(engine.command.action) })} />
      </View>

      {/* Recent intake */}
      <View style={styles.section}>
        <AFSectionLabel label={t('hydration.v2.recent_intake')} />
        {recent.length === 0 ? (
          <AFCard>
            <AFEmptyState
              icon="droplet"
              title={t('hydration.v2.empty_title')}
              message={t('hydration.v2.empty_message')}
            />
          </AFCard>
        ) : (
          <AFCard padded={false} style={styles.recentCard}>
            {recent.map((e, i) => (
              <AFListRow
                key={e.id}
                icon={e.fluidType === 'water' ? 'droplet' : 'zap'}
                title={t(`hydration.v2.${FLUID_KEY[e.fluidType] ?? 'fluid_default'}`)}
                subtitle={formatTimeAgo(e.loggedAt)}
                value={t('hydration.v2.oz_value', { oz: Math.round(e.oz) })}
              />
            ))}
          </AFCard>
        )}
      </View>

      {/* 7-day strip (streak, honest) */}
      <View style={styles.section}>
        <AFSectionLabel label={t('hydration.v2.this_week')} />
        <View style={styles.strip}>
          {weekdayInitials.map((d, i) => {
            // Fill the most recent `streak` days up to and including today.
            const daysBack = (todayIdx - i + 7) % 7;
            const filled = daysBack < streak;
            const isToday = i === todayIdx;
            return (
              <View
                key={i}
                style={styles.dayCol}
                accessible
                accessibilityLabel={weekdayLabels[i]}
                accessibilityState={{ selected: filled }}
              >
                <View
                  style={[
                    styles.dayDot,
                    filled && styles.dayDotFilled,
                    isToday && styles.dayDotToday,
                  ]}
                />
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{d}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </AFScreen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function titleCase(level: string): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  mainCard: { marginTop: 20 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringPct: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  stats: { flex: 1, gap: 12 },
  stat: { gap: 2 },
  statLabel: { ...afType.eyebrow, color: af.textTertiary },
  statValue: { ...afType.bodyStrong, color: af.textPrimary },
  recoveryRow: { gap: 4, alignItems: 'flex-start' },
  actions: { marginTop: 20, gap: 12 },
  section: { marginTop: 28, gap: 12 },
  recentCard: { paddingHorizontal: 16 },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 8, flex: 1 },
  dayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: 'transparent',
  },
  dayDotFilled: { backgroundColor: af.red, borderColor: af.red },
  dayDotToday: { borderColor: af.textPrimary },
  dayLabel: { ...afType.caption, color: af.textTertiary },
  dayLabelToday: { color: af.textPrimary },
});
