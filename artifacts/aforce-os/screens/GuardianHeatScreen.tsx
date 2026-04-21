/**
 * Guardian Heat Screen — coach / staff team view.
 *
 * Lists every athlete with their heat risk score, band, trend, and the
 * coach-facing action. Sorted with the most urgent at the top. Includes a
 * live alert feed for INTERVENE / PULL_NOW state.
 */

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { GradientBackground } from "@/components/GradientBackground";
import { Colors } from "@/theme/colors";
import { HEAT_BANDS } from "@/services/heatRiskEngine";
import { buildMockAlertFeed, buildMockRoster } from "@/mocks/heatData";
import type { HeatRiskBand, TeamHeatAlertState, TeamHeatAthlete } from "@/types/heat";

const ALERT_RANK: Record<TeamHeatAlertState, number> = {
  PULL_NOW: 0,
  INTERVENE: 1,
  WATCH: 2,
};

const ALERT_LABEL: Record<TeamHeatAlertState, string> = {
  PULL_NOW: "PULL NOW",
  INTERVENE: "INTERVENE",
  WATCH: "WATCH",
};

const ALERT_COLOR: Record<TeamHeatAlertState, string> = {
  PULL_NOW: Colors.states.DEPLETED.primary,
  INTERVENE: Colors.states.RECOVERING.primary,
  WATCH: Colors.states.BALANCED.primary,
};

function bandColor(band: HeatRiskBand): string {
  return HEAT_BANDS.find((b) => b.band === band)?.color ?? Colors.text.secondary;
}

