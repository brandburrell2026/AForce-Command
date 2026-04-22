/**
 * HeatAlertBanner — sticky top alert that appears whenever heat risk is
 * ELEVATED or above. Tapping opens the full Heat Risk screen.
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { Colors } from "../theme/colors";
import type { HeatRiskBand } from "../types/heat";
import { HEAT_BANDS } from "../services/heatRiskEngine";

interface Props {
  score: number;
  band: HeatRiskBand;
}

export function HeatAlertBanner({ score, band }: Props) {
  const router = useRouter();
  const display = HEAT_BANDS.find((b) => b.band === band) ?? HEAT_BANDS[0];
  if (band === "STABLE") return null;
  const accent = display.color;

  // Punch up CRITICAL/SEVERE alerts so they read at a glance: stronger
  // background, brighter inner glow, and a 1px inner border in the
  // alert color (rendered as a second wrapping View).
  const isCritical = band === "CRITICAL" || band === "HIGH_RISK";
  const bgAlpha = isCritical ? "33" : "1F";
  const outerBorder = isCritical ? "FF" : "88";
  const innerBorder = `${accent}${isCritical ? "AA" : "55"}`;

  return (
    <Pressable
      onPress={() => router.push("/heat")}
      style={[
        styles.banner,
        { borderColor: `${accent}${outerBorder}`, backgroundColor: `${accent}${bgAlpha}` },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Heat Guard: ${display.label}, score ${score}. Tap to open.`}
    >
      <View
        pointerEvents="none"
        style={[styles.innerBorder, { borderColor: innerBorder }]}
      />
      <View style={[styles.iconCell, { backgroundColor: `${accent}44` }]}>
        <Feather name="thermometer" size={16} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: accent }]}>HEAT GUARD · {display.label}</Text>
        <Text style={[styles.line, isCritical && { color: accent, fontWeight: "700" }]}>
          {display.shortDirective} · Score {score}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1,
    position: "relative",
  },
  innerBorder: {
    position: "absolute",
    top: 3, left: 3, right: 3, bottom: 3,
    borderRadius: 9,
    borderWidth: 1,
  },
  iconCell: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  body: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
  line: { fontSize: 12, color: Colors.text.primary, marginTop: 2 },
});
