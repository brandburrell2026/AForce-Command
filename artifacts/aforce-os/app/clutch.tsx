/**
 * Phase 2 — Clutch Access (Command the Team).
 * Demo experience gated behind `clutch_access_enabled`.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { useRouter } from 'expo-router';

import { FeatureGate } from '@/components/FeatureGate';
import { AFScreen, AFMasthead, AFCard, AFSectionLabel } from '@/components/ui';
import { Colors } from '@/theme/colors';
import { af, afType, Spacing } from '@/theme';
import { useAFEyebrowType } from '@/hooks/useAFEyebrowType';
import { useAppStore } from '@/store/useAppStore';
import { mockRosterClutch as mockRoster, CLUTCH_TEAM_NAME as TEAM_NAME } from '@/data/mockData';
import { clutchHydrationPlan, clutchTier, clutchRecommendation } from '@/utils/scoringEngine';
import { WEB_TOP_PADDING, WEB_BOTTOM_INSET } from '@/constants/layout';
import { EditorialClutchLandingScreen } from '@/components/skinIntelligence/SkinIntelligenceEditorialSuite';

// Two-column grid floor: each card needs this much width before the grid
// wraps to one column. Scales with Dynamic Type so large text reflows to a
// single column instead of clipping (never a fixed 50%).
const PLAYER_CARD_MIN_WIDTH = 150;

export function LegacyClutchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const eyebrowType = useAFEyebrowType();
  const { fontScale } = useWindowDimensions();
  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_INSET : insets.bottom;
  const heatModeOn = state.featureFlags.clutch_heat_mode_enabled;
  const cardMinWidth = Math.round(PLAYER_CARD_MIN_WIDTH * Math.max(1, fontScale));

  return (
    <AFScreen
      scroll
      edges={[]}
      contentContainerStyle={{ paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 }}
    >
      <AFMasthead
        onBack={() => router.back()}
        backLabel="Back"
        breadcrumb={`CLUTCH / PHASE 2 · ${TEAM_NAME}`}
        title="Command the team."
      />

      <FeatureGate
        flag="clutch_access_enabled"
        title="Clutch Access"
        description="Live game commands, weight-based hydration engine, team grid, heat mode, and auto-replenish. Activate to preview."
        accentColor={Colors.clutch.primary}
      >
        {/* Live Command Grid */}
        <View style={styles.section}>
          <AFSectionLabel label="Live command grid" meta={`${mockRoster.length} players`} />
        </View>
        <View style={styles.rosterGrid}>
          {mockRoster.map((p) => {
            const tier = clutchTier(p.hydrationScore);
            const tierColor =
              tier === 'PLATINUM' ? af.textPrimary :
              tier === 'STABLE' ? Colors.states.BALANCED.primary :
              tier === 'RECOVERY' ? Colors.states.RECOVERING.primary :
              Colors.states.DEPLETED.primary;
            const rec = clutchRecommendation({ hydrationScore: p.hydrationScore, position: p.position });
            const isPull = rec.action === 'pull';
            // Alert card = the depleted / recovery bands, derived from the
            // engine's own tier — never from a name or position.
            const isAlert = tier === 'DEPLETED' || tier === 'RECOVERY';
            const chips = [
              `${rec.fluidOz} oz`,
              ...(rec.sticks > 0 ? [`${rec.sticks} stick${rec.sticks > 1 ? 's' : ''}`] : []),
              `recheck ${rec.recheckMinutes}m`,
            ];
            return (
              <AFCard
                key={p.id}
                variant={isAlert ? 'alert' : 'standard'}
                padded={false}
                style={[
                  styles.playerCard,
                  { minWidth: cardMinWidth, flexBasis: cardMinWidth },
                  tier === 'PLATINUM' && { borderColor: tierColor },
                ]}
                accessibilityLabel={`${p.name}, ${p.position}. ${p.hydrationScore}, ${tier}. ${rec.command} ${rec.detail} ${rec.fluidOz} ounces${rec.sticks > 0 ? `, ${rec.sticks} stick${rec.sticks > 1 ? 's' : ''}` : ''}, recheck ${rec.recheckMinutes} minutes.`}
              >
                <View style={styles.playerHeader}>
                  <Text style={[styles.playerPos, eyebrowType]}>{p.position}</Text>
                  <View
                    style={[styles.led, { backgroundColor: tierColor }]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                </View>
                <Text style={styles.playerName}>{p.name}</Text>
                <Text style={[styles.playerScore, { color: tierColor }]}>{p.hydrationScore}</Text>
                <Text style={[styles.playerTier, eyebrowType]}>{tier}</Text>

                <View style={[styles.recDivider, isAlert && styles.recDividerAlert]} />
                <Text style={[styles.recCommand, isPull && { color: Colors.states.DEPLETED.primary }]}>
                  {rec.command}
                </Text>
                <Text style={styles.recDetail}>{rec.detail}</Text>
                <View style={styles.recMeta}>
                  {chips.map((chip) => (
                    <Text key={chip} style={[styles.recMetaItem, eyebrowType]}>{chip.toUpperCase()}</Text>
                  ))}
                </View>
              </AFCard>
            );
          })}
        </View>

        {/* Weight-based plan */}
        <View style={styles.section}>
          <AFSectionLabel label="Weight-based hydration plan" />
        </View>
        <AFCard style={styles.block}>
          {(() => {
            const plan = clutchHydrationPlan(state.userState.bodyWeightLbs, 4);
            return (
              <>
                <PlanRow label="Daily baseline" value={`${plan.dailyBaselineOz} ounces`} />
                <PlanRow label="Game target (4 active windows)" value={`${plan.gameTargetOz} ounces`} />
                <PlanRow label="Sticks needed" value={`${plan.sticksNeeded}`} accent={Colors.clutch.primary} />
              </>
            );
          })()}
          <Text style={styles.formulaNote}>
            Formula: 0.5 × bodyweight (baseline) + 12 × active 30-min windows.
          </Text>
        </AFCard>

        {/* Heat mode */}
        <AFCard style={[styles.block, { borderColor: heatModeOn ? af.amber : af.border }]}>
          <View style={styles.heatHeader}>
            <Icon name="thermometer" size={18} color={heatModeOn ? af.amber : af.textTertiary} />
            <Text style={[styles.heatLabel, eyebrowType, { color: heatModeOn ? af.amber : af.textSecondary }]}>
              HEAT MODE {heatModeOn ? 'ACTIVE' : 'STANDBY'}
            </Text>
          </View>
          <Text style={styles.heatDesc}>
            {heatModeOn
              ? 'Forced 15-minute recheck cadence. Team-wide stick deployment recommended.'
              : 'Activate to enforce aggressive recheck windows under heat stress.'}
          </Text>
        </AFCard>

        <View style={styles.section}>
          <AFSectionLabel label="Operations" />
        </View>
        <AFCard padded={false} style={styles.opsList}>
          <OpsRow icon="user-plus" label="Roster import" status="Coming Soon" />
          <OpsRow icon="package" label="Auto replenish inventory" status={state.featureFlags.clutch_inventory_enabled ? 'Active' : 'Standby'} />
          <OpsRow icon="users" label="Staff coach view" status="Active" />
          <OpsRow icon="wifi-off" label="Offline game mode" status="Coming Soon" />
          <OpsRow icon="cpu" label="CLUTCH Clip pairing" status={state.featureFlags.clutch_clip_enabled ? 'Active' : 'Inactive'} last />
        </AFCard>
      </FeatureGate>
    </AFScreen>
  );
}

