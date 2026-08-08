/**
 * AppleHealthDiagnosticsPanel — TEMPORARY, INTERNAL-TESTFLIGHT-ONLY.
 *
 * RC-2 P0 device-validation audit (fix/rc2-apple-pipeline-diagnostics).
 * Renders, in the "Live from Apple Health" panel area, exactly what one
 * refresh cycle did: the raw samples HealthKit returned per metric, the
 * mapped snapshot, the value on the card above, and the value that reached
 * the scoring input — so the founder can compare AForce's numbers against
 * the Health app on-device without reading a console log.
 *
 * Pure presentation, driven entirely by props — no store, router, or the
 * Apple Health service module — same convention as
 * `AppleHealthRefreshControl.tsx` (see its header). `enabled` is passed in
 * by the caller (`ProfileScreenV2.tsx`, from
 * `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED`) rather than read here, so this
 * component carries zero feature-flag knowledge of its own and is fully
 * testable with a plain boolean.
 *
 * Renders NOTHING (`null`) unless `enabled` AND `diagnostics` are both
 * present — a production build, where `enabled` is always `false`, never
 * mounts so much as an empty wrapper `View`.
 *
 * TEMPORARY: this component ships for RC-2 device validation only. It is
 * not a permanent diagnostics surface and carries no brand-system
 * obligation beyond "never visible outside internal TestFlight" — see
 * CLAUDE.md's brand law, which this intentionally does not attempt to
 * satisfy (mono data font aside), because it must never be seen by a real
 * user.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Icon } from '@/components/Icon';
import { af } from '@/theme';
import { Typography } from '@/theme/typography';
import type {
  AppleHealthDiagnosticsSnapshot,
  AppleHealthScoringInputSnapshot,
} from '@/services/appleHealthDiagnostics';
import type { FieldArbitrationResult } from '@/utils/biometricsAggregator';

export interface AppleHealthDiagnosticsPanelProps {
  /** Pass `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED` from the caller — this component never reads the flag itself. */
  enabled: boolean;
  /** Result of the last `fetchAppleHealthSnapshot()` call, or `null` before the first refresh. */
  diagnostics: AppleHealthDiagnosticsSnapshot | null;
  /** Read back from store state by the caller — never recomputed here. */
  scoringInput: AppleHealthScoringInputSnapshot | null;
  /**
   * RC-2 founder logging order (build-49 device finding, 2026-08-07): the
   * `explainFieldArbitration` readback for `sleepHoursLastNight` and
   * `hrvSdnn` — computed by the caller (`AppleHealthDiagnosticsSection`),
   * never here, matching this component's "driven entirely by props"
   * convention.
   */
  arbitration: {
    sleep: FieldArbitrationResult<'sleepHoursLastNight'>;
    hrv: FieldArbitrationResult<'hrvSdnn'>;
  };
  testID?: string;
}

function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} testID={testID}>{value}</Text>
    </View>
  );
}

function SectionHeading({ children }: { children: string }) {
  return <Text style={styles.sectionHeading}>{children}</Text>;
}

function formatSampleLine(sample: AppleHealthDiagnosticsSnapshot['restingHeartRate']['newest']): string {
  if (!sample) return 'no samples found';
  return `${sample.quantity} ${sample.unit} · ${sample.sourceName} · ${sample.startDate}`;
}

function formatCandidateLine(c: { value: number; tier: string; comparisonTimestampMs: number }): string {
  return `${c.value} · ${c.tier} @ ${new Date(c.comparisonTimestampMs).toISOString()}`;
}

/**
 * RC-2 founder logging order: one field's arbitration readback — winning
 * provider, value, tier, timestamp, plus every losing candidate's
 * value/tier/timestamp. Renders "no provider reports this field" when
 * `candidates` is empty (nothing connected reports this metric at all).
 */
function ArbitrationRows({
  title,
  result,
  testID,
}: {
  title: string;
  result: FieldArbitrationResult<'sleepHoursLastNight'> | FieldArbitrationResult<'hrvSdnn'>;
  testID: string;
}) {
  return (
    <>
      <SectionHeading>{title}</SectionHeading>
      {result.winner ? (
        <>
          <Row
            label="winner"
            value={`${result.winner.providerId} · ${formatCandidateLine(result.winner)}`}
            testID={`${testID}-winner`}
          />
          {result.candidates
            .filter((c) => c.providerId !== result.winner!.providerId)
            .map((c) => (
              <Row
                key={c.providerId}
                label={`  lost: ${c.providerId}`}
                value={formatCandidateLine(c)}
                testID={`${testID}-lost-${c.providerId}`}
              />
            ))}
        </>
      ) : (
        <Row label="winner" value="no provider reports this field" testID={`${testID}-winner`} />
      )}
    </>
  );
}

