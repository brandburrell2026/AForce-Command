/**
 * Profile & Settings — goals, weight, activity type, hardware pairing,
 * subscription tier, and the demo Feature Flag panel that previews
 * Phase 2 (Clutch) and Phase 3 (Guardian).
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { mockUserProfile } from '@/data/mockData';
import { useAppStore } from '@/store/useAppStore';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '@/featureFlags/flags';
import type { FeatureFlags } from '@/types';

const TIER_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  core:       { label: 'AForce Core',        desc: 'Athlete OS — Phase 1 hydration intelligence.',         color: Colors.states.BALANCED.primary },
  core_team:  { label: 'AForce Core Team',   desc: 'Programs & coaches. Roster-aware Core.',              color: Colors.states.BALANCED.primary },
  clutch:     { label: 'AForce Clutch',      desc: 'Live game commands + heat mode + team grid.',         color: Colors.clutch.primary },
  guardian:   { label: 'AForce Guardian',    desc: 'Roster protection. Risk monitoring + alerts.',         color: Colors.guardian.primary },
  all_access: { label: 'AForce All-Access',  desc: 'Core + Clutch + Guardian. Full performance OS.',       color: Colors.states.PEAK.primary },
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, setFeatureFlags } = useAppStore();
  const [remindersEnabled, setRemindersEnabled] = useState(mockUserProfile.remindersEnabled);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84;
  const tierKey = mockUserProfile.subscriptionTier;
  const tier = TIER_LABELS[tierKey] ?? TIER_LABELS.core;

  const toggleFlag = (key: keyof FeatureFlags) => {
    setFeatureFlags({ ...state.featureFlags, [key]: !state.featureFlags[key] });
  };

  const allOn = Object.keys(DEMO_ALL_ON_FLAGS).every((k) => state.featureFlags[k as keyof FeatureFlags] === DEMO_ALL_ON_FLAGS[k as keyof FeatureFlags]);

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.title}>Commander</Text>

          {/* Profile card */}
          <View style={[styles.profileCard, { borderColor: `${tier.color}33` }]}>
            <View style={[styles.avatar, { backgroundColor: `${tier.color}20`, borderColor: `${tier.color}55` }]}>
              <Text style={[styles.avatarText, { color: tier.color }]}>
                {mockUserProfile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{mockUserProfile.name}</Text>
              <View style={[styles.tierBadge, { backgroundColor: `${tier.color}15`, borderColor: `${tier.color}44` }]}>
                <Feather name="award" size={10} color={tier.color} />
                <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {/* Goals */}
          <SectionHeader label="GOALS" />
          <View style={styles.card}>
            <SettingRow icon="target" label="Daily Target" value={`${mockUserProfile.dailyTarget} units`} />
            <Divider />
            <SettingRow icon="droplet" label="Daily Oz Target" value={`${mockUserProfile.dailyTarget * 12} oz`} />
            <Divider />
            <SettingRow icon="user" label="Body Weight" value={`${mockUserProfile.bodyWeightLbs} lb`} />
            <Divider />
            <SettingRow icon="activity" label="Activity Type" value={mockUserProfile.activityType} />
            <Divider />
            <SettingRow icon="sunrise" label="Wake Time" value={mockUserProfile.wakeTimeHHMM} />
            <Divider />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Feather name="bell" size={16} color={Colors.states.BALANCED.primary} />
                <Text style={styles.settingLabel}>Reminders</Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ false: Colors.fill.medium, true: Colors.states.PEAK.primary }}
                thumbColor={Colors.text.primary}
                ios_backgroundColor={Colors.fill.medium}
              />
            </View>
          </View>

          {/* Hardware Pairing */}
          <SectionHeader label="HARDWARE" />
          <View style={styles.card}>
            <HardwareRow
              name="PHANTOM Band"
              kind="Private consumer wearable · BLE · 30s sync"
              ledColor={Colors.states.BALANCED.primary}
              status="UNPAIRED"
            />
            <Divider />
            <HardwareRow
              name="CLUTCH Clip"
              kind="Athlete clip · BLE · 15s in-game"
              ledColor={Colors.clutch.primary}
              status="UNPAIRED"
            />
          </View>

          {/* Connected devices */}
          <SectionHeader label="CONNECTED DEVICES" />
          <View style={styles.card}>
            {mockUserProfile.connectedDevices.map((device, i) => (
              <React.Fragment key={device}>
                <View style={styles.deviceRow}>
                  <View style={styles.deviceLeft}>
                    <View style={[styles.deviceDot, { backgroundColor: Colors.states.PEAK.primary }]} />
                    <Text style={styles.deviceName}>{device}</Text>
                  </View>
                  <Text style={[styles.deviceStatus, { color: Colors.states.PEAK.primary }]}>LIVE</Text>
                </View>
                {i < mockUserProfile.connectedDevices.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </View>

          {/* Phase 2 / Phase 3 Demo Toggles */}
          <SectionHeader label="DEMO ACCESS" hint="Preview Phase 2 + Phase 3" />
          <View style={styles.card}>
            <Pressable
              onPress={() => setFeatureFlags(allOn ? DEFAULT_FLAGS : DEMO_ALL_ON_FLAGS)}
              style={[styles.demoMaster, { borderColor: allOn ? Colors.states.PEAK.primary : Colors.border.medium }]}
            >
              <Feather name={allOn ? 'eye-off' : 'eye'} size={14} color={allOn ? Colors.states.PEAK.primary : Colors.text.secondary} />
              <Text style={[styles.demoMasterText, { color: allOn ? Colors.states.PEAK.primary : Colors.text.primary }]}>
                {allOn ? 'Lock all demo features' : 'Unlock all demo features'}
              </Text>
            </Pressable>

            <FlagRow flag="clutch_access_enabled" label="Clutch Access" desc="Phase 2 — Command the Team" color={Colors.clutch.primary} state={state} onToggle={toggleFlag} />
            <FlagRow flag="clutch_heat_mode_enabled" label="Heat Mode" desc="Aggressive cadence under heat stress" color={Colors.clutch.primary} state={state} onToggle={toggleFlag} />
            <FlagRow flag="clutch_inventory_enabled" label="Auto Replenish" desc="Inventory + restock automation" color={Colors.clutch.primary} state={state} onToggle={toggleFlag} />
            <FlagRow flag="clutch_clip_enabled" label="CLUTCH Clip" desc="Coach-visible BLE hardware" color={Colors.clutch.primary} state={state} onToggle={toggleFlag} />

            <FlagRow flag="guardian_intelligence_enabled" label="Guardian Intelligence" desc="Phase 3 — Protect the Roster" color={Colors.guardian.primary} state={state} onToggle={toggleFlag} />
            <FlagRow flag="guardian_body_map_enabled" label="Body Risk Map" desc="Per-body-region risk visualization" color={Colors.guardian.primary} state={state} onToggle={toggleFlag} />
            <FlagRow flag="guardian_alerts_enabled" label="Critical Alerts" desc="Coach + medical escalations" color={Colors.guardian.primary} state={state} onToggle={toggleFlag} />

            <FlagRow flag="phantom_wearable_enabled" label="PHANTOM Band" desc="Private consumer wearable" color={Colors.states.BALANCED.primary} state={state} onToggle={toggleFlag} />
          </View>

          {/* Phase 2 / Phase 3 entry */}
          <View style={styles.phaseRow}>
            <Pressable
              onPress={() => router.push('/clutch')}
              style={[styles.phaseCard, { borderColor: `${Colors.clutch.primary}55` }]}
            >
              <View style={[styles.phaseIcon, { backgroundColor: `${Colors.clutch.primary}1A` }]}>
                <Feather name="users" size={20} color={Colors.clutch.primary} />
              </View>
              <Text style={[styles.phaseTitle, { color: Colors.clutch.primary }]}>CLUTCH</Text>
              <Text style={styles.phaseDesc}>Command the Team</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/guardian')}
              style={[styles.phaseCard, { borderColor: `${Colors.guardian.primary}55` }]}
            >
              <View style={[styles.phaseIcon, { backgroundColor: `${Colors.guardian.primary}1A` }]}>
                <Feather name="shield" size={20} color={Colors.guardian.primary} />
              </View>
              <Text style={[styles.phaseTitle, { color: Colors.guardian.primary }]}>GUARDIAN</Text>
              <Text style={styles.phaseDesc}>Protect the Roster</Text>
            </Pressable>
          </View>

          {/* Subscription */}
          <SectionHeader label="SUBSCRIPTION" />
          <View style={[styles.subscriptionCard, { borderColor: `${tier.color}33` }]}>
            <View style={styles.subscriptionTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tierName, { color: tier.color }]}>{tier.label}</Text>
                <Text style={styles.tierDesc}>{tier.desc}</Text>
              </View>
              <View style={[styles.tierTag, { backgroundColor: `${tier.color}1A`, borderColor: `${tier.color}55` }]}>
                <Text style={[styles.tierTagText, { color: tier.color }]}>ACTIVE</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.upgradeBtn, { borderColor: `${tier.color}44` }]} activeOpacity={0.85}>
              <Text style={[styles.upgradeBtnText, { color: tier.color }]}>Manage Plan</Text>
              <Feather name="arrow-right" size={14} color={tier.color} />
            </TouchableOpacity>
          </View>

          <Text style={styles.version}>AForce OS v1.0.0 · Phase 1 Core</Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

function SettingRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Feather name={icon} size={16} color={Colors.states.BALANCED.primary} />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function HardwareRow({ name, kind, ledColor, status }: { name: string; kind: string; ledColor: string; status: string }) {
  return (
    <View style={styles.hardwareRow}>
      <View style={[styles.led, { backgroundColor: ledColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.hardwareName}>{name}</Text>
        <Text style={styles.hardwareKind}>{kind}</Text>
      </View>
      <Text style={styles.hardwareStatus}>{status}</Text>
    </View>
  );
}

function FlagRow({
  flag, label, desc, color, state, onToggle,
}: {
  flag: keyof FeatureFlags;
  label: string;
  desc: string;
  color: string;
  state: ReturnType<typeof useAppStore>['state'];
  onToggle: (k: keyof FeatureFlags) => void;
}) {
  const value = state.featureFlags[flag];
  return (
    <View style={styles.flagRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.flagLabel, value && { color }]}>{label}</Text>
        <Text style={styles.flagDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={() => onToggle(flag)}
        trackColor={{ false: Colors.fill.medium, true: color }}
        thumbColor={Colors.text.primary}
        ios_backgroundColor={Colors.fill.medium}
      />
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20 },
  eyebrow: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 3, marginBottom: 4, marginTop: 8,
  },
  title: {
    fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.text.primary,
    letterSpacing: -0.5, marginBottom: 24,
  },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.background.card, borderRadius: 20, borderWidth: 1,
    padding: 20, marginBottom: 28,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  profileInfo: { flex: 1, gap: 8 },
  profileName: {
    fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.3,
  },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1,
  },
  tierLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, marginTop: 6,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2.5,
  },
  sectionHint: {
    fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.text.secondary, letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.background.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border.subtle, marginBottom: 22, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text.primary },
  settingValue: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginHorizontal: 16 },
  hardwareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  led: { width: 10, height: 10, borderRadius: 5 },
  hardwareName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary },
  hardwareKind: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted, marginTop: 2 },
  hardwareStatus: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5,
  },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deviceDot: { width: 7, height: 7, borderRadius: 4 },
  deviceName: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text.primary },
  deviceStatus: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  flagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.border.subtle,
  },
  flagLabel: {
    fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary,
  },
  flagDesc: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted, marginTop: 2,
  },
  demoMaster: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, marginHorizontal: 12, marginTop: 12, marginBottom: 4,
    borderRadius: 10, borderWidth: 1,
  },
  demoMasterText: {
    fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1,
  },
  phaseRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  phaseCard: {
    flex: 1, backgroundColor: Colors.background.card, borderRadius: 16,
    borderWidth: 1, padding: 16, alignItems: 'center', gap: 8,
  },
  phaseIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  phaseTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2.5,
  },
  phaseDesc: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.secondary,
  },
  subscriptionCard: {
    backgroundColor: Colors.background.card, borderRadius: 16, borderWidth: 1,
    padding: 20, gap: 16, marginBottom: 22,
  },
  subscriptionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  tierName: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3, marginBottom: 4 },
  tierDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, lineHeight: 18 },
  tierTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  tierTagText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  upgradeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  version: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted,
    textAlign: 'center', marginTop: 12, marginBottom: 8,
  },
});
