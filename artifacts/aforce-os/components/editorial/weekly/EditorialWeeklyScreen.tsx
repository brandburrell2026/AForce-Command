/**
 * EditorialWeeklyScreen — WEEKLY REPORT, The Feature (E5, founder decisions
 * 2026-08-30).
 *
 * The Editorial OS composition of the SAME weekly truth WeeklyReportV3 renders.
 * Every value comes from the chain that screen already consumes:
 * `buildWeeklyV3Model` for the model, `performanceAgeBarAxis` for the chart
 * domain, `getWeeklyReportSection` for the postures. Nothing is re-derived.
 *
 * This is the FIRST surface in the migration to turn the stock to paper.
 *
 * FOUNDER DECISIONS ENFORCED HERE (locked by editorialWeeklyLaw.test.ts):
 *  D1 — NO positive hue. Soursop Green measures 2.48:1 on paper: below the
 *       4.5:1 text floor and below even the 3:1 graphical floor. Positive
 *       reads through weight, rule and position. The direction of a
 *       Performance Age move survives as a glyph plus its spoken label, never
 *       as colour alone.
 *  D2 — period furniture is the REAL date range. No week number, no issue
 *       number (E2's R1).
 *  D3 — no share affordance. V3 has none and E5 adds none.
 *  D4 — four-way seam; V3, ReadinessInsightsV2 and the legacy report all stay
 *       reachable.
 *  D5 — the live V3 analytics-failure asymmetry is NOT fixed here. It is a
 *       defect on the shipping surface and belongs to its own lane, so the fix
 *       is not buried behind a flag that is false.
 *  D6 — per-source honesty: the degraded row and the em dash. No global stale
 *       banner; `lastRefreshStale` is deliberately not threaded onto Weekly.
 *
 * PARITY NOTE — this screen is NOT a pure reader. `usePerformanceAge` appends
 * one idempotent Performance Age snapshot to the Command-Event Ledger per day,
 * and that write is what produces the series read back at
 * `ledgerToPerformanceAgeSnapshots`. For a member whose only visit is this
 * screen, dropping the hook stops the series accruing. No test pinned that read
 * on V3; editorialWeeklyLaw.test.ts pins it here.
 *
 * HEADLINE NOTE — the approved comp shows an authored headline ("The week you
 * started logging"). No source for a per-week headline exists, and generating
 * one would be the class of fabrication Ruling R3 bans. The Feature therefore
 * carries the real title in the display voice with the reported period above
 * it. Flagged for a founder ruling; not invented here.
 *
 * OMITTED, DELIBERATELY — the TOP COMMAND banner. V3 renders it, but it has no
 * command-usage instrumentation anywhere in the app, so its posture is
 * permanently 'awaiting': a banner whose only content is that it has nothing to
 * report. The approved comp does not include it, and a standing "nothing yet"
 * panel is the opposite of what the Feature register is for. Nothing is
 * stranded by this — the section has no producer and no data, only a
 * placeholder — but it IS a V3 element this surface does not carry, so it is
 * recorded here rather than dropped silently. Flagged for a founder ruling.
 */
import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';

import { AFScreen } from '@/components/ui';
import { getAnalyticsSnapshot } from '@/services/analytics';
import { fetchJournalRollups } from '@/services/realApi';
import { getCommandLedgerState } from '@/services/commandLedger';
import { useUserSlice } from '@/store/slices';
import { ledgerToPerformanceAgeSnapshots } from '@/utils/intelligence/commandEventAdapters';
import { usePerformanceAge } from '@/hooks/usePerformanceAge';
import { PERFORMANCE_AGE_DISCLAIMER } from '@/utils/performanceAge';
import { lastCompletedWeek, getWeeklyReportSection } from '@/utils/weeklyReport';
import { sectionSummary } from '@/components/insights/weeklyReportCopy';
import {
  buildWeeklyV3Model,
  performanceAgeBarAxis,
  type WeeklyV3Inputs,
  type WeeklyV3Model,
} from '@/components/insights/weeklyV3Presentation';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { edInkFor, edRhythm, edStock, edType } from '@/theme/editorialTokens';

import { EdCaption, EdEvidenceLine, EdKicker, EdRule, EdStatement, EdSurface, useEdSettle } from '../index';
import { EdReturn } from '../moments/EdReturn';
import { EdFeatureNumbers } from './EdFeatureNumbers';
import { featureDateRange, featureShortDate } from './editorialWeeklyPresentation';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MS_PER_DAY = 86_400_000;