export function AppleHealthDiagnosticsPanel({
  enabled,
  diagnostics,
  scoringInput,
  arbitration,
  testID = 'apple-health-diagnostics-panel',
}: AppleHealthDiagnosticsPanelProps) {
  const [open, setOpen] = useState(false);

  if (!enabled || !diagnostics) return null;

  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Internal diagnostics — Apple Health pipeline"
        testID={`${testID}-toggle`}
      >
        <Text style={styles.headerLabel}>INTERNAL DIAGNOSTICS · APPLE HEALTH</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} color={af.textTertiary} />
      </Pressable>

      {open && (
        <View style={styles.body} testID={`${testID}-body`}>
          <Text style={styles.captured}>
            Captured {new Date(diagnostics.capturedAt).toLocaleTimeString()}
          </Text>

          <SectionHeading>Resting heart rate</SectionHeading>
          <Row label="value used" value={`${diagnostics.restingHeartRate.valueUsed ?? '—'} bpm`} testID={`${testID}-rhr-value`} />
          <Row label="newest sample" value={formatSampleLine(diagnostics.restingHeartRate.newest)} />
          <Row label="samples / 24h" value={String(diagnostics.restingHeartRate.sampleCount24h ?? '—')} />

          <SectionHeading>HRV (SDNN)</SectionHeading>
          <Row label="value used" value={`${diagnostics.hrv.valueUsed ?? '—'} ms`} testID={`${testID}-hrv-value`} />
          <Row label="newest sample" value={formatSampleLine(diagnostics.hrv.newest)} />
          <Row label="samples / 24h" value={String(diagnostics.hrv.sampleCount24h ?? '—')} />

          <SectionHeading>Steps today — old vs. new aggregation</SectionHeading>
          <Row
            label="raw sum (old)"
            value={String(diagnostics.steps.rawSampleSum ?? '—')}
            testID={`${testID}-steps-raw`}
          />
          <Row
            label="bucketed max (new)"
            value={String(diagnostics.steps.bucketedMaxTotal ?? '—')}
            testID={`${testID}-steps-bucketed`}
          />
          <Row
            label="native merged (HK's own)"
            value={String(diagnostics.steps.nativeMergedTotal ?? '—')}
            testID={`${testID}-steps-native-merged`}
          />
          <Row
            label="value used"
            value={`${diagnostics.steps.valueUsed ?? '—'}${diagnostics.steps.usedFallback ? ' (fallback → raw sum)' : ''}`}
            testID={`${testID}-steps-used`}
          />
          <Row label="sample count" value={String(diagnostics.steps.sampleCount ?? '—')} />
          {diagnostics.steps.perSourceTotals.length === 0 ? (
            <Row label="per-source totals" value="none" />
          ) : (
            diagnostics.steps.perSourceTotals.map((s) => (
              <Row key={s.sourceName} label={`  source: ${s.sourceName}`} value={String(s.total)} />
            ))
          )}

          <SectionHeading>Sleep last night — old vs. new aggregation</SectionHeading>
          <Row
            label="query window"
            value={`${diagnostics.sleep.queryWindowStartIso} → ${diagnostics.sleep.queryWindowEndIso}`}
            testID={`${testID}-sleep-window`}
          />
          <Row
            label="raw sum (old)"
            value={`${diagnostics.sleep.rawSumHours ?? '—'} h`}
            testID={`${testID}-sleep-raw`}
          />
          <Row
            label="interval union (new)"
            value={`${diagnostics.sleep.unionHours ?? '—'} h`}
            testID={`${testID}-sleep-union`}
          />
          <Row
            label="union last-end (raw)"
            value={diagnostics.sleep.unionLastEndMs == null ? '—' : new Date(diagnostics.sleep.unionLastEndMs).toISOString()}
            testID={`${testID}-sleep-union-last-end`}
          />
          <Row
            label="value used"
            value={`${diagnostics.sleep.valueUsed ?? '—'} h${
              diagnostics.sleep.sleepValueUnknown
                ? ' (unknown — raw samples dropped)'
                : diagnostics.sleep.valueUsed == null && diagnostics.sleep.sleepSessionRule === 'none'
                  ? ' (no session in 36h window)'
                  : ''
            }`}
            testID={`${testID}-sleep-used`}
          />
          <Row label="selection branch" value={diagnostics.sleep.selectionBranch} testID={`${testID}-sleep-branch`} />
          <Row
            label="selected slices (from samples)"
            value={`${diagnostics.sleep.summedSampleCount ?? '—'} (from ${diagnostics.sleep.totalSampleCount ?? '—'})`}
          />
          {/* RC-2 sleep-window ruling (2026-08-08): session-clustering diagnostics. */}
          <Row
            label="sessions in window"
            value={String(diagnostics.sleep.sessionCount)}
            testID={`${testID}-sleep-session-count`}
          />
          <Row
            label="session rule fired"
            value={diagnostics.sleep.sleepSessionRule}
            testID={`${testID}-sleep-session-rule`}
          />
          <Row
            label="chosen session"
            value={
              diagnostics.sleep.chosenSessionStartIso && diagnostics.sleep.chosenSessionEndIso
                ? `${diagnostics.sleep.chosenSessionStartIso} → ${diagnostics.sleep.chosenSessionEndIso}`
                : 'none'
            }
            testID={`${testID}-sleep-chosen-session`}
          />
          {diagnostics.sleep.sleepSessions.length === 0 ? (
            <Row label="all sessions" value="none" />
          ) : (
            diagnostics.sleep.sleepSessions.map((s, i) => (
              <Row
                key={`${s.startIso}-${s.endIso}`}
                label={`  session ${i + 1}`}
                value={`${s.startIso} → ${s.endIso} (${s.durationHours.toFixed(2)}h)`}
                testID={`${testID}-sleep-session-${i}`}
              />
            ))
          )}
          {diagnostics.sleep.perSourceTotals.length === 0 ? (
            <Row label="per-source totals" value="none" />
          ) : (
            diagnostics.sleep.perSourceTotals.map((s) => (
              <Row
                key={`${s.sourceName}-${s.valueClass}`}
                label={`  source: ${s.sourceName} (${s.valueClass})`}
                value={`${s.totalHours.toFixed(2)}h`}
              />
            ))
          )}

          <SectionHeading>Workouts</SectionHeading>
          <Row label="status" value="NOT QUERIED" />

          <SectionHeading>Scoring input (read from app state)</SectionHeading>
          {scoringInput?.biometricsEntry ? (
            <>
              <Row
                label="biometrics.apple_health"
                value={`RHR=${scoringInput.biometricsEntry.restingHeartRate ?? '—'} HRV=${scoringInput.biometricsEntry.hrvSdnn ?? '—'} sleep=${scoringInput.biometricsEntry.sleepHoursLastNight ?? '—'} steps=${scoringInput.biometricsEntry.stepsToday ?? '—'}`}
                testID={`${testID}-scoring-biometrics`}
              />
              <Row
                label="sleep observed at"
                value={
                  scoringInput.biometricsEntry.sleepObservedAtMs != null
                    ? new Date(scoringInput.biometricsEntry.sleepObservedAtMs).toISOString()
                    : '—'
                }
                testID={`${testID}-scoring-sleep-observed-at`}
              />
              <Row
                label="latest observed at"
                value={
                  scoringInput.biometricsEntry.latestObservedAtMs != null
                    ? new Date(scoringInput.biometricsEntry.latestObservedAtMs).toISOString()
                    : '—'
                }
                testID={`${testID}-scoring-latest-observed-at`}
              />
            </>
          ) : (
            <Row label="biometrics.apple_health" value="not set" />
          )}
          {scoringInput?.recoveryContribution ? (
            <Row
              label="breakdown row"
              value={`${scoringInput.recoveryContribution.label} · delta ${scoringInput.recoveryContribution.delta} · ${scoringInput.recoveryContribution.hint}`}
              testID={`${testID}-scoring-breakdown`}
            />
          ) : (
            <Row label="breakdown row" value="none found" />
          )}

          <ArbitrationRows
            title="Arbitration — sleepHoursLastNight (which provider won, and why)"
            result={arbitration.sleep}
            testID={`${testID}-arbitration-sleep`}
          />
          <ArbitrationRows
            title="Arbitration — hrvSdnn (which provider won, and why)"
            result={arbitration.hrv}
            testID={`${testID}-arbitration-hrv`}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: af.border,
    backgroundColor: af.surface,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerLabel: {
    fontFamily: Typography.fonts.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: af.textTertiary,
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  captured: {
    fontFamily: Typography.fonts.mono,
    fontSize: 10,
    color: af.textTertiary,
    marginBottom: 4,
  },
  sectionHeading: {
    fontFamily: Typography.fonts.medium,
    fontSize: 11,
    color: af.textSecondary,
    marginTop: 10,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLabel: {
    fontFamily: Typography.fonts.mono,
    fontSize: 10,
    color: af.textTertiary,
    flexShrink: 0,
  },
  rowValue: {
    fontFamily: Typography.fonts.mono,
    fontSize: 10,
    color: af.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
});
