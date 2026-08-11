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
  AFReadinessArc,
  AFStatusBadge,
  type AFTimelineStep,
} from '@/components/ui';
import { af, afType, afLayout, Spacing } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { deriveProtocol } from '@/services/mockApi';
import { formatTimeAgo } from '@/data/mockData';
import { NightOutProtocolEntry } from '@/components/nightOut/NightOutProtocolEntry';
import { resolveHomePresentation } from '@/components/home/homePresentation';
import { explainFieldArbitration } from '@/utils/biometricsAggregator';
import { freshestBiometricsFetchedAt } from '@/components/home/homeFreshness';
import { formatHrvMs } from '@/components/home/homeV3Presentation';
import {
  formatBpm,
  hydrationProgress,
  signalsAreLive,
  ringFraction,
} from './protocolV3Presentation';

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

  // ── Protocol V3 dashboard (flag-gated, presentation-only; founder comps
  // 2026-08-11). Honest-data contract mirrors Home V3: every value below is
  // derived from state this screen (or the shared arbitration/freshness
  // modules) already exposes — real oz, real streak, the engine-derived
  // stage, the plan's own recheck timer, and HR/HRV from
  // explainFieldArbitration (the scoring path's own per-field winner).
  // Missing readings render an em dash; no fabricated amounts or times.
  const v3 = state.featureFlags.protocol_v3_dashboard_enabled;
  // Founder ruling (2026-08-11): the V3 hero ring's lights follow the
  // readiness band EXACTLY like the Home arc — same pure homePresentation
  // accent module (af.* tokens, never statusColor.ts). Cyan Balanced /
  // green Peak / amber Recovering / red Depleted.
  const bandAccent = resolveHomePresentation(engineOutput.performanceState.level).accent;
  const v3Data = React.useMemo(() => {
    if (!v3) return null;
    const now = Date.now();
    const hr = explainFieldArbitration(userState.biometrics, 'restingHeartRate', now).winner;
    const hrv = explainFieldArbitration(userState.biometrics, 'hrvSdnn', now).winner;
    return {
      hydration: hydrationProgress(userState.ozConsumedToday, userState.ozTarget),
      hrText: formatBpm(hr ? (hr.value as number) : null),
      hrvText: formatHrvMs(hrv ? (hrv.value as number) : null),
      live: signalsAreLive(
        freshestBiometricsFetchedAt(userState.appleHealth, userState.biometrics),
        now,
      ),
      completedSteps: steps.filter((s) => s.complete),
    };
  }, [v3, userState, steps]);
  const ringPct = Math.round(ringFraction(completedCount, total) * 100);

  // Map the remaining steps into the timeline (first upcoming = the step right
  // after the active one). Completed context stays in the progress bar above.
  const timelineSteps: AFTimelineStep[] = upcoming.map((s, i) => ({
    title: s.label,
    subtitle: s.window,
    state: i === 0 ? 'upcoming' : 'upcoming',
    meta: undefined,
  }));

  return (
    <AFScreen scroll contentContainerStyle={v3 ? styles.v3ScrollContent : undefined}>
      <AFTopBar
        eyebrow={t('protocol.v2.eyebrow')}
        title={v3 ? protocol.stage : t('protocol.v2.title')}
      />

      {/* Night Out Protocol — authorized entry (renders null unless authorized;
          hidden in production/default). NO-b: placement only, no command experience. */}
      <NightOutProtocolEntry />

      {/* V3: day chip — real streak + real plan progress */}
      {v3 ? (
        <View style={styles.v3Chip} testID="protocol-v3-chip">
          <View style={styles.v3ChipDot} />
          <Text style={styles.v3ChipText}>
            {t('protocol.v3.chip', {
              day: userState.complianceStreak,
              completed: completedCount,
              total,
            })}
          </Text>
        </View>
      ) : null}

      {/* V3: stage hero — protocol-completion ring + streak + next recheck.
          Flag off: the shipped recovery-plan progress header, byte-identical. */}
      {v3 ? (
        <AFCard variant="raised" style={styles.v3Hero} testID="protocol-v3-hero">
          <View style={styles.v3HeroRow}>
            <AFReadinessArc
              progress={ringFraction(completedCount, total)}
              size={116}
              stroke={8}
              sweepDeg={360}
              color={bandAccent}
            >
              <Text style={styles.v3RingPct} maxFontSizeMultiplier={1.2}>{ringPct}%</Text>
              <Text style={styles.v3RingLabel}>{t('protocol.v3.ring_label')}</Text>
            </AFReadinessArc>
            <View style={styles.v3HeroStats}>
              <View>
                <Text style={styles.v3HeroKey}>{t('protocol.v3.current_streak')}</Text>
                <Text style={styles.v3HeroValue}>
                  {t('protocol.v3.streak_days', { n: userState.complianceStreak })}
                </Text>
              </View>
              <View>
                <Text style={styles.v3HeroKey}>{t('protocol.v3.next_check')}</Text>
                <Text style={styles.v3HeroValue}>
                  {t('protocol.v3.check_minutes', { min: protocol.nextRecheckMinutes })}
                </Text>
              </View>
            </View>
          </View>
        </AFCard>
      ) : (
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
          <View style={styles.track} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      )}

      {/* V3: hydration progress — the REAL oz fields; hidden when no target
          is set rather than inventing a denominator. */}
      {v3 && v3Data?.hydration ? (
        <View style={styles.v3Hydration} testID="protocol-v3-hydration">
          <View style={styles.v3HydrationTop}>
            <Text style={styles.v3HydrationLabel}>{t('protocol.v3.hydration')}</Text>
            <Text style={styles.v3HydrationValue}>
              {t('protocol.v3.hydration_oz', {
                consumed: v3Data.hydration.consumed,
                target: v3Data.hydration.target,
              })}
            </Text>
          </View>
          <View style={styles.track} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View
              style={[
                styles.fill,
                styles.v3HydrationFill,
                { width: `${Math.round(v3Data.hydration.fraction * 100)}%` },
              ]}
            />
          </View>
        </View>
      ) : null}

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

      {/* V3: completed today — the plan's own completed steps with their real
          windows; never fabricated amounts. Flag off: the shipped metrics row
          (whose values live in the V3 hero + hydration bar instead —
          relocated, never deleted). */}
      {v3 ? (
        v3Data && v3Data.completedSteps.length > 0 ? (
          <View style={styles.section} testID="protocol-v3-completed">
            <View style={styles.v3SectionHead}>
              <AFSectionLabel label={t('protocol.v3.completed_today')} />
              <Text style={styles.v3Count} maxFontSizeMultiplier={1.35}>
                {completedCount} / {total}
              </Text>
            </View>
            <View style={styles.v3Rows}>
              {v3Data.completedSteps.map((s) => (
                <View
                  key={s.label}
                  style={styles.v3Row}
                  accessible
                  accessibilityLabel={`${s.label}, ${s.window}`}
                >
                  <View style={styles.v3Check}>
                    <Text style={styles.v3CheckMark}>✓</Text>
                  </View>
                  <Text style={styles.v3RowLabel} numberOfLines={1}>{s.label}</Text>
                  <Text style={styles.v3RowWindow}>{s.window}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null
      ) : (
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
      )}

      {/* Relocated: command history (compact) */}
      {history.length > 0 && (
        <View style={styles.section}>
          <AFSectionLabel label={t('protocol.v2.recent_activity')} />
          <AFCard padded={false} style={styles.historyCard}>
            {history.slice(0, 5).map((entry, i) => (
              <View
                key={entry.id}
                style={[styles.historyRow, i > 0 && styles.historyDivider]}
                accessible
                accessibilityLabel={`${entry.action} ${formatTimeAgo(entry.timestamp)} ${entry.score}`}
              >
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

      {/* V3: recovery signals — HR/HRV from the scoring path's own arbitration
          winner; em dash when a provider hasn't reported; "Live" only within
          the shared freshness window of an honest timestamp. */}
      {v3 && v3Data ? (
        <View style={styles.section} testID="protocol-v3-signals">
          <View style={styles.v3SectionHead}>
            <AFSectionLabel label={t('protocol.v3.recovery_signals')} />
            {v3Data.live ? <Text style={styles.v3Live}>{t('protocol.v3.live')}</Text> : null}
          </View>
          <View style={styles.v3Signals}>
            <View style={styles.v3Signal}>
              <Text style={styles.v3SignalLabel}>{t('protocol.v3.heart_rate').toUpperCase()}</Text>
              <Text style={styles.v3SignalValue} numberOfLines={1} adjustsFontSizeToFit>
                {v3Data.hrText}
              </Text>
            </View>
            <View style={styles.v3Signal}>
              <Text style={styles.v3SignalLabel}>{t('protocol.v3.hrv').toUpperCase()}</Text>
              <Text style={styles.v3SignalValue} numberOfLines={1} adjustsFontSizeToFit>
                {v3Data.hrvText}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

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
  activeEyebrow: { ...afType.eyebrow, color: af.redText, marginBottom: 8 },
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
  // ── Protocol V3 dashboard (protocol_v3_dashboard_enabled) ──
  v3ScrollContent: { paddingBottom: Spacing[24] + Spacing[8] },
  v3Chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    marginTop: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  v3ChipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: af.green },
  v3ChipText: { ...afType.caption, color: af.textSecondary },
  v3Hero: { marginTop: 16 },
  v3HeroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[6] },
  v3RingPct: { ...afType.title1, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  v3RingLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  v3HeroStats: { flex: 1, gap: Spacing[4] },
  v3HeroKey: { ...afType.eyebrow, color: af.textTertiary },
  v3HeroValue: { ...afType.title2, color: af.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] },
  v3Hydration: { marginTop: 24, gap: 10 },
  v3HydrationTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  v3HydrationLabel: { ...afType.bodyStrong, color: af.textPrimary },
  v3HydrationValue: { ...afType.body, color: af.textSecondary, fontVariant: ['tabular-nums'] },
  v3HydrationFill: { backgroundColor: af.cyan },
  v3SectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  v3Count: { ...afType.caption, color: af.green, fontVariant: ['tabular-nums'] },
  v3Rows: { gap: 14 },
  v3Row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  v3Check: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: af.green,
    alignItems: 'center', justifyContent: 'center',
  },
  v3CheckMark: { color: af.canvas, fontSize: 12, fontWeight: '700', lineHeight: 14 },
  v3RowLabel: { ...afType.body, color: af.textPrimary, flex: 1 },
  v3RowWindow: { ...afType.caption, color: af.textTertiary },
  v3Live: { ...afType.caption, color: af.green },
  v3Signals: { flexDirection: 'row', gap: 12 },
  v3Signal: {
    flex: 1, gap: 6, paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1, borderColor: af.border, backgroundColor: af.surface,
  },
  v3SignalLabel: { ...afType.eyebrow, color: af.textTertiary },
  v3SignalValue: { ...afType.title3, color: af.textPrimary, fontVariant: ['tabular-nums'] },
});
