/**
 * PerformanceSignalV3 — the Hydration tab's "Command History / Performance
 * Signal" screen (founder comps 2026-08-11), rendered only when
 * `signal_v3_dashboard_enabled` is on (app/(tabs)/journal.tsx branch).
 *
 * HONEST-DATA CONTRACT (see signalV3Presentation.ts):
 *  - Every row renders the server's real per-day `JournalRollup`s
 *    (GET /journal/rollups — the same source the shipped Journal uses).
 *  - Chips carry only rollup metrics: real end-of-day oz, the rollup's own
 *    Peak+Balanced time share ("in band"), and snapshotsCount labeled
 *    "checks" — never "commands" (snapshots are engine checks, not issued
 *    commands), and no per-day streak (the rollup has none).
 *  - Offline/failed fetch shows the same error posture as the shipped
 *    Journal; an empty account shows an empty state — never sample rows.
 *  - Band pills/accents: shipped day-card thresholds tinted by the same
 *    homePresentation accents as the Home arc and Protocol ring.
 *
 * WAVE-5 EXPERIENCE PASS — one signal leads, detail is one tap deeper.
 * The default view used to carry four competing layers: a 56pt week average, a
 * bar chart, seven equal-weight day cards each with a tinted band pill and
 * three dotted metric chips, and a five-row "Weekly averages" card whose first
 * row repeated the 56pt number verbatim. Roughly thirty numerals, no hierarchy.
 * Now the week average is the only dominant number; the day rows state day /
 * band / score and nothing else; per-day metrics and the weekly aggregates live
 * in ONE AFDisclosureSheet (the repo's established disclosure pattern — see
 * ProtocolScreenV2's "why this plan"), driven by a single `detail` state.
 *
 * EVIDENCE, not decoration: the average wears the shipped ConfidenceChip
 * (completenessChip) so "78" is never read without knowing how many of the
 * seven days are actually behind it. Inside the sheet, a day's LOGGED ounces
 * and the engine's INTERPOLATED score / in-band share are grouped separately
 * and the check count that produced the estimates is stated — an interpolation
 * across a handful of checks must not look like a measurement.
 *
 * `fixtureRollups` exists ONLY for the demo gallery / tests (production
 * builds never pass it): it skips the network and renders the given days.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AFScreen,
  AFTopBar,
  AFCard,
  AFDisclosureSheet,
  AFInlineErrorRow,
  AFSecondaryButton,
  AFTextButton,
} from '@/components/ui';
import { SignalSkeleton } from './SignalSkeleton';
import { Icon } from '@/components/Icon';
import { ConfidenceChip } from '@/components/ConfidenceChip';
import { completenessChip } from '@/utils/confidence/confidenceChip';
import { af, afType, Spacing } from '@/theme';
import type { JournalRollup } from '@/types';
import { fetchJournalRollups } from '@/services/realApi';
import { computeRecapStats } from '@/utils/journalRecapStats';
import {
  buildDayViews,
  buildBars,
  accentTextForScore,
  historyCompletenessLevel,
  weeklyChecks,
  weeklyInBandAvg,
  weeklyTotalOz,
  type SignalDayView,
} from './signalV3Presentation';

const RANGE_DAYS = 7;

/** Which detail the single disclosure sheet is showing; null = closed. */
type Detail = { kind: 'week' } | { kind: 'day'; date: string };

function localTodayIso(): string {
  const d = new Date();
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
}

function weekdayName(weekday: number): string {
  // Anchor week: 2026-08-09 is a Sunday; weekday is 0(Sun)…6(Sat).
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, 7, 9 + weekday)),
  );
}

/** Mount-fetch retry backoff — covers the cold-launch auth race (the Clerk
 *  token getter wires up only after ClerkAuthBridge mounts; a deep link
 *  straight to this tab can fetch before it) and transient network. */
const RETRY_DELAYS_MS = [1500, 4000];

