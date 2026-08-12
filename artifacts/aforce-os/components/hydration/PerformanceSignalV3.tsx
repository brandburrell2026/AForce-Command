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
 * `fixtureRollups` exists ONLY for the demo gallery / tests (production
 * builds never pass it): it skips the network and renders the given days.
 */
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AFScreen, AFTopBar, AFCard, AFSectionLabel, AFSecondaryButton } from '@/components/ui';
import { af, afType, Spacing } from '@/theme';
import type { JournalRollup } from '@/types';
import { fetchJournalRollups } from '@/services/realApi';
import { computeRecapStats } from '@/utils/journalRecapStats';
import {
  buildDayViews,
  buildBars,
  accentForScore,
  weeklyInBandAvg,
  type SignalDayView,
} from './signalV3Presentation';

const RANGE_DAYS = 7;

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
        <View style={styles.stateWrap} testID="signal-v3-loading">
          <ActivityIndicator color={af.textTertiary} />
        </View>
      ) : days.length === 0 ? (
        <View style={styles.stateWrap} testID="signal-v3-empty">
          <Text style={styles.stateTitle}>
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
          {/* 7-day average + band-colored bars — the rollups' own scores */}
          <AFCard variant="raised" style={styles.summaryCard} testID="signal-v3-summary">
            <View style={styles.summaryRow}>
              <View>
                <Text
                  style={[styles.summaryAvg, { color: accentForScore(recap.avgScore) }]}
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
          </AFCard>

          {/* Day rows — newest first */}
          <View style={styles.dayList}>
            {days.map((d) => {
              const dayName =
                d.dayLabel.kind === 'today'
                  ? t('signal.v3.today')
                  : d.dayLabel.kind === 'yesterday'
                    ? t('signal.v3.yesterday')
                    : weekdayName(d.dayLabel.weekday);
              return (
                <AFCard
                  key={d.date}
                  style={styles.dayCard}
                  testID={`signal-v3-day-${d.date}`}
                  accessibilityLabel={`${dayName} ${shortDate(d.date)}: ${t(`signal.v3.band_${d.bandKey}`)}, ${d.score}. ${d.oz} oz, ${d.inBandPct}% in band, ${d.checks} checks`}
                >
                  <View style={[styles.dayAccent, { backgroundColor: d.accent }]} />
                  <View style={styles.dayMain}>
                    <View style={styles.dayTop}>
                      <Text style={styles.dayName}>{dayName}</Text>
                      <Text style={styles.dayDate}>{shortDate(d.date)}</Text>
                      <View style={[styles.bandPill, { backgroundColor: `${d.accent}22` }]}>
                        <Text style={[styles.bandPillText, { color: d.accent }]}>
                          {t(`signal.v3.band_${d.bandKey}`)}
                        </Text>
                      </View>
                    </View>
                    {/* Comp restyle 2026-08-12: dotted metric chips. The
                        "% rec" slot binds the rollup's REAL in-band time (no
                        per-day recovery series exists) and keeps its honest
                        label; no per-day streak (rollups carry none). */}
                    <View style={styles.chips}>
                      <View style={styles.chipRow}>
                        <View style={[styles.chipDot, { backgroundColor: af.cyan }]} />
                        <Text style={styles.chip}>
                          <Text style={styles.chipStrong}>{d.oz}</Text> {t('signal.v3.oz')}
                        </Text>
                      </View>
                      <View style={styles.chipRow}>
                        <View style={[styles.chipDot, { backgroundColor: accentForScore(d.inBandPct) }]} />
                        <Text style={styles.chip}>
                          <Text style={styles.chipStrong}>{d.inBandPct}%</Text> {t('signal.v3.in_band')}
                        </Text>
                      </View>
                      <Text style={styles.chip}>
                        <Text style={styles.chipStrong}>{d.checks}</Text> {t('signal.v3.checks')}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.dayScore, { color: d.accent }]} maxFontSizeMultiplier={1.2}>
                    {d.score}
                  </Text>
                </AFCard>
              );
            })}
          </View>

          {/* Weekly averages — computeRecapStats over the same rollups */}
          <View style={styles.section} testID="signal-v3-recap">
            <View style={styles.sectionHead}>
              <AFSectionLabel label={t('signal.v3.weekly_label')} />
              <Text style={styles.sectionHint}>{t('signal.v3.weekly_range', { days: RANGE_DAYS })}</Text>
            </View>
            <AFCard padded={false} style={styles.recapCard}>
              {(
                [
                  [t('signal.v3.recap_avg'), `${recap.avgScore}`],
                  [t('signal.v3.recap_in_band'), `${weeklyInBandAvg(days)}%`],
                  [t('signal.v3.recap_peak'), `${recap.peakScore}`],
                  [t('signal.v3.recap_best_streak'), t('signal.v3.recap_days', { n: recap.bestStreak })],
                  [t('signal.v3.recap_total_oz'), `${recap.totalOunces} ${t('signal.v3.oz')}`],
                ] as const
              ).map(([k, v], i) => (
                <View key={k} style={[styles.recapRow, i > 0 && styles.recapDivider]}>
                  <Text style={styles.recapKey}>{k}</Text>
                  <Text style={styles.recapValue}>{v}</Text>
                </View>
              ))}
            </AFCard>
          </View>
        </>
      )}
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8] },
  stateWrap: { marginTop: Spacing[16], alignItems: 'center', gap: 10, paddingHorizontal: Spacing[6] },
  stateTitle: { ...afType.title3, color: af.textPrimary, textAlign: 'center' },
  stateBody: { ...afType.body, color: af.textTertiary, textAlign: 'center' },
  summaryCard: { marginTop: 20 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[6] },
  summaryAvg: { ...afType.displayScore, fontSize: 56, lineHeight: 60 },
  summaryLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 4 },
  barsWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 96 },
  barTrack: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 6 },
  dayList: { marginTop: 20, gap: 12 },
  dayCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayAccent: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  dayMain: { flex: 1, gap: 8 },
  dayTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dayName: { ...afType.title3, color: af.textPrimary },
  dayDate: { ...afType.caption, color: af.textTertiary },
  bandPill: { marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  bandPillText: { ...afType.caption, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', alignItems: 'center' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chip: { ...afType.caption, color: af.textTertiary },
  chipStrong: { color: af.textSecondary, fontVariant: ['tabular-nums'] },
  dayScore: { ...afType.title1, fontVariant: ['tabular-nums'] },
  section: { marginTop: 28, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionHint: { ...afType.caption, color: af.green },
  recapCard: { paddingHorizontal: 16 },
  recapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  recapDivider: { borderTopWidth: 1, borderTopColor: af.divider },
  recapKey: { ...afType.body, color: af.textSecondary },
  recapValue: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
});
