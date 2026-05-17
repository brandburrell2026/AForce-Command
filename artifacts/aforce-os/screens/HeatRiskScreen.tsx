/**
 * Heat Risk Screen — Guardian individual view.
 *
 * Shows the Heat Pulse, a large Heat Risk Card with WHY THIS RISK, the active
 * intervention protocol, the recheck timer, and a band selector that lets the
 * user simulate inputs across STABLE → CRITICAL.
 *
 * IMPORTANT — this screen never claims diagnosis. The CRITICAL band flags
 * a severe risk pattern; emergency-services language is suggested only as
 * an action the user may need to take, not as a medical determination.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Icon, type IconName } from '../components/Icon';

import { GradientBackground } from "@/components/GradientBackground";
import { HeatPulse } from "@/components/HeatPulse";
import { HeatRiskCard } from "@/components/HeatRiskCard";
import { Colors } from "@/theme/colors";
import { evaluateHeatRisk, HEAT_BANDS } from "@/services/heatRiskEngine";
import { activeProtocolFor } from "@/services/heatProtocolService";
import {
  getCurrentCityClimate,
  getCurrentCityClimateSync,
  type CityClimate,
} from "@/services/cityClimateService";
import { SAMPLE_INPUTS } from "@/mocks/heatData";
import type { HeatRiskBand } from "@/types/heat";

const TONE_COLOR: Record<"info" | "warn" | "alert" | "critical", string> = {
  info: Colors.states.BALANCED.primary,
  warn: Colors.states.RECOVERING.primary,
  alert: "#FF5A1F",
  critical: Colors.states.DEPLETED.primary,
};

export default function HeatRiskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bandPattern, setBandPattern] = useState<HeatRiskBand>("ELEVATED");
  const previousScoreRef = useRef<number | null>(null);

  // Live local climate — drives the city-humidity insight panel below.
  const [climate, setClimate] = useState<CityClimate>(() => getCurrentCityClimateSync());
  useEffect(() => {
    let cancelled = false;
    void getCurrentCityClimate().then((c) => {
      if (!cancelled) setClimate(c);
    });
    return () => { cancelled = true; };
  }, []);

  const score = useMemo(() => {
    const out = evaluateHeatRisk(SAMPLE_INPUTS[bandPattern], {
      previousScore: previousScoreRef.current ?? undefined,
    });
    return out;
  }, [bandPattern]);

  // Track previous score for trend calc on pattern changes.
  useEffect(() => {
    previousScoreRef.current = score.score;
  }, [score.score]);

  const protocol = activeProtocolFor(score.band);
  const display = HEAT_BANDS.find((b) => b.band === score.band) ?? HEAT_BANDS[0];

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
                else router.replace("/(tabs)/index" as never);
              }}
              style={styles.backBtn}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Icon name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>HEAT GUARD · GUARDIAN</Text>
              <Text style={styles.title}>Heat Risk Prediction</Text>
            </View>
            <Pressable
              onPress={() => router.push("/heat/guardian")}
              style={styles.teamBtn}
              accessibilityRole="button"
              accessibilityLabel="Switch to team view"
              hitSlop={8}
            >
              <Icon name="users" size={14} color={Colors.text.primary} />
              <Text style={styles.teamBtnText}>TEAM</Text>
            </Pressable>
          </View>

          <Text style={styles.disclaimer}>
            Early-warning intervention. Not a diagnosis. Not a medical device.
          </Text>

          {/* Heat Pulse */}
          <View style={styles.pulseWrap}>
            <HeatPulse band={score.band} score={score.score} size={200} />
            <View style={styles.pulseOverlay} pointerEvents="none">
              <Text style={styles.pulseScore}>{score.score}</Text>
              <Text style={styles.pulseLabel}>RISK</Text>
            </View>
          </View>

          {/* Risk card */}
          <HeatRiskCard score={score} />

          {/* Local climate — humidity drives a real, named recommendation */}
          <View style={styles.climateCard} testID="climate-card">
            <View style={styles.climateHeader}>
              <Icon name="map-pin" size={12} color={Colors.text.muted} />
              <Text style={styles.climateEyebrow}>
                LOCAL CLIMATE · {climate.city.toUpperCase()}
                {climate.region ? `, ${climate.region.toUpperCase()}` : ""}
              </Text>
            </View>
            <View style={styles.climateRow}>
              <View style={styles.climateMetric}>
                <Icon name="thermometer" size={14} color={Colors.text.secondary} />
                <Text style={styles.climateMetricText}>{climate.tempF}°F</Text>
              </View>
              <View style={styles.climateMetric}>
                <Icon name="droplet" size={14} color={Colors.text.secondary} />
                <Text style={styles.climateMetricText}>{climate.humidityPct}% RH</Text>
              </View>
              <Text style={styles.climateBand}>
                {climate.humidityBand.replace("_", " ").toUpperCase()}
              </Text>
            </View>
            <Text style={styles.climateInsight}>{climate.hydrationInsight}</Text>
          </View>

          {/* Command card */}
          <View
            style={[
              styles.commandCard,
              { borderColor: `${display.color}88`, backgroundColor: `${display.color}1A` },
            ]}
          >
            <Text style={[styles.commandEyebrow, { color: display.color }]}>AI COMMAND</Text>
            <Text style={styles.commandText}>{score.command}</Text>
            <Text style={styles.commandDetail}>{score.commandDetail}</Text>
            <View style={styles.commandMetaRow}>
              <View style={styles.commandMetaItem}>
                <Icon name="clock" size={12} color={Colors.text.secondary} />
                <Text style={styles.commandMetaText}>Recheck in {score.recheckMinutes} min</Text>
              </View>
              {score.cooldownMinutes > 0 && (
                <View style={styles.commandMetaItem}>
                  <Icon name="wind" size={12} color={Colors.text.secondary} />
                  <Text style={styles.commandMetaText}>Cooldown {score.cooldownMinutes} min</Text>
                </View>
              )}
            </View>
          </View>

          {/* Active protocol */}
          {protocol && (
            <View
              style={[
                styles.protocolCard,
                { borderColor: `${TONE_COLOR[protocol.tone]}55` },
              ]}
            >
              <View style={styles.protocolHeader}>
                <Text
                  style={[styles.protocolTitle, { color: TONE_COLOR[protocol.tone] }]}
                >
                  {protocol.title}
                </Text>
                <Text style={styles.protocolDuration}>{protocol.durationMinutes} min</Text>
              </View>
              {protocol.actions.map((action, idx) => (
                <View key={action.id} style={styles.actionRow}>
                  <View
                    style={[
                      styles.actionDot,
                      { backgroundColor: TONE_COLOR[protocol.tone] },
                    ]}
                  >
                    <Text style={styles.actionDotText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionLabel}>{action.label}</Text>
                    {action.detail && (
                      <Text style={styles.actionDetail}>{action.detail}</Text>
                    )}
                  </View>
                </View>
              ))}
              {protocol.returnGate && (
                <View style={styles.returnGate}>
                  <Text style={styles.returnGateLabel}>RETURN-TO-ACTIVITY GATE</Text>
                  <Text style={styles.returnGateText}>
                    Risk ≤ {protocol.returnGate.maxScore} · Hydration ≥{" "}
                    {protocol.returnGate.minHydrationScore} · Zero symptoms · Timer
                    complete
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Band simulator */}
          <View style={styles.simCard}>
            <Text style={styles.simLabel}>SIMULATE RISK PATTERN</Text>
            <Text style={styles.simHint}>
              Until wearable / weather feeds are wired, tap a band to preview the response.
            </Text>
            <View style={styles.simRow}>
              {(["STABLE", "ELEVATED", "WARNING", "HIGH_RISK", "CRITICAL"] as HeatRiskBand[]).map(
                (b) => {
                  const d = HEAT_BANDS.find((x) => x.band === b)!;
                  const active = b === bandPattern;
                  return (
                    <Pressable
                      key={b}
                      onPress={() => setBandPattern(b)}
                      style={[
                        styles.simChip,
                        active && {
                          borderColor: d.color,
                          backgroundColor: `${d.color}22`,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={[styles.simDot, { backgroundColor: d.color }]} />
                      <Text
                        style={[
                          styles.simChipText,
                          active && { color: Colors.text.primary },
                        ]}
                      >
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>

          {/* Cross-link → Sweat Calculator */}
          <Pressable
            onPress={() => router.push('/sweat')}
            style={styles.sweatCta}
            accessibilityRole="button"
            accessibilityLabel="Open Sweat Calculator"
          >
            <View style={styles.sweatCtaIcon}>
              <Icon name="droplet" size={18} color={Colors.states.BALANCED.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sweatCtaTitle}>Calculate your sweat rate</Text>
              <Text style={styles.sweatCtaSub}>
                ACSM-grade fluid &amp; sodium loss · personalized AForce protocol
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={Colors.text.muted} />
          </Pressable>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  climateCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 14,
    gap: 10,
  },
  climateHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  climateEyebrow: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
  },
  climateRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  climateMetric: { flexDirection: "row", alignItems: "center", gap: 6 },
  climateMetricText: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  climateBand: {
    marginLeft: "auto",
    color: Colors.text.secondary,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  climateInsight: {
    color: Colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.light,
  },
  eyebrow: { fontSize: 11, letterSpacing: 1.6, color: Colors.text.muted, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "800", color: Colors.text.primary, marginTop: 2, letterSpacing: -0.4 },
  teamBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
  },
  teamBtnText: { color: Colors.text.primary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  disclaimer: {
    fontSize: 11, color: Colors.text.muted, lineHeight: 16,
    marginTop: 6, marginBottom: 16, fontStyle: "italic",
  },

  pulseWrap: {
    height: 220, alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  pulseOverlay: { position: "absolute", alignItems: "center" },
  pulseScore: { fontSize: 56, fontWeight: "800", color: "#000", letterSpacing: -2 },
  pulseLabel: { fontSize: 10, fontWeight: "800", color: "#000", letterSpacing: 1.6, opacity: 0.7 },

  commandCard: {
    marginTop: 14, padding: 16,
    borderRadius: 14, borderWidth: 1, gap: 8,
  },
  commandEyebrow: { fontSize: 10, letterSpacing: 1.6, fontWeight: "800" },
  commandText: { fontSize: 15, fontWeight: "700", color: Colors.text.primary, lineHeight: 21 },
  commandDetail: { fontSize: 12, color: Colors.text.secondary, lineHeight: 17 },
  commandMetaRow: { flexDirection: "row", gap: 14, marginTop: 4 },
  commandMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  commandMetaText: { fontSize: 11, color: Colors.text.secondary },

  protocolCard: {
    marginTop: 14, padding: 14,
    borderRadius: 14, borderWidth: 1,
    backgroundColor: Colors.fill.light, gap: 8,
  },
  protocolHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  protocolTitle: { fontSize: 13, letterSpacing: 1.2, fontWeight: "800" },
  protocolDuration: { fontSize: 11, color: Colors.text.muted, letterSpacing: 0.6 },
  actionRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginTop: 4 },
  actionDot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  actionDotText: { fontSize: 10, fontWeight: "800", color: "#000" },
  actionLabel: { fontSize: 13, color: Colors.text.primary, fontWeight: "600", lineHeight: 18 },
  actionDetail: { fontSize: 11, color: Colors.text.muted, marginTop: 2, lineHeight: 15 },
  returnGate: {
    marginTop: 10, padding: 10, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  returnGateLabel: { fontSize: 9, letterSpacing: 1.4, color: Colors.text.muted, fontWeight: "700" },
  returnGateText: { fontSize: 11, color: Colors.text.secondary, marginTop: 4, lineHeight: 16 },

  simCard: {
    marginTop: 18, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.light,
  },
  simLabel: { fontSize: 10, letterSpacing: 1.6, color: Colors.text.muted, fontWeight: "700" },
  simHint: { fontSize: 11, color: Colors.text.secondary, marginTop: 4, marginBottom: 10 },
  simRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  simChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  simDot: { width: 8, height: 8, borderRadius: 4 },
  simChipText: { fontSize: 10, fontWeight: "700", color: Colors.text.secondary, letterSpacing: 0.6 },

  sweatCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.states.BALANCED.dim,
  },
  sweatCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.states.BALANCED.dim,
  },
  sweatCtaTitle: { color: Colors.text.primary, fontSize: 14, fontWeight: "700" },
  sweatCtaSub: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
});
