/**
 * ReadinessInsightsV2 — the Phase 2 · S4 redesign of the Weekly Report as
 * "Readiness Insights" (spec §8.4), rendered when `spec_weekly_report` is on.
 * Spec target: one large weekly score → line chart → three drivers → one AForce
 * insight — the compact, chart-led summary that replaces the legacy 7-card grid.
 *
 * Data is REAL and honest (spec §6.2, §11): the score series is the store's
 * recovery `history`; the drivers are the live score `breakdown` (never a
 * fabricated trend). When there isn't ≥2 days of history yet, it says so rather
 * than inventing a chart. The legacy grid is preserved behind the flag-off path.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  AFScreen,
  AFTopBar,
  AFChart,
  AFCard,
  AFSectionLabel,
  AFStatusBadge,
  AFEmptyState,
} from '@/components/ui';
import { af, afType, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { useFeatureFlags } from '@/store/useAppStore';
import { useEngineSlice, useHistorySlice, useBootstrapSlice, useUserSlice } from '@/store/slices';
import { EliteWeeklyEditorial } from './EliteWeeklyEditorial';
import { ReadinessInsightsSkeleton } from './ReadinessInsightsSkeleton';
import type { AnalyticsEvent } from '@/utils/analytics/metrics';
import { getAnalyticsSnapshot } from '@/services/analytics';
import {
  buildWeeklyReport,
  lastCompletedWeek,
  type WeeklyReport,
  type WeeklyReportSection,
  type WeeklyReportSectionKey,
} from '@/utils/weeklyReport';
import { usePerformanceAge } from '@/hooks/usePerformanceAge';
import { openShareSheet } from '@/services/shareService';
import { sectionSummary } from './weeklyReportCopy';
import { buildWeeklyHealthAggregates } from '@/services/health/weeklyHealthAggregates';

/**
 * RC-1 fix (P0 live bug): the same 7-section order used by the legacy Weekly
 * Report grid (app/weekly-report.tsx), duplicated verbatim here so the share
 * action below always composes the full report regardless of which visual
 * (legacy grid or this Phase-2 view) is on screen.
 */
const SHARE_SECTION_ORDER: WeeklyReportSectionKey[] = [
  'improved',
  'attention',
  'performanceAge',
  'habitVelocity',
  'recovery',
  'topCommand',
  'nextWeekFocus',
];

function dayInitial(ts: Date | string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(undefined, { weekday: 'narrow' });
  } catch {
    return '';
  }
}

