/**
 * EditorialProtocolScreen — PROTOCOL, The Brief (E4, founder decisions
 * 2026-08-30).
 *
 * The Editorial OS composition of the SAME Protocol truth. Every value comes
 * from the chain ProtocolScreenV2 already consumes: `deriveProtocol` for the
 * stage, its containment description, the steps and `nextRecheckMinutes`;
 * `protocolV3Presentation`'s resolvers for hydration and the signal tiles;
 * `explainFieldArbitration` for the biometrics winners.
 *
 * FOUNDER DECISIONS ENFORCED HERE (locked by editorialProtocolLaw.test.ts):
 *  D1 — the completion ring is FOLDED INTO the canonical clock's hairline
 *       gauge. One dominant instrument. No second ring, no percentage, no
 *       readiness score, no derived progress metric; the checklist stays the
 *       truthful step-completion representation.
 *  D2 — the Lane A stale contract is REUSED verbatim (`lastRefreshStale` +
 *       `home.v2.stale_notice`). No second freshness system, no threshold or
 *       provider change. The clock and stage stay visible; their reduced
 *       freshness is stated.
 *  D3 — production strings are preserved EXACTLY. Nothing is localized here;
 *       the stage names, step labels and step windows remain the hardcoded
 *       English the derivation ships, recorded as post-E4 debt.
 *  D4 — ProtocolScreenLegacy remains the rollback branch (route seam).
 *
 * STRUCTURAL NOTES
 *  • Protocol is a ROOT TAB, so there is NO back control and no `EdReturn` —
 *    the opposite of the two pushed Moments routes.
 *  • The stage description is the post-#885 containment copy, rendered
 *    verbatim: Protocol explains, it never prescribes.
 *  • Hydration is a MEASUREMENT of what the member drank against their own
 *    target — never an instruction (DR-013).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { AFScreen, AFDisclosureSheet } from '@/components/ui';
import { NightOutProtocolEntry } from '@/components/nightOut/NightOutProtocolEntry';
import { freshestBiometricsFetchedAt } from '@/components/home/homeFreshness';
import { formatHrvMs } from '@/components/home/homeV3Presentation';
import {
  formatBpm,
  hydrationProgress,
  signalsAreLive,
  anySignalReported,
  shouldAcknowledgeProgress,
} from '@/components/protocol/protocolV3Presentation';
import { formatTimeAgo } from '@/data/mockData';
import { fireMoment } from '@/services/haptics';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { useWeeklyCompliance } from '@/hooks/useWeeklyCompliance';
import { deriveProtocol } from '@/services/protocolDerivation';
import { useAppStore } from '@/store/useAppStore';
import { useBootstrapSlice } from '@/store/slices';
import { explainFieldArbitration } from '@/utils/biometricsAggregator';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import { edInkFor, edPositive, edRhythm, edStock, edType } from '@/theme/editorialTokens';

import { EdCaption, EdEvidenceLine, EdRule, EdStatement, EdSurface, useEdSettle } from '../index';
import { EdBriefChecklist } from './EdBriefChecklist';
import { EdCanonicalClock } from './EdCanonicalClock';
import { briefGaugeFraction } from './editorialProtocolPresentation';

export function EditorialProtocolScreen() {
  const { t } = useTranslation();
  const { state } = useAppStore();
  const { engineOutput, userState, history } = state;
  const { lastRefreshStale } = useBootstrapSlice();
  const [whyOpen, setWhyOpen] = React.useState(false);
  const tabClearance = useTabBarClearance();
  const ink = edInkFor('black');
  const settle = useEdSettle();

  // Same lazy fetch rule as the live screen: rollups only once a surface
  // that shows compliance activates.
  const weeklyCompliancePct = useWeeklyCompliance(whyOpen);

  const protocol = React.useMemo(
    () => deriveProtocol(userState, engineOutput, weeklyCompliancePct),
    [userState, engineOutput, weeklyCompliancePct],
  );

  const steps = protocol.steps;
  const total = steps.length;
  const completedCount = steps.filter((s) => s.complete).length;

  // SIGNATURE MOMENT — RITUAL PROGRESSION, carried over verbatim from
  // ProtocolScreenV2. `ritual_progressed` is the only named haptic moment
  // Protocol owns; dropping it would have made it unreachable app-wide the
  // moment this flag flipped (the E4 review caught exactly that). Same pure
  // rule, same ref baseline, so establishing the baseline never re-renders.
  const prevCompletedRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const prev = prevCompletedRef.current;
    prevCompletedRef.current = completedCount;
    if (shouldAcknowledgeProgress(prev, completedCount)) fireMoment('ritual_progressed');
  }, [completedCount]);

  // Same resolvers the V3 dashboard uses — reused, never reimplemented, so
  // the honest-data rules they encode stay enforced on this surface too.
  const signals = React.useMemo(() => {
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
    };
  }, [userState]);

  const anySignal = anySignalReported(signals.hrText, signals.hrvText);

  return (
    <EdSurface stock="black" style={styles.fill}>
      <AFScreen scroll contentContainerStyle={{ paddingBottom: tabClearance }}>
        <Animated.View style={settle}>
          {/* Root tab: masthead furniture only — no back control. */}
          <EdCaption text={t('protocol.v2.eyebrow')} />
          <EdRule />

          {/* D2 — the same notice Home renders, from the same flag and key. */}
          {lastRefreshStale ? (
            <Text
              style={[edType.micro as TextStyle, { color: ink.quiet, marginBottom: 10 }]}
              testID="editorial-protocol-stale-notice"
            >
              {t('home.v2.stale_notice')}
            </Text>
          ) : null}

          {/* The stage as context. Verbatim from the derivation — never a
              locale key here, and never paraphrased (D3). */}
          <EdStatement accessibilityRole="header">{protocol.stage}</EdStatement>
          <Text style={[edType.body as TextStyle, { color: ink.quiet, marginTop: 10 }]}>
            {protocol.description}
          </Text>

          <NightOutProtocolEntry />

          {/* D1 — the one instrument. */}
          <EdCanonicalClock
            minutes={protocol.nextRecheckMinutes}
            minutesLabel={t('protocol.v2.recheck_minutes', { min: protocol.nextRecheckMinutes })}
            caption={t('protocol.v2.next_recheck')}
            gaugeFraction={briefGaugeFraction(completedCount, total)}
            a11yLabel={`${t('protocol.v2.next_recheck')} ${t('protocol.v2.recheck_minutes', {
              min: protocol.nextRecheckMinutes,
            })}`}
          />

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <EdCaption text={t('protocol.v2.today_section')} />
              {/* The count V2 renders beside its Completed-today header. A
                  count, not a percentage — D1 bans derived metrics, not the
                  step tally the checklist already states. */}
              <Text
                maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
                style={[edType.data as TextStyle, { color: ink.quiet }]}
                testID="editorial-protocol-count"
              >
                {completedCount} / {total}
              </Text>
            </View>
            <EdBriefChecklist
              steps={steps}
              doneLabel={t('protocol.v3.completed_today')}
              activeLabel={t('protocol.v2.active_step')}
              pendingLabel={t('protocol.v2.timeline_upcoming')}
            />
          </View>

          {/* Hydration — MEASUREMENT of what was drunk against the member's
              own target. Omitted entirely when there is no target: no
              invented denominator (the resolver returns null). */}
          {signals.hydration ? (
            <View style={styles.section} testID="editorial-protocol-hydration">
              <EdCaption text={t('protocol.v3.hydration')} />
              <Text style={[edType.data as TextStyle, { color: ink.primary, marginTop: 6 }]}>
                {t('protocol.v3.hydration_oz', {
                  consumed: signals.hydration.consumed,
                  target: signals.hydration.target,
                })}
              </Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <EdCaption text={t('protocol.v3.recovery_signals')} />
            {anySignal ? (
              <>
                {/* Live is a freshness qualifier on the section, not a third
                    reading — V2 renders it as a chip beside the header, and a
                    valueless tile would read as a signal with no value. */}
                {signals.live ? (
                  <Text
                    style={[edType.micro as TextStyle, { color: edPositive, marginTop: 6 }]}
                    testID="editorial-protocol-live"
                  >
                    {t('protocol.v3.live')}
                  </Text>
                ) : null}
                <View style={styles.signalRow}>
                  <Signal label={t('protocol.v3.heart_rate')} value={signals.hrText} />
                  <Signal label={t('protocol.v3.hrv')} value={signals.hrvText} />
                </View>
              </>
            ) : (
              <Text
                style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 6 }]}
                testID="editorial-protocol-signals-empty"
              >
                {t('protocol.v3.signals_empty')}
              </Text>
            )}
          </View>

          {/* Command history, relocated — NOT deleted. ProtocolScreenV2's own
              header records the standing founder ruling ("relocate, never
              delete"); the E4 review caught this surface dropping it. Same
              slice, same five entries, same fields. */}
          {history.length > 0 ? (
            <View style={styles.section} testID="editorial-protocol-history">
              <EdCaption text={t('protocol.v2.recent_activity')} />
              {history.slice(0, 5).map((entry) => (
                <View key={entry.id}>
                  <EdRule />
                  <View
                    accessible
                    accessibilityLabel={`${entry.action} ${formatTimeAgo(entry.timestamp)} ${entry.score}`}
                    style={styles.historyRow}
                  >
                    <Text
                      style={[edType.body as TextStyle, { color: ink.primary, flexShrink: 1 }]}
                      numberOfLines={1}
                    >
                      {entry.action}
                    </Text>
                    <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
                      {formatTimeAgo(entry.timestamp)}
                    </Text>
                    <Text style={[edType.data as TextStyle, { color: ink.quiet }]}>
                      {entry.score}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* WHY — progressive disclosure, unchanged in substance. */}
          <Pressable
            onPress={() => setWhyOpen(true)}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.whyTarget}
            testID="editorial-protocol-why"
          >
            <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>
              {t('protocol.v2.why_this_plan')}
            </Text>
          </Pressable>

          <View style={styles.folio}>
            <EdEvidenceLine parts={[t('protocol.v2.eyebrow')]} />
          </View>
        </Animated.View>
      </AFScreen>

      <AFDisclosureSheet
        visible={whyOpen}
        onClose={() => setWhyOpen(false)}
        title={t('protocol.v2.why_this_plan')}
      >
        <Text style={[edType.caption as TextStyle, { color: ink.quiet }]}>{protocol.stage}</Text>
        <Text style={[edType.body as TextStyle, { color: ink.primary, marginTop: 8 }]}>
          {protocol.description}
        </Text>
        <Text style={[edType.bodySmall as TextStyle, { color: ink.quiet, marginTop: 10 }]}>
          {protocol.weeklyCompliancePct != null
            ? t('protocol.v2.why_consistency', {
                pct: protocol.weeklyCompliancePct,
                min: protocol.nextRecheckMinutes,
              })
            : t('protocol.v2.why_adaptive', { min: protocol.nextRecheckMinutes })}
        </Text>
      </AFDisclosureSheet>
    </EdSurface>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  const ink = edInkFor('black');
  return (
    <View accessible accessibilityLabel={`${label} ${value}`.trim()} style={styles.signal}>
      <Text style={[edType.micro as TextStyle, { color: ink.quiet }]}>{label}</Text>
      {value ? (
        <Text style={[edType.data as TextStyle, { color: ink.primary, marginTop: 3 }]}>{value}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: edStock.black },
  section: { marginTop: 26 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: 12,
    flexWrap: 'wrap',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 10,
    flexWrap: 'wrap',
    rowGap: 2,
    paddingVertical: 4,
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 26,
    rowGap: 12,
    marginTop: 8,
  },
  signal: { minWidth: 64 },
  whyTarget: {
    marginTop: 26,
    minHeight: edRhythm.minTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  folio: { marginTop: 24 },
});
