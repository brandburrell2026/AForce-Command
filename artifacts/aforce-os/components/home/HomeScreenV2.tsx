/**
 * HomeScreenV2 — the Phase 2 · S3 Home redesign (spec §8.2), rendered only when
 * `spec_home` is on. The spec's reduced hierarchy: wordmark + freshness →
 * dominant readiness value with a thin arc → one "Your next move" command card →
 * three quiet signal metrics. One score, one command, one CTA.
 *
 * Same live engine data as the legacy Home (score, command, signals) — no
 * scoring change (statusColor/scoringEngine untouched). Tapping the arc opens
 * Readiness Insights, where the legacy Home's detail zones (Metabolic Readiness,
 * Performance Age, Voice Check-In, Activation Journey, AI-Coach video) now live
 * (founder ruling: relocate, never delete) — so nothing users had access to on
 * the legacy Home went missing.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useUser } from '@clerk/expo';

import {
  AFScreen,
  AFReadinessArc,
  AFCommandCard,
  AFSectionLabel,
} from '@/components/ui';
import { useRouter } from 'expo-router';
import { af, afType } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { useEngineSlice, useActionsSlice } from '@/store/slices';
import { parseEngineActionCopy, parseDoseOz } from '@/utils/recovery/recoveryCommandFromStore';
import type { FluidType } from '@/types';

interface HomeActions {
  logIntake: (
    fluidType: FluidType,
    opts?: { silent?: boolean; ozOverride?: number; flavorLabel?: string },
  ) => Promise<void>;
}

/** Heat-load band → i18n key suffix (translated at the call site). */
function heatBand(heatLoad: number): 'high' | 'moderate' | 'low' {
  if (heatLoad >= 60) return 'high';
  if (heatLoad >= 30) return 'moderate';
  return 'low';
}

function titleCase(level: string): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

/** Compact signal tile — fixed-width column so word values never collide. */
function Signal({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.signal} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.signalLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.signalValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export function HomeScreenV2() {
  const { t } = useTranslation();
  const { state } = useAppStore();
  const engine = useEngineSlice();
  const { logIntake } = useActionsSlice<HomeActions>();
  const clerkUser = useUser().user;
  const router = useRouter();

  const { userState } = state;
  const score = Math.max(0, Math.min(100, Math.round(engine.score)));
  const { title, instruction } = parseEngineActionCopy(engine.command.action);
  const hydrationPct =
    userState.dailyTarget > 0
      ? Math.round((userState.unitsConsumedToday / userState.dailyTarget) * 100)
      : 0;
  const greeting = clerkUser?.firstName ?? t('home.v2.greeting_default');

  return (
    <AFScreen scroll>
      {/* Wordmark + freshness */}
      <View style={styles.header}>
        <Text style={styles.welcome}>{t('home.welcome', { name: greeting })}</Text>
        <Text style={styles.brand}>{t('home.subtitle_title')}</Text>
        <Text style={styles.freshness}>{t('home.v2.freshness')}</Text>
      </View>

      {/* Dominant readiness value + thin arc (tap → insights) */}
      <Pressable
        style={styles.arcWrap}
        onPress={() => router.push('/weekly-report')}
        accessibilityRole="button"
        accessibilityLabel={`${t('home.v2.readiness_a11y', { score })} ${engine.performanceState.level}`}
        testID="home-readiness-arc"
      >
        <AFReadinessArc score={score} size={240}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.scoreLabel}>{t('home.v2.readiness_label')}</Text>
          <Text style={styles.stateLabel}>{engine.performanceState.level}</Text>
        </AFReadinessArc>
      </Pressable>

      {/* One command */}
      <AFCommandCard
        title={title || t('home.v2.default_command_title')}
        instruction={instruction}
        primaryLabel={t('home.v2.log_water')}
        onPrimary={() => {
          void logIntake('water', { silent: true, ozOverride: parseDoseOz(engine.command.action) });
        }}
        rationale={engine.command.explanation || undefined}
      />

      {/* Three quiet signals */}
      <View style={styles.signalsSection}>
        <AFSectionLabel label={t('home.v2.signals_label')} />
        <View style={styles.signals}>
          <Signal label={t('home.v2.signal_hydration')} value={`${hydrationPct}%`} />
          <Signal label={t('home.v2.signal_heat')} value={t(`home.v2.heat_${heatBand(userState.heatLoad)}`)} />
          <Signal label={t('home.v2.signal_recovery')} value={titleCase(engine.performanceState.level)} />
        </View>
      </View>

      <View style={{ height: 40 }} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 8, marginBottom: 8 },
  welcome: { ...afType.secondary, color: af.textTertiary },
  brand: { ...afType.title1, color: af.textPrimary },
  freshness: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  arcWrap: { alignItems: 'center', marginVertical: 24 },
  score: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  scoreLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  stateLabel: { ...afType.caption, color: af.redText, marginTop: 6 },
  signalsSection: { marginTop: 28, gap: 12 },
  signals: { flexDirection: 'row', gap: 12 },
  signal: {
    flex: 1,
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
  },
  signalLabel: { ...afType.eyebrow, color: af.textTertiary },
  signalValue: { ...afType.title3, color: af.textPrimary },
});