export default function ClutchScreen() {
  if (process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true') {
    return <EditorialClutchLandingScreen />;
  }
  return <LegacyClutchScreen />;
}

function PlanRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.planRow}>
      <Text style={styles.planLabel}>{label}</Text>
      <Text style={[styles.planValue, accent && { color: accent }]}>{value}</Text>
    </View>
  );
}

function OpsRow({ icon, label, status, last }: { icon: IconName; label: string; status: string; last?: boolean }) {
  const active = status === 'Active';
  const eyebrowType = useAFEyebrowType();
  return (
    <View style={[styles.opsRow, last && styles.opsRowLast]}>
      <Icon name={icon} size={16} color={active ? Colors.clutch.primary : af.textTertiary} />
      <Text style={styles.opsLabel}>{label}</Text>
      <Text style={[styles.opsStatus, eyebrowType, active && { color: Colors.clutch.primary }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing[6], marginBottom: Spacing[3] },
  block: { marginBottom: Spacing[5] },
  rosterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing[5] },
  playerCard: { flexGrow: 1, padding: Spacing[4] },
  playerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  playerPos: { ...afType.micro, color: af.textTertiary },
  led: { width: 8, height: 8, borderRadius: 4 },
  playerName: { ...afType.bodyStrong, color: af.textPrimary, marginBottom: 4 },
  playerScore: { ...afType.title1, fontVariant: ['tabular-nums'] },
  playerTier: { ...afType.micro, color: af.textSecondary, marginTop: 2 },
  recDivider: { height: 1, marginTop: 12, marginBottom: 10, backgroundColor: af.divider },
  recDividerAlert: { backgroundColor: af.borderAlert },
  recCommand: { ...afType.bodyStrong, fontSize: 14, lineHeight: 19, color: af.textPrimary },
  recDetail: { ...afType.caption, color: af.textSecondary, marginTop: 4 },
  recMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  recMetaItem: {
    ...afType.micro, color: af.textSecondary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    borderWidth: 1, borderColor: af.border, backgroundColor: af.canvas,
  },
  planRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingVertical: 8,
  },
  planLabel: { ...afType.caption, color: af.textSecondary, flexShrink: 1 },
  planValue: { ...afType.bodyStrong, color: af.textPrimary },
  formulaNote: { ...afType.caption, color: af.textTertiary, marginTop: 8, fontStyle: 'italic' },
  heatHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  heatLabel: { ...afType.eyebrow },
  heatDesc: { ...afType.caption, color: af.textSecondary },
  opsList: { marginBottom: Spacing[5], overflow: 'hidden' },
  opsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, minHeight: 48,
    borderBottomWidth: 1, borderBottomColor: af.divider,
  },
  opsRowLast: { borderBottomWidth: 0 },
  opsLabel: { ...afType.caption, fontSize: 14, color: af.textPrimary, flex: 1 },
  opsStatus: { ...afType.micro, color: af.textTertiary },
});
