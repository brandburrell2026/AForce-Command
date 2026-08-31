/**
 * EditorialMomentDetailScreen — MOMENT DETAIL, The Performance Story
 * (E3, founder ruling 2026-08-29).
 *
 * The same ritual truth as `MomentDetailScreen`, in editorial register: the
 * moment titled like a story, mono meta carrying time and window, the four
 * charter-locked chapters (PAUSE → HYDRATE → LOCK IN → PERFORM) rendered
 * from `rec.ritual` in order with done chapters receding and the live one
 * dominant, one CONFIRM action, and the fail-closed evidence caption.
 *
 * CONTRACTS
 *  • Stage titles reuse the shipped `opening.ritual_*` identity — one ritual
 *    across the OS. Order and membership come from `rec.ritual`; nothing is
 *    re-derived, filtered, or sorted here. RP-3 (Wave 3, 2026-08-31): the
 *    HYDRATE chapter mirrors the canonical command and is OMITTED — not
 *    degraded — when no eligible command exists; a three-chapter ritual
 *    (PAUSE → LOCK IN → PERFORM) is correct rendering, not a bug.
 *  • Instructions render the GUARDED label + params verbatim. A blocked
 *    mirror is DROPPED (the stage disappears), never replaced with neutral
 *    fallback copy — silence, not a Moment-minted substitute (RP-3).
 *  • "I'm ready" performs the identical three effects as the legacy screen —
 *    calendar-prepared mark OR store write, plus the notification cancel —
 *    under the identical `!prepared && !readOnly` guard. No second write
 *    path, no un-prepare control.
 *  • WHY stays the inline fail-closed caption. The dead WhyThisSheet that
 *    Wave 5 deleted from this surface is NOT resurrected.
 *  • The DR-012 selective prep-feedback ask is carried over with its exact
 *    guards — it is the only write path for the Moments learning corpus.
 *  • Both Wave-5 announcement guards are kept: iOS-only (Android has the
 *    live region) and mount-seeded (announce on ADVANCE, never on open).
 *  • The И is absent: this surface has no canonical single-token state word.
 *    (The spec's "И flips on confirm" is a motion flourish with no state to
 *    attach to — see the PR's prototype-vs-production conflicts.)
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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

import { AFScreen } from '@/components/ui';
import { markCalendarMomentPrepared } from '@/services/calendarMoments';
import { cancelMomentNotification } from '@/services/momentNotifications';
import { updateMoment } from '@/services/momentsStore';
import {
  useMomentFeedback,
  hydrateMomentFeedback,
  recordMomentFeedback,
  shouldAskFeedback,
  type MomentPrepFeedback,
} from '@/services/momentFeedback';
import { useFeatureFlags } from '@/store/useAppStore';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import {
  clockLabel,
  prepWindowLabel,
  ritualStageA11yLabel,
  stageStateLabelKey,
  startsIn,
} from '@/components/moments/momentsPresentation';
import type { Moment, MomentRecommendation, RitualStage } from '@/types/moments';
import { edAccent, edInkFor, edPositive, edRhythm, edStock, edType } from '@/theme/editorialTokens';

import { EdCaption, EdEvidenceLine, EdRule, EdStatement, EdSurface, useEdSettle } from '../index';
import { EdReturn } from './EdReturn';
import { chapterNumber } from './editorialMomentsPresentation';

/** Charter-locked ritual identity — the same keys the legacy screen uses. */
const STAGE_TITLE_KEY: Record<RitualStage['key'], string> = {
  pause: 'opening.ritual_pause',
  hydrate: 'opening.ritual_hydrate',
  lock_in: 'opening.ritual_lock_in',
  perform: 'opening.ritual_perform',
};

