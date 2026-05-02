/**
 * Phase 3 — Guardian Intelligence (Protect the Roster).
 * Demo experience gated behind `guardian_intelligence_enabled`.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { FeatureGate } from '@/components/FeatureGate';
import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';
import { mockRoster } from '@/data/mockData';
import { guardianRiskScore, guardianTier, guardianRecommendation } from '@/utils/scoringEngine';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

const TIER_COLOR: Record<string, string> = {
  OPTIMAL: Colors.states.PEAK.primary,
  WATCH: Colors.states.BALANCED.primary,
  MODERATE: Colors.states.RECOVERING.primary,
  CRITICAL: Colors.states.DEPLETED.primary,
};

export default function GuardianScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const layout = useResponsiveLayout();
  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom;

  // Mock the user's own Guardian risk
  const ownRisk = guardianRiskScore({
    hydrationPercent: state.engineOutput.score,
    bodyWeightLbs: state.userState.bodyWeightLbs,
    activeMinutes: 90,
    heatIndex: 88,
    sweatRate: state.userState.sweatRate,
    coreTempEstimate: 99.4,
    quarter: 3,
    pH: 6.8,
  });
  const ownTier = guardianTier(ownRisk);

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 },
            // Cap line length on Fold-open / tablet so risk cards and
            // body-map panels stay readable rather than stretching.
            layout.isWide && {
              maxWidth: layout.contentMaxWidth,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={20} color={Colors.text.secondary} />
            <Text style={styles.backText}>Profile</Text>
          </Pressable>

          <Text style={[styles.eyebrow, { color: Colors.guardian.primary }]}>PHASE 3 · GUARDIAN</Text>
          <Text style={styles.title}>Protect the Roster</Text>

          <FeatureGate
            flag="guardian_intelligence_enabled"
            title="Guardian Intelligence"
            description="Per-athlete risk scoring across hydration, heat, exertion, core temp, and pH. Critical alerts and roster-wide protection."
            accentColor={Colors.guardian.primary}
          >
            {/* Personal risk score */}
            <View style={[styles.riskCard, { borderColor: `${TIER_COLOR[ownTier]}55` }]}>
              <Text style={styles.riskLabel}>YOUR GUARDIAN RISK</Text>
              <Text style={[styles.riskScore, { color: TIER_COLOR[ownTier] }]}>{ownRisk}</Text>
              <Text style={[styles.riskTier, { color: TIER_COLOR[ownTier] }]}>{ownTier}</Text>
              <Text style={styles.riskDesc}>
                Composite of hydration, heat index, exertion, core temp, pH and quarter.
              </Text>
            </View>

            {/* Body Risk Map (simplified placeholder) */}
            {state.featureFlags.guardian_body_map_enabled ? (
              <View style={styles.bodyMap}>
                <Text style={styles.sectionLabel}>BODY RISK MAP</Text>
                <View style={styles.bodyRow}>
                  <BodyZone label="Head" risk={ownRisk * 0.4} />
                  <BodyZone label="Core" risk={ownRisk} />
                  <BodyZone label="Arms" risk={ownRisk * 0.6} />
                </View>
                <View style={styles.bodyRow}>
                  <BodyZone label="Legs" risk={ownRisk * 0.85} />
                  <BodyZone label="Feet" risk={ownRisk * 0.5} />
                  <BodyZone label="Back" risk={ownRisk * 0.7} />
                </View>
              </View>
            ) : (
              <Text style={styles.lockedHint}>Body Risk Map locked. Enable in Profile.</Text>
            )}

            {/* Roster monitoring */}
            <Text style={styles.sectionLabel}>ROSTER MONITORING</Text>
            <View style={styles.rosterList}>
              {mockRoster.map((p) => {
                const tier = guardianTier(p.guardianRisk);
                const color = TIER_COLOR[tier];
                const rec = guardianRecommendation({ guardianRisk: p.guardianRisk, position: p.position });
                const isPull = rec.action === 'pull';
                return (
                  <View key={p.id} style={[styles.rosterRow, { borderLeftColor: color }]}>
                    <View style={styles.rosterTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rosterName}>{p.name} · {p.position}</Text>
                        <Text style={styles.rosterMeta}>Hydration {p.hydrationScore}</Text>
                      </View>
                      <Text style={[styles.rosterRisk, { color }]}>{p.guardianRisk}</Text>
                      <View style={[styles.tierTag, { backgroundColor: `${color}1A`, borderColor: `${color}55` }]}>
                        <Text style={[styles.tierTagText, { color }]}>{tier}</Text>
                      </View>
                    </View>
                    <Text style={[styles.rosterRecCommand, isPull && { color: Colors.danger }]}>
                      {rec.command}
                    </Text>
                    <Text style={styles.rosterRecDetail}>{rec.detail}</Text>
                    <View style={styles.rosterRecMeta}>
                      <Text style={styles.rosterRecChip}>{rec.fluidOz} ounces</Text>
                      {rec.sticks > 0 && (
                        <Text style={styles.rosterRecChip}>{rec.sticks} stick{rec.sticks > 1 ? 's' : ''}</Text>
                      )}
                      <Text style={styles.rosterRecChip}>recheck {rec.recheckMinutes}m</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Critical alerts — auto-generated for every CRITICAL athlete */}
            {state.featureFlags.guardian_alerts_enabled && (() => {
              const critical = mockRoster.filter((p) => guardianTier(p.guardianRisk) === 'CRITICAL');
              if (critical.length === 0) {
                return (
                  <View style={[styles.alertCard, styles.alertCardClear, { borderColor: `${Colors.states.PEAK.primary}55` }]}>
                    <Feather name="check-circle" size={18} color={Colors.states.PEAK.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, { color: Colors.states.PEAK.primary }]}>NO CRITICAL ALERTS</Text>
                      <Text style={styles.alertBody}>Roster within safe bounds. Continue standard monitoring.</Text>
                    </View>
                  </View>
                );
              }
              return (
                <>
                  <Text style={styles.sectionLabel}>
                    CRITICAL ALERTS · {critical.length} ATHLETE{critical.length > 1 ? 'S' : ''}
                  </Text>
                  {critical.map((p) => {
                    const rec = guardianRecommendation({ guardianRisk: p.guardianRisk, position: p.position });
                    return (
                      <View key={p.id} style={[styles.alertCard, { borderColor: Colors.danger }]}>
                        <Feather name="alert-octagon" size={18} color={Colors.danger} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.alertTitle}>CRITICAL · {p.name} ({p.position})</Text>
                          <Text style={styles.alertBody}>
                            Risk {p.guardianRisk}. {rec.command} {rec.detail}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              );
            })()}

            <Text style={styles.thresholdNote}>
              Tiers — OPTIMAL 0–24 · WATCH 25–49 · MODERATE 50–74 · CRITICAL 75–100
            </Text>
          </FeatureGate>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function BodyZone({ label, risk }: { label: string; risk: number }) {
  const tier = guardianTier(Math.round(risk));
  const color = TIER_COLOR[tier];
  return (
    <View style={[styles.bodyZone, { borderColor: `${color}55`, backgroundColor: `${color}10` }]}>
      <Text style={styles.bodyZoneLabel}>{label}</Text>
      <Text style={[styles.bodyZoneRisk, { color }]}>{Math.round(risk)}</Text>
      <Text style={[styles.bodyZoneTier, { color }]}>{tier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, marginBottom: 4 },
  backText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 3, marginTop: 4 },
  title: {
    fontSize: 30, fontFamily: 'Inter_700Bold', color: Colors.text.primary,
    letterSpacing: -0.5, marginTop: 6, marginBottom: 24,
  },
  riskCard: {
    backgroundColor: Colors.background.card, borderRadius: 18, borderWidth: 1,
    padding: 22, alignItems: 'center', marginBottom: 22,
  },
  riskLabel: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 2.5, marginBottom: 6,
  },
  riskScore: {
    fontSize: 64, fontFamily: 'Inter_700Bold', letterSpacing: -3, lineHeight: 70,
  },
  riskTier: {
    fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 2, marginTop: 4, marginBottom: 10,
  },
  riskDesc: {
    fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.secondary,
    textAlign: 'center', lineHeight: 17,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 2.5, marginBottom: 10, marginTop: 4,
  },
  bodyMap: { marginBottom: 22 },
  bodyRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  bodyZone: {
    flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 2,
  },
  bodyZoneLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.text.secondary },
  bodyZoneRisk: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  bodyZoneTier: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  lockedHint: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted,
    fontStyle: 'italic', marginBottom: 22,
  },
  rosterList: {
    backgroundColor: Colors.background.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border.subtle, marginBottom: 22, overflow: 'hidden',
  },
  rosterRow: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderLeftWidth: 3,
    borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
  },
  rosterTop: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  rosterName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary },
  rosterMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted, marginTop: 2 },
  rosterRisk: { fontSize: 18, fontFamily: 'Inter_700Bold', minWidth: 32, textAlign: 'right' },
  tierTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1,
  },
  tierTagText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
  rosterRecCommand: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary,
    lineHeight: 16, marginTop: 10,
  },
  rosterRecDetail: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.secondary,
    lineHeight: 15, marginTop: 2,
  },
  rosterRecMeta: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8,
  },
  rosterRecChip: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 1, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, backgroundColor: Colors.background.primary,
  },
  alertCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: 'rgba(255,45,85,0.08)', borderRadius: 16, borderWidth: 1,
    padding: 14, marginBottom: 12,
  },
  alertCardClear: {
    backgroundColor: 'rgba(180,255,80,0.06)', marginBottom: 18,
  },
  alertTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: Colors.danger, letterSpacing: 1.5, marginBottom: 4,
  },
  alertBody: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.primary, lineHeight: 17 },
  thresholdNote: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.text.muted,
    textAlign: 'center', marginBottom: 12, fontStyle: 'italic',
  },
});
