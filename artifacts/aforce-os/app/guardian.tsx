/**
 * Phase 3 — Guardian Intelligence (Protect the Roster).
 * Demo experience gated behind `guardian_intelligence_enabled`.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { FeatureGate } from '@/components/FeatureGate';
import { AFCard, AFMasthead, AFSectionLabel, AFStatusBadge, type AFStatusTone } from '@/components/ui';
import { Colors } from '@/theme/colors';
import { af, afType, afLayout, AF_MAX_DISPLAY_FONT_SCALE, withAlpha, afAlpha } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import { mockRosterGuardian as mockRoster, GUARDIAN_TEAM_NAME as TEAM_NAME } from '@/data/mockData';
import { guardianRiskScore, guardianTier, guardianRecommendation } from '@/utils/scoringEngine';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { useAFGutter } from '@/hooks/useAFGutter';
import { WEB_TOP_PADDING, WEB_BOTTOM_INSET } from '@/constants/layout';
import { EditorialGuardianLandingScreen } from '@/components/skinIntelligence/SkinIntelligenceEditorialSuite';

type GuardianTierWord = ReturnType<typeof guardianTier>;

// Status colours stay system-sourced (Black Issue D3): the tier palette is the
// hydration state palette it has always been. Only the red INK is swapped for
// the AA red-text token (D1) — the fill/edge colour stays the system value.
const TIER_COLOR: Record<string, string> = {
  OPTIMAL: Colors.states.PEAK.primary,
  WATCH: Colors.states.BALANCED.primary,
  MODERATE: Colors.states.RECOVERING.primary,
  CRITICAL: Colors.states.DEPLETED.primary,
};

// AFStatusBadge tones whose colours are the same system colours as TIER_COLOR.
const TIER_TONE: Record<GuardianTierWord, AFStatusTone> = {
  OPTIMAL: 'positive',
  WATCH: 'info',
  MODERATE: 'caution',
  CRITICAL: 'critical',
};

/** Text colour for a tier word / numeral: the system status colour (D3 — never overridden; #FF2800 clears AA on every Guardian surface). */
function tierInk(tier: string): string {
  return TIER_COLOR[tier];
}