export function EditorialMomentDetailScreen({
  moment,
  rec,
  nowIso,
  readOnly,
}: {
  moment: Moment;
  rec: MomentRecommendation;
  nowIso: string;
  /** Gallery/demo fixtures render without store writes. */
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const ink = edInkFor('black');
  const settle = useEdSettle();
  const eta = startsIn(moment.startAtIso, nowIso);
  const prepared = Boolean(moment.preparedAtIso);
  const title = moment.masked ? t('moments.private_event') : moment.title;

  // The ritual advances on its own (the 30s tick). Sighted members watch the
  // live chapter move; screen-reader users are told — announced ONLY when the
  // active stage actually changes, never on a tick that moved a clock.
  const activeStage = rec.ritual.find((s) => s.state === 'active');
  const activeStageKey = activeStage?.key ?? null;
  const announcedStageRef = React.useRef<string | null>(null);
  const activeAnnouncement = activeStage
    ? ritualStageA11yLabel(
        t(STAGE_TITLE_KEY[activeStage.key]),
        t('moments.do_this_now'),
        t(activeStage.instructionKey, activeStage.instructionParams),
      )
    : null;
  const activeAnnouncementRef = React.useRef(activeAnnouncement);
  activeAnnouncementRef.current = activeAnnouncement;
  // Both Wave-5 guards, carried over verbatim from the legacy screen:
  //  • iOS only — Android already gets the polite live region below, so
  //    announcing here as well would double-speak every advance.
  //  • Seed the ref on mount, so the FIRST commit is not treated as an
  //    advance: the ritual announces when it MOVES, never on open.
  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      announcedStageRef.current = activeStageKey;
      return;
    }
    if (Platform.OS !== 'ios') return;
    if (announcedStageRef.current === activeStageKey) return;
    announcedStageRef.current = activeStageKey;
    if (activeAnnouncementRef.current) {
      AccessibilityInfo.announceForAccessibility(activeAnnouncementRef.current);
    }
  }, [activeStageKey]);

  // DR-012 Ruling 2 — the selective prep-feedback ask. Ported verbatim from
  // the legacy screen: this is the ONLY write path for the Moments learning
  // corpus (services/momentFeedback.ts), which feeds deriveLeadAdjustments →
  // planMomentNotifications. Dropping it would have quietly starved a live
  // production subsystem the moment this flag flipped.
  const learningOn = useFeatureFlags().moments_learning_enabled;
  const feedback = useMomentFeedback();
  React.useEffect(() => {
    if (learningOn) void hydrateMomentFeedback();
  }, [learningOn]);
  const answered = feedback.find((r) => r.momentId === moment.id);
  const askFeedback =
    learningOn &&
    !readOnly &&
    (answered != null ||
      shouldAskFeedback(
        {
          momentId: moment.id,
          importance: moment.importance,
          prepared,
          momentStartIso: moment.startAtIso,
        },
        feedback,
        nowIso,
      ));
  const giveFeedback = (value: MomentPrepFeedback) => {
    recordMomentFeedback({
      momentId: moment.id,
      momentType: moment.type,
      feedback: value,
      atIso: new Date().toISOString(),
    });
  };

  const confirm = () => {
    if (!prepared && !readOnly) {
      if (moment.source === 'calendar' && moment.calendarEventId) {
        void markCalendarMomentPrepared(moment.calendarEventId);
      } else {
        updateMoment(moment.id, { preparedAtIso: new Date().toISOString() });
      }
      void cancelMomentNotification(moment.id);
    }
  };

  return (
    <EdSurface stock="black" style={styles.fill}>
      <AFScreen scroll contentContainerStyle={styles.scrollContent}>
        <Animated.View style={settle}>
          <EdReturn now={new Date(nowIso)} fallback="/moments" />
          <EdRule />

          <EdStatement style={styles.title} accessibilityRole="header">
            {title}
          </EdStatement>
          {/* Mono meta. Every value keeps the label that names it — a bare
              "22 min" says nothing on its own, in print or to a reader. */}
          <View style={styles.metaRow}>
            <EdCaption text={clockLabel(moment.startAtIso)} />
            {eta ? (
              <EdCaption
                text={`${t('moments.starts_in')} ${
                  eta.hours > 0
                    ? t('moments.in_h_m', { h: eta.hours, m: eta.minutes })
                    : t('moments.in_m', { m: eta.minutes })
                }`}
              />
            ) : null}
            <EdCaption text={`${t('moments.prep_window')} ${prepWindowLabel(rec)}`} />
          </View>

          {/* The chapters — charter-locked order, straight from rec.ritual. */}
          <View
            style={styles.chapters}
            accessibilityLiveRegion="polite"
            testID="editorial-moment-ritual"
          >
            {rec.ritual.map((stage, i) => (
              <Chapter key={stage.key} stage={stage} index={i} />
            ))}
          </View>

          <EdRule />

          <View testID="editorial-moment-confirm">
            <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>
              <Text style={{ color: edAccent.red }}>{'—— '}</Text>
              {t('moments.why_this')}
            </Text>
            <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 8 }]}>
              {t(rec.evidence.summaryKey)}
            </Text>
          </View>

          <Pressable
            onPress={confirm}
            disabled={prepared}
            accessibilityRole="button"
            accessibilityLabel={prepared ? t('moments.status_completed') : t('moments.im_ready')}
            accessibilityState={{ disabled: prepared }}
            style={({ pressed }) => [
              styles.confirm,
              {
                borderColor: prepared ? ink.quiet : ink.primary,
                opacity: prepared ? 0.55 : pressed ? 0.75 : 1,
              },
            ]}
            testID="editorial-moment-im-ready"
          >
            <Text
              maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
              style={[
                edType.confirm as TextStyle,
                { color: prepared ? ink.quiet : ink.primary },
              ]}
            >
              {prepared ? t('moments.status_completed') : t('moments.im_ready')}
            </Text>
          </Pressable>

          {askFeedback ? (
            <View style={styles.feedback} testID="editorial-moment-feedback">
              <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
                {t('moments.feedback.title')}
              </Text>
              {answered ? (
                <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 8 }]}>
                  {t('moments.feedback.thanks')}
                </Text>
              ) : (
                <View style={styles.feedbackRow}>
                  {(['just_right', 'too_early', 'too_late'] as const).map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => giveFeedback(k)}
                      accessibilityRole="button"
                      hitSlop={8}
                      style={styles.feedbackPill}
                      testID={`editorial-moment-feedback-${k}`}
                    >
                      <Text style={[edType.micro as TextStyle, { color: ink.primary }]}>
                        {t(`moments.feedback.${k}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.folio}>
            <EdEvidenceLine parts={[clockLabel(moment.startAtIso)]} />
          </View>
        </Animated.View>
      </AFScreen>
    </EdSurface>
  );
}

function Chapter({ stage, index }: { stage: RitualStage; index: number }) {
  const { t } = useTranslation();
  const ink = edInkFor('black');
  const done = stage.state === 'completed';
  const live = stage.state === 'active';
  const stateKey = stageStateLabelKey(stage.state);
  const title = t(STAGE_TITLE_KEY[stage.key]);
  const instruction = t(stage.instructionKey, stage.instructionParams);
  // Upcoming chapters carry their own clock instead of a "not yet" word.
  const meta = stateKey ? t(stateKey) : clockLabel(stage.atIso);

  return (
    <View
      accessible
      accessibilityLabel={ritualStageA11yLabel(title, meta, instruction)}
      style={styles.chapter}
      testID={`editorial-chapter-${stage.key}`}
    >
      <View style={styles.chapterHead}>
        <Text style={[edType.micro as TextStyle, { color: live ? edAccent.red : ink.quiet }]}>
          {chapterNumber(index)}
        </Text>
        <Text
          /* Display-voice text caps at the house boundary, like every other
             editorial statement — an oversized single word must never force
             an iOS mid-word break. */
          maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
          style={[
            (live ? edType.command : edType.body) as TextStyle,
            { color: done ? ink.quiet : ink.primary, flexShrink: 1 },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            edType.micro as TextStyle,
            { color: done ? edPositive : live ? edAccent.red : ink.quiet },
          ]}
        >
          {meta}
        </Text>
      </View>
      <Text
        style={[
          edType.bodySmall as TextStyle,
          { color: done ? ink.quiet : live ? ink.primary : ink.quiet, marginTop: 4 },
        ]}
      >
        {instruction}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: edStock.black },
  scrollContent: { paddingBottom: 96 },
  title: { marginTop: 18 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    rowGap: 4,
    marginTop: 10,
  },
  chapters: { marginTop: 26, rowGap: 20 },
  chapter: {},
  chapterHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 10,
    flexWrap: 'wrap',
    rowGap: 2,
  },
  confirm: {
    marginTop: 22,
    minHeight: edRhythm.minTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  feedback: { marginTop: 26 },
  feedbackRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 8,
    marginTop: 8,
  },
  feedbackPill: {
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: edInkFor('black').rule,
    borderRadius: 2,
  },
  folio: { marginTop: 30 },
});
