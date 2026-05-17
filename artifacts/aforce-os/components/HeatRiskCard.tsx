/**
 * HeatRiskCard — score + band + trend + drivers.
 *
 * Renders the canonical Heat Guard risk display. Used inside the Heat Risk
 * screen and within the Guardian roster detail expansion.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Icon, type IconName } from './Icon';

import { Colors } from "../theme/colors";
import type { HeatRiskScore } from "../types/heat";
import { HEAT_BANDS } from "../services/heatRiskEngine";

interface Props {
  score: HeatRiskScore;
  /** Compact layout for use inside lists / overlays. */
  compact?: boolean;
}

export function HeatRiskCard({ score, compact = false }: Props) {
  const display = HEAT_BANDS.find((b) => b.band === score.band) ?? HEAT_BANDS[0];
  const accent = display.color;
  const trendIcon =
    score.trend === "rising" ? "trending-up" : score.trend === "falling" ? "trending-down" : "minus";

  return (
    <View
      style={[
        styles.card,
        { borderColor: `${accent}55`, backgroundColor: `${accent}10` },
        compact && styles.cardCompact,
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.bandLabel, { color: accent }]}>{display.label}</Text>
        <View style={styles.trendPill}>
          <Icon name={trendIcon} size={12} color={Colors.text.secondary} />
          <Text style={styles.trendText}>{score.trend.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.scoreRow}>
        <Text style={[styles.scoreValue, { color: accent }]}>{score.score}</Text>
        <View style={styles.scoreMeta}>
          <Text style={styles.scoreUnit}>HEAT RISK · 0–100</Text>
          <Text style={styles.scoreUrgency}>Urgency: {score.urgency}</Text>
        </View>
      </View>

      {!compact && (
        <>
          <Text style={styles.sectionLabel}>WHY THIS RISK</Text>
          {score.topDrivers.length === 0 ? (
            <Text style={styles.noDrivers}>No active risk drivers detected.</Text>
          ) : (
            score.topDrivers.map((d) => (
              <View key={d.id} style={styles.driverRow}>
                <View style={styles.driverHeader}>
                  <Text style={styles.driverLabel}>{d.label}</Text>
                  <Text style={[styles.driverPoints, { color: accent }]}>+{d.points} pts</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: accent,
                        width: `${Math.min(100, (d.points / d.maxPoints) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.driverReason}>{d.reason}</Text>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  cardCompact: { padding: 12, gap: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bandLabel: { fontSize: 11, letterSpacing: 1.6, fontWeight: "800" },
  trendPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.fill.medium,
  },
  trendText: { fontSize: 9, letterSpacing: 1, color: Colors.text.secondary, fontWeight: "700" },

  scoreRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 4 },
  scoreValue: { fontSize: 64, fontWeight: "800", lineHeight: 64, letterSpacing: -2 },
  scoreMeta: { paddingBottom: 6, gap: 2 },
  scoreUnit: { fontSize: 10, letterSpacing: 1.4, color: Colors.text.muted, fontWeight: "700" },
  scoreUrgency: { fontSize: 12, color: Colors.text.secondary },

  sectionLabel: {
    fontSize: 10, letterSpacing: 1.4, color: Colors.text.muted,
    fontWeight: "700", marginTop: 12, marginBottom: 4,
  },
  noDrivers: { fontSize: 12, color: Colors.text.secondary },

  driverRow: { gap: 4, marginBottom: 8 },
  driverHeader: { flexDirection: "row", justifyContent: "space-between" },
  driverLabel: { fontSize: 12, color: Colors.text.primary, fontWeight: "600" },
  driverPoints: { fontSize: 11, fontWeight: "700" },
  barTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 2 },
  driverReason: { fontSize: 11, color: Colors.text.muted, lineHeight: 15 },
});
