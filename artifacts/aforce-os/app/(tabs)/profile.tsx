/**
 * Profile Screen — User preferences, subscription tier, and device info.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { mockUserProfile } from '@/data/mockData';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [remindersEnabled, setRemindersEnabled] = useState(mockUserProfile.remindersEnabled);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84;

  const tierColors = {
    free: Colors.text.muted,
    pro: Colors.states.BALANCED.primary,
    elite: Colors.states.PEAK.primary,
  };
  const tierColor = tierColors[mockUserProfile.subscriptionTier];

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.title}>Commander</Text>

          {/* Profile card */}
          <View style={[styles.profileCard, { borderColor: `${tierColor}33` }]}>
            <View style={[styles.avatar, { backgroundColor: `${tierColor}20`, borderColor: `${tierColor}44` }]}>
              <Text style={[styles.avatarText, { color: tierColor }]}>
                {mockUserProfile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{mockUserProfile.name}</Text>
              <View style={[styles.tierBadge, { backgroundColor: `${tierColor}15`, borderColor: `${tierColor}33` }]}>
                <Feather name="award" size={10} color={tierColor} />
                <Text style={[styles.tierLabel, { color: tierColor }]}>
                  {mockUserProfile.subscriptionTier.toUpperCase()} MEMBER
                </Text>
              </View>
            </View>
          </View>

          {/* Protocol settings */}
          <SectionHeader label="PROTOCOL" />
          <View style={styles.card}>
            <SettingRow
              icon="target"
              label="Daily Target"
              value={`${mockUserProfile.dailyTarget} units`}
            />
            <Divider />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Feather name="bell" size={16} color={Colors.states.BALANCED.primary} />
                <Text style={styles.settingLabel}>Reminders</Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{
                  false: Colors.fill.medium,
                  true: Colors.states.PEAK.primary,
                }}
                thumbColor={Colors.text.primary}
                ios_backgroundColor={Colors.fill.medium}
              />
            </View>
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
            <Divider />
            <TouchableOpacity style={styles.addDeviceRow} activeOpacity={0.7}>
              <Feather name="plus-circle" size={14} color={Colors.text.muted} />
              <Text style={styles.addDeviceText}>Add device</Text>
            </TouchableOpacity>
          </View>

          {/* Subscription */}
          <SectionHeader label="SUBSCRIPTION" />
          <View style={[styles.subscriptionCard, { borderColor: `${tierColor}30` }]}>
            <View style={styles.subscriptionTop}>
              <View>
                <Text style={[styles.tierName, { color: tierColor }]}>
                  AForce {mockUserProfile.subscriptionTier.charAt(0).toUpperCase() + mockUserProfile.subscriptionTier.slice(1)}
                </Text>
                <Text style={styles.tierDesc}>
                  {mockUserProfile.subscriptionTier === 'pro'
                    ? 'Full Autopilot + Advanced Analytics'
                    : mockUserProfile.subscriptionTier === 'elite'
                    ? 'Everything Pro + Priority Support'
                    : 'Basic tracking only'}
                </Text>
              </View>
              <View style={[styles.tierTag, { backgroundColor: `${tierColor}20`, borderColor: `${tierColor}44` }]}>
                <Text style={[styles.tierTagText, { color: tierColor }]}>ACTIVE</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.upgradeBtn, { borderColor: `${tierColor}33` }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.upgradeBtnText, { color: tierColor }]}>
                {mockUserProfile.subscriptionTier === 'elite' ? 'Manage Plan' : 'Upgrade Plan'}
              </Text>
              <Feather name="arrow-right" size={14} color={tierColor} />
            </TouchableOpacity>
          </View>

          {/* Legal */}
          <SectionHeader label="LEGAL" />
          <View style={styles.card}>
            <LegalRow label="Privacy Policy" />
            <Divider />
            <LegalRow label="Terms of Service" />
            <Divider />
            <LegalRow label="Data Usage" />
          </View>

          {/* Version */}
          <Text style={styles.version}>AForce OS v1.0.0 · Build 100</Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
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

function LegalRow({ label }: { label: string }) {
  return (
    <TouchableOpacity style={styles.legalRow} activeOpacity={0.7}>
      <Text style={styles.legalLabel}>{label}</Text>
      <Feather name="chevron-right" size={14} color={Colors.text.muted} />
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    paddingHorizontal: 20,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 3,
    marginBottom: 4,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 28,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  profileInfo: {
    flex: 1,
    gap: 8,
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  tierLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  sectionHeader: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2.5,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    marginBottom: 20,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
  },
  settingValue: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginHorizontal: 16,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  deviceName: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
  },
  deviceStatus: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  addDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  addDeviceText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
  },
  subscriptionCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    marginBottom: 20,
  },
  subscriptionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tierName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  tierDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    maxWidth: 200,
  },
  tierTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  tierTagText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  upgradeBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  legalLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
  },
  version: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
});
