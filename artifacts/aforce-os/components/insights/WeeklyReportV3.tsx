/**
 * WeeklyReportV3 — the Week in Review redesign (founder comps 2026-08-11),
 * rendered only when `weekly_v3_dashboard_enabled` is on (app/weekly-report.tsx
 * branch). View-model: components/insights/weeklyV3Presentation.ts (pure,
 * tested) — see its header for the honest-data contract. In one line: real
 * ledger-backed Performance Age movement, real analytics habit metrics, real
 * rollup timeline; the metrics with no persisted source (recovery trend, top
 * command) keep their collecting/awaiting postures instead of fake numbers.
 *
 * `fixture` exists ONLY for the demo gallery / tests (production builds never
 * pass it): it skips every live source and renders the given inputs.
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AFScreen, AFTopBar, AFCard, AFSectionLabel } from '@/components/ui';
import { af, afType, Spacing } from '@/theme';
import { getAnalyticsSnapshot } from '@/services/analytics';
import { fetchJournalRollups } from '@/services/realApi';
import { getCommandLedgerState } from '@/services/commandLedger';
import { ledgerToPerformanceAgeSnapshots } from '@/utils/intelligence/commandEventAdapters';
import { usePerformanceAge } from '@/hooks/usePerformanceAge';
import { PERFORMANCE_AGE_DISCLAIMER } from '@/utils/performanceAge';
import { getWeeklyReportSection } from '@/utils/weeklyReport';
import { sectionSummary } from '@/components/insights/weeklyReportCopy';
import {
  buildWeeklyV3Model,
  type WeeklyV3Inputs,
  type WeeklyV3Model,
} from './weeklyV3Presentation';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function shortDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
}

const STATUS_ACCENT: Record<string, string> = {
  improved: af.green,
  attention: af.amber,
  steady: af.textSecondary,
  collecting: af.cyan,
  awaiting: af.textTertiary,
};

export function WeeklyReportV3({ fixture }: { fixture?: WeeklyV3Inputs }) {
  const { t } = useTranslation();
  const pa = usePerformanceAge();
  const [model, setModel] = React.useState<WeeklyV3Model | null>(
    fixture ? buildWeeklyV3Model(fixture) : null,
  );

  React.useEffect(() => {
    if (fixture) return;
    let cancelled = false;
    (async () => {
      const nowISO = new Date().toISOString();
      const [snapshot, rollups] = await Promise.all([
        getAnalyticsSnapshot().catch(() => null),
        fetchJournalRollups(7).catch(() => [] as never[]),
      ]);
      if (cancelled) return;
      setModel(
        buildWeeklyV3Model({
          nowISO,
          analyticsEvents: snapshot?.events ?? [],
          rollups,
          paSnapshots: ledgerToPerformanceAgeSnapshots(getCommandLedgerState().events),
          paResult: pa.result,
        }),
      );
    })();
    return () => { cancelled = true; };
    // pa is a fresh object each render; keying on its stable fields avoids a
    // rebuild loop while still refreshing when the age itself moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture, pa.result.performanceAge, pa.result.status]);

  if (!model) {
    return (
      <AFScreen scroll contentContainerStyle={styles.scrollContent}>
        <AFTopBar eyebrow={t('reports.v3.eyebrow')} title={t('reports.v3.title')} />
        <View style={styles.loading}><ActivityIndicator color={af.textTertiary} /></View>
      </AFScreen>
    );
  }

  const { report, performanceAge: paView } = model;
  const habit = getWeeklyReportSection(report, 'habitVelocity');
  const recovery = getWeeklyReportSection(report, 'recovery');
  const topCommand = getWeeklyReportSection(report, 'topCommand');
  const nextFocus = getWeeklyReportSection(report, 'nextWeekFocus');
  const habitStreak = Number((habit.params as { streak?: number } | undefined)?.streak ?? 0);
  const habitAccent = STATUS_ACCENT[habit.status] ?? af.textSecondary;

  const paDelta = paView.trend.available ? paView.trend.deltaYears : null;
  const paBarMin = Math.min(...paView.bars.map((b) => b.age), Number.POSITIVE_INFINITY);
  const paBarMax = Math.max(...paView.bars.map((b) => b.age), Number.NEGATIVE_INFINITY);

  return (
    <AFScreen scroll contentContainerStyle={styles.scrollContent}>
      <AFTopBar eyebrow={t('reports.v3.eyebrow')} title={t('reports.v3.title')} />

      {/* Completed-week chip — real window from lastCompletedWeek */}
      <View style={styles.chip} testID="weekly-v3-chip">
        <View style={styles.chipDot} />
        <Text style={styles.chipText}>
          {shortDate(model.week.weekStartISO)} – {shortDate(model.week.weekEndISO)}
          {'  '}
          <Text style={styles.chipMuted}>· {t('reports.v3.generated_today')}</Text>
        </Text>
      </View>

      {/* Performance Age™ — rendered only with a real current age; movement
          only when the ledger series has a real ≥7-day baseline. */}
      {paView.currentAge != null ? (
        <AFCard variant="raised" style={styles.paCard} testID="weekly-v3-performance-age">
          <View style={styles.paHead}>
            <Text style={styles.paLabel}>{t('reports.v3.pa_label')}</Text>
            {paDelta != null ? (
              <View style={[styles.paPill, paDelta <= 0 ? styles.paPillGood : styles.paPillWatch]}>
                <Text style={[styles.paPillText, { color: paDelta <= 0 ? af.green : af.amber }]}>
                  {paDelta <= 0 ? '▼' : '▲'} {Math.abs(paDelta)} {t('reports.v3.pa_years')}
                </Text>
              </View>
            ) : paView.provisional ? (
              <View style={styles.paPill}><Text style={styles.paPillMuted}>{t('reports.v3.pa_provisional')}</Text></View>
            ) : null}
          </View>
          <View style={styles.paRow}>
            {paView.previousAge != null ? (
              <>
                <Text style={styles.paPrev} maxFontSizeMultiplier={1.2}>{paView.previousAge}</Text>
                <Text style={styles.paArrow}>→</Text>
              </>
            ) : null}
            <Text
              style={[styles.paCurrent, paDelta != null && paDelta <= 0 && { color: af.green }]}
              maxFontSizeMultiplier={1.2}
            >
              {paView.currentAge}
            </Text>
          </View>
          {paView.bars.length >= 2 ? (
            <View style={styles.paBars} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {paView.bars.map((b) => {
                const span = Math.max(1, paBarMax - paBarMin);
                // Younger = taller: invert the age within the series range.
                const frac = 0.25 + 0.75 * ((paBarMax - b.age) / span);
                return <View key={b.dayIndex} style={[styles.paBar, { height: `${Math.round(frac * 100)}%` }]} />;
              })}
            </View>
          ) : (
            <Text style={styles.paCollecting}>{t('reports.v3.pa_collecting')}</Text>
          )}
          <Text style={styles.paDisclaimer}>{PERFORMANCE_AGE_DISCLAIMER}</Text>
        </AFCard>
      ) : null}

      {/* Tile grid — each value real or an honest posture */}
      <View style={styles.grid} testID="weekly-v3-tiles">
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>{t('reports.v3.tile_recovery')}</Text>
          <Text style={[styles.tileValue, styles.tileValueSmall, { color: STATUS_ACCENT[recovery.status] }]}>
            {t('reports.v3.collecting')}
          </Text>
          <Text style={styles.tileCaption}>{t('reports.v3.recovery_caption')}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>{t('reports.v3.tile_hydration_days')}</Text>
          <Text style={styles.tileValue}>
            {model.daysTracked > 0 ? `${model.hydrationDays}/${model.daysTracked}` : '—'}
          </Text>
          <Text style={styles.tileCaption}>{t('reports.v3.hydration_days_caption')}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>{t('reports.v3.tile_habit')}</Text>
          <Text style={[styles.tileValue, styles.tileValueSmall, { color: habitAccent }]}>
            {habit.status === 'collecting'
              ? t('reports.v3.collecting')
              : t('reports.v3.active_days', { n: habit.value ?? '0' })}
          </Text>
          <Text style={styles.tileCaption}>{t(`reports.v3.habit_${habit.status}`)}</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>{t('reports.v3.tile_streak')}</Text>
          <Text style={styles.tileValue}>
            {habitStreak}
            <Text style={styles.tileUnit}> {t('reports.v3.days_unit')}</Text>
          </Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>{t('reports.v3.tile_wins')}</Text>
          <Text style={styles.tileValue}>{model.weeklyWins}</Text>
          <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {WEEKDAY_KEYS.map((k, i) => (
              <View key={k} style={[styles.dot, i < Math.min(model.weeklyWins, 7) && styles.dotOn]} />
            ))}
          </View>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>{t('reports.v3.tile_tracked')}</Text>
          <Text style={styles.tileValue}>{model.daysTracked}</Text>
          <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {WEEKDAY_KEYS.map((k, i) => (
              <View key={k} style={[styles.dot, i < Math.min(model.daysTracked, 7) && styles.dotOn]} />
            ))}
          </View>
        </View>
      </View>

      {/* Top command — honest 'awaiting' posture until command metadata exists */}
      <View style={[styles.banner, styles.bannerRed]} testID="weekly-v3-top-command">
        <View style={[styles.bannerIcon, styles.bannerIconRed]}><Text style={styles.bannerGlyphRed}>▲</Text></View>
        <View style={styles.bannerBody}>
          <Text style={[styles.bannerLabel, { color: af.redText }]}>{t('reports.v3.top_command')}</Text>
          <Text style={styles.bannerText}>{sectionSummary(t, topCommand)}</Text>
        </View>
      </View>

      {/* Next week focus — real 2-way Water-First guidance */}
      <View style={[styles.banner, styles.bannerGreen]} testID="weekly-v3-next-focus">
        <View style={[styles.bannerIcon, styles.bannerIconGreen]}><Text style={styles.bannerGlyphGreen}>●</Text></View>
        <View style={styles.bannerBody}>
          <Text style={[styles.bannerLabel, { color: af.green }]}>{t('reports.v3.next_focus')}</Text>
          <Text style={styles.bannerText}>{sectionSummary(t, nextFocus)}</Text>
        </View>
      </View>

      {/* Weekly timeline — real rollup days, shared band accents */}
      {model.timeline.length > 0 ? (
        <View style={styles.section} testID="weekly-v3-timeline">
          <View style={styles.sectionHead}>
            <AFSectionLabel label={t('reports.v3.timeline_label')} />
            <Text style={styles.sectionHint}>{t('reports.v3.timeline_hint')}</Text>
          </View>
          <View style={styles.timeline}>
            {model.timeline.map((d) => (
              <View key={d.date} style={styles.timelineDay}>
                <Text style={styles.timelineWeekday}>{t(`reports.v3.wd_${WEEKDAY_KEYS[d.weekday]}`)}</Text>
                <View style={styles.timelineTrack}>
                  <View
                    style={[
                      styles.timelineFill,
                      { height: `${Math.max(10, Math.min(100, d.score))}%`, backgroundColor: d.accent },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8] },
  loading: { marginTop: Spacing[16], alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    marginTop: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: af.green },
  chipText: { ...afType.caption, color: af.textPrimary },
  chipMuted: { color: af.textTertiary },
  paCard: { marginTop: 16 },
  paHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paLabel: { ...afType.eyebrow, color: af.textTertiary },
  paPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: af.surfacePressed },
  paPillGood: { backgroundColor: `${af.green}22` },
  paPillWatch: { backgroundColor: `${af.amber}22` },
  paPillText: { ...afType.caption, fontVariant: ['tabular-nums'] },
  paPillMuted: { ...afType.caption, color: af.textTertiary },
  paRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 10 },
  paPrev: { ...afType.title1, color: af.textTertiary, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  paArrow: { ...afType.title2, color: af.textTertiary },
  paCurrent: { ...afType.displayScore, fontSize: 52, lineHeight: 56, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  paBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 84, marginTop: 14 },
  paBar: { flex: 1, borderRadius: 6, backgroundColor: `${af.green}88` },
  paCollecting: { ...afType.caption, color: af.textTertiary, marginTop: 12 },
  paDisclaimer: { ...afType.caption, color: af.textTertiary, marginTop: 14, lineHeight: 16 },
  grid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    flexBasis: '47%', flexGrow: 1, gap: 6, padding: 14,
    borderRadius: 14, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  tileLabel: { ...afType.eyebrow, color: af.textTertiary },
  tileValue: { ...afType.title1, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  tileValueSmall: { ...afType.title3 },
  tileUnit: { ...afType.caption, color: af.textTertiary },
  tileCaption: { ...afType.caption, color: af.textTertiary },
  dots: { flexDirection: 'row', gap: 5, marginTop: 4 },
  dot: { flex: 1, height: 8, borderRadius: 3, backgroundColor: af.divider },
  dotOn: { backgroundColor: af.green },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1 },
  bannerRed: { borderColor: `${af.redText}44`, backgroundColor: `${af.red}14` },
  bannerGreen: { borderColor: `${af.green}44`, backgroundColor: `${af.green}12` },
  bannerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bannerIconRed: { backgroundColor: `${af.red}26` },
  bannerIconGreen: { backgroundColor: `${af.green}26` },
  bannerGlyphRed: { color: af.redText, fontSize: 12 },
  bannerGlyphGreen: { color: af.green, fontSize: 12 },
  bannerBody: { flex: 1, gap: 3 },
  bannerLabel: { ...afType.eyebrow },
  bannerText: { ...afType.bodyStrong, color: af.textPrimary },
  section: { marginTop: 24, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionHint: { ...afType.caption, color: af.green },
  timeline: { flexDirection: 'row', gap: 8 },
  timelineDay: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface },
  timelineWeekday: { ...afType.eyebrow, color: af.textTertiary },
  timelineTrack: { width: 10, height: 56, borderRadius: 5, backgroundColor: af.divider, justifyContent: 'flex-end', overflow: 'hidden' },
  timelineFill: { width: '100%', borderRadius: 5 },
});
