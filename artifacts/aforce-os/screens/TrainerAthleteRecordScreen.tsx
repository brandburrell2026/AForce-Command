/**
 * Athlete record — the drill-down behind a board row.
 *
 * Phase 3 of `docs/TRAINER-DASHBOARD-BRIEF.md`. Layout only: the record's
 * shape, its signals and its trend maths are pure functions in
 * `utils/trainerRecord.ts`.
 *
 * Two properties this screen is responsible for:
 *
 *   - IT SAYS WHERE ITS NUMBERS CAME FROM. Every signal renders its
 *     completeness, and an unavailable one shows the reason instead of a
 *     number. A sparkline drawn from four days is labelled partial.
 *   - IT SAYS HOW OLD IT IS. A record served from cache carries its age in
 *     the header. Rendering yesterday's numbers as today's is the failure
 *     mode the offline requirement exists to prevent.
 *
 * Colors are af.* tokens only; af.red stays a fill, af.redText carries text.
 */

import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { af, afLayout, afType } from "@/theme/afTokens";
import type { AthleteRecord, Completeness, RecordSignal } from "@/utils/trainerRecord";
import { trendCompleteness, trendStats } from "@/utils/trainerRecord";

export interface TrainerAthleteRecordScreenProps {
  record: AthleteRecord;
  /** Null when the record is live. Set when it came from cache. */
  cacheAgeMs?: number | null;
  freshness: string;
  onBack?: () => void;
}

const COMPLETENESS_LABEL: Record<Completeness, string> = {
  observed: "OBSERVED",
  partial: "PARTIAL",
  unavailable: "NO DATA",
};

function completenessTone(c: Completeness): string {
  if (c === "observed") return af.textTertiary;
  if (c === "partial") return af.amber;
  return af.textDisabled;
}

function SignalRow({ signal }: { signal: RecordSignal }) {
  return (
    <View style={styles.signalRow}>
      <View style={styles.signalTop}>
        <Text style={styles.signalLabel}>{signal.label}</Text>
        <View style={styles.spacer} />
        <Text style={[styles.completeness, { color: completenessTone(signal.completeness) }]}>
          {COMPLETENESS_LABEL[signal.completeness]}
        </Text>
      </View>
      <Text style={signal.value === null ? styles.signalValueEmpty : styles.signalValue}>
        {signal.value ?? "--"}
      </Text>
      <Text style={styles.signalDetail}>{signal.detail}</Text>
    </View>
  );
}

/**
 * Sparkline drawn with plain Views.
 *
 * No charting dependency and no SVG: fourteen bars is not worth a runtime
 * dependency, and the brief's §3 asks for justification before adding one.
 */
function Trend({ record }: { record: AthleteRecord }) {
  const stats = useMemo(() => trendStats(record.trend), [record.trend]);
  const completeness = trendCompleteness(stats);

  return (
    <View style={styles.section}>
      <View style={styles.signalTop}>
        <Text style={styles.sectionTitle}>14-DAY TREND</Text>
        <View style={styles.spacer} />
        <Text style={[styles.completeness, { color: completenessTone(completeness) }]}>
          {COMPLETENESS_LABEL[completeness]}
        </Text>
      </View>

      <View style={styles.sparkline}>
        {record.trend.map((point) => (
          <View key={point.daysAgo} style={styles.sparkColumn}>
            <View
              style={[
                styles.sparkBar,
                { height: point.score === null ? 2 : Math.max(2, point.score * 0.6) },
                point.score === null ? styles.sparkBarEmpty : null,
                point.daysAgo === 0 ? styles.sparkBarToday : null,
              ]}
            />
          </View>
        ))}
      </View>

      <Text style={styles.signalDetail}>
        {stats.average === null
          ? "No scores in this window."
          : `Low ${stats.min} · Average ${stats.average} · High ${stats.max} · ${stats.covered} of ${stats.window} days`}
      </Text>
    </View>
  );
}

