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

  return (
    <Pressable
      onPress={() => router.push("/heat")}
      style={[
        styles.banner,
        { borderColor: `${accent}88`, backgroundColor: `${accent}1F` },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Heat Guard: ${display.label}, score ${score}. Tap to open.`}
    >
      <View style={[styles.iconCell, { backgroundColor: `${accent}33` }]}>
        <Feather name="thermometer" size={16} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: accent }]}>HEAT GUARD · {display.label}</Text>
        <Text style={styles.line}>{display.shortDirective} · Score {score}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={Colors.text.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1,
  },
  iconCell: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  body: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.4, fontWeight: "800" },
  line: { fontSize: 12, color: Colors.text.primary, marginTop: 2 },
});