export function ReadinessInsightsV2() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const history = useHistorySlice();
  const { isHydrated } = useBootstrapSlice();
  const userState = useUserSlice();
  const engine = useEngineSlice();
  const flags = useFeatureFlags();
  const elite = flags.elite_weekly_report_enabled;

  // Chronological window of the most recent readings (history is newest-first).
  // Memoized (audit P2-8): recomputing these on every render was harmless-but-
  // wasteful before this screen still subscribed to the once-a-second
  // TICK_TIMER facade re-render; keeping the memo now that it doesn't makes
  // the dependency (`history`) the actual re-render trigger, not incidental.
  const { scores, labels } = React.useMemo(() => {
    const win = history.slice(0, 7).reverse();
    return {
      scores: win.map((h) => h.score),
      labels: win.map((h) => dayInitial(h.timestamp)),
    };
  }, [history]);

  const avg = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const delta = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null;

  // Drivers = the live score breakdown, biggest movers first, non-zero only.
  // Memoized (audit P2-8) keyed on the true dependency (`engine.breakdown`).
  const drivers = React.useMemo(
    () =>
      [...engine.breakdown]
        .filter((c) => c.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 3),
    [engine.breakdown],
  );

  const topPositive = drivers.find((d) => d.delta > 0);

  // ─── RC-1 fix (P0 live bug): back + share ──────────────────────────────
  // This screen previously rendered AFTopBar with no onBack and no share
  // action — a dead-end with no way to leave except the hardware/gesture
  // back, and no way to share the report at all. Share is ported verbatim
  // from the dormant legacy path's `onShare` (app/weekly-report.tsx:192-200)
  // so "share" always composes the full 7-section report — identical
  // content regardless of whether the legacy grid or this Phase-2 view is
  // the one currently on screen.
  const healthCanonicalConsumers = flags.health_canonical_consumers;
  const biometrics = userState.biometrics;
  const shareNowISO = React.useRef(new Date().toISOString()).current;
  const shareWeek = React.useMemo(() => lastCompletedWeek(shareNowISO), [shareNowISO]);

  const [shareEvents, setShareEvents] = React.useState<AnalyticsEvent[]>([]);
  // RC-1 Wave-2B (item 2c) originally gated the empty-vs-chart decision below
  // on this fetch's own loading flag. That was wrong: `getAnalyticsSnapshot()`
  // feeds ONLY `shareEvents` (the share-sheet payload built below); it has no
  // bearing on `history`/`scores`, which come straight from the store and are
  // already known synchronously. Coupling the two meant the honest empty
  // state sat behind an unrelated fetch it never needed. This effect now
  // exists purely to populate `shareEvents` — best-effort, no loading state
  // of its own (see the `isHydrated`-gated skeleton below for the real
  // first-paint signal that decision uses instead, RC-1 Wave-2B item 2a).
  React.useEffect(() => {
    let cancelled = false;
    getAnalyticsSnapshot()
      .then((snap) => {
        if (!cancelled && snap) setShareEvents(snap.events);
      })
      .catch(() => {
        // Best-effort — a failed snapshot fetch leaves shareEvents at its
        // honest empty default; the shared report's sections simply read
        // "collecting"/"awaiting" (Score-Protection), never a crash.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sharePerformanceAge = usePerformanceAge();

  const shareReport: WeeklyReport = React.useMemo(() => {
    const nowMs = Date.parse(shareNowISO);
    const health = healthCanonicalConsumers
      ? buildWeeklyHealthAggregates({
          dailySignals: [
            {
              dayIndex: 6,
              input: {
                biometrics,
                records: undefined,
                activeDirectProviders: new Set(),
                connections: undefined,
                nowMs,
              },
            },
          ],
          days: 7,
          timezoneOffsetMin: -new Date(shareNowISO).getTimezoneOffset(),
          nowMs,
        })
      : undefined;

    return buildWeeklyReport({
      nowISO: shareNowISO,
      weekStartISO: shareWeek.weekStartISO,
      weekEndISO: shareWeek.weekEndISO,
      priorWeekStartISO: shareWeek.priorWeekStartISO,
      priorWeekEndISO: shareWeek.priorWeekEndISO,
      analyticsEvents: shareEvents,
      current: { performanceAge: sharePerformanceAge.result },
      health,
    });
  }, [shareNowISO, shareWeek, shareEvents, sharePerformanceAge.result, healthCanonicalConsumers, biometrics]);

  const fmtShareDay = React.useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      try {
        return d.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
      } catch {
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
    },
    [i18n.language],
  );

  const shareWeekRange = t('reports.weekRange', {
    start: fmtShareDay(shareReport.weekStartISO),
    end: fmtShareDay(shareReport.weekEndISO),
  });

  const shareSections = SHARE_SECTION_ORDER.map((key) =>
    shareReport.sections.find((s) => s.key === key),
  ).filter((s): s is WeeklyReportSection => Boolean(s));

  const onShare = React.useCallback(() => {
    const lines: string[] = [t('reports.shareTitle'), shareWeekRange, ''];
    for (const s of shareSections) {
      const title = t(`reports.sections.${s.key}.title`);
      const summary = sectionSummary(t, s);
      lines.push(summary ? `${title}: ${summary}` : title);
    }
    void openShareSheet({ format: 'recap', message: lines.join('\n') });
  }, [t, shareWeekRange, shareSections]);

  return (
    <AFScreen scroll>
      <AFTopBar
        eyebrow={t('reports.v2.eyebrow')}
        title={t('reports.v2.title')}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        actions={[{ icon: 'share', onPress: onShare, label: t('reports.share_a11y') }]}
      />

      {!isHydrated ? (
        <ReadinessInsightsSkeleton />
      ) : scores.length < 2 ? (
        <AFEmptyState
          icon="activity"
          title={t('reports.v2.empty_title')}
          message={t('reports.v2.empty_message')}
        />
      ) : (
        <>
          {/* Weekly score hero */}
          <View style={styles.hero}>
            <Text style={styles.score} accessibilityLabel={`${avg} ${t('reports.v2.avg_label')}`} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{avg}</Text>
            <Text
              style={styles.scoreLabel}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              {t('reports.v2.avg_label')}
            </Text>
            {delta != null && delta !== 0 && (
              <View style={styles.deltaWrap}>
                <AFStatusBadge
                  label={t(delta > 0 ? 'reports.v2.delta_positive' : 'reports.v2.delta_negative', {
                    value: Math.abs(delta),
                  })}
                  tone={delta > 0 ? 'positive' : 'critical'}
                  icon={delta > 0 ? 'trending-up' : 'trending-down'}
                />
              </View>
            )}
          </View>

          {/* Line chart */}
          <View style={styles.chart}>
            <AFChart
              values={scores}
              labels={labels}
              height={140}
              summary={t('reports.v2.chart_summary', { days: scores.length, avg })}
            />
            {/* E2: surface the chart's plain-language summary on-screen (it is
                screen-reader-only in the shipped V2). */}
            {elite && (
              <Text style={styles.caption}>
                {t('reports.v2.chart_summary', { days: scores.length, avg })}
              </Text>
            )}
          </View>

          {/* Three drivers */}
          <View style={styles.section}>
            <AFSectionLabel label={t('reports.v2.movers_label')} />
            <AFCard padded={false} style={styles.driversCard}>
              {drivers.length === 0 ? (
                <Text style={styles.noDrivers}>{t('reports.v2.no_movers')}</Text>
              ) : (
                drivers.map((d, i) => (
                  <View
                    key={d.id}
                    style={[styles.driverRow, i > 0 && styles.driverDivider]}
                    accessible
                    accessibilityLabel={`${d.label} ${d.delta > 0 ? '+' : '−'}${Math.abs(Math.round(d.delta))}`}
                  >
                    <Text style={styles.driverLabel}>{d.label}</Text>
                    <Text style={[styles.driverDelta, { color: d.delta > 0 ? af.green : af.red }]}>
                      {d.delta > 0 ? '+' : '−'}
                      {Math.abs(Math.round(d.delta))}
                    </Text>
                  </View>
                ))
              )}
            </AFCard>
          </View>

          {/* One AForce insight */}
          {topPositive && (
            <View style={styles.section}>
              <AFSectionLabel label={t('reports.v2.insight_label')} />
              <AFCard>
                <Text style={styles.insight}>
                  {t('reports.v2.insight_text', { label: topPositive.label })}
                </Text>
              </AFCard>
            </View>
          )}

          {/* E2: editorial performance-review sections (wins / watch / Performance
              Age + disclaimer / next-week focus), with honest calibrating/awaiting
              states. Mounted only when the flag is on. */}
          {elite && <EliteWeeklyEditorial />}
        </>
      )}

      <View style={{ height: 40 }} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: 24, gap: 4 },
  score: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  scoreLabel: { ...afType.eyebrow, color: af.textTertiary },
  deltaWrap: { marginTop: 10 },
  chart: { marginTop: 28 },
  caption: { ...afType.caption, color: af.textTertiary, marginTop: 10, textAlign: 'center' },
  section: { marginTop: 28, gap: 12 },
  driversCard: { paddingHorizontal: 16 },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  driverDivider: { borderTopWidth: 1, borderTopColor: af.divider },
  driverLabel: { ...afType.body, color: af.textPrimary, flex: 1 },
  driverDelta: { ...afType.title3, fontVariant: ['tabular-nums'] },
  noDrivers: { ...afType.secondary, color: af.textTertiary, padding: 16 },
  insight: { ...afType.body, color: af.textSecondary },
});