export default function TrainerAthleteRecordScreen({
  record,
  cacheAgeMs = null,
  freshness,
  onBack,
}: TrainerAthleteRecordScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + afLayout.cardPadding,
        paddingBottom: insets.bottom + afLayout.sectionGap,
      }}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to the board" onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>BOARD</Text>
        </Pressable>

        <View style={styles.headerTop}>
          <Text style={styles.name} numberOfLines={2}>
            {record.displayName}
          </Text>
          {record.isSimulated ? <Text style={styles.simulated}>SIMULATED</Text> : null}
        </View>

        <Text style={styles.meta}>
          {record.position} · {record.tier ?? "NO TIER"} · {freshness}
        </Text>

        {record.command ? <Text style={styles.command}>{record.command}</Text> : null}
        <Text style={styles.attribution}>
          Recommendation — clinical decision remains with licensed staff.
        </Text>
      </View>

      {!record.consentGranted ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOT SHARING</Text>
          <Text style={styles.signalDetail}>
            This athlete has not shared with staff. Nothing about their signals is shown here.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SIGNALS</Text>
            {record.signals.map((signal) => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </View>

          <Trend record={record} />
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>STATUS HISTORY</Text>
        {record.statusHistory.length === 0 ? (
          <Text style={styles.signalDetail}>No status has been set for this athlete.</Text>
        ) : (
          record.statusHistory.map((entry) => (
            <View key={`${entry.at}-${entry.status}`} style={styles.historyRow}>
              <Text style={styles.historyStatus}>{entry.status.toUpperCase()}</Text>
              <Text style={styles.signalDetail}>
                {entry.setByDisplayName} · {entry.at}
              </Text>
              {entry.reason ? <Text style={styles.signalDetail}>{entry.reason}</Text> : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NOTES</Text>
        {record.notes.length === 0 ? (
          <Text style={styles.signalDetail}>No notes filed.</Text>
        ) : (
          record.notes.map((note) => (
            <View key={note.id} style={styles.historyRow}>
              <Text style={styles.noteBody}>{note.body}</Text>
              <Text style={styles.signalDetail}>
                {note.authorDisplayName} · {note.at}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DOCUMENTS</Text>
        <Text style={styles.signalDetail}>Document upload is not built yet.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: af.canvas },
  header: {
    paddingHorizontal: afLayout.screenPaddingX,
    paddingBottom: afLayout.cardPadding,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  back: { ...afType.tab, color: af.redText, minHeight: afLayout.controlMinHeight },
  headerTop: { flexDirection: "row", alignItems: "baseline" },
  name: { ...afType.title1, color: af.textPrimary, flexShrink: 1 },
  simulated: { ...afType.tab, color: af.amber, marginLeft: 8 },
  meta: { ...afType.caption, color: af.textSecondary, marginTop: 6 },
  command: { ...afType.bodyStrong, color: af.textPrimary, marginTop: afLayout.cardGap },
  attribution: { ...afType.caption, color: af.textTertiary, marginTop: 6 },

  section: {
    paddingHorizontal: afLayout.screenPaddingX,
    paddingTop: afLayout.cardPadding,
    paddingBottom: afLayout.cardGap,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  sectionTitle: { ...afType.eyebrow, color: af.redText, marginBottom: afLayout.cardGap },

  signalRow: { marginBottom: afLayout.cardPadding },
  signalTop: { flexDirection: "row", alignItems: "center" },
  spacer: { flex: 1 },
  signalLabel: { ...afType.secondary, color: af.textSecondary },
  completeness: { ...afType.tab },
  signalValue: { ...afType.title2, color: af.textPrimary, marginTop: 2 },
  signalValueEmpty: { ...afType.title2, color: af.textDisabled, marginTop: 2 },
  signalDetail: { ...afType.caption, color: af.textTertiary, marginTop: 2 },

  sparkline: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 70,
    marginBottom: afLayout.cardGap,
  },
  sparkColumn: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" },
  sparkBar: { width: "62%", backgroundColor: af.textSecondary, borderRadius: 2 },
  sparkBarEmpty: { backgroundColor: af.border },
  sparkBarToday: { backgroundColor: af.red },

  historyRow: { marginBottom: afLayout.cardGap },
  historyStatus: { ...afType.tab, color: af.textPrimary },
  noteBody: { ...afType.secondary, color: af.textPrimary },
});
