/**
 * ProtocolScreenV2 — the Phase 2 · S2 Protocol redesign (spec §8.2), rendered
 * only when `spec_protocol` is on. Same data as the legacy screen
 * (`deriveProtocol`) — presentation only, no engine/threshold change.
 *
 * Hierarchy (spec target): recovery-plan progress → one large ACTIVE step →
 * ordered upcoming steps (AFTimeline) → "Why this plan" disclosure. The legacy
 * command-history list is PRESERVED, relocated to a compact "Recent activity"
 * section at the bottom (founder ruling: relocate, never delete).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';

import {
  AFScreen,
  AFTopBar,
  AFCard,
  AFSectionLabel,
  AFTimeline,
  AFDisclosureSheet,
  AFTextButton,
  AFMetric,
  AFStatusBadge,
  type AFTimelineStep,
} from '@/components/ui';
import { af, afType, afLayout } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { deriveProtocol } from '@/services/mockApi';
import { formatTimeAgo } from '@/data/mockData';

export function ProtocolScreenV2() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state } = useAppStore();
  const { history, engineOutput, userState } = state;
  const [whyOpen, setWhyOpen] = React.useState(false);

  const protocol = React.useMemo(
    () => deriveProtocol(userState, engineOutput),
    [userState, engineOutput],
  );

  const steps = protocol.steps;
  const total = steps.length;
  const completedCount = steps.filter((s) => s.complete).length;
  const activeIndex = steps.findIndex((s) => !s.complete);
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;
  const upcoming = activeIndex >= 0 ? steps.slice(activeIndex + 1).filter((s) => !s.complete) : [];
  const progress = total > 0 ? completedCount / total : 0;

  // Map the remaining steps into the timeline (first upcoming = the step right
  // after the active one). Completed context stays in the progress bar above.
  const timelineSteps: AFTimelineStep[] = upcoming.map((s, i) => ({
    title: s.label,
    subtitle: s.window,
    state: i === 0 ? 'upcoming' : 'upcoming',
    meta: undefined,
  }));

  return (
    <AFScreen scroll>
      <AFTopBar eyebrow={t('protocol.v2.eyebrow')} title={t('protocol.v2.title')} />

      {/* Recovery-plan progress */}
      <View style={styles.planHeader}>
        <AFSectionLabel label={t('protocol.v2.recovery_plan')} />
        <View style={styles.progressRow}>
          <Text style={styles.progressCount}>
            {t('protocol.v2.progress_count', { completed: completedCount, total })}
          </Text>
          <AFStatusBadge
            label={t('protocol.v2.consistency', { pct: protocol.weeklyCompliancePct })}
            tone="positive"
            icon={null}
          />
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>

      {/* One large ACTIVE step */}
      {activeStep ? (
        <AFCard variant="raised" style={styles.activeCard} testID="protocol-active-step">
          <Text style={styles.activeEyebrow}>{t('protocol.v2.active_step')}</Text>
          <Text style={styles.activeTitle}>{activeStep.label}</Text>
          <Text style={styles.activeWindow}>{activeStep.window}</Text>
          <View style={styles.activeFooter}>
            <Text style={styles.footerLabel}>{t('protocol.v2.next_recheck')}</Text>
            <Text style={styles.footerValue}>{t('protocol.v2.recheck_minutes', { min: protocol.nextRecheckMinutes })}</Text>
          </View>
        </AFCard>
      ) : (
        <AFCard variant="raised" style={styles.activeCard}>
          <AFStatusBadge label={t('protocol.v2.plan_complete')} tone="positive" />
          <Text style={styles.activeWindow}>{t('protocol.v2.plan_complete_body')}</Text>
        </AFCard>
      )}

      {/* Ordered upcoming */}
      {timelineSteps.length > 0 && (
        <View style={styles.section}>
          <AFSectionLabel label={t('protocol.v2.next')} />
          <View style={styles.timelineWrap}>
            <AFTimeline steps={timelineSteps} />
          </View>
        </View>
      )}

      {/* Why this plan */}
      <View style={styles.whyRow}>
        <AFTextButton label={t('protocol.v2.why_this_plan')} icon={whyOpen ? 'chevron-up' : 'chevron-down'} onPress={() => setWhyOpen(true)} />
      </View>

      {/* Relocated: plan metrics */}
      <View style={styles.section}>
        <AFSectionLabel label={t('protocol.v2.today_section')} />
        <AFCard>
          <View style={styles.metricsRow}>
            <AFMetric label={t('protocol.v2.metric_goal')} value={`${userState.dailyTarget}`} unit={t('protocol.v2.unit_units')} />
            <AFMetric label={t('protocol.v2.metric_logged')} value={`${userState.unitsConsumedToday}`} unit={t('protocol.v2.unit_units')} />
            <AFMetric label={t('protocol.v2.metric_streak')} value={`${userState.complianceStreak}`} unit={t('protocol.v2.unit_day')} />
          </View>
        </AFCard>
      </View>

      {/* Relocated: command history (compact) */}
      {history.length > 0 && (
        <View style={styles.section}>
          <AFSectionLabel label={t('protocol.v2.recent_activity')} />
          <AFCard padded={false} style={styles.historyCard}>
            {history.slice(0, 5).map((entry, i) => (
              <View key={entry.id} style={[styles.historyRow, i > 0 && styles.historyDivider]}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyAction} numberOfLines={1}>{entry.action}</Text>
                  <Text style={styles.historyTime}>{formatTimeAgo(entry.timestamp)}</Text>
                </View>
                <Text style={styles.historyScore}>{entry.score}</Text>
              </View>
            ))}
          </AFCard>
        </View>
      )}

      <View style={{ height: 40 }} />

      <AFDisclosureSheet visible={whyOpen} onClose={() => setWhyOpen(false)} title={t('protocol.v2.why_this_plan')}>
        <Text style={styles.whyStage}>{protocol.stage}</Text>
        <Text style={styles.whyBody}>{protocol.description}</Text>
        <Text style={styles.whyBody}>
          {t('protocol.v2.why_consistency', {
            pct: protocol.weeklyCompliancePct,
            min: protocol.nextRecheckMinutes,
          })}
        </Text>
      </AFDisclosureSheet>
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  planHeader: { marginTop: 20, gap: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressCount: { ...afType.body, color: af.textPrimary },
  track: { height: 6, borderRadius: 3, backgroundColor: af.divider, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: af.red },
  activeCard: { marginTop: 20 },
  activeEyebrow: { ...afType.eyebrow, color: af.red, marginBottom: 8 },
  activeTitle: { ...afType.title1, color: af.textPrimary },
  activeWindow: { ...afType.body, color: af.textSecondary, marginTop: 4 },
  activeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: afLayout.cardPadding,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: af.divider,
  },
  footerLabel: { ...afType.eyebrow, color: af.textTertiary },
  footerValue: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  section: { marginTop: 28, gap: 12 },
  timelineWrap: { marginTop: 4 },
  whyRow: { marginTop: 16 },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  historyCard: { paddingHorizontal: 16 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  historyDivider: { borderTopWidth: 1, borderTopColor: af.divider },
  historyLeft: { flex: 1, gap: 2 },
  historyAction: { ...afType.body, color: af.textPrimary },
  historyTime: { ...afType.caption, color: af.textTertiary },
  historyScore: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  whyStage: { ...afType.title3, color: af.textPrimary, marginBottom: 8 },
  whyBody: { ...afType.body, color: af.textSecondary, marginBottom: 12 },
});
