/**
 * EditorialMomentsScreen — MOMENTS, The Day (E3, founder ruling 2026-08-29).
 *
 * The Editorial OS composition of the SAME Moments truth: `useMomentsData`
 * with its Decision-Guard-wrapped `recFor`, the same surfaced set, the same
 * hydration gate, the same empty state, the same routes. The node spine is
 * this surface's ONE signature — the day on a vertical spine, each row
 * carrying mono time · node · title · state.
 *
 * RULINGS APPLIED
 *  R1 — the return idiom is locale-formatted date furniture; no issue number.
 *  R2 — the canonical posture vocabulary is completed | active | upcoming.
 *       There is NO "clear"/committed posture in production, so the spec
 *       prototype's CLEAR row and its Lock-In blue are NOT implemented.
 *  И  — absent by design: Moments has no canonical single-token state word
 *       to mark, and the mark is never introduced to increase its own use.
 *  CMD— the live row's action renders the guarded label verbatim.
 *
 * INFORMATION CARRIED OVER (verified element-by-element against
 * MomentsScreen in the E3 review): summary counts, PREPARE MY DAY, the
 * priority moment's prep window + guarded action + best-before + OPTIONAL
 * secondary + WHY THIS, the quiet later rows, the calendar entry behind its
 * legal gate, and the empty/skeleton states.
 *
 * DELIBERATELY NOT CARRIED OVER (presentation, not truth): the legacy card's
 * category · importance line and its per-row "Starts in" cell. Both are
 * restated by the spine itself — the row's own clock and its position on the
 * day — and the category/importance pair is the one piece of legacy copy that
 * duplicates what the moment's title and placement already say. Recorded here
 * so it is a decision, not drift.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { AFMasthead, AFScreen } from '@/components/ui';
import { MomentsOverviewSkeleton } from '@/components/moments/MomentsSkeleton';
import { WhyThisSheet } from '@/components/moments/WhyThisSheet';
import { useMomentsData } from '@/components/moments/useMomentsData';
import {
  clockLabel,
  prepWindowLabel,
  windowPosture,
} from '@/components/moments/momentsPresentation';
import { useFeatureFlags } from '@/store/useAppStore';
import type { Moment, MomentRecommendation } from '@/types/moments';
import { af } from '@/theme';
import { edInkFor, edRhythm, edStock, edType } from '@/theme/editorialTokens';

import {
  EdRule,
  EdStatement,
  EdSurface,
  useEdSettle,
} from '../index';
import { EdReturn } from './EdReturn';
import { returnLabel, spineStateFor } from './editorialMomentsPresentation';

export function EditorialMomentsScreen({
  fixtureMoments,
  fixtureNowIso,
}: {
  fixtureMoments?: Moment[];
  fixtureNowIso?: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const data = useMomentsData({ fixtureMoments, fixtureNowIso });
  const calendarOn = useFeatureFlags().moments_calendar_enabled;
  const ink = edInkFor('black');
  const settle = useEdSettle();

  const now = React.useMemo(() => new Date(data.nowIso), [data.nowIso]);
  // The Figma calendar is a short, ordered horizon rather than one undifferentiated
  // queue. These are only real surfaced Moments, limited to the first three
  // dates the existing recommendation boundary already allows through.
  const calendarDays = React.useMemo(
    () => groupMomentDays(data.surfaced, data.nowIso),
    [data.nowIso, data.surfaced],
  );
  const upcomingCount = React.useMemo(() => {
    const nowMs = Date.parse(data.nowIso);
    return calendarDays
      .flatMap((d) => d.moments)
      .filter((m) => Date.parse(m.startAtIso) > nowMs).length;
  }, [calendarDays, data.nowIso]);

  return (
    <EdSurface stock="black" style={styles.fill}>
      <AFScreen scroll contentContainerStyle={styles.scrollContent}>
        <Animated.View style={settle}>
          {/* Black Issue (2026-10-06): the wordmark masthead heads the day;
              the return idiom + calendar entry sit on the row beneath it. */}
          <AFMasthead testID="editorial-moments-masthead" />
          <View style={styles.headRow}>
            <EdReturn now={now} fallback="/" />
            {calendarOn ? (
              <Pressable
                onPress={() => router.push('/calendar-settings')}
                accessibilityRole="button"
                accessibilityLabel={t('moments.calendar.title')}
                hitSlop={8}
                style={styles.headAction}
                testID="editorial-moments-calendar"
              >
                <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
                  {t('moments.calendar.title')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <EdRule />

          {!data.hydrated ? (
            /* Until the store answers, "no moments" is not something we know. */
            <MomentsOverviewSkeleton />
          ) : data.surfaced.length === 0 ? (
            <View style={styles.emptyWrap} testID="editorial-moments-empty">
              <EdStatement>{t('moments.empty_title')}</EdStatement>
              <Text style={[edType.body as TextStyle, { color: ink.quiet, marginTop: 10 }]}>
                {t('moments.empty_body')}
              </Text>
              <Pressable
                onPress={() => router.push('/moments-plan')}
                accessibilityRole="button"
                accessibilityLabel={t('moments.add_moment')}
                style={[styles.primary, { borderColor: ink.primary }]}
                testID="editorial-moments-add"
              >
                <Text style={[edType.confirm as TextStyle, { color: ink.primary }]}>
                  {t('moments.add_moment')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Figma's approved three-day calendar leads the experience.
                  The rows below stay sourced from real surfaced Moments. */}
              <View style={styles.statementWrap}>
                <Text style={[edType.caption as TextStyle, { color: af.redText }]}>
                  {t('moments.overview_title').toUpperCase()}
                </Text>
                <EdStatement style={styles.statement} accessibilityRole="header">
                  {t('moments.editorial_three_days')}
                </EdStatement>
                <Text style={[edType.body as TextStyle, { color: ink.quiet, marginTop: 6 }]}>
                  {t('moments.editorial_three_days_body')}
                </Text>
              </View>

              {/* Black Issue: each day is a red mono section head over a
                  hairline (relative day left, real date right), then
                  hairline rows of mono clock · title · trailing meta. The
                  rows stay sourced from real surfaced Moments. */}
              {calendarDays.map((day, dayIndex) => (
                <View key={day.key} style={dayIndex === 0 ? styles.firstDay : styles.daySection}>
                  <View style={[styles.dayHeading, { borderBottomColor: af.red }]}>
                    <Text
                      accessibilityRole="header"
                      style={[edType.caption as TextStyle, { color: af.redText }]}
                    >
                      {t(`moments.editorial_${day.relative}`).toUpperCase()}
                    </Text>
                    <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
                      {day.dateLabel.toUpperCase()}
                    </Text>
                  </View>
                  {day.moments.map((moment, momentIndex) => (
                    <SpineMoment
                      key={moment.id}
                      moment={moment}
                      rec={data.recFor(moment)}
                      nowIso={data.nowIso}
                      /* The first real upcoming Moment keeps the full brief;
                         every subsequent row remains quiet. */
                      priority={dayIndex === 0 && momentIndex === 0}
                    />
                  ))}
                </View>
              ))}

              {/* Summary furniture: only what the screen can state — the
                  count of RENDERED rows that have not started yet, and the
                  date. No "flagged", no "synced", no readiness claim. */}
              <Text
                style={[edType.micro as TextStyle, styles.summary, { color: ink.quiet }]}
                testID="editorial-moments-summary"
              >
                {`${t('moments.summary_count', { count: upcomingCount })} · ${returnLabel(now)}`}
              </Text>
            </>
          )}
        </Animated.View>
      </AFScreen>
    </EdSurface>
  );
}

function groupMomentDays(moments: Moment[], nowIso: string) {
  const grouped = new Map<string, Moment[]>();
  const sorted = [...moments].sort(
    (a, b) => Date.parse(a.startAtIso) - Date.parse(b.startAtIso),
  );
  for (const moment of sorted) {
    const date = new Date(moment.startAtIso);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(moment);
    else grouped.set(key, [moment]);
  }
  return Array.from(grouped.entries())
    .slice(0, 3)
    .map(([key, dayMoments]) => {
      const date = new Date(dayMoments[0].startAtIso);
      const today = new Date(nowIso);
      date.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const dayDelta = Math.round((date.getTime() - today.getTime()) / 86_400_000);
      return {
        key,
        relative: dayDelta <= 0 ? 'today' : dayDelta === 1 ? 'tomorrow' : 'next',
        // Date furniture is derived from the real moment itself, never an
        // authored or sample calendar claim.
        dateLabel: new Intl.DateTimeFormat(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }).format(date),
        moments: dayMoments,
      };
    });
}

