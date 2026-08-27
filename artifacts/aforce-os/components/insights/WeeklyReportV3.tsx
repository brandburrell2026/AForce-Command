/**
 * WeeklyReportV3 — the Week in Review redesign (founder comps 2026-08-11),
 * rendered only when `weekly_v3_dashboard_enabled` is on (app/weekly-report.tsx
 * branch). View-model: components/insights/weeklyV3Presentation.ts (pure,
 * tested) — see its header for the honest-data contract. In one line: real
 * ledger-backed Performance Age movement, real analytics habit metrics, real
 * rollup timeline; the metrics with no persisted source (recovery trend, top
 * command) keep their collecting/awaiting postures instead of fake numbers.
 *
 * The honest-data contract extends to the PICTURE, not just the numbers: the
 * Performance Age bars are drawn over an explicit minimum domain
 * (`performanceAgeBarAxis`) and state their scale, so a one-year week cannot
 * look like a dramatic swing, and Signal Red is withheld from the top-command
 * banner while it has nothing to report.
 *
 * `fixture` exists ONLY for the demo gallery / tests (production builds never
 * pass it): it skips every live source and renders the given inputs.
 */
import React from 'react';
import { View, Text, StyleSheet, AccessibilityInfo, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AFScreen, AFTopBar, AFCard, AFSectionLabel, AFInlineErrorRow } from '@/components/ui';
import { WeeklyReportSkeleton } from './WeeklyReportSkeleton';
import { af, afType, Spacing, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
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
  performanceAgeBarAxis,
  type WeeklyV3Inputs,
  type WeeklyV3Model,
} from './weeklyV3Presentation';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const MS_PER_DAY = 86_400_000;

function shortDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
}

