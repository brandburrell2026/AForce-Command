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
 * Everything the legacy overview shows is preserved (§ information
 * classification in the PR): summary counts, PREPARE MY DAY, the priority
 * moment's prep window + action + WHY THIS, the quiet later rows, the
 * calendar entry behind its legal gate, and the empty/skeleton states.
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
                <EdCaption text={t('moments.up_next')} />
                <EdStatement style={styles.statement}>
                  {t('moments.overview_summary', { total: summary.total })}
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

  return (
    <EdSpineRow state={state}>
      <Pressable
        onPress={() => router.push(`/moment/${moment.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${clockLabel(moment.startAtIso)}, ${title}`}
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
        {/* State is said in words, never carried by the node colour alone. */}
        <Text style={[edType.micro as TextStyle, { color: live ? edAccent.red : ink.quiet, marginTop: 4 }]}>
          {t('moments.prep_window')} {prepWindowLabel(rec)}
        </Text>
        {priority ? (
          <Text style={[edType.micro as TextStyle, { color: ink.quiet, marginTop: 4 }]}>
            {t(live ? 'moments.do_this_now' : 'moments.do_this')}{' '}
            {t(action.labelKey, action.labelParams)}
          </Text>
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
  spine: { marginTop: 22 },
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