export function PerformanceSignalV3({ fixtureRollups }: { fixtureRollups?: JournalRollup[] }) {
  const { t } = useTranslation();
  const [rollups, setRollups] = React.useState<JournalRollup[] | null>(fixtureRollups ?? null);
  const [error, setError] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [detail, setDetail] = React.useState<Detail | null>(null);

  const load = React.useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetchJournalRollups(RANGE_DAYS);
      setRollups(r);
      setError(false);
      return true;
    } catch {
      setRollups((prev) => prev ?? []);
      setError(true);
      return false;
    }
  }, []);

  React.useEffect(() => {
    if (fixtureRollups) return;
    let cancelled = false;
    void (async () => {
      if (await load()) return;
      for (const delay of RETRY_DELAYS_MS) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (cancelled) return;
        if (await load()) return;
      }
    })();
    return () => { cancelled = true; };
  }, [fixtureRollups, load]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const days: SignalDayView[] = React.useMemo(
    () => (rollups ? buildDayViews(rollups, localTodayIso()) : []),
    [rollups],
  );
  const bars = React.useMemo(() => buildBars(days), [days]);
  const recap = React.useMemo(() => computeRecapStats(rollups ?? []), [rollups]);
  const chip = React.useMemo(
    () => completenessChip(historyCompletenessLevel(recap.daysTracked, RANGE_DAYS)),
    [recap.daysTracked],
  );

  // The spinner and the history occupy the same place, so a VoiceOver member
  // was never told the load finished. `accessibilityLiveRegion` covers Android;
  // iOS needs the explicit announcement, fired only on the loading→loaded
  // transition (the WeeklyReportV3 / RiskTimerDisplay pattern). A fixture
  // starts non-null, so the demo gallery never announces.
  const wasLoadingRef = React.useRef(rollups == null);
  React.useEffect(() => {
    if (rollups == null) {
      wasLoadingRef.current = true;
      return;
    }
    if (!wasLoadingRef.current) return;
    wasLoadingRef.current = false;
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(t('signal.v3.loaded_a11y'));
  }, [rollups, t]);

  const dayNameOf = React.useCallback(
    (d: SignalDayView) =>
      d.dayLabel.kind === 'today'
        ? t('signal.v3.today')
        : d.dayLabel.kind === 'yesterday'
          ? t('signal.v3.yesterday')
          : weekdayName(d.dayLabel.weekday),
    [t],
  );

  const daysTrackedText = t('signal.v3.days_tracked', {
    n: recap.daysTracked,
    total: RANGE_DAYS,
  });
  const detailDay = detail?.kind === 'day' ? days.find((d) => d.date === detail.date) : undefined;

  return (
    <AFScreen
      scroll
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        fixtureRollups ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={af.textTertiary}
          />
        )
      }
    >
      <AFTopBar eyebrow={t('signal.v3.eyebrow')} title={t('signal.v3.title')} />

      {rollups === null ? (
        /* The loading window holds the history's own shape (summary card +
           seven day rows) rather than a bare spinner on an empty canvas — and
           it claims nothing: a skeleton block says something is coming, never
           what it will say. Still ONE accessible progressbar, so the shaped
           blocks don't each announce themselves. */
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('signal.v3.loading_a11y')}
          accessibilityLiveRegion="polite"
          testID="signal-v3-loading"
        >
          <SignalSkeleton dayCount={RANGE_DAYS} />
        </View>
      ) : days.length === 0 ? (
        <View style={styles.stateWrap} accessibilityLiveRegion="polite" testID="signal-v3-empty">
          <Text style={styles.stateTitle} accessibilityRole="header">
            {t(error ? 'signal.v3.load_failed' : 'signal.v3.empty_title')}
          </Text>
          <Text style={styles.stateBody}>
            {t(error ? 'signal.v3.load_failed_body' : 'signal.v3.empty_body')}
          </Text>
          {error ? (
            <AFSecondaryButton
              label={t('signal.v3.retry')}
              onPress={() => void onRefresh()}
              loading={refreshing}
              testID="signal-v3-retry"
            />
          ) : null}
        </View>
      ) : (
        <>
          {/* A refresh that fails once history is already on screen used to say
              NOTHING: the pull-to-refresh spinner retracted, `error` went true,
              and the week stayed exactly as it was — last week's numbers
              presented with the authority of a fresh read. This row names what
              happened, what still works, and offers the same retry. It appears
              ABOVE the average it qualifies, for the same reason the
              completeness chip shares the average's card. */}
          {error ? (
            <View style={styles.staleWrap}>
              <AFInlineErrorRow
                message={t('signal.v3.stale_notice')}
                onRetry={() => void onRefresh()}
                retryLabel={t('signal.v3.retry')}
                testID="signal-v3-stale"
              />
            </View>
          ) : null}

          {/* THE screen's one dominant number: the week average, its trend, and
              — on the same card, so it can never be read without it — how much
              of the week is actually behind it. */}
          <AFCard
            variant="raised"
            style={styles.summaryCard}
            testID="signal-v3-summary"
            accessibilityLabel={t('signal.v3.summary_a11y', {
              days: recap.daysTracked,
              score: recap.avgScore,
              tracked: daysTrackedText,
              completeness: chip.label,
            })}
          >
            <View style={styles.summaryRow}>
              <View>
                <Text
                  style={[styles.summaryAvg, { color: accentTextForScore(recap.avgScore) }]}
                  maxFontSizeMultiplier={1.2}
                >
                  {recap.avgScore}
                </Text>
                <Text style={styles.summaryLabel}>{t('signal.v3.avg_label', { days: recap.daysTracked })}</Text>
              </View>
              <View style={styles.barsWrap} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {bars.map((b) => (
                  <View key={b.date} style={styles.barTrack}>
                    <View style={[styles.bar, { height: `${Math.round(b.height * 100)}%`, backgroundColor: b.accent }]} />
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.summaryFooter}>
              <ConfidenceChip
                label={chip.label}
                opacity={chip.opacity}
                a11yContext={t('signal.v3.completeness_a11y_context')}
              />
              <Text style={styles.summaryFooterFact}>{daysTrackedText}</Text>
            </View>
          </AFCard>

          {/* Day rows — newest first. One line each: which day, which band,
              which score. Ounces / in-band share / check count moved into the
              day sheet; the spoken label still carries them all, so a
              screen-reader member loses nothing to the disclosure. */}
          <View style={styles.dayList}>
            {days.map((d) => {
              const dayName = dayNameOf(d);
              const band = t(`signal.v3.band_${d.bandKey}`);
              return (
                <AFCard
                  key={d.date}
                  style={styles.dayCard}
                  testID={`signal-v3-day-${d.date}`}
                  onPress={() => setDetail({ kind: 'day', date: d.date })}
                  accessibilityLabel={t('signal.v3.day_a11y', {
                    day: dayName,
                    date: shortDate(d.date),
                    score: d.score,
                    band,
                    oz: d.oz,
                    pct: d.inBandPct,
                    checks: d.checks,
                  })}
                >
                  <View style={[styles.dayAccent, { backgroundColor: d.accent }]} />
                  <View style={styles.dayMain}>
                    <Text style={styles.dayName}>{dayName}</Text>
                    <Text style={styles.dayDate}>{shortDate(d.date)}</Text>
                  </View>
                  {/* The band WORD, not a tinted pill: the accent bar and the
                      score colour already carry the band, and the word keeps it
                      perceivable without relying on colour. */}
                  <Text style={styles.dayBand}>{band}</Text>
                  {/* accentTextForScore, not d.accent: as TEXT the DEPLETED
                      band's Signal Red fails AA on this canvas (~3.1:1). The
                      rail above keeps the fill accent. */}
                  <Text style={[styles.dayScore, { color: accentTextForScore(d.score) }]} maxFontSizeMultiplier={1.2}>
                    {d.score}
                  </Text>
                  <Icon name="chevron-right" size={16} color={af.textTertiary} />
                </AFCard>
              );
            })}
          </View>

          <View style={styles.weekDetailRow}>
            <AFTextButton
              label={t('signal.v3.week_detail')}
              icon="chevron-down"
              onPress={() => setDetail({ kind: 'week' })}
              testID="signal-v3-week-detail"
            />
          </View>
        </>
      )}

      {/* ONE sheet for both disclosures — a week's aggregates or a single day's
          metrics — so the screen gains no second modal system. */}
      <AFDisclosureSheet
        visible={detail !== null}
        onClose={() => setDetail(null)}
        title={
          detailDay
            ? `${dayNameOf(detailDay)} · ${shortDate(detailDay.date)}`
            : t('signal.v3.weekly_label')
        }
        testID="signal-v3-detail-sheet"
      >
        {detailDay ? (
          <>
            {/* MEASURED: ounces the member logged. */}
            <Text style={styles.sheetEyebrow}>{t('signal.v3.logged_label')}</Text>
            <SheetRow
              label={t('signal.v3.sheet_oz')}
              value={`${detailDay.oz} ${t('signal.v3.oz')}`}
            />

            {/* ESTIMATED: the engine's own numbers, interpolated across the
                day's checks. Grouped and captioned apart from the logged value
                so the two never read as the same grade of evidence. */}
            <Text style={[styles.sheetEyebrow, styles.sheetEyebrowSpaced]}>
              {t('signal.v3.estimated_label')}
            </Text>
            <SheetRow
              label={t('signal.v3.sheet_score')}
              value={`${detailDay.score} · ${t(`signal.v3.band_${detailDay.bandKey}`)}`}
            />
            <SheetRow label={t('signal.v3.in_band')} value={`${detailDay.inBandPct}%`} />
            <Text style={styles.sheetNote}>
              {t('signal.v3.day_basis', { checks: detailDay.checks })}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.sheetEyebrow}>{t('signal.v3.weekly_range', { days: RANGE_DAYS })}</Text>
            <SheetRow label={t('signal.v3.in_band')} value={`${weeklyInBandAvg(days)}%`} />
            {/* Rounded here: computeRecapStats.peakScore is the raw max, which
                rendered as e.g. "88.4" beside whole-number scores. */}
            <SheetRow label={t('signal.v3.recap_peak')} value={`${Math.round(recap.peakScore)}`} />
            <SheetRow
              label={t('signal.v3.recap_best_streak')}
              value={t('signal.v3.recap_days', { n: recap.bestStreak })}
            />
            <SheetRow
              label={t('signal.v3.recap_total_oz')}
              value={`${weeklyTotalOz(days)} ${t('signal.v3.oz')}`}
            />
            <Text style={styles.sheetNote}>
              {t('signal.v3.week_basis', {
                tracked: daysTrackedText,
                checks: weeklyChecks(days),
              })}
            </Text>
          </>
        )}
      </AFDisclosureSheet>
    </AFScreen>
  );
}