/** Bar snapshots carry only the UTC day index the ledger keys them by. */
function weekdayKeyForDayIndex(dayIndex: number): (typeof WEEKDAY_KEYS)[number] {
  return WEEKDAY_KEYS[new Date(dayIndex * MS_PER_DAY).getUTCDay()]!;
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
  const router = useRouter();
  const pa = usePerformanceAge();
  const [model, setModel] = React.useState<WeeklyV3Model | null>(
    fixture ? buildWeeklyV3Model(fixture) : null,
  );
  // A failed rollup fetch used to be indistinguishable from a genuinely empty
  // week: the `.catch` handed the model an empty array, so "0 days tracked" and
  // "0 wins" rendered as measurements of a week the member had actually lived.
  // (The legacy report learned this exact lesson — see app/weekly-report.tsx's
  // `eventsLoading` note.) Tracking the failure lets the tiles fall back to the
  // honest em dash and lets the screen say what happened.
  const [rollupsUnavailable, setRollupsUnavailable] = React.useState(false);
  // Bumped by the retry control so the one loader below re-runs; keeps a single
  // fetch path rather than a second, divergent copy of it.
  const [reloadNonce, setReloadNonce] = React.useState(0);

  React.useEffect(() => {
    if (fixture) return;
    let cancelled = false;
    (async () => {
      const nowISO = new Date().toISOString();
      let rollupsFailed = false;
      const [snapshot, rollups] = await Promise.all([
        getAnalyticsSnapshot().catch(() => null),
        fetchJournalRollups(7).catch(() => {
          rollupsFailed = true;
          return [] as never[];
        }),
      ]);
      if (cancelled) return;
      setRollupsUnavailable(rollupsFailed);
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
  }, [fixture, pa.result.performanceAge, pa.result.status, reloadNonce]);

  // The spinner and the report occupy the same place, so a VoiceOver member is
  // never told the week finished loading. `accessibilityLiveRegion` on the
  // spinner covers Android; iOS needs the explicit announcement, fired only on
  // the loading→loaded transition (the RiskTimerDisplay /
  // AppleHealthRefreshControl pattern). A fixture starts non-null, so the demo
  // gallery never announces.
  const wasLoadingRef = React.useRef(model == null);
  React.useEffect(() => {
    if (model == null) {
      wasLoadingRef.current = true;
      return;
    }
    if (!wasLoadingRef.current) return;
    wasLoadingRef.current = false;
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(t('reports.v3.loaded_a11y'));
  }, [model, t]);

  if (!model) {
    return (
      <AFScreen scroll contentContainerStyle={styles.scrollContent}>
        <AFTopBar
          eyebrow={t('reports.v3.eyebrow')}
          title={t('reports.v3.title')}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        {/* Holds the report's own shape while three sources are assembled,
            instead of a lone spinner on an empty canvas. One accessible
            progressbar wraps it so the blocks don't each announce themselves. */}
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('reports.v3.loading_a11y')}
          accessibilityLiveRegion="polite"
          testID="weekly-v3-loading"
        >
          <WeeklyReportSkeleton />
        </View>
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
  const paAxis = performanceAgeBarAxis(paView.bars);

  // Signal Red is reserved for something real. Top command has no
  // instrumentation yet, so its 'awaiting' posture renders neutral and recedes:
  // an alert-red banner over "no data yet" is the screen claiming certainty it
  // does not have, and it competes with the one banner that carries real
  // guidance (next week's focus).
  const topCommandAwaiting = topCommand.status === 'awaiting';

  // A tile is three sibling Text nodes, so VoiceOver reads its label, value and
  // caption as three unrelated fragments. Hoisting the computed values lets
  // each tile carry one composed label without restating the expression.
  //
  // The three rollup-fed tiles take the em dash — the honest-data contract's
  // "nobody took this reading" glyph, already shared with the Home and Protocol
  // signal tiles — when the rollup fetch failed. A zero here is a claim about
  // the member's week; the em dash is a claim about our data, which is the only
  // one that is true.
  const hydrationDaysValue =
    rollupsUnavailable || model.daysTracked === 0
      ? '—'
      : `${model.hydrationDays}/${model.daysTracked}`;
  const winsValue = rollupsUnavailable ? '—' : `${model.weeklyWins}`;
  const trackedValue = rollupsUnavailable ? '—' : `${model.daysTracked}`;
  const habitValue =
    habit.status === 'collecting'
      ? t('reports.v3.collecting')
      : t('reports.v3.active_days', { n: habit.value ?? '0' });

  return (
    <AFScreen scroll contentContainerStyle={styles.scrollContent}>
      <AFTopBar
        eyebrow={t('reports.v3.eyebrow')}
        title={t('reports.v3.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />

      {/* Completed-week chip — real window from lastCompletedWeek */}
      <View style={styles.chip} testID="weekly-v3-chip">
        <View style={styles.chipDot} />
        <Text style={styles.chipText}>
          {shortDate(model.week.weekStartISO)} – {shortDate(model.week.weekEndISO)}
          {'  '}
          <Text style={styles.chipMuted}>· {t('reports.v3.generated_today')}</Text>
        </Text>
      </View>

      {/* Degraded, not broken: the day-by-day hydration source didn't answer,
          so the tiles it feeds show an em dash and this row states what
          happened, what is still current, and how to try again. The rest of the
          report — Performance Age, habit velocity, next week's focus — comes
          from other sources and stands unchanged. */}
      {rollupsUnavailable ? (
        <View style={styles.degraded}>
          <AFInlineErrorRow
            message={t('reports.v3.rollups_unavailable')}
            onRetry={() => setReloadNonce((n) => n + 1)}
            retryLabel={t('reports.v3.retry')}
            testID="weekly-v3-degraded"
          />
        </View>
      ) : null}

      {/* Performance Age™ — rendered only with a real current age; movement
          only when the ledger series has a real ≥7-day baseline. */}
      {paView.currentAge != null ? (
        <AFCard variant="raised" style={styles.paCard} testID="weekly-v3-performance-age">
          <View style={styles.paHead}>
            <Text style={styles.paLabel} accessibilityRole="header">{t('reports.v3.pa_label')}</Text>
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
          {/* The struck-through previous age reads as just another number to
              VoiceOver — the strikethrough IS the "was" and it is invisible
              there, so the row is grouped and spoken as one sentence. */}
          <View
            style={styles.paRow}
            accessible
            accessibilityLabel={
              paView.previousAge != null
                ? t('reports.v3.pa_row_a11y_moved', {
                    previous: paView.previousAge,
                    current: paView.currentAge,
                  })
                : t('reports.v3.pa_row_a11y_current', { current: paView.currentAge })
            }
          >
            {paView.previousAge != null ? (
              <>
                <Text style={styles.paPrev} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{paView.previousAge}</Text>
                <Text style={styles.paArrow}>→</Text>
              </>
            ) : null}
            <Text
              style={[styles.paCurrent, paDelta != null && paDelta <= 0 && { color: af.green }]}
              maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
            >
              {paView.currentAge}
            </Text>
          </View>
          {/* Bars are drawn over `performanceAgeBarAxis`'s explicit ≥10-year
              domain, NOT the series' own extremes: a one-year week — the
              smallest move the engine can express — used to render as a
              full-height swing. The rendered scale is stated below the chart
              so the slope can be read for what it is. */}
          {paView.bars.length >= 2 && paAxis ? (
            <>
              <View
                style={styles.paBars}
                accessible
                accessibilityRole="image"
                accessibilityLabel={t('reports.v3.pa_bars_a11y', {
                  days: paView.bars
                    .map((b) => `${t(`reports.v3.wd_${weekdayKeyForDayIndex(b.dayIndex)}`)} ${b.age}`)
                    .join(', '),
                  min: Math.round(paAxis.minAge),
                  max: Math.round(paAxis.maxAge),
                })}
              >
                {paView.bars.map((b, i) => (
                  <View
                    key={b.dayIndex}
                    style={[styles.paBar, { height: `${Math.round(paAxis.fractions[i]! * 100)}%` }]}
                  />
                ))}
              </View>
              <Text style={styles.paScale}>
                {t('reports.v3.pa_scale', {
                  min: Math.round(paAxis.minAge),
                  max: Math.round(paAxis.maxAge),
                })}
              </Text>
            </>
          ) : (
            <Text style={styles.paCollecting}>{t('reports.v3.pa_collecting')}</Text>
          )}
          <Text style={styles.paDisclaimer}>{PERFORMANCE_AGE_DISCLAIMER}</Text>
        </AFCard>
      ) : null}

      {/* Tile grid — each value real or an honest posture */}
      <View style={styles.grid} testID="weekly-v3-tiles">
        <View
          style={styles.tile}
          accessible
          accessibilityLabel={`${t('reports.v3.tile_recovery')}: ${t('reports.v3.collecting')}. ${t('reports.v3.recovery_caption')}`}
        >
          <Text style={styles.tileLabel}>{t('reports.v3.tile_recovery')}</Text>
          <Text style={[styles.tileValue, styles.tileValueSmall, { color: STATUS_ACCENT[recovery.status] }]}>
            {t('reports.v3.collecting')}
          </Text>
          <Text style={styles.tileCaption}>{t('reports.v3.recovery_caption')}</Text>
        </View>
        <View
          style={styles.tile}
          accessible
          accessibilityLabel={`${t('reports.v3.tile_hydration_days')}: ${hydrationDaysValue}. ${t('reports.v3.hydration_days_caption')}`}
        >
          <Text style={styles.tileLabel}>{t('reports.v3.tile_hydration_days')}</Text>
          <Text style={styles.tileValue}>{hydrationDaysValue}</Text>
          <Text style={styles.tileCaption}>{t('reports.v3.hydration_days_caption')}</Text>
        </View>
        <View
          style={styles.tile}
          accessible
          accessibilityLabel={`${t('reports.v3.tile_habit')}: ${habitValue}. ${t(`reports.v3.habit_${habit.status}`)}`}
        >
          <Text style={styles.tileLabel}>{t('reports.v3.tile_habit')}</Text>
          <Text style={[styles.tileValue, styles.tileValueSmall, { color: habitAccent }]}>
            {habitValue}
          </Text>
          <Text style={styles.tileCaption}>{t(`reports.v3.habit_${habit.status}`)}</Text>
        </View>
        <View
          style={styles.tile}
          accessible
          accessibilityLabel={`${t('reports.v3.tile_streak')}: ${habitStreak} ${t('reports.v3.days_unit')}`}
        >
          <Text style={styles.tileLabel}>{t('reports.v3.tile_streak')}</Text>
          <Text style={styles.tileValue}>
            {habitStreak}
            <Text style={styles.tileUnit}> {t('reports.v3.days_unit')}</Text>
          </Text>
        </View>
        <View
          style={styles.tile}
          accessible
          accessibilityLabel={`${t('reports.v3.tile_wins')}: ${winsValue}`}
        >
          <Text style={styles.tileLabel}>{t('reports.v3.tile_wins')}</Text>
          <Text style={styles.tileValue}>{winsValue}</Text>
          <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {WEEKDAY_KEYS.map((k, i) => (
              <View key={k} style={[styles.dot, i < Math.min(model.weeklyWins, 7) && styles.dotOn]} />
            ))}
          </View>
        </View>
        <View
          style={styles.tile}
          accessible
          accessibilityLabel={`${t('reports.v3.tile_tracked')}: ${trackedValue}`}
        >
          <Text style={styles.tileLabel}>{t('reports.v3.tile_tracked')}</Text>
          <Text style={styles.tileValue}>{trackedValue}</Text>
          <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {WEEKDAY_KEYS.map((k, i) => (
              <View key={k} style={[styles.dot, i < Math.min(model.daysTracked, 7) && styles.dotOn]} />
            ))}
          </View>
        </View>
      </View>

      {/* Top command — honest 'awaiting' posture until command metadata exists.
          While awaiting it renders neutral, not Signal Red (see
          `topCommandAwaiting`). */}
      <View
        style={[styles.banner, topCommandAwaiting ? styles.bannerNeutral : styles.bannerRed]}
        accessible
        accessibilityLabel={`${t('reports.v3.top_command')}: ${sectionSummary(t, topCommand)}`}
        testID="weekly-v3-top-command"
      >
        <View style={[styles.bannerIcon, topCommandAwaiting ? styles.bannerIconNeutral : styles.bannerIconRed]}>
          <Text style={topCommandAwaiting ? styles.bannerGlyphNeutral : styles.bannerGlyphRed}>
            {topCommandAwaiting ? '●' : '▲'}
          </Text>
        </View>
        <View style={styles.bannerBody}>
          <Text style={[styles.bannerLabel, { color: topCommandAwaiting ? af.textTertiary : af.redText }]}>
            {t('reports.v3.top_command')}
          </Text>
          <Text style={[styles.bannerText, topCommandAwaiting && styles.bannerTextMuted]}>
            {sectionSummary(t, topCommand)}
          </Text>
        </View>
      </View>

      {/* Next week focus — real 2-way Water-First guidance */}
      <View
        style={[styles.banner, styles.bannerGreen]}
        accessible
        accessibilityLabel={`${t('reports.v3.next_focus')}: ${sectionSummary(t, nextFocus)}`}
        testID="weekly-v3-next-focus"
      >
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
          {/* Each day is an AFCard purely so its composed label is spoken:
              the bar carries the score as height and band as colour, neither
              of which VoiceOver can see, and the weekday was the only text.
              `padded={false}` + the existing tile style keep it pixel-identical
              to the plain View it replaces. */}
          <View style={styles.timeline}>
            {model.timeline.map((d) => {
              const weekday = t(`reports.v3.wd_${WEEKDAY_KEYS[d.weekday]}`);
              return (
                <AFCard
                  key={d.date}
                  padded={false}
                  style={styles.timelineDay}
                  accessibilityLabel={t('reports.v3.timeline_day_a11y', {
                    day: weekday,
                    date: shortDate(d.date),
                    score: d.score,
                  })}
                  testID={`weekly-v3-timeline-${d.date}`}
                >
                  <Text style={styles.timelineWeekday}>{weekday}</Text>
                  <View style={styles.timelineTrack}>
                    <View
                      style={[
                        styles.timelineFill,
                        { height: `${Math.max(10, Math.min(100, d.score))}%`, backgroundColor: d.accent },
                      ]}
                    />
                  </View>
                </AFCard>
              );
            })}
          </View>
        </View>
      ) : null}
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8] },
  degraded: { marginTop: 14 },
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
  paScale: { ...afType.caption, color: af.textTertiary, marginTop: 8, fontVariant: ['tabular-nums'] },
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
  bannerNeutral: { borderColor: af.border, backgroundColor: af.surface },
  bannerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bannerIconRed: { backgroundColor: `${af.red}26` },
  bannerIconGreen: { backgroundColor: `${af.green}26` },
  bannerIconNeutral: { backgroundColor: af.surfacePressed },
  bannerGlyphRed: { color: af.redText, fontSize: 12 },
  bannerGlyphGreen: { color: af.green, fontSize: 12 },
  bannerGlyphNeutral: { color: af.textTertiary, fontSize: 12 },
  bannerBody: { flex: 1, gap: 3 },
  bannerLabel: { ...afType.eyebrow },
  bannerText: { ...afType.bodyStrong, color: af.textPrimary },
  bannerTextMuted: { color: af.textSecondary },
  section: { marginTop: 24, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionHint: { ...afType.caption, color: af.green },
  timeline: { flexDirection: 'row', gap: 8 },
  timelineDay: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface },
  timelineWeekday: { ...afType.eyebrow, color: af.textTertiary },
  timelineTrack: { width: 10, height: 56, borderRadius: 5, backgroundColor: af.divider, justifyContent: 'flex-end', overflow: 'hidden' },
  timelineFill: { width: '100%', borderRadius: 5 },
});
