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

function HeatAlertBannerImpl({ score, band }: Props) {
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
        <Feather name="thermometer" size={18} color={accent} />
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

export const HeatAlertBanner = React.memo(HeatAlertBannerImpl);

// Sized to match the other bottom-zone signal cards (PhantomBandCard,
// PhantomSignal, SocialModeBanner): marginHorizontal 20, padding 16,
// borderRadius 14, eyebrow 11/700, body 12.
const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 14, borderWidth: 1,
    position: "relative",
  },
  innerBorder: {
    position: "absolute",
    top: 3, left: 3, right: 3, bottom: 3,
    borderRadius: 11,
    borderWidth: 1,
  },
  iconCell: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  body: { flex: 1 },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, fontWeight: "700" },
  line: { fontSize: 12, color: Colors.text.primary, marginTop: 4 },
});
