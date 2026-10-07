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
import { useTabBarClearance } from '@/hooks/useTabBarClearance';

import {
  AFScreen,
  AFTopBar,
  AFMasthead,
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
import { useBootstrapSlice } from '@/store/slices';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
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
  formatMastheadDay,
  formatSignalsClock,
  recheckDisplay,
} from './protocolV3Presentation';

export function ProtocolScreenV2() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { state } = useAppStore();
  const { history, engineOutput, userState } = state;
  // TRUTH FILTER (P2). The store seeds ONE synthetic baseline entry on first
  // mount (store/useAppStore.tsx, buildSyntheticBaselineEntry) carrying a
  // MANUFACTURED yesterday timestamp and the cold-start engine score. It is
  // flagged `isSynthetic: true` precisely so surfaces can exclude it, and
  // Home already does (homeBaselineState.countRealHistoryEntries). The legacy list
  // did not either, so a member who had logged nothing saw a fabricated reading
  // under the heading "Recent activity" — an invented observation presented
  // as their own. Legitimate observed history is untouched.
  const observedHistory = history.filter((h) => h.isSynthetic !== true);
  const [whyOpen, setWhyOpen] = React.useState(false);
  const tabClearance = useTabBarClearance();
  // Lane A stale contract, reused verbatim from Home / EditorialProtocol:
  // the last /state delivery never reached the server, so this screen shows
  // last-known data. The same flag and the same key — no second freshness
  // system on Protocol.
  const { lastRefreshStale } = useBootstrapSlice();
  const eyebrowType = useAFEyebrowType();

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
    const freshestAt = freshestBiometricsFetchedAt(userState.appleHealth, userState.biometrics);
    return {
      hydration: hydrationProgress(userState.ozConsumedToday, userState.ozTarget),
      hrText: formatBpm(hr ? (hr.value as number) : null),
      hrvText: formatHrvMs(hrv ? (hrv.value as number) : null),
      live: signalsAreLive(freshestAt, now),
      // "Checked", not "Updated": a fetchedAt stamps when the app last READ
      // the provider, not that the value changed (home/homeFreshness.ts).
      signalsCheckedAt: formatSignalsClock(freshestAt, i18n.language),
      completedSteps: steps.filter((s) => s.complete),
    };
  }, [v3, userState, steps, i18n.language]);
  const ringPct = Math.round(ringFraction(completedCount, total) * 100);
  // The recheck figure is stated once on this screen (protocolHierarchy lock);
  // both the flag-off footer and the V3 hero numeral's spoken label read it.
  const recheckSpoken = t('protocol.v2.recheck_minutes', { min: protocol.nextRecheckMinutes });
  const recheck = recheckDisplay(protocol.nextRecheckMinutes);
  const mastheadMeta = `${t('protocol.v2.eyebrow')} · ${formatMastheadDay(Date.now(), i18n.language)}`;

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
    <AFScreen scroll contentContainerStyle={{ paddingBottom: tabClearance }}>
      {!v3 ? (
        <>
          {/* ── FLAG OFF (`protocol_v3_dashboard_enabled` false): the shipped
              V2 layout, unchanged. TODAY → NEXT → WHY → PROGRESS. ───────── */}
          <AFTopBar eyebrow={t('protocol.v2.eyebrow')} title={t('protocol.v2.title')} />

          {/* Night Out Protocol — authorized entry (renders null unless authorized;
              hidden in production/default). NO-b: placement only, no command experience. */}
          <NightOutProtocolEntry />

          {/* ── TODAY: the one step that is actually due ──────────────────────
              Its reason is inline: the plan's own description was reachable
              only through the WHY sheet, so the screen answered WHAT without
              WHY until the member paid a tap (the defect AFCommandCard fixed
              on Home — same `commandReasonLine` helper). */}
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
                <Text style={styles.footerValue}>{recheckSpoken}</Text>
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
                    the card above), so that is the only word to translate.
                    AFTimeline falls back to the state key for anything not
                    supplied, so nothing goes unspoken. */}
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

          {/* Recovery-plan progress header + the shipped metrics row. */}
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
        </>
      ) : (
        <>
          {/* ── BLACK ISSUE (2026-10-06): masthead → Today → statement →
              hero numeral → step rail → two-up footer. Presentation only:
              every value is the one this screen already derived. ──────── */}
          <AFMasthead meta={mastheadMeta} testID="protocol-v3-masthead" />

          <View style={styles.v3Today}>
            <Text style={styles.v3TodayTitle}>{t('protocol.v2.eyebrow')}</Text>
            {/* Lane A — last-known data. Not an "offline" claim and not a
                freshness timestamp: it renders only when the screen already
                knows the last refresh never reached the server. */}
            {lastRefreshStale ? (
              <Text style={styles.v3Stale} testID="protocol-stale-notice">
                {t('home.v2.stale_notice')}
              </Text>
            ) : null}
          </View>

          {/* The stage is the statement (verbatim from the derivation). */}
          <AFMasthead wordmark={false} title={protocol.stage} />
          {reason ? (
            <Text style={styles.v3Reason} testID="protocol-active-reason">{reason.line}</Text>
          ) : null}

          {/* Night Out Protocol — authorized entry (renders null unless authorized;
              hidden in production/default). NO-b: placement only, no command experience. */}
          <NightOutProtocolEntry />

          {/* ── HERO: the plan's own recheck timer ──────────────────────────
              The numeral + unit is one spoken element ("Next recheck, 45
              min"); the red hairline is the plan's completed/total fraction
              (decorative, hidden from the reader — the count is spoken by the
              rail header). "Checked", never "Updated": fetchedAt stamps when
              the app last READ a provider (home/homeFreshness.ts). */}
          <View style={styles.v3HeroBlock} testID="protocol-v3-recheck">
            <View
              style={styles.v3NumeralRow}
              accessible
              accessibilityLabel={`${t('protocol.v2.next_recheck')}, ${recheckSpoken}`}
            >
              <Text style={styles.v3Numeral} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
                {recheck.value}
              </Text>
              <Text style={[styles.v3Unit, eyebrowType]}>
                {t(recheck.unit === 'hr' ? 'protocol.v3.recheck_unit_hr' : 'protocol.v3.recheck_unit_min').toUpperCase()}
              </Text>
            </View>
            <View style={styles.v3HeroMetaRow}>
              <Text
                style={[styles.v3HeroEyebrow, eyebrowType]}
                importantForAccessibility="no"
                accessibilityElementsHidden
              >
                {t('protocol.v2.next_recheck')}
              </Text>
              {v3Data?.signalsCheckedAt ? (
                <Text style={[styles.v3HeroMeta, eyebrowType]} testID="protocol-v3-signals-checked">
                  {t('protocol.v3.signals_checked', { time: v3Data.signalsCheckedAt }).toUpperCase()}
                </Text>
              ) : null}
            </View>
            <View style={styles.v3HeroTrack} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <View style={[styles.v3HeroFill, { width: `${ringPct}%` }]} />
            </View>
          </View>

          {/* ── PROTOCOL STEPS: the whole plan as one rail. Completed steps
              no longer live in a separate list; the rail says which are done,
              which is active and what the rest wait on (their own windows). */}
          <View style={styles.section} testID="protocol-v3-completed">
            <View style={styles.v3StepsHead}>
              <Text style={[styles.v3StepsLabel, eyebrowType]} accessibilityRole="header">
                {t('protocol.v3.steps_heading').toUpperCase()}
              </Text>
              <Text style={styles.v3Count} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
                {completedCount} / {total}
              </Text>
            </View>
            <AFTimeline
              testID="protocol-v3-steps"
              steps={steps.map((s, i): AFTimelineStep => {
                const state = s.complete ? 'completed' : i === activeIndex ? 'current' : 'upcoming';
                return {
                  title: s.label,
                  state,
                  meta: (state === 'completed'
                    ? t('protocol.v3.completed_today')
                    : state === 'current'
                      ? `${t('protocol.v2.active_step')} · ${s.window}`
                      : s.window
                  ).toUpperCase(),
                };
              })}
              stateLabels={{
                completed: t('protocol.v3.timeline_completed'),
                current: t('protocol.v3.timeline_current'),
                upcoming: t('protocol.v2.timeline_upcoming'),
              }}
            />
            {/* Honest sparse state: a day with nothing done says so and names
                what fills it, instead of four unmarked rows reading as a
                render that failed. No figure in the sentence. */}
            {v3Data && v3Data.completedSteps.length > 0 ? null : (
              <Text style={styles.v3Empty} testID="protocol-v3-completed-empty">
                {t('protocol.v3.completed_empty')}
              </Text>
            )}
            {!activeStep ? (
              <View style={styles.v3Complete}>
                <AFStatusBadge label={t('protocol.v2.plan_complete')} tone="positive" />
                <Text style={styles.v3Empty}>{t('protocol.v2.plan_complete_body')}</Text>
              </View>
            ) : null}
          </View>

          {/* ── FOOTER: hydration | recovery signals ───────────────────────
              Real oz fields (omitted when no target is set — never a made-up
              denominator). HR/HRV are the scoring path's own arbitration
              winners; nothing reported ⇒ one honest sentence, not two bare
              em dashes. Grouped as one element per cell (Wave-5 a11y). */}
          {v3Data ? (
            <View
              style={[styles.v3Footer, !anySignalReported(v3Data.hrText, v3Data.hrvText) && styles.v3FooterStacked]}
            >
              {v3Data.hydration ? (
                <View
                  style={styles.v3FooterCell}
                  testID="protocol-v3-hydration"
                  accessible
                  accessibilityLabel={`${t('protocol.v3.hydration')} ${t('protocol.v3.hydration_oz', {
                    consumed: v3Data.hydration.consumed,
                    target: v3Data.hydration.target,
                  })}`}
                >
                  <Text style={[styles.v3FooterLabel, eyebrowType]}>{t('protocol.v3.hydration').toUpperCase()}</Text>
                  <Text style={styles.v3FooterValue} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
                    {t('protocol.v3.hydration_oz', {
                      consumed: v3Data.hydration.consumed,
                      target: v3Data.hydration.target,
                    }).toUpperCase()}
                  </Text>
                </View>
              ) : null}
              <View style={styles.v3FooterCell} testID="protocol-v3-signals">
                {anySignalReported(v3Data.hrText, v3Data.hrvText) ? (
                  <View
                    accessible
                    accessibilityLabel={`${t('protocol.v3.heart_rate')} ${v3Data.hrText}, ${t('protocol.v3.hrv')} ${v3Data.hrvText}`}
                  >
                    <View style={styles.v3FooterLabelRow}>
                      <Text style={[styles.v3FooterLabel, eyebrowType]}>{t('protocol.v3.recovery_signals').toUpperCase()}</Text>
                      {v3Data.live ? <Text style={styles.v3Live}>{t('protocol.v3.live')}</Text> : null}
                    </View>
                    <Text style={styles.v3FooterValue} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
                      {v3Data.hrText} · {v3Data.hrvText}
                    </Text>
                    <Text style={[styles.v3FooterCaption, eyebrowType]}>
                      {t('protocol.v3.heart_rate')}, {t('protocol.v3.hrv')}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.v3FooterLabel, eyebrowType]}>{t('protocol.v3.recovery_signals').toUpperCase()}</Text>
                    <Text style={styles.v3Empty} testID="protocol-v3-signals-empty">
                      {t('protocol.v3.signals_empty')}
                    </Text>
                  </>
                )}
              </View>
            </View>
          ) : null}

          {/* Why this plan */}
          <View style={styles.whyRow}>
            <AFTextButton label={t('protocol.v2.why_this_plan')} icon={whyOpen ? 'chevron-up' : 'chevron-down'} onPress={() => setWhyOpen(true)} />
          </View>

          {/* ── PROGRESS: the completion ring + streak, relocated below the
              reference's footer (not in the comp; kept — the ring is the
              Ritual-progression signature moment and the streak is real data
              with no other home). */}
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
                  <Text style={styles.v3RingPct} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>{ringPct}%</Text>
                  <Text style={styles.v3RingLabel}>{t('protocol.v3.ring_label')}</Text>
                </AFReadinessArc>
                <View style={styles.v3HeroStats}>
                  <Text style={styles.v3HeroKey}>{t('protocol.v3.current_streak')}</Text>
                  <Text style={styles.v3HeroValue}>
                    {t('protocol.v3.streak_days', { n: userState.complianceStreak })}
                  </Text>
                </View>
              </View>
            </AFCard>
          </View>
        </>
      )}

      {/* Relocated: command history (compact) */}
      {observedHistory.length > 0 && (
        <View style={styles.section}>
          <AFSectionLabel label={t('protocol.v2.recent_activity')} />
          <AFCard padded={false} style={styles.historyCard}>
            {observedHistory.slice(0, 5).map((entry, i) => (
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
  // ── Protocol V3 dashboard (protocol_v3_dashboard_enabled) — Black Issue ──
  v3Today: { marginTop: 4, gap: 4 },
  v3TodayTitle: { ...afType.body, color: af.textPrimary },
  // Sentence-case mono: furniture voice, quiet — never a banner.
  v3Stale: { ...afType.micro, color: af.textTertiary },
  v3Reason: { ...afType.body, color: af.textSecondary, marginTop: 8 },
  v3HeroBlock: { marginTop: 32 },
  v3NumeralRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  v3Numeral: { ...afType.displayScore, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  v3Unit: { ...afType.eyebrow, color: af.textSecondary },
  v3HeroMetaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: 12,
    marginTop: 18,
  },
  v3HeroEyebrow: { ...afType.micro, color: af.redText },
  v3HeroMeta: { ...afType.micro, color: af.textSecondary, flexShrink: 1, textAlign: 'right' },
  v3HeroTrack: { height: 2, backgroundColor: af.divider, overflow: 'hidden', marginTop: 8 },
  v3HeroFill: { height: 2, backgroundColor: af.red },
  v3StepsHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: af.divider,
  },
  v3StepsLabel: { ...afType.eyebrow, color: af.redText },
  v3Complete: { gap: 8, alignItems: 'flex-start' },
  v3Footer: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: af.divider,
  },
  v3FooterStacked: { flexDirection: 'column', gap: 20 },
  v3FooterCell: { flex: 1, gap: 6 },
  v3FooterLabelRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  v3FooterLabel: { ...afType.micro, color: af.textTertiary },
  v3FooterValue: { ...afType.title3, color: af.textPrimary, marginTop: 6, fontVariant: ['tabular-nums'] },
  v3FooterCaption: { ...afType.micro, color: af.textTertiary, marginTop: 4 },
  v3HeroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[6] },
  v3RingPct: { ...afType.title1, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  v3RingLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  v3HeroStats: { flex: 1 },
  v3HeroKey: { ...afType.eyebrow, color: af.textTertiary },
  v3HeroValue: { ...afType.title2, color: af.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] },
  // Neutral, not green: this counter renders at 0 / 4 too, and green on a
  // day where nothing is done would read as approval the data hasn't earned.
  v3Count: { ...afType.caption, color: af.textTertiary, fontVariant: ['tabular-nums'] },
  // Shared voice for the two honest-sparse states (nothing completed yet, no
  // provider reporting): a sentence, not a placeholder row.
  v3Empty: { ...afType.body, color: af.textTertiary, marginTop: 12 },
  v3Live: { ...afType.caption, color: af.green },
});
