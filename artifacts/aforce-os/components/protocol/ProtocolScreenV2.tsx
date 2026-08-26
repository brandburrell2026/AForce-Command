/**
 * ProtocolScreenV2 — the Phase 2 · S2 Protocol redesign (spec §8.2), rendered
 * only when `spec_protocol` is on. Same data as the legacy screen
 * (`deriveProtocol`) — presentation only, no engine/threshold change.
 *
 * Hierarchy (Wave 5, founder order): TODAY → NEXT → WHY → PROGRESS. Progress
 * used to lead — a day chip, a completion ring and a hydration bar all sat
 * above the one step that was actually due, and two of the three said the same
 * thing. The step the member has to act on now comes first; everything that
 * merely reports how far they have come is grouped into one progress block
 * below it. The legacy command-history list is PRESERVED, relocated to a
 * compact "Recent activity" section at the bottom (founder ruling: relocate,
 * never delete).
 *
 * Wave 5 also stops the screen reading as broken when it is merely honest.
 * Removing the fabricated compliance data left sections that vanished
 * silently (nothing completed yet) and tiles that showed two bare em dashes
 * (no provider connected). Those states now say what they are and what fills
 * them — no placeholder rows, no invented percentages.
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
  commandReasonLine,
  type AFTimelineStep,
} from '@/components/ui';
import { af, afType, afLayout, Spacing, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { fireMoment } from '@/services/haptics';
import { useAppStore } from '@/store/useAppStore';
import { useWeeklyCompliance } from '@/hooks/useWeeklyCompliance';
import { deriveProtocol } from '@/services/protocolDerivation';
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
  anySignalReported,
  shouldAcknowledgeProgress,
} from './protocolV3Presentation';

export function ProtocolScreenV2() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state } = useAppStore();
  const { history, engineOutput, userState } = state;
  const [whyOpen, setWhyOpen] = React.useState(false);

  const v3Flag = state.featureFlags.protocol_v3_dashboard_enabled;
  // Real 7-day compliance; fetched lazily the first time a surface that
  // shows it activates (the WHY sheet, or the legacy consistency badge).
  const weeklyCompliancePct = useWeeklyCompliance(whyOpen || !v3Flag);

  const protocol = React.useMemo(
    () => deriveProtocol(userState, engineOutput, weeklyCompliancePct),
    [userState, engineOutput, weeklyCompliancePct],
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

  // ── SIGNATURE MOMENT — RITUAL PROGRESSION (Wave-5 motion pass) ─────────────
  // The hero ring is the only place a member sees "I moved". It used to be a
  // static stroke that silently redrew at a new length between renders, so the
  // thing the Protocol screen exists to communicate was the one thing that
  // never registered. It now draws in on first paint and animates FROM ITS
  // CURRENT POSITION when a step completes (see AFReadinessArc's `animate`),
  // and a single `ritual_progressed` tick — the lightest of the four named
  // haptic moments — lands with it.
  //
  // The "did progress actually happen?" rule is the pure, unit-tested
  // `shouldAcknowledgeProgress` — a ref holds the baseline so establishing it
  // never re-renders. Derivation is synchronous from store state, so this costs
  // nothing per second (Wave-4 rule).
  const prevCompletedRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const prev = prevCompletedRef.current;
    prevCompletedRef.current = completedCount;
    if (shouldAcknowledgeProgress(prev, completedCount)) fireMoment('ritual_progressed');
  }, [completedCount]);

  // The one-line WHY shown on the active step. The full text (stage +
  // description + the real-or-adaptive compliance line) still lives in the
  // disclosure, which always says more than this line, so the control keeps
  // earning its place.
  const reason = commandReasonLine(protocol.description);

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

      {/* ── TODAY: the one step that is actually due ──────────────────────
          Leads the screen now. Its reason is inline: the plan's own
          description was reachable only through the WHY sheet, so the screen
          answered WHAT without WHY until the member paid a tap (the defect
          AFCommandCard fixed on Home — same `commandReasonLine` helper). */}
      {activeStep ? (
        <AFCard variant="raised" style={styles.activeCard} testID="protocol-active-step">
          <Text style={styles.activeEyebrow}>{t('protocol.v2.active_step')}</Text>
          <Text style={styles.activeTitle}>{activeStep.label}</Text>
          <Text style={styles.activeWindow}>{activeStep.window}</Text>
          {reason ? (
            <Text style={styles.activeReason} testID="protocol-active-reason">{reason.line}</Text>
          ) : null}
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
            {/* Every step this screen produces is `upcoming` (the active one is
                the card above, completed ones live in PROGRESS), so that is the
                only word to translate. AFTimeline falls back to the state key
                for anything not supplied, so nothing goes unspoken. */}
            <AFTimeline
              steps={timelineSteps}
              stateLabels={{ upcoming: t('protocol.v2.timeline_upcoming') }}
            />
          </View>
        </View>
      )}

      {/* Why this plan */}
      <View style={styles.whyRow}>
        <AFTextButton label={t('protocol.v2.why_this_plan')} icon={whyOpen ? 'chevron-up' : 'chevron-down'} onPress={() => setWhyOpen(true)} />
      </View>

      {/* ── PROGRESS: one block, reporting how far the day has come ───────
          V3: the completion ring, the streak and the real-oz bar were three
          separate elements (plus a chip that repeated both numbers a third
          time) stacked above the active step. They are one card now, below
          the action, because none of them is something to DO.
          Flag off: the shipped recovery-plan progress header, unchanged. */}
      {v3 ? (
        <View style={styles.section}>
          <AFSectionLabel label={t('protocol.v3.progress')} />
          <AFCard variant="raised" testID="protocol-v3-hero">
            <View style={styles.v3HeroRow}>
              <AFReadinessArc
                progress={ringFraction(completedCount, total)}
                size={116}
                stroke={8}
                sweepDeg={360}
                color={bandAccent}
                animate
              >
                <Text style={styles.v3RingPct} maxFontSizeMultiplier={1.2}>{ringPct}%</Text>
                <Text style={styles.v3RingLabel}>{t('protocol.v3.ring_label')}</Text>
              </AFReadinessArc>
              <View style={styles.v3HeroStats}>
                <Text style={styles.v3HeroKey}>{t('protocol.v3.current_streak')}</Text>
                <Text style={styles.v3HeroValue}>
                  {t('protocol.v3.streak_days', { n: userState.complianceStreak })}
                </Text>
              </View>
            </View>

            {/* Hydration — the REAL oz fields; omitted when no target is set
                rather than inventing a denominator. */}
            {v3Data?.hydration ? (
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
          </AFCard>
        </View>
      ) : (
        <View style={styles.planHeader}>
          <AFSectionLabel label={t('protocol.v2.recovery_plan')} />
          <View style={styles.progressRow}>
            <Text style={styles.progressCount}>
              {t('protocol.v2.progress_count', { completed: completedCount, total })}
            </Text>
            {protocol.weeklyCompliancePct != null ? (
              <AFStatusBadge
                label={t('protocol.v2.consistency', { pct: protocol.weeklyCompliancePct })}
                tone="positive"
                icon={null}
              />
            ) : null}
          </View>
          <View style={styles.track} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      )}

      {/* V3: completed today — the plan's own completed steps with their real
          windows; never fabricated amounts. With nothing done the section used
          to disappear, which reads as a screen that failed to load rather than
          a day that has not started; it now says so and names what fills it.
          Flag off: the shipped metrics row (whose values live in the V3
          progress card instead — relocated, never deleted). */}
      {v3 ? (
        <View style={styles.section} testID="protocol-v3-completed">
          <View style={styles.v3SectionHead}>
            <AFSectionLabel label={t('protocol.v3.completed_today')} />
            <Text style={styles.v3Count} maxFontSizeMultiplier={1.35}>
              {completedCount} / {total}
            </Text>
          </View>
          {v3Data && v3Data.completedSteps.length > 0 ? (
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
          ) : (
            <Text style={styles.v3Empty} testID="protocol-v3-completed-empty">
              {t('protocol.v3.completed_empty')}
            </Text>
          )}
        </View>
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
          the shared freshness window of an honest timestamp. When NOTHING has
          reported, two bordered tiles each showing a bare em dash look like a
          render that failed — one sentence saying what would fill them is the
          same truth, told properly. */}
      {v3 && v3Data ? (
        <View style={styles.section} testID="protocol-v3-signals">
          <View style={styles.v3SectionHead}>
            <AFSectionLabel label={t('protocol.v3.recovery_signals')} />
            {v3Data.live ? <Text style={styles.v3Live}>{t('protocol.v3.live')}</Text> : null}
          </View>
          {anySignalReported(v3Data.hrText, v3Data.hrvText) ? (
            /*
             * A11y fix (Wave-5 Phase-1 pass): these two tiles were the same
             * defect pair Home's Signal tile carried — `adjustsFontSizeToFit`
             * SHRANK the reading as Dynamic Type grew, and label + value were
             * two unlinked Texts a screen reader read as separate swipes. Home
             * already grouped its tiles with `accessible`; this matches it.
             */
            <View style={styles.v3Signals}>
              <View
                style={styles.v3Signal}
                accessible
                accessibilityLabel={`${t('protocol.v3.heart_rate')} ${v3Data.hrText}`}
              >
                <Text style={styles.v3SignalLabel}>{t('protocol.v3.heart_rate').toUpperCase()}</Text>
                <Text style={styles.v3SignalValue} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
                  {v3Data.hrText}
                </Text>
              </View>
              <View
                style={styles.v3Signal}
                accessible
                accessibilityLabel={`${t('protocol.v3.hrv')} ${v3Data.hrvText}`}
              >
                <Text style={styles.v3SignalLabel}>{t('protocol.v3.hrv').toUpperCase()}</Text>
                <Text style={styles.v3SignalValue} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
                  {v3Data.hrvText}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.v3Empty} testID="protocol-v3-signals-empty">
              {t('protocol.v3.signals_empty')}
            </Text>
          )}
        </View>
      ) : null}

      <View style={{ height: 40 }} />

      <AFDisclosureSheet visible={whyOpen} onClose={() => setWhyOpen(false)} title={t('protocol.v2.why_this_plan')}>
        <Text style={styles.whyStage}>{protocol.stage}</Text>
        <Text style={styles.whyBody}>{protocol.description}</Text>
        <Text style={styles.whyBody}>
          {protocol.weeklyCompliancePct != null
            ? t('protocol.v2.why_consistency', {
                pct: protocol.weeklyCompliancePct,
                min: protocol.nextRecheckMinutes,
              })
            : t('protocol.v2.why_adaptive', {
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
  // Quieter than the window on purpose: the reason supports the step, it never
  // competes with it for the one-action read (same rule as AFCommandCard).
  activeReason: { ...afType.caption, color: af.textTertiary, marginTop: 8 },
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
  v3HeroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[6] },
  v3RingPct: { ...afType.title1, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  v3RingLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  v3HeroStats: { flex: 1 },
  v3HeroKey: { ...afType.eyebrow, color: af.textTertiary },
  v3HeroValue: { ...afType.title2, color: af.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] },
  v3Hydration: { marginTop: 24, gap: 10 },
  v3HydrationTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  v3HydrationLabel: { ...afType.bodyStrong, color: af.textPrimary },
  v3HydrationValue: { ...afType.body, color: af.textSecondary, fontVariant: ['tabular-nums'] },
  v3HydrationFill: { backgroundColor: af.cyan },
  v3SectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  // Neutral, not green: this counter now renders at 0/4 too, and green on a
  // day where nothing is done would read as approval the data hasn't earned.
  v3Count: { ...afType.caption, color: af.textTertiary, fontVariant: ['tabular-nums'] },
  // Shared voice for the two honest-sparse states (nothing completed yet, no
  // provider reporting): a sentence, not a placeholder row.
  v3Empty: { ...afType.body, color: af.textTertiary },
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
