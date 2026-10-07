/**
 * EditorialWeeklyScreen — WEEKLY REPORT, The Feature (E5, founder decisions
 * 2026-08-30).
 *
 * The Editorial OS composition of the SAME weekly truth WeeklyReportV3 renders.
 * Every value comes from the chain that screen already consumes:
 * `buildWeeklyV3Model` for the model, `performanceAgeBarAxis` for the chart
 * domain, `getWeeklyReportSection` for the postures. Nothing is re-derived.
 *
 * The approved Figma composition uses the app's black stock. BLACK ISSUE
 * (2026-10-07, PR 4): presentation restyle only — wordmark masthead, red mono
 * section heads over hairlines, numerals, key/value rows, a timeline plate and
 * a full-width CTA. No source, gate, copy authority or truth rule moves.
 *
 * FOUNDER DECISIONS ENFORCED HERE (locked by editorialWeeklyLaw.test.ts):
 *  D1 — NO positive status hue. Positive reads through weight, rule and
 *       position. The direction of a
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
import { useRouter } from 'expo-router';

import { AFMasthead, AFPrimaryButton, AFScreen } from '@/components/ui';
import { getAnalyticsSnapshot } from '@/services/analytics';
import { fetchJournalRollups } from '@/services/realApi';
import { getCommandLedgerState, hydrateCommandLedger } from '@/services/commandLedger';
import { useUserSlice } from '@/store/slices';
import { ledgerToPerformanceAgeSnapshots } from '@/utils/intelligence/commandEventAdapters';
import { usePerformanceAge } from '@/hooks/usePerformanceAge';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { PERFORMANCE_AGE_DISCLAIMER } from '@/utils/performanceAge';
import { lastCompletedWeek, getWeeklyReportSection } from '@/utils/weeklyReport';
import { sectionSummary } from '@/components/insights/weeklyReportCopy';
import {
  buildWeeklyV3Model,
  performanceAgeBarAxis,
  type WeeklyV3Inputs,
  type WeeklyV3Model,
} from '@/components/insights/weeklyV3Presentation';
import { af, afLayout, afType, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { edInkFor, edRhythm, edStock, edType } from '@/theme/editorialTokens';

import { EdRule, EdStatement, EdSurface, useEdSettle } from '../index';
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
  const router = useRouter();
  const ink = edInkFor('black');
  const settle = useEdSettle();
  const eyebrow = useAFEyebrowType();

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
      // The command ledger is the ONLY source of Performance Age snapshots and
      // is now hydrated lazily — module-evaluation hydration was removed
      // because it read storage before Clerk had answered. Read it before
      // snapshotting, or the report would silently show an empty history.
      await hydrateCommandLedger();
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
      <EdSurface stock="black" style={styles.fill}>
        {/* Restated here so this route remains legible if the app-wide status
            bar policy changes. */}
        <StatusBar style="light" />
        {/* AFScreen paints its own shell, so the approved black stock is
            restated explicitly rather than inherited implicitly. */}
        <AFScreen scroll style={styles.canvas} contentContainerStyle={styles.content}>
          <AFMasthead testID="editorial-weekly-masthead" />
          <EdReturn now={new Date()} />
          <Text style={[edType.caption as TextStyle, eyebrow, { color: af.redText }]}>
            {t('reports.v3.eyebrow').toUpperCase()}
          </Text>
          {/* Holds the report's shape while the sources are assembled. Rules,
              not shimmer blocks. One accessible
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

  // The one red emphasis on the timeline: the most recent day that was
  // actually measured. Every other measured day is drawn in the primary ink,
  // so the accent never spreads into a wall of red. Height, the dot fill and
  // the day letter's ink carry the same distinction, so hue is never the
  // only carrier.
  const latestMeasuredDate =
    [...model.timeline].reverse().find((d) => d.score != null)?.date ?? null;

  return (
    <EdSurface stock="black" style={styles.fill}>
      <StatusBar style="light" />
      {/* See the loading branch: the stock is restated on the AFScreen shell
          because AFScreen paints af.canvas over whatever it sits inside. */}
      <AFScreen scroll style={styles.canvas} contentContainerStyle={styles.content}>
        <Animated.View style={settle}>
          <AFMasthead testID="editorial-weekly-masthead" />
          <EdReturn now={new Date()} />

          {/* Eyebrow — the report, then the real reported period (D2), in the
              red mono furniture over a hairline. */}
          <Text style={[edType.caption as TextStyle, eyebrow, styles.eyebrow, { color: af.redText }]}>
            {(period ? `${t('reports.v3.eyebrow')} · ${period}` : t('reports.v3.eyebrow')).toUpperCase()}
          </Text>
          <EdRule />

          <EdStatement accessibilityRole="header">{t('reports.v3.title')}{t('reports.v3.title_stop')}</EdStatement>

          {/* Degraded, not broken. D6 — per-source honesty, stated where the
              loss happened, with a working retry.

              The spec's own anatomy calls for this: "the couldn't-load line
              rendered as editorial matter-of-fact body." It is deliberately NOT
              AFInlineErrorRow. Same message, same retry,
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
                unit: t('reports.v3.days_unit').toUpperCase(),
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

          {/* Honest partials as key / value rows under hairlines. Recovery
              keeps its hardcoded collecting posture — no persisted series
              exists, so it never earns a number. Each row speaks as one unit;
              the quiet note is the existing caption, said in the label too. */}
          <View
            accessible
            accessibilityLabel={`${t('reports.v3.tile_recovery')}: ${t('reports.v3.collecting')}. ${t('reports.v3.recovery_caption')}`}
            style={[styles.kvRow, { borderTopColor: ink.rule }]}
            testID="editorial-weekly-recovery"
          >
            <Text style={[edType.caption as TextStyle, styles.kvKey, eyebrow, { color: af.redText }]}>
              {t('reports.v3.tile_recovery')}
            </Text>
            <Text style={[afType.bodyStrong as TextStyle, styles.kvValue, { color: ink.primary }]}>
              {t('reports.v3.collecting')}
            </Text>
            <Text style={[edType.micro as TextStyle, styles.kvNote, eyebrow, { color: ink.quiet }]}>
              {t('reports.v3.recovery_caption').toUpperCase()}
            </Text>
          </View>

          {/* Hydration days — real, lower authority than the pull numbers. */}
          <View
            accessible
            accessibilityLabel={`${t('reports.v3.tile_hydration_days')}: ${hydrationDaysLine}. ${t('reports.v3.hydration_days_caption')}`}
            style={[styles.kvRow, { borderTopColor: ink.rule }]}
            testID="editorial-weekly-hydration-days"
          >
            <Text style={[edType.caption as TextStyle, styles.kvKey, eyebrow, { color: af.redText }]}>
              {t('reports.v3.tile_hydration_days')}
            </Text>
            <Text style={[afType.bodyStrong as TextStyle, styles.kvValue, { color: ink.primary }]}>
              {hydrationDaysLine}
            </Text>
            <Text style={[edType.micro as TextStyle, styles.kvNote, eyebrow, { color: ink.quiet }]}>
              {t('reports.v3.hydration_days_caption').toUpperCase()}
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
            style={[styles.kvRow, { borderTopColor: ink.rule }]}
            testID="editorial-weekly-habit"
          >
            <Text style={[edType.caption as TextStyle, styles.kvKey, eyebrow, { color: af.redText }]}>
              {t('reports.v3.tile_habit')}
            </Text>
            <Text style={[afType.bodyStrong as TextStyle, styles.kvValue, { color: ink.primary }]}>
              {habit.status === 'collecting'
                ? t('reports.v3.collecting')
                : t('reports.v3.active_days', { n: habit.value ?? '0' })}
            </Text>
            <Text style={[edType.micro as TextStyle, styles.kvNote, eyebrow, { color: ink.quiet }]}>
              {t(`reports.v3.habit_${habit.status}`).toUpperCase()}
            </Text>
          </View>

          {/* Performance Age — only with a real current age. D1: the direction
              of the move is a glyph and a spoken sentence, never a colour. */}
          {paView.currentAge != null ? (
            <View style={styles.section} testID="editorial-weekly-performance-age">
              <SectionHead
                label={t('reports.v3.pa_label')}
                meta={
                  paView.bars.length >= 2 && paAxis
                    ? t('reports.v3.pa_scale', {
                        min: Math.round(paAxis.minAge),
                        max: Math.round(paAxis.maxAge),
                      })
                    : null
                }
              />
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
                  <Text style={[edType.micro as TextStyle, eyebrow, { color: ink.quiet }]}>
                    {paDelta === 0
                      ? `${t('reports.v3.pa_no_change')} · 0 ${t('reports.v3.pa_years')}`.toUpperCase()
                      : `${paDelta <= 0 ? '▼' : '▲'} ${Math.abs(paDelta)} ${t('reports.v3.pa_years')}`.toUpperCase()}
                  </Text>
                ) : paView.provisional ? (
                  <Text style={[edType.micro as TextStyle, eyebrow, { color: ink.quiet }]}>
                    {t('reports.v3.pa_provisional').toUpperCase()}
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
                            {
                              flex: Math.max(0.02, paAxis.fractions[i]!),
                              backgroundColor:
                                i === paView.bars.length - 1 ? ink.primary : af.surfacePressed,
                            },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                  {/* Day furniture under the bars. Hidden from the reader: the
                      chart's own label already names every day and age. */}
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={styles.paDays}
                  >
                    {paView.bars.map((b) => (
                      <Text
                        key={b.dayIndex}
                        style={[edType.micro as TextStyle, styles.paDay, { color: ink.quiet }]}
                      >
                        {t(`reports.v3.wd_${weekdayKeyForDayIndex(b.dayIndex)}`)}
                      </Text>
                    ))}
                  </View>
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

          {/* Weekly timeline — this is the visual centre of the report. It is
              intentionally an observed hydration series, not an invented
              composite score: each column preserves the model's measured or
              unmeasured state. D1: height carries the reading; hue does not. */}
          {model.timeline.length > 0 ? (
            <View style={styles.section} testID="editorial-weekly-timeline">
              <SectionHead
                label={t('reports.v3.timeline_label')}
                meta={t('reports.v3.timeline_hint')}
              />
              <View style={styles.card}>
                <View style={styles.timeline}>
                  {model.timeline.map((d) => {
                    // A day HydroState never observed keeps its column but
                    // draws no bar — a flat dim dash and a hollow dot — and
                    // speaks "no reading": the Editorial truthful-neutral rule
                    // (an unmeasured value is the em-dash, never a fabricated
                    // zero) applied to the timeline. Drawing the server's
                    // sentinel would give a silent day a real, readable height.
                    const unmeasured = d.score == null;
                    const latest = d.date === latestMeasuredDate;
                    const accent = latest ? af.red : ink.primary;
                    const dayOfMonth = Number(d.date.slice(8, 10));
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
                          {/* An unobserved day draws NO bar (truth lock:
                              denseRollupConsumers) — the hollow dot and the
                              spoken "no reading" carry the absence. */}
                          {unmeasured ? null : (
                            <>
                              <View style={{ flex: Math.max(0.02, 1 - Math.min(100, d.score!) / 100) }} />
                              <View
                                style={[
                                  styles.timelineFill,
                                  {
                                    flex: Math.max(0.1, Math.min(100, d.score!) / 100),
                                    backgroundColor: accent,
                                  },
                                ]}
                              />
                            </>
                          )}
                        </View>
                        <View
                          style={[
                            styles.timelineDot,
                            unmeasured
                              ? { borderColor: af.textTertiary }
                              : { backgroundColor: accent, borderColor: accent },
                          ]}
                        />
                        <Text
                          style={[
                            edType.micro as TextStyle,
                            { color: latest ? ink.primary : ink.quiet },
                          ]}
                        >
                          {t(`reports.v3.wd_${WEEKDAY_KEYS[d.weekday]}`).charAt(0)}
                        </Text>
                        {Number.isFinite(dayOfMonth) ? (
                          <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
                            {dayOfMonth}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}

          {/* The focus carries the week's one instruction — the canonical
              next-week focus, verbatim through sectionSummary. This surface
              authors no instruction of its own (DR-013), so the head keeps the
              honest name for it rather than calling it an observation. */}
          <View style={styles.section} testID="editorial-weekly-next-focus">
            <SectionHead label={t('reports.v3.next_focus')} />
            <Text style={[afType.bodyStrong as TextStyle, { color: ink.primary }]}>
              {sectionSummary(t, nextFocus)}
            </Text>
            <AFPrimaryButton
              label={t('reports.v3.open_next_protocol')}
              onPress={() => router.push('/protocol')}
              trailingIcon="plus"
              style={styles.protocolButton}
              testID="editorial-weekly-open-protocol"
            />
          </View>
        </Animated.View>
      </AFScreen>
    </EdSurface>
  );
}

/**
 * The red mono section head: a tracked caption on the left, quiet mono meta on
 * the right. Tracking yields at large Dynamic Type through useAFEyebrowType;
 * the two halves wrap instead of clipping.
 */
function SectionHead({ label, meta }: { label: string; meta?: string | null }) {
  const ink = edInkFor('black');
  const eyebrow = useAFEyebrowType();
  return (
    <View style={styles.sectionHead}>
      <Text style={[edType.caption as TextStyle, eyebrow, styles.sectionLabel, { color: af.redText }]}>
        {label.toUpperCase()}
      </Text>
      {meta ? (
        <Text style={[edType.micro as TextStyle, eyebrow, styles.sectionMeta, { color: ink.quiet }]}>
          {meta.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: edStock.black },
  /** Restates the stock on the AFScreen shell, which paints af.canvas. */
  canvas: { backgroundColor: edStock.black },
  content: { paddingBottom: edRhythm.minTarget * 2 },
  eyebrow: { marginTop: 4 },
  degraded: { marginTop: 16 },
  retryTarget: {
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  spacedRule: { marginTop: 24 },
  section: { marginTop: 28 },
  sectionHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: 12,
    rowGap: 4,
    marginBottom: 12,
  },
  sectionLabel: { flexShrink: 1 },
  sectionMeta: { flexShrink: 1, textAlign: 'right' },
  /** Key / value row: red mono key, bold value, quiet mono note. Wraps — the
   *  note drops under the value at large type instead of being squeezed. */
  kvRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 10,
    rowGap: 4,
    paddingVertical: 14,
    minHeight: edRhythm.minTarget,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  kvKey: { minWidth: 124, maxWidth: '100%' },
  kvValue: { flexShrink: 0 },
  kvNote: { flexGrow: 1, flexShrink: 1, flexBasis: 90, minWidth: 0, textAlign: 'right' },
  paRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 12,
    flexWrap: 'wrap',
    rowGap: 4,
  },
  paBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 8,
    height: 72,
    marginTop: 18,
  },
  paBarTrack: { flex: 1, justifyContent: 'flex-end' },
  paBar: { width: '100%', borderRadius: 2 },
  paDays: { flexDirection: 'row', columnGap: 8, marginTop: 8 },
  paDay: { flex: 1, textAlign: 'center' },
  /** The timeline plate: card surface, hairline border, card radius. Built
   *  here from the tokens because the weekly law bars the shared card
   *  component from this layer. */
  card: {
    backgroundColor: af.surface,
    borderColor: af.border,
    borderWidth: 1,
    borderRadius: afLayout.radiusCard,
    padding: 16,
  },
  timeline: {
    flexDirection: 'row',
    columnGap: 8,
  },
  timelineDay: { flex: 1, alignItems: 'center', rowGap: 6 },
  timelineTrack: {
    height: 76,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  timelineFill: { width: 16, borderRadius: 3 },
  timelineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    marginTop: 4,
  },
  protocolButton: { marginTop: 22 },
});