/** Bar snapshots carry only the UTC day index the ledger keys them by. */
function weekdayKeyForDayIndex(dayIndex: number): (typeof WEEKDAY_KEYS)[number] {
  return WEEKDAY_KEYS[new Date(dayIndex * MS_PER_DAY).getUTCDay()]!;
}

export function EditorialWeeklyScreen({ fixture }: { fixture?: WeeklyV3Inputs }) {
  const { t, i18n } = useTranslation();
  const ink = edInkFor('paper');
  const settle = useEdSettle();

  // PARITY — the ledger writer. See the header note.
  const pa = usePerformanceAge();
  const complianceStreak = useUserSlice().complianceStreak;

  const [model, setModel] = React.useState<WeeklyV3Model | null>(
    fixture ? buildWeeklyV3Model(fixture) : null,
  );
  const [rollupsUnavailable, setRollupsUnavailable] = React.useState(false);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  // One loader, re-run by the nonce — the same single fetch path V3 uses,
  // never a second divergent copy. D5: the analytics `.catch(() => null)`
  // asymmetry is carried over UNCHANGED and deliberately, so that its fix
  // lands on the live surface rather than behind this flag.
  React.useEffect(() => {
    if (fixture) return;
    let cancelled = false;
    (async () => {
      const nowISO = new Date().toISOString();
      let rollupsFailed = false;
      const [snapshot, rollups] = await Promise.all([
        getAnalyticsSnapshot().catch(() => null),
        // WINDOW TRUTH (P2). The masthead states the LAST COMPLETED week
        // (buildWeeklyV3Model derives model.week via lastCompletedWeek), but
        // this fetched the trailing 7 days ENDING TODAY — so on any day but
        // Sunday the period furniture and the pull numbers beneath it
        // described different populations. Days-tracked and hydration-days
        // were computed over a window the masthead never named.
        //
        // Fetching 14 days guarantees the stated week is fully covered (its
        // start is at most 13 days back), and the filter below narrows the
        // population to exactly the period the masthead claims. No HydroState
        // calculation changes — this selects WHICH observed days are counted,
        // and unobserved days stay unobserved.
        fetchJournalRollups(14).catch(() => {
          rollupsFailed = true;
          return [] as never[];
        }),
      ]);
      if (cancelled) return;
      setRollupsUnavailable(rollupsFailed);
      // Narrow to the period the masthead names. `date` is YYYY-MM-DD, which
      // sorts lexicographically, so string comparison IS chronological here.
      const week = lastCompletedWeek(nowISO);
      const weekStartDay = week.weekStartISO.slice(0, 10);
      const weekEndDay = week.weekEndISO.slice(0, 10);
      const periodRollups = rollups.filter(
        (r) => r.date >= weekStartDay && r.date <= weekEndDay,
      );
      setModel(
        buildWeeklyV3Model({
          nowISO,
          analyticsEvents: snapshot?.events ?? [],
          rollups: periodRollups,
          paSnapshots: ledgerToPerformanceAgeSnapshots(getCommandLedgerState().events),
          paResult: pa.result,
          complianceStreak,
        }),
      );
    })();
    return () => { cancelled = true; };
    // pa is a fresh object each render; keying on its stable fields avoids a
    // rebuild loop while still refreshing when the age itself moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture, pa.result.performanceAge, pa.result.status, reloadNonce]);

  // The skeleton and the report occupy the same place, so a VoiceOver member is
  // never told the week finished loading. `accessibilityLiveRegion` covers
  // Android; iOS needs the explicit announcement, fired only on the
  // loading→loaded transition. A fixture starts non-null, so the gallery never
  // announces.
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
      <EdSurface stock="paper" style={styles.fill}>
        {/* The app sets a LIGHT status bar globally (app/_layout.tsx). On the
            black stock that is correct; on paper the system glyphs land at
            ~1.3:1. expo-status-bar is declarative and last-mount-wins. */}
        <StatusBar style="dark" />
        {/* AFScreen paints af.canvas (#0D0D0D) on its own shell. On the black
            stock that is invisible; on paper it would cover the sheet entirely
            and leave paper ink at ~1.1:1 — the E2 invisible-text defect at
            full-screen scale. The stock is therefore restated on the shell. */}
        <AFScreen scroll style={styles.canvas} contentContainerStyle={styles.content}>
          <EdReturn now={new Date()} />
          <EdCaption text={t('reports.v3.eyebrow')} />
          {/* Holds the sheet's shape while the sources are assembled. Rules,
              not shimmer blocks: WeeklyReportSkeleton is built from af.* dark
              tokens and would read as dark bars on paper. One accessible
              progressbar wraps it so the rules don't each announce. */}
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('reports.v3.loading_a11y')}
            accessibilityLiveRegion="polite"
            testID="editorial-weekly-loading"
          >
            <Text style={[edType.body as TextStyle, { color: ink.quiet, marginTop: 20 }]}>
              {t('reports.v3.loading_a11y')}
            </Text>
            <EdRule style={styles.spacedRule} />
            <EdRule style={styles.spacedRule} />
          </View>
        </AFScreen>
      </EdSurface>
    );
  }

  const { report, performanceAge: paView } = model;
  const habit = getWeeklyReportSection(report, 'habitVelocity');
  const nextFocus = getWeeklyReportSection(report, 'nextWeekFocus');
  const habitStreak = Number((habit.params as { streak?: number } | undefined)?.streak ?? 0);

  const paDelta = paView.trend.available ? paView.trend.deltaYears : null;
  const paAxis = performanceAgeBarAxis(paView.bars);

  // D2 — the reported window, formatted as period furniture. Null when the
  // window will not parse: the masthead then carries the title alone.
  const period = featureDateRange(model.week.weekStartISO, model.week.weekEndISO, i18n.language);

  // The rollup-fed pull numbers take NULL — not 0 — when the fetch failed, so
  // EdNumber prints the em dash and speaks "no reading". A zero here would be
  // a claim about the member's week; the dash is a claim about our data, which
  // is the only one that is true.
  const daysTrackedValue = rollupsUnavailable ? null : model.daysTracked;
  const weeklyWinsValue = rollupsUnavailable ? null : model.weeklyWins;
  const hydrationDaysLine =
    rollupsUnavailable || model.daysTracked === 0
      ? '—'
      : `${model.hydrationDays}/${model.daysTracked}`;

  return (
    <EdSurface stock="paper" style={styles.fill}>
      <StatusBar style="dark" />
      {/* See the loading branch: the stock is restated on the AFScreen shell
          because AFScreen paints af.canvas over whatever it sits inside. */}
      <AFScreen scroll style={styles.canvas} contentContainerStyle={styles.content}>
        <Animated.View style={settle}>
          <EdReturn now={new Date()} />

          {/* Masthead — THE FEATURE, then the real reported period (D2). */}
          <EdCaption
            text={period ? `${t('reports.v3.eyebrow')} · ${period}` : t('reports.v3.eyebrow')}
          />
          <EdRule />

          <EdStatement accessibilityRole="header">{t('reports.v3.title')}</EdStatement>

          {/* Degraded, not broken. D6 — per-source honesty, stated where the
              loss happened, with a working retry.

              The spec's own anatomy calls for this: "the couldn't-load line
              rendered as editorial matter-of-fact body." It is deliberately NOT
              AFInlineErrorRow — that component is built from af.surface
              (#141420) and af.textSecondary, so on paper it would land as a
              dark chip in the middle of the sheet. Same message, same retry,
              same testID; the register is the sheet's. */}
          {rollupsUnavailable ? (
            <View style={styles.degraded} testID="editorial-weekly-degraded">
              <Text style={[edType.body as TextStyle, { color: ink.quiet }]}>
                {t('reports.v3.rollups_unavailable')}
              </Text>
              <Pressable
                onPress={() => setReloadNonce((n) => n + 1)}
                accessibilityRole="button"
                accessibilityLabel={t('reports.v3.retry')}
                hitSlop={8}
                style={styles.retryTarget}
                testID="editorial-weekly-retry"
              >
                <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>
                  {t('reports.v3.retry')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* The pull numbers — streak beside honest em dashes. */}
          <EdFeatureNumbers
            numbers={[
              {
                value: habitStreak,
                label: t('reports.v3.tile_streak'),
                unit: t('reports.v3.days_unit'),
                testID: 'editorial-weekly-streak',
              },
              {
                value: daysTrackedValue,
                label: t('reports.v3.tile_tracked'),
                testID: 'editorial-weekly-tracked',
              },
              {
                value: weeklyWinsValue,
                label: t('reports.v3.tile_wins'),
                testID: 'editorial-weekly-wins',
              },
            ]}
          />

          <EdRule style={styles.spacedRule} />

          {/* Honest partials, as editorial matter-of-fact body. Recovery keeps
              its hardcoded collecting posture — no persisted series exists, so
              it never earns a number. */}
          <View
            accessible
            accessibilityLabel={`${t('reports.v3.tile_recovery')}: ${t('reports.v3.collecting')}. ${t('reports.v3.recovery_caption')}`}
            testID="editorial-weekly-recovery"
          >
            <Text style={[edType.body as TextStyle, { color: ink.quiet }]}>
              {t('reports.v3.tile_recovery')} · {t('reports.v3.collecting')} —{' '}
              {t('reports.v3.recovery_caption')}
            </Text>
          </View>

          {/* Hydration days — real, lower authority than the pull numbers. */}
          <View
            accessible
            accessibilityLabel={`${t('reports.v3.tile_hydration_days')}: ${hydrationDaysLine}. ${t('reports.v3.hydration_days_caption')}`}
            style={styles.evidence}
            testID="editorial-weekly-hydration-days"
          >
            <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet }]}>
              {t('reports.v3.tile_hydration_days')} {hydrationDaysLine} ·{' '}
              {t('reports.v3.hydration_days_caption')}
            </Text>
          </View>

          {/* Habit velocity — the posture, said in words. */}
          <View
            accessible
            accessibilityLabel={`${t('reports.v3.tile_habit')}: ${
              habit.status === 'collecting'
                ? t('reports.v3.collecting')
                : t('reports.v3.active_days', { n: habit.value ?? '0' })
            }. ${t(`reports.v3.habit_${habit.status}`)}`}
            style={styles.evidence}
            testID="editorial-weekly-habit"
          >
            <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet }]}>
              {t('reports.v3.tile_habit')}{' '}
              {habit.status === 'collecting'
                ? t('reports.v3.collecting')
                : t('reports.v3.active_days', { n: habit.value ?? '0' })}{' '}
              · {t(`reports.v3.habit_${habit.status}`)}
            </Text>
          </View>

          {/* Performance Age — only with a real current age. D1: the direction
              of the move is a glyph and a spoken sentence, never a colour. */}
          {paView.currentAge != null ? (
            <View style={styles.section} testID="editorial-weekly-performance-age">
              <EdCaption text={t('reports.v3.pa_label')} />
              <View
                accessible
                accessibilityLabel={[
                  paView.previousAge != null
                    ? t('reports.v3.pa_row_a11y_moved', {
                        previous: paView.previousAge,
                        current: paView.currentAge,
                      })
                    : t('reports.v3.pa_row_a11y_current', { current: paView.currentAge }),
                  // A grouped node's label REPLACES its children, so the
                  // qualifier rendered beside the numbers has to be folded in
                  // or it is never announced at all.
                  paDelta == null && paView.provisional ? t('reports.v3.pa_provisional') : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={styles.paRow}
              >
                {paView.previousAge != null ? (
                  <>
                    <Text
                      maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
                      style={[edType.numberFeature as TextStyle, { color: ink.quiet }]}
                    >
                      {paView.previousAge}
                    </Text>
                    <Text style={[edType.body as TextStyle, { color: ink.quiet }]}>→</Text>
                  </>
                ) : null}
                <Text
                  maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
                  style={[edType.numberFeature as TextStyle, { color: ink.primary }]}
                >
                  {paView.currentAge}
                </Text>
                {paDelta != null ? (
                  <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>
                    {paDelta <= 0 ? '▼' : '▲'} {Math.abs(paDelta)} {t('reports.v3.pa_years')}
                  </Text>
                ) : paView.provisional ? (
                  <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>
                    {t('reports.v3.pa_provisional')}
                  </Text>
                ) : null}
              </View>

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
                      <View key={b.dayIndex} style={styles.paBarTrack}>
                        {/* Spacer FIRST, bar SECOND: in a column the bar must
                            sit on the baseline and grow upward. Reversing
                            these hangs every bar from the top and inverts the
                            whole chart's reading. */}
                        <View style={{ flex: Math.max(0.02, 1 - paAxis.fractions[i]!) }} />
                        <View
                          style={[
                            styles.paBar,
                            { flex: Math.max(0.02, paAxis.fractions[i]!), backgroundColor: ink.primary },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                  <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 8 }]}>
                    {t('reports.v3.pa_scale', {
                      min: Math.round(paAxis.minAge),
                      max: Math.round(paAxis.maxAge),
                    })}
                  </Text>
                </>
              ) : (
                <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 10 }]}>
                  {t('reports.v3.pa_collecting')}
                </Text>
              )}
              <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 12 }]}>
                {PERFORMANCE_AGE_DISCLAIMER}
              </Text>
            </View>
          ) : null}

          {/* Weekly timeline — omitted rather than drawn empty. D1: the band
              accent is withheld on paper; height carries the score and the
              composed label speaks it. */}
          {model.timeline.length > 0 ? (
            <View style={styles.section} testID="editorial-weekly-timeline">
              <EdCaption text={t('reports.v3.timeline_label')} />
              <View style={styles.timeline}>
                {model.timeline.map((d) => {
                  // A day HydroState never observed keeps its column but draws
                  // no bar and speaks "no reading" — the Editorial
                  // truthful-neutral rule (an unmeasured value is the em-dash,
                  // never a fabricated zero) applied to the timeline. Drawing
                  // the server's sentinel would give a silent day a real,
                  // readable height.
                  const unmeasured = d.score == null;
                  return (
                    <View
                      key={d.date}
                      accessible
                      accessibilityLabel={
                        unmeasured
                          ? t('reports.v3.timeline_day_unmeasured_a11y', {
                              day: t(`reports.v3.wd_${WEEKDAY_KEYS[d.weekday]}`),
                              date: featureShortDate(d.date, i18n.language) ?? d.date,
                            })
                          : t('reports.v3.timeline_day_a11y', {
                              day: t(`reports.v3.wd_${WEEKDAY_KEYS[d.weekday]}`),
                              date: featureShortDate(d.date, i18n.language) ?? d.date,
                              score: d.score,
                            })
                      }
                      style={styles.timelineDay}
                      testID={`editorial-weekly-timeline-${d.date}`}
                    >
                      <View style={styles.timelineTrack}>
                        {unmeasured ? null : (
                          <>
                            <View style={{ flex: Math.max(0.02, 1 - Math.min(100, d.score!) / 100) }} />
                            <View
                              style={[
                                styles.timelineFill,
                                {
                                  flex: Math.max(0.1, Math.min(100, d.score!) / 100),
                                  backgroundColor: ink.primary,
                                },
                              ]}
                            />
                          </>
                        )}
                      </View>
                      <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
                        {t(`reports.v3.wd_${WEEKDAY_KEYS[d.weekday]}`)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* The kicker carries the week's one instruction — the canonical
              next-week focus, verbatim through sectionSummary. This surface
              authors no instruction of its own (DR-013). */}
          <View style={styles.section} testID="editorial-weekly-next-focus">
            <EdCaption text={t('reports.v3.next_focus')} />
            <EdKicker text={sectionSummary(t, nextFocus)} />
          </View>

          <View style={styles.folio}>
            <EdEvidenceLine parts={[t('reports.v3.eyebrow')]} />
          </View>
        </Animated.View>
      </AFScreen>
    </EdSurface>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: edStock.paper },
  /** Restates the stock on the AFScreen shell, which paints af.canvas. */
  canvas: { backgroundColor: edStock.paper },
  content: { paddingBottom: edRhythm.minTarget * 2 },
  degraded: { marginTop: 16 },
  retryTarget: {
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  spacedRule: { marginTop: 24 },
  section: { marginTop: 28 },
  evidence: { marginTop: 10 },
  paRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 12,
    flexWrap: 'wrap',
    rowGap: 4,
    marginTop: 8,
  },
  paBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 6,
    height: 72,
    marginTop: 18,
  },
  paBarTrack: { flex: 1, justifyContent: 'flex-end' },
  paBar: { width: '100%' },
  timeline: {
    flexDirection: 'row',
    columnGap: 8,
    marginTop: 14,
  },
  timelineDay: { flex: 1, alignItems: 'center', rowGap: 6 },
  timelineTrack: { height: 56, width: '100%', justifyContent: 'flex-end' },
  timelineFill: { width: '100%' },
  folio: { marginTop: 30 },
});
