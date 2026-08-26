/**
 * MomentDetailScreen — the flagship Moments surface (Phases 1–2, founder
 * approval 2026-08-12): one moment's PAUSE → HYDRATE → LOCK IN → PERFORM
 * ritual as a compact vertical progression. Visually benchmarked against
 * Recovery Stage / Community / Performance Signal: AFTopBar header, charcoal
 * cards, one dominant active stage (green), muted upcoming stages, no giant
 * standalone cards, no decorative motion.
 *
 * Stage titles reuse the shipped Opening Sequence ritual keys
 * (opening.ritual_*) — one ritual identity across the OS. The ritual states
 * are pure engine output (services/momentRecommendation.ts); I'M READY marks
 * the moment prepared in the Moments store only (Score Protection: nothing
 * here touches score or hydration state).
 *
 * Wave 5 closed three accessibility defects here: each ritual stage is now ONE
 * accessibility element with a composed label (it used to read as three loose
 * fragments), stage state is said in words rather than carried by green alone,
 * and the ritual announces when it advances. The dead WHY THIS sheet — mounted
 * but with no control that could ever open it, since WHY is answered inline
 * below — was deleted.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, AccessibilityInfo, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useRouter } from 'expo-router';

import { AFScreen, AFTopBar, AFPrimaryButton } from '@/components/ui';
import { Icon, type IconName } from '@/components/Icon';
import { af, afType, afAlpha, afLayout, withAlpha, Spacing } from '@/theme';
import type { Moment, MomentRecommendation, RitualStage } from '@/types/moments';
import { updateMoment } from '@/services/momentsStore';
import { markCalendarMomentPrepared } from '@/services/calendarMoments';
import { useFeatureFlags } from '@/store/useAppStore';
import {
  useMomentFeedback,
  hydrateMomentFeedback,
  recordMomentFeedback,
  shouldAskFeedback,
  type MomentPrepFeedback,
} from '@/services/momentFeedback';
import { cancelMomentNotification } from '@/services/momentNotifications';
import {
  clockLabel,
  prepWindowLabel,
  ritualStageA11yLabel,
  stageStateLabelKey,
  startsIn,
} from './momentsPresentation';

const STAGE_ICON: Record<RitualStage['key'], IconName> = {
  pause: 'pause',
  hydrate: 'droplet',
  lock_in: 'target',
  perform: 'zap',
};

const STAGE_TITLE_KEY: Record<RitualStage['key'], string> = {
  pause: 'opening.ritual_pause',
  hydrate: 'opening.ritual_hydrate',
  lock_in: 'opening.ritual_lock_in',
  perform: 'opening.ritual_perform',
};

export function MomentDetailScreen({
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
  const eta = startsIn(moment.startAtIso, nowIso);
  const prepared = Boolean(moment.preparedAtIso);
  const learningOn = useFeatureFlags().moments_learning_enabled;
  const feedback = useMomentFeedback();
  React.useEffect(() => {
    if (learningOn) void hydrateMomentFeedback();
  }, [learningOn]);
  const answered = feedback.find((r) => r.momentId === moment.id);
  // DR-012 Ruling 2: selective — completed + prepared + high importance +
  // once per moment + daily ask cap. Never after every moment.
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

  // The ritual advances on its own — useMomentsData's 30s tick moves HYDRATE
  // from upcoming to active while the screen is open. Sighted members watch
  // the green move down; screen-reader users were told nothing. Android gets
  // the polite live region on the ritual group below; RN marks
  // `accessibilityLiveRegion` @platform android, so iOS gets an explicit
  // announcement here — fired ONLY when the ACTIVE STAGE CHANGES, never on the
  // tick itself, so this costs nothing on a re-render that only moved a clock.
  const activeStage = rec.ritual.find((s) => s.state === 'active');
  const activeStageKey = activeStage?.key ?? null;
  const activeAnnouncementRef = React.useRef('');
  activeAnnouncementRef.current = activeStage
    ? ritualStageA11yLabel(
        t(STAGE_TITLE_KEY[activeStage.key]),
        t('moments.do_this_now'),
        t(activeStage.instructionKey, activeStage.instructionParams),
      )
    : '';
  const announcedStageRef = React.useRef<string | null>(null);
  const hasMountedRef = React.useRef(false);
  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!hasMountedRef.current) {
      // VoiceOver already reads the stage when focus lands on it; announcing
      // on mount would double-speak the state the member just navigated to.
      hasMountedRef.current = true;
      announcedStageRef.current = activeStageKey;
      return;
    }
    if (announcedStageRef.current === activeStageKey) return;
    announcedStageRef.current = activeStageKey;
    if (activeAnnouncementRef.current) {
      AccessibilityInfo.announceForAccessibility(activeAnnouncementRef.current);
    }
  }, [activeStageKey]);

  return (
    <AFScreen scroll contentContainerStyle={styles.scrollContent}>
      <AFTopBar
        eyebrow={clockLabel(moment.startAtIso)}
        title={moment.masked ? t('moments.private_event') : moment.title}
        onBack={() => router.back()}
      />

      {/* Window + countdown — compact metric pair, comp layout */}
      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>{t('moments.prep_window')}</Text>
          <Text style={styles.metaValue}>{prepWindowLabel(rec)}</Text>
        </View>
        {eta ? (
          <View style={[styles.metaCell, styles.metaCellEnd]}>
            <Text style={styles.metaLabel}>{t('moments.starts_in')}</Text>
            <Text style={[styles.metaValue, { color: af.green }]}>
              {eta.hours > 0
                ? t('moments.in_h_m', { h: eta.hours, m: eta.minutes })
                : t('moments.in_m', { m: eta.minutes })}
            </Text>
          </View>
        ) : null}
      </View>

      {/* The Ritual — one linear progression, active stage dominant */}
      <View style={styles.ritual} accessibilityLiveRegion="polite" testID="moment-ritual">
        {rec.ritual.map((stage, i) => (
          <RitualStageRow
            key={stage.key}
            stage={stage}
            last={i === rec.ritual.length - 1}
            t={t}
          />
        ))}
      </View>

      {/* WHY THIS — concise, plain language, no scores */}
      <View style={styles.why} testID="moment-why">
        <Text style={styles.whyLabel}>{t('moments.why_this')}</Text>
        <Text style={styles.whyBody}>{t(rec.evidence.summaryKey)}</Text>
      </View>

      <AFPrimaryButton
        label={prepared ? t('moments.status_completed') : t('moments.im_ready')}
        onPress={() => {
          if (!prepared && !readOnly) {
            if (moment.source === 'calendar' && moment.calendarEventId) {
              void markCalendarMomentPrepared(moment.calendarEventId);
            } else {
              updateMoment(moment.id, { preparedAtIso: new Date().toISOString() });
            }
            // Immediate cancel; the scheduling hook's resync also covers it.
            void cancelMomentNotification(moment.id);
          }
        }}
        disabled={prepared}
        testID="moment-im-ready"
      />

      {askFeedback ? (
        <View style={styles.feedback} testID="moment-feedback">
          <Text style={styles.feedbackLabel}>{t('moments.feedback.title')}</Text>
          {answered ? (
            <Text style={styles.feedbackThanks}>{t('moments.feedback.thanks')}</Text>
          ) : (
            <View style={styles.feedbackRow}>
              {(['just_right', 'too_early', 'too_late'] as const).map((k) => (
                <Pressable
                  key={k}
                  onPress={() => giveFeedback(k)}
                  style={styles.feedbackPill}
                  accessibilityRole="button"
                  hitSlop={8}
                  testID={`moment-feedback-${k}`}
                >
                  <Text style={styles.feedbackPillText}>{t(`moments.feedback.${k}`)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </AFScreen>
  );
}

function RitualStageRow({
  stage,
  last,
  t,
}: {
  stage: RitualStage;
  last: boolean;
  t: TFunction;
}) {
  const active = stage.state === 'active';
  const done = stage.state === 'completed';
  const accent = done || active ? af.green : af.textTertiary;

  const title = t(STAGE_TITLE_KEY[stage.key]);
  // DONE / DO THIS NOW in words, or — for a stage still ahead — its own clock
  // time. State stops depending on which green the node happens to be.
  const stateKey = stageStateLabelKey(stage.state);
  const meta = stateKey ? t(stateKey) : clockLabel(stage.atIso);
  const instruction = t(stage.instructionKey, stage.instructionParams);

  return (
    <View
      style={styles.stageRow}
      accessible
      accessibilityLabel={ritualStageA11yLabel(title, meta, instruction)}
      accessibilityState={{ selected: active }}
      testID={`moment-stage-${stage.key}`}
    >
      <View style={styles.stageRail}>
        <View
          style={[
            styles.stageNode,
            { borderColor: accent },
            (done || active) && {
              backgroundColor: done ? af.green : withAlpha(af.green, afAlpha.a16),
            },
          ]}
        >
          {done ? (
            <Icon name="check" size={12} color={af.canvas} />
          ) : (
            <Icon name={STAGE_ICON[stage.key]} size={13} color={active ? af.green : af.textTertiary} />
          )}
        </View>
        {!last && (
          <View
            style={[
              styles.stageConnector,
              done && { backgroundColor: withAlpha(af.green, afAlpha.a34) },
            ]}
          />
        )}
      </View>
      <View
        style={[
          styles.stageBody,
          active && styles.stageBodyActive,
          last && styles.stageBodyLast,
        ]}
      >
        <View style={styles.stageHeader}>
          <Text style={[styles.stageTitle, active && { color: af.green }, done && { color: af.textPrimary }]}>
            {title}
          </Text>
          <Text style={[styles.stageMeta, active && { color: af.green }]}>{meta}</Text>
        </View>
        <Text style={[styles.stageInstruction, active && { color: af.textPrimary }]}>
          {instruction}
        </Text>
      </View>
    </View>
  );
}

const NODE = 26;
const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing[24] + Spacing[8], gap: 20 },
  metaRow: {
    flexDirection: 'row', marginTop: 6, padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  metaCell: { flex: 1, gap: 3 },
  metaCellEnd: { alignItems: 'flex-end' },
  metaLabel: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  metaValue: { ...afType.bodyStrong, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  ritual: { marginTop: 4 },
  stageRow: { flexDirection: 'row', gap: 14 },
  stageRail: { alignItems: 'center', width: NODE },
  stageNode: {
    width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: af.surface,
  },
  stageConnector: { flex: 1, width: 2, backgroundColor: af.divider, marginVertical: 4 },
  stageBody: { flex: 1, paddingBottom: 22, gap: 3 },
  stageBodyActive: {
    backgroundColor: withAlpha(af.green, afAlpha.a06), borderWidth: 1,
    borderColor: withAlpha(af.green, afAlpha.a24),
    borderRadius: 14, padding: 12, marginBottom: 22, paddingBottom: 12,
  },
  stageBodyLast: { paddingBottom: 0, marginBottom: 0 },
  stageHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  stageTitle: { ...afType.eyebrow, color: af.textSecondary, letterSpacing: 1.6 },
  stageMeta: { ...afType.caption, color: af.textTertiary, fontVariant: ['tabular-nums'] },
  stageInstruction: { ...afType.body, color: af.textSecondary },
  why: {
    padding: 14, borderRadius: 14, gap: 6,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  whyLabel: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  whyBody: { ...afType.body, color: af.textSecondary, lineHeight: 22 },
  feedback: {
    padding: 14, gap: 10, borderRadius: 14,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  feedbackLabel: { ...afType.eyebrow, color: af.textTertiary, fontSize: 10 },
  feedbackRow: { flexDirection: 'row', gap: 8 },
  // 44pt floor, not the 38pt the caption + padding happened to produce.
  feedbackPill: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    minHeight: afLayout.controlMinHeight, paddingVertical: 10, borderRadius: 999,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surfaceRaised,
  },
  feedbackPillText: { ...afType.caption, color: af.textSecondary },
  feedbackThanks: { ...afType.caption, color: af.green },
});
