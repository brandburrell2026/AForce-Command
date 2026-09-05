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

import { AFScreen } from '@/components/ui';
import { MomentsOverviewSkeleton } from '@/components/moments/MomentsSkeleton';
import { WhyThisSheet } from '@/components/moments/WhyThisSheet';
import { useMomentsData } from '@/components/moments/useMomentsData';
import {
  clockLabel,
  daySummary,
  prepWindowLabel,
  windowPosture,
} from '@/components/moments/momentsPresentation';
import { useFeatureFlags } from '@/store/useAppStore';
import type { Moment, MomentRecommendation } from '@/types/moments';
import { edAccent, edInkFor, edRhythm, edStock, edType } from '@/theme/editorialTokens';

import {
  EdCaption,
  EdNodeSpine,
  EdRule,
  EdSpineRow,
  EdStatement,
  EdSurface,
  useEdSettle,
} from '../index';
import { EdReturn } from './EdReturn';
import { spineStateFor } from './editorialMomentsPresentation';

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

  const summary = daySummary(data.surfaced);
  const upNext = data.surfaced.filter(
    (m) => Date.parse(m.startAtIso) > Date.parse(data.nowIso),
  );
  const now = React.useMemo(() => new Date(data.nowIso), [data.nowIso]);

  return (
    <EdSurface stock="black" style={styles.fill}>
      <AFScreen scroll contentContainerStyle={styles.scrollContent}>
        <Animated.View style={settle}>
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
              {/* The day announced, not listed. */}
              <View style={styles.statementWrap}>
                <EdStatement style={styles.statement} accessibilityRole="header">
                  {/* `count` is what i18next pluralizes on; `total` stays for the
                      interpolation. Without count it printed "1 moments". */}
                  {t('moments.overview_summary', { count: summary.total, total: summary.total })}
                </EdStatement>
                <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 6 }]}>
                  {t('moments.overview_summary_prep', { n: summary.prepWorthy })}
                </Text>
                <Pressable
                  onPress={() => router.push('/moments-plan')}
                  accessibilityRole="button"
                  accessibilityLabel={t('moments.prepare_my_day')}
                  hitSlop={8}
                  style={styles.quietAction}
                  testID="editorial-moments-prepare-day"
                >
                  <Text style={[edType.micro as TextStyle, { color: edAccent.red }]}>
                    {t('moments.prepare_my_day')}
                  </Text>
                </Pressable>
              </View>

              {upNext.length > 0 ? (
                <View style={styles.spineLabel}>
                  {/* The section label belongs to the list it heads — not to
                      the summary statement above it. */}
                  <EdCaption text={t('moments.up_next')} />
                </View>
              ) : null}
              {upNext.length > 0 ? (
                <EdNodeSpine style={styles.spine}>
                  {upNext.map((moment, i) => (
                    <SpineMoment
                      key={moment.id}
                      moment={moment}
                      rec={data.recFor(moment)}
                      nowIso={data.nowIso}
                      /* The priority moment keeps the full brief; the rest stay
                         quiet rows — the Wave-5 "UP NEXT has ONE priority"
                         hierarchy, in editorial register. */
                      priority={i === 0}
                    />
                  ))}
                </EdNodeSpine>
              ) : null}

              {/* The ascent — the deck's closing device. Decorative only. */}
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.ascent}
              >
                {[10, 16, 22, 28].map((w) => (
                  <View key={w} style={[styles.ascentDash, { width: w, backgroundColor: ink.rule }]} />
                ))}
                <View style={[styles.ascentDot, { backgroundColor: edAccent.red }]} />
              </View>
            </>
          )}
        </Animated.View>
      </AFScreen>
    </EdSurface>
  );
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
  const stateWord = t(live ? 'moments.do_this_now' : 'moments.do_this');
  const prepText = `${t('moments.prep_window')} ${prepWindowLabel(rec)}`;
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
    <EdSpineRow state={state}>
      <Pressable
        onPress={() => router.push(`/moment/${moment.id}`)}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        style={styles.rowPress}
        testID={`editorial-moment-row-${moment.id}`}
      >
        <View style={styles.rowHead}>
          <Text style={[edType.data as TextStyle, { color: ink.quiet }]}>
            {clockLabel(moment.startAtIso)}
          </Text>
          <Text
            style={[edType.body as TextStyle, { color: ink.primary, flexShrink: 1 }]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        {/* The window, with its label. Colour marks the live row but never
            carries it alone — the node's own form differs, and the composed
            accessibility label above says the state in words. */}
        <Text style={[edType.micro as TextStyle, { color: live ? edAccent.red : ink.quiet, marginTop: 4 }]}>
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
    </EdSpineRow>
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
  statementWrap: { marginTop: 18 },
  statement: { marginTop: 8 },
  quietAction: {
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  spineLabel: { marginTop: 26 },
  spine: { marginTop: 10 },
  rowPress: { minHeight: edRhythm.minTarget, justifyContent: 'center' },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 10,
    flexWrap: 'wrap',
    rowGap: 2,
  },
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
  ascent: {
    marginTop: 34,
    alignItems: 'flex-start',
    rowGap: 5,
  },
  ascentDash: { height: StyleSheet.hairlineWidth },
  ascentDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 },
});