function SpineMoment({
  moment,
  rec,
  nowIso,
  priority,
}: {
  moment: Moment;
  rec: MomentRecommendation;
  nowIso: string;
  priority: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const ink = edInkFor('black');
  const [whyOpen, setWhyOpen] = React.useState(false);
  const posture = windowPosture(rec, moment.startAtIso, nowIso);
  const state = spineStateFor(posture);
  const live = state === 'live';
  const title = moment.masked ? t('moments.private_event') : moment.title;
  const action = rec.primaryAction;
  // The state word: a completed row says DONE — shown AND spoken — never an
  // instruction to act (#1088 review follow-up); live/next rows keep the
  // charter's imperative, gated on an action existing (RP-3 lock below).
  const stateWord = state === 'done' ? t('moments.stage_done') : t(live ? 'moments.do_this_now' : 'moments.do_this');
  const prepText = `${t('moments.prep_window')} ${prepWindowLabel(rec)}`;
  // Trailing meta: a done row says DONE (a word, not a tint); other rows show
  // the guarded action label or the state word.
  const actionPreview = (
    state === 'done' ? stateWord : action ? t(action.labelKey, action.labelParams) : stateWord
  ).toUpperCase();
  // The Pressable groups its children, so the composed label IS the whole
  // spoken row: time, title, state, window, and — on the priority row — the
  // action and its best-before. Without this the reader hears only the time
  // and title while the screen shows four more facts.
  const a11yLabel = [
    clockLabel(moment.startAtIso),
    title,
    // RP-3 review: stateWord ("Do this now") used to always introduce a
    // real action on priority rows — now that the mirror can be absent
    // (no eligible command / a blocked mirror dropped), speaking the
    // imperative alone with nothing following it is a dangling command.
    // Mirror the visible composition: silent exactly when the action is.
    priority ? (action ? stateWord : '') : stateWord,
    prepText,
    priority && action ? t(action.labelKey, action.labelParams) : '',
    priority && action?.bestBeforeIso
      ? t('moments.best_before', { time: clockLabel(action.bestBeforeIso) })
      : '',
    priority && rec.secondaryAction
      ? `${t('moments.optional_label')}: ${t(rec.secondaryAction.labelKey, rec.secondaryAction.labelParams)}`
      : '',
  ]
    .filter((part) => part.trim().length > 0)
    .join(', ');

  return (
    <View style={[styles.row, { borderBottomColor: ink.rule }]}>
      {/* Shape cue for the live row (never colour alone — #1088 review B2):
          a 2pt red rule down the row's left edge. Done rows say DONE. */}
      {live ? (
        <View
          style={[styles.liveRule, { backgroundColor: af.red }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      <Pressable
        onPress={() => router.push(`/moment/${moment.id}`)}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={styles.rowPress}
        testID={`editorial-moment-row-${moment.id}`}
      >
        <View style={styles.rowHead}>
          {/* Mono clock column, then the title; the live row's clock and
              trailing meta take the AA red. Colour never carries the state
              alone — the composed accessibility label says it in words,
              and the done row reads quiet. */}
          <Text style={[edType.data as TextStyle, styles.rowClock, { color: live ? af.redText : ink.quiet }]}>
            {clockLabel(moment.startAtIso)}
          </Text>
          <Text
            style={[edType.body as TextStyle, { color: state === 'done' ? ink.quiet : ink.primary, flexShrink: 1, flexGrow: 1 }]}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text style={[edType.micro as TextStyle, styles.rowAction, { color: live ? af.redText : ink.quiet, flexShrink: 1 }]}>
            {actionPreview}
          </Text>
        </View>
        <Text style={[edType.micro as TextStyle, styles.rowWindow, { color: live ? af.redText : ink.quiet }]}>
          {prepText}
        </Text>
        {priority ? (
          <>
            {/* RP-3: mirror or silence — the Moment never words its own
                hydration action. */}
            {action ? (
              <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 4 }]}>
                {stateWord} {t(action.labelKey, action.labelParams)}
              </Text>
            ) : null}
            {action?.bestBeforeIso ? (
              <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 2 }]}>
                {t('moments.best_before', { time: clockLabel(action.bestBeforeIso) })}
              </Text>
            ) : null}
            {rec.secondaryAction ? (
              <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 2 }]}>
                {t('moments.optional_label')}{' '}
                {t(rec.secondaryAction.labelKey, rec.secondaryAction.labelParams)}
              </Text>
            ) : null}
          </>
        ) : null}
      </Pressable>
      {priority ? (
        <Pressable
          onPress={() => setWhyOpen(true)}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.whyTarget}
          testID={`editorial-moment-why-${moment.id}`}
        >
          <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
            {t('moments.why_this')}
          </Text>
        </Pressable>
      ) : null}
      {priority ? (
        <WhyThisSheet rec={rec} visible={whyOpen} onClose={() => setWhyOpen(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: edStock.black },
  scrollContent: { paddingBottom: 96 },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 12,
  },
  headAction: {
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
  },
  statementWrap: { marginTop: 10 },
  statement: { marginTop: 8 },
  firstDay: { marginTop: 24 },
  daySection: { marginTop: 22 },
  dayHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  row: { borderBottomWidth: 1 },
  liveRule: { position: 'absolute', left: -12, top: 10, bottom: 10, width: 2, borderRadius: 1 },
  rowPress: { minHeight: edRhythm.minTarget, justifyContent: 'center', paddingVertical: 10 },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 12,
    // AX ruling: reflow, not clip — at accessibility sizes the clock, title
    // and meta wrap onto their own lines instead of clipping at the edge.
    flexWrap: 'wrap',
    rowGap: 2,
  },
  rowClock: { minWidth: 64 },
  rowAction: { textAlign: 'right' },
  rowWindow: { marginTop: 4, marginLeft: 76 },
  summary: { marginTop: 22 },
  whyTarget: {
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  emptyWrap: { marginTop: 28 },
  primary: {
    marginTop: 18,
    minHeight: edRhythm.minTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
});
