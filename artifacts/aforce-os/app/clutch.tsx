/**
 * Phase 2 — Clutch Access (Command the Team).
 * Demo experience gated behind `clutch_access_enabled`.
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
import { clutchHydrationPlan, clutchTier, clutchRecommendation } from '@/utils/scoringEngine';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export default function ClutchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const layout = useResponsiveLayout();
  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom;
  const heatModeOn = state.featureFlags.clutch_heat_mode_enabled;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 },
            // Cap line length on Fold-open / tablet so the roster
            // grid and command panels don't sprawl edge-to-edge.
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

          <Text style={[styles.eyebrow, { color: Colors.clutch.primary }]}>PHASE 2 · CLUTCH</Text>
          <Text style={styles.title}>Command the Team</Text>

          <FeatureGate
            flag="clutch_access_enabled"
            title="Clutch Access"
            description="Live game commands, weight-based hydration engine, team grid, heat mode, and auto-replenish. Activate to preview."
            accentColor={Colors.clutch.primary}
          >
            {/* Live Command Grid */}
            <Text style={styles.sectionLabel}>LIVE COMMAND GRID</Text>
            <View style={styles.rosterGrid}>
              {mockRoster.map((p) => {
                const tier = clutchTier(p.hydrationScore);
                const tierColor =
                  tier === 'PLATINUM' ? '#FFFFFF' :
                  tier === 'STABLE' ? Colors.states.BALANCED.primary :
                  tier === 'RECOVERY' ? Colors.states.RECOVERING.primary :
                  Colors.states.DEPLETED.primary;
                const rec = clutchRecommendation({ hydrationScore: p.hydrationScore, position: p.position });
                const isPull = rec.action === 'pull';
                return (
                  <View key={p.id} style={[styles.playerCard, { borderColor: `${tierColor}55` }]}>
                    <View style={styles.playerHeader}>
                      <Text style={styles.playerPos}>{p.position}</Text>
                      <View style={[styles.led, { backgroundColor: tierColor }]} />
                    </View>
                    <Text style={styles.playerName}>{p.name}</Text>
                    <Text style={[styles.playerScore, { color: tierColor }]}>{p.hydrationScore}</Text>
                    <Text style={styles.playerTier}>{tier}</Text>

                    <View style={[styles.recDivider, { backgroundColor: `${tierColor}33` }]} />
                    <Text style={[styles.recCommand, isPull && { color: Colors.states.DEPLETED.primary }]}>
                      {rec.command}
                    </Text>
                    <Text style={styles.recDetail}>{rec.detail}</Text>
                    <View style={styles.recMeta}>
                      <Text style={styles.recMetaItem}>{rec.fluidOz} oz</Text>
                      {rec.sticks > 0 && <Text style={styles.recMetaItem}>{rec.sticks} stick{rec.sticks > 1 ? 's' : ''}</Text>}
                      <Text style={styles.recMetaItem}>recheck {rec.recheckMinutes}m</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Weight-based plan */}
            <Text style={styles.sectionLabel}>WEIGHT-BASED HYDRATION PLAN</Text>
            <View style={styles.planCard}>
              {(() => {
                const plan = clutchHydrationPlan(state.userState.bodyWeightLbs, 4);
                return (
                  <>
                    <PlanRow label="Daily baseline" value={`${plan.dailyBaselineOz} oz`} />
                    <PlanRow label="Game target (4 active windows)" value={`${plan.gameTargetOz} oz`} />
                    <PlanRow label="Sticks needed" value={`${plan.sticksNeeded}`} accent={Colors.clutch.primary} />
                  </>
                );
              })()}
              <Text style={styles.formulaNote}>
                Formula: 0.5 × bodyweight (baseline) + 12 × active 30-min windows.
              </Text>
            </View>

            {/* Heat mode */}
            <View style={[
              styles.heatCard,
              { borderColor: heatModeOn ? Colors.states.RECOVERING.primary : Colors.border.medium },
            ]}>
              <View style={styles.heatHeader}>
                <Feather name="thermometer" size={18} color={heatModeOn ? Colors.states.RECOVERING.primary : Colors.text.muted} />
                <Text style={[styles.heatLabel, { color: heatModeOn ? Colors.states.RECOVERING.primary : Colors.text.secondary }]}>
                  HEAT MODE {heatModeOn ? 'ACTIVE' : 'STANDBY'}
                </Text>
              </View>
              <Text style={styles.heatDesc}>
                {heatModeOn
                  ? 'Forced 15-minute recheck cadence. Team-wide stick deployment recommended.'
                  : 'Activate to enforce aggressive recheck windows under heat stress.'}
              </Text>
            </View>

            <Text style={styles.sectionLabel}>OPERATIONS</Text>
            <View style={styles.opsList}>
              <OpsRow icon="user-plus" label="Roster import" status="Coming Soon" />
              <OpsRow icon="package" label="Auto replenish inventory" status={state.featureFlags.clutch_inventory_enabled ? 'Active' : 'Standby'} />
              <OpsRow icon="users" label="Staff coach view" status="Active" />
              <OpsRow icon="wifi-off" label="Offline game mode" status="Coming Soon" />
              <OpsRow icon="cpu" label="CLUTCH Clip pairing" status={state.featureFlags.clutch_clip_enabled ? 'Active' : 'Inactive'} />
            </View>
          </FeatureGate>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function PlanRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.planRow}>
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={[styles.planValue, accent && { color: accent }]}>{value}</Text>
    </View>
  );
}

function OpsRow({ icon, label, status }: { icon: keyof typeof Feather.glyphMap; label: string; status: string }) {
  const active = status === 'Active';
  return (
    <View style={styles.opsRow}>
      <Feather name={icon} size={16} color={active ? Colors.clutch.primary : Colors.text.muted} />
      <Text style={styles.opsLabel}>{label}</Text>
      <Text style={[styles.opsStatus, active && { color: Colors.clutch.primary }]}>{status}</Text>
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
  sectionLabel: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 2.5, marginBottom: 10, marginTop: 8,
  },
  rosterGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22,
  },
  playerCard: {
    width: '48%', padding: 14, borderRadius: 14,
    borderWidth: 1, backgroundColor: Colors.background.card,
  },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  playerPos: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5 },
  led: { width: 8, height: 8, borderRadius: 4 },
  playerName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary, marginBottom: 8 },
  playerScore: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  playerTier: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5, marginTop: 2 },
  recDivider: { height: 1, marginTop: 10, marginBottom: 8 },
  recCommand: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary, lineHeight: 15,
  },
  recDetail: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, lineHeight: 14, marginTop: 2,
  },
  recMeta: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6,
  },
  recMetaItem: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, backgroundColor: Colors.background.primary,
  },
  planCard: {
    backgroundColor: Colors.background.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border.subtle, padding: 16, marginBottom: 22,
  },
  planRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  planLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },
  planValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.3 },
  formulaNote: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.text.muted,
    marginTop: 8, fontStyle: 'italic',
  },
  heatCard: {
    backgroundColor: Colors.background.card, borderRadius: 16, borderWidth: 1,
    padding: 16, marginBottom: 22,
  },
  heatHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  heatLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  heatDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, lineHeight: 17 },
  opsList: {
    backgroundColor: Colors.background.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border.subtle, marginBottom: 24, overflow: 'hidden',
  },
  opsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
  },
  opsLabel: { fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.text.primary, flex: 1 },
  opsStatus: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5 },
});