export function LegacyGuardianScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const layout = useResponsiveLayout();
  const gutter = useAFGutter();
  const eyebrowType = useAFEyebrowType();
  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_INSET : insets.bottom;

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
  const COMPOSITE = 'Composite of hydration, heat index, exertion, core temp, pH and quarter.';

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: gutter, paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 },
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
          <AFMasthead
            breadcrumb={`Guardian / Phase 3 · ${TEAM_NAME}`}
            title="Protect the roster."
            onBack={() => router.back()}
            backLabel="Profile"
            testID="guardian-masthead"
          />

          <FeatureGate
            flag="guardian_intelligence_enabled"
            title="Guardian Intelligence"
            description="Per-athlete risk scoring across hydration, heat, exertion, core temp, and pH. Critical alerts and roster-wide protection."
            accentColor={Colors.guardian.primary}
          >
            {/* Personal risk score */}
            <AFCard
              variant={ownTier === 'CRITICAL' ? 'alert' : 'standard'}
              style={[styles.riskCard, ownTier !== 'CRITICAL' && { borderColor: `${TIER_COLOR[ownTier]}55` }]}
              accessibilityLabel={`Your Guardian risk ${ownRisk}, ${ownTier}. ${COMPOSITE}`}
              testID="guardian-risk-card"
            >
              <Text style={[styles.riskLabel, eyebrowType]}>YOUR GUARDIAN RISK</Text>
              <Text
                style={[styles.riskScore, { color: tierInk(ownTier) }]}
                maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
              >
                {ownRisk}
              </Text>
              <Text style={[styles.riskTier, eyebrowType, { color: tierInk(ownTier) }]}>{ownTier}</Text>
              <Text style={[styles.riskDesc, eyebrowType]}>{COMPOSITE.toUpperCase()}</Text>
            </AFCard>

            {/* Body Risk Map (simplified placeholder) */}
            {state.featureFlags.guardian_body_map_enabled ? (
              <View style={styles.section}>
                <AFSectionLabel label="Body risk map" />
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
              <Text style={[styles.lockedHint, eyebrowType]}>BODY RISK MAP LOCKED · ENABLE IN PROFILE</Text>
            )}

            {/* Roster monitoring */}
            <View style={styles.section}>
              <AFSectionLabel label="Roster monitoring" meta={`${mockRoster.length} ${mockRoster.length === 1 ? 'athlete' : 'athletes'}`} />
              <View style={styles.rosterList}>
                {mockRoster.map((p) => {
                  const tier = guardianTier(p.guardianRisk);
                  const color = TIER_COLOR[tier];
                  const rec = guardianRecommendation({ guardianRisk: p.guardianRisk, position: p.position });
                  // Red command line only for a pull (as on main); the word, bar and numeral carry the tier.
                  const escalated = rec.action === 'pull';
                  const stickLabel = rec.sticks > 0 ? `${rec.sticks} stick${rec.sticks > 1 ? 's' : ''}` : null;
                  return (
                    <AFCard
                      key={p.id}
                      padded={false}
                      style={styles.rosterRow}
                      accessibilityLabel={
                        `${p.name}, ${p.position}. Hydration ${p.hydrationScore}. Risk ${p.guardianRisk}, ${tier}. ` +
                        `${rec.command} ${rec.detail} ${rec.fluidOz} ounces` +
                        `${stickLabel ? `, ${stickLabel}` : ''}, recheck ${rec.recheckMinutes} minutes.`
                      }
                      testID={`guardian-roster-${p.id}`}
                    >
                      <View style={[styles.accentBar, { backgroundColor: color }]} />
                      <View style={styles.rosterBody}>
                        <View style={styles.rosterTop}>
                          <View style={styles.rosterId}>
                            <Text style={styles.rosterName}>{p.name} · {p.position}</Text>
                            <Text style={[styles.rosterMeta, eyebrowType]}>HYDRATION {p.hydrationScore}</Text>
                          </View>
                          <View style={styles.rosterStatus}>
                            <Text style={[styles.rosterRisk, { color: tierInk(tier) }]}>{p.guardianRisk}</Text>
                            <AFStatusBadge label={tier} tone={TIER_TONE[tier]} />
                          </View>
                        </View>
                        <Text style={[styles.rosterRecCommand, escalated && { color: af.redText }]}>
                          {rec.command}
                        </Text>
                        <Text style={styles.rosterRecDetail}>{rec.detail}</Text>
                        <View style={styles.rosterRecMeta}>
                          <Text style={[styles.rosterRecChip, eyebrowType]}>{rec.fluidOz} OZ</Text>
                          {stickLabel && (
                            <Text style={[styles.rosterRecChip, eyebrowType]}>{stickLabel.toUpperCase()}</Text>
                          )}
                          <Text style={[styles.rosterRecChip, eyebrowType]}>RECHECK {rec.recheckMinutes}M</Text>
                        </View>
                      </View>
                    </AFCard>
                  );
                })}
              </View>
            </View>

            {/* Critical alerts — auto-generated for every CRITICAL athlete */}
            {state.featureFlags.guardian_alerts_enabled && (() => {
              const critical = mockRoster.filter((p) => guardianTier(p.guardianRisk) === 'CRITICAL');
              if (critical.length === 0) {
                return (
                  <View style={[styles.alertCard, styles.alertCardClear, { borderColor: withAlpha(af.green, afAlpha.a34) }]}>
                    <Icon name="check-circle" size={18} color={Colors.states.PEAK.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, { color: Colors.states.PEAK.primary }]}>NO CRITICAL ALERTS</Text>
                      <Text style={styles.alertBody}>Roster within safe bounds. Continue standard monitoring.</Text>
                    </View>
                  </View>
                );
              }
              return (
                <View style={styles.section}>
                  <AFSectionLabel
                    label="Critical alerts"
                    meta={`${critical.length} athlete${critical.length > 1 ? 's' : ''}`}
                  />
                  {critical.map((p) => {
                    const rec = guardianRecommendation({ guardianRisk: p.guardianRisk, position: p.position });
                    return (
                      <View key={p.id} style={[styles.alertCard, { borderColor: af.borderAlert }]}>
                        <Icon name="alert-octagon" size={18} color={af.redText} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.alertTitle}>CRITICAL · {p.name} ({p.position})</Text>
                          <Text style={styles.alertBody}>
                            Risk {p.guardianRisk}. {rec.command} {rec.detail}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            <Text style={[styles.thresholdNote, eyebrowType]}>
              TIERS — OPTIMAL 0–24 · WATCH 25–49 · MODERATE 50–74 · CRITICAL 75–100
            </Text>
          </FeatureGate>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

export default function GuardianScreen() {
  if (process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true') {
    return <EditorialGuardianLandingScreen />;
  }
  return <LegacyGuardianScreen />;
}

function BodyZone({ label, risk }: { label: string; risk: number }) {
  const tier = guardianTier(Math.round(risk));
  const color = TIER_COLOR[tier];
  const eyebrowType = useAFEyebrowType();
  return (
    <View
      style={[styles.bodyZone, { borderColor: `${color}55`, backgroundColor: `${color}10` }]}
      accessible
      accessibilityLabel={`${label}, risk ${Math.round(risk)}, ${tier}`}
    >
      <Text style={styles.bodyZoneLabel}>{label}</Text>
      <Text style={[styles.bodyZoneRisk, { color: tierInk(tier) }]}>{Math.round(risk)}</Text>
      <Text style={[styles.bodyZoneTier, eyebrowType, { color: tierInk(tier) }]}>{tier}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { gap: 20 },
  section: { gap: 12 },
  riskCard: { alignItems: 'center', gap: 4, paddingVertical: 24 },
  riskLabel: { ...afType.eyebrow, color: af.textSecondary },
  riskScore: { ...afType.displayScore, textAlign: 'center' },
  riskTier: { ...afType.eyebrow },
  riskDesc: { ...afType.eyebrow, color: af.textSecondary, textAlign: 'center', marginTop: 6 },
  bodyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bodyZone: {
    flexGrow: 1, flexBasis: 90, padding: 12, borderRadius: afLayout.radiusCard, borderWidth: 1,
    alignItems: 'center', gap: 2,
  },
  bodyZoneLabel: { ...afType.secondary, color: af.textSecondary },
  bodyZoneRisk: { ...afType.title3 },
  bodyZoneTier: { ...afType.eyebrow },
  lockedHint: { ...afType.eyebrow, color: af.textTertiary },
  rosterList: { gap: 12 },
  rosterRow: { overflow: 'hidden' },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  rosterBody: { paddingVertical: 16, paddingRight: 16, paddingLeft: 20, gap: 8 },
  rosterTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  rosterId: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0, gap: 2 },
  rosterStatus: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  rosterName: { ...afType.bodyStrong, color: af.textPrimary },
  rosterMeta: { ...afType.eyebrow, color: af.textSecondary },
  rosterRisk: { ...afType.title3, minWidth: 32, textAlign: 'right' },
  rosterRecCommand: { ...afType.bodyStrong, fontSize: 15, lineHeight: 21, color: af.textPrimary },
  rosterRecDetail: { ...afType.secondary, color: af.textSecondary },
  rosterRecMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  rosterRecChip: {
    ...afType.eyebrow, color: af.textSecondary, minHeight: 24, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: af.border, backgroundColor: af.surfaceRaised, overflow: 'hidden',
  },
  alertCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: af.surfaceAlert, borderRadius: afLayout.radiusCard, borderWidth: 1,
    padding: 14,
  },
  alertCardClear: {
    backgroundColor: withAlpha(af.green, afAlpha.a06),
  },
  alertTitle: { ...afType.eyebrow, color: af.redText, marginBottom: 4 },
  alertBody: { ...afType.secondary, color: af.textPrimary },
  thresholdNote: { ...afType.eyebrow, color: af.textTertiary, textAlign: 'center' },
});