/** One label/value line in the sheet, spoken as a single "label, value". */
function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sheetRow} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text style={styles.sheetKey}>{label}</Text>
      <Text style={styles.sheetValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8] },
  stateWrap: { marginTop: Spacing[16], alignItems: 'center', gap: 10, paddingHorizontal: Spacing[6] },
  stateTitle: { ...afType.title3, color: af.textPrimary, textAlign: 'center' },
  stateBody: { ...afType.body, color: af.textTertiary, textAlign: 'center' },
  staleWrap: { marginTop: 20 },
  summaryCard: { marginTop: 20 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[6] },
  summaryAvg: { ...afType.displayScore, fontSize: 56, lineHeight: 60 },
  summaryLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 4 },
  barsWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 96 },
  barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 6 },
  summaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: af.divider,
  },
  summaryFooterFact: { ...afType.caption, color: af.textTertiary },
  // 14pt gaps (was 12) — the rows carry a third of the elements they used to,
  // so the list can breathe without growing taller than the old one.
  dayList: { marginTop: 24, gap: 14 },
  dayCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayAccent: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  dayMain: { flex: 1 },
  dayName: { ...afType.title3, color: af.textPrimary },
  dayDate: { ...afType.caption, color: af.textTertiary, marginTop: 2 },
  dayBand: { ...afType.caption, color: af.textSecondary },
  dayScore: { ...afType.title1, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  weekDetailRow: { marginTop: 20, alignItems: 'flex-start' },
  sheetEyebrow: { ...afType.eyebrow, color: af.textTertiary },
  sheetEyebrowSpaced: { marginTop: 24 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: af.divider,
  },
  sheetKey: { ...afType.body, color: af.textSecondary },
  sheetValue: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  sheetNote: { ...afType.caption, color: af.textTertiary, marginTop: 14, lineHeight: 18 },
});