export default function GuardianHeatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const roster = useMemo(() => buildMockRoster(), []);
  const alerts = useMemo(() => buildMockAlertFeed(), []);

  const sorted = useMemo<TeamHeatAthlete[]>(
    () =>
      [...roster].sort((a, b) => {
        const r = ALERT_RANK[a.alertState] - ALERT_RANK[b.alertState];
        if (r !== 0) return r;
        return b.riskScore - a.riskScore;
      }),
    [roster],
  );

  const counts = useMemo(() => {
    const c = { PULL_NOW: 0, INTERVENE: 0, WATCH: 0 } as Record<TeamHeatAlertState, number>;
    roster.forEach((a) => (c[a.alertState] += 1));
    return c;
  }, [roster]);

  const topPadding = Platform.OS === "web" ? 24 : insets.top;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/heat");
              }}
              style={styles.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>HEAT GUARD · TEAM</Text>
              <Text style={styles.title}>Coach Heat Console</Text>
            </View>
          </View>

          <Text style={styles.disclaimer}>
            Early-warning intervention. Not a diagnosis. Pull decisions belong to the staff.
          </Text>

          {/* Summary tiles */}
          <View style={styles.summaryRow}>
            <SummaryTile
              label="PULL NOW"
              count={counts.PULL_NOW}
              color={ALERT_COLOR.PULL_NOW}
            />
            <SummaryTile
              label="INTERVENE"
              count={counts.INTERVENE}
              color={ALERT_COLOR.INTERVENE}
            />
            <SummaryTile
              label="WATCH"
              count={counts.WATCH}
              color={ALERT_COLOR.WATCH}
            />
          </View>

          {/* Alert feed */}
          {alerts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>LIVE ALERTS</Text>
              {alerts.map((a) => (
                <View
                  key={`${a.athleteId}_${a.loggedAt}`}
                  style={[
                    styles.alertRow,
                    { borderColor: `${ALERT_COLOR[a.state]}66` },
                  ]}
                >
                  <View
                    style={[
                      styles.alertBadge,
                      { backgroundColor: ALERT_COLOR[a.state] },
                    ]}
                  >
                    <Text style={styles.alertBadgeText}>{ALERT_LABEL[a.state]}</Text>
                  </View>
                  <Text style={styles.alertText}>{a.message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Roster */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ROSTER · {roster.length} ATHLETES</Text>
            {sorted.map((a) => (
              <Pressable
                key={a.id}
                style={[
                  styles.athleteRow,
                  { borderColor: `${bandColor(a.band)}55` },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${a.name}, ${a.alertState}, score ${a.riskScore}`}
              >
                <View style={[styles.jerseyChip, { borderColor: bandColor(a.band) }]}>
                  <Text style={styles.jerseyText}>#{a.jerseyNumber}</Text>
                </View>
                <View style={styles.athleteBody}>
                  <View style={styles.athleteHeader}>
                    <Text style={styles.athleteName}>{a.name}</Text>
                    <Text style={styles.athletePos}>{a.position}</Text>
                    <View
                      style={[
                        styles.athleteBandPill,
                        { backgroundColor: `${bandColor(a.band)}1F`, borderColor: `${bandColor(a.band)}66` },
                      ]}
                    >
                      <Text style={[styles.athleteBandText, { color: bandColor(a.band) }]}>
                        {HEAT_BANDS.find((b) => b.band === a.band)?.label ?? a.band}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.athleteMetaRow}>
                    <Text style={[styles.athleteScore, { color: bandColor(a.band) }]}>
                      {a.riskScore}
                    </Text>
                    <Text style={styles.athleteScoreUnit}>RISK</Text>
                    <Feather
                      name={
                        a.trend === "rising"
                          ? "trending-up"
                          : a.trend === "falling"
                          ? "trending-down"
                          : "minus"
                      }
                      size={12}
                      color={Colors.text.secondary}
                    />
                    <Text style={styles.athleteMetaText}>
                      Hyd {a.hydrationScore}
                    </Text>
                    <Text style={styles.athleteMetaText}>
                      · {a.minutesSinceLastIntake}m since intake
                    </Text>
                  </View>
                  <Text style={styles.athleteAction}>{a.coachAction}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function SummaryTile({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.summaryTile, { borderColor: `${color}66`, backgroundColor: `${color}14` }]}>
      <Text style={[styles.summaryCount, { color }]}>{count}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: Colors.text.muted, fontWeight: "700" },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text.primary, marginTop: 2, letterSpacing: -0.4 },
  disclaimer: {
    fontSize: 11, color: Colors.text.muted, lineHeight: 16,
    marginTop: 6, marginBottom: 16, fontStyle: "italic",
  },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  summaryTile: {
    flex: 1, padding: 12, borderRadius: 12, borderWidth: 1,
    alignItems: "flex-start", gap: 4,
  },
  summaryCount: { fontSize: 28, fontWeight: "800", lineHeight: 30, letterSpacing: -1 },
  summaryLabel: { fontSize: 10, letterSpacing: 1.4, color: Colors.text.muted, fontWeight: "700" },

  section: { marginBottom: 18 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 1.6, color: Colors.text.muted,
    fontWeight: "700", marginBottom: 8,
  },

  alertRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, marginBottom: 8,
    borderRadius: 10, borderWidth: 1,
    backgroundColor: Colors.fill.light,
  },
  alertBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  alertBadgeText: { fontSize: 9, letterSpacing: 1, color: "#000", fontWeight: "800" },
  alertText: { flex: 1, fontSize: 12, color: Colors.text.primary, lineHeight: 16 },

  athleteRow: {
    flexDirection: "row", gap: 10, padding: 12, marginBottom: 8,
    borderRadius: 12, borderWidth: 1,
    backgroundColor: Colors.fill.light,
  },
  jerseyChip: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  jerseyText: { fontSize: 12, fontWeight: "800", color: Colors.text.primary, letterSpacing: 0.5 },

  athleteBody: { flex: 1, gap: 4 },
  athleteHeader: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  athleteName: { fontSize: 14, fontWeight: "700", color: Colors.text.primary },
  athletePos: { fontSize: 11, color: Colors.text.muted, letterSpacing: 0.4 },
  athleteBandPill: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1,
  },
  athleteBandText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },

  athleteMetaRow: { flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  athleteScore: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  athleteScoreUnit: { fontSize: 9, color: Colors.text.muted, letterSpacing: 1.2, fontWeight: "700" },
  athleteMetaText: { fontSize: 11, color: Colors.text.secondary },
  athleteAction: { fontSize: 12, color: Colors.text.primary, marginTop: 2, lineHeight: 17 },
});
