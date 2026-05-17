/**
 * Notification Preferences screen.
 *
 * Surfaces the persisted `notificationSettings` slice as a card stack
 * of segmented toggles so the user can opt in/out of each alert class
 * without leaving the app: score-band alerts, risk-timer countdowns,
 * recovery nudges, completion rewards, reorder prompts, and the
 * morning brief. Every toggle round-trips through `setNotificationSetting`
 * which writes back to AsyncStorage so the choice survives reload.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';
import type { NotificationSettingKey } from '@/types';

interface ToggleRow {
  key: NotificationSettingKey;
  label: string;
  hint: string;
  icon: IconName;
}

const ROWS: ToggleRow[] = [
  { key: 'recheckReminders',    label: 'Recheck Reminders',    hint: 'Risk-timer pings as your hydration window closes.',           icon: 'clock' },
  { key: 'scoreDecayAlerts',    label: 'Score Decay Alerts',   hint: 'Voice + push when you cross PEAK / STABLE / RISK bands.',     icon: 'activity' },
  { key: 'morningKickoff',      label: 'Morning Kickoff',      hint: 'Daily 06:30 summary of the prior day + today\'s plan.',       icon: 'sunrise' },
  { key: 'circleActivity',      label: 'Circle Activity',      hint: 'Pings when friends in your circle log a peak streak.',         icon: 'users' },
  { key: 'challengeDeadlines',  label: 'Challenge Deadlines',  hint: 'Reminders before an open circle challenge expires.',           icon: 'flag' },
  { key: 'lowInventoryAlert',   label: 'Low Inventory Alerts', hint: 'Restock prompts when sticks/RTD/canister inventory hits zero.', icon: 'shopping-bag' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notificationSettings, setNotificationSetting } = useAppStore();

  const topPadding = Platform.OS === 'web' ? 24 : insets.top + 8;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom + 24;

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12} testID="notifications-back">
              <Icon name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>PREFERENCES</Text>
              <Text style={styles.title}>Notifications</Text>
            </View>
          </View>

          <Text style={styles.intro}>
            Decide exactly which alerts AForce sends. Voice, push, and in-app
            badges all honor these toggles together.
          </Text>

          <View style={styles.card}>
            {ROWS.map((row, idx) => (
              <View key={row.key}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <View style={styles.iconWrap}>
                      <Icon name={row.icon} size={14} color={Colors.states.BALANCED.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{row.label}</Text>
                      <Text style={styles.rowHint}>{row.hint}</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings[row.key]}
                    onValueChange={(v) => setNotificationSetting(row.key, v)}
                    trackColor={{ false: Colors.fill.medium, true: Colors.states.PEAK.primary }}
                    thumbColor={Colors.text.primary}
                    ios_backgroundColor={Colors.fill.medium}
                    testID={`notification-toggle-${row.key}`}
                  />
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>
            Score-band and risk-timer voice also respect the AForce Command
            Voice Engine scope/intensity in Profile › Voice.
          </Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.text.muted, letterSpacing: 2.5 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text.primary, marginTop: 2 },
  intro: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: Colors.text.secondary },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border.subtle,
    padding: 4,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border.subtle, marginHorizontal: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text.primary },
  rowHint: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.muted, marginTop: 2, lineHeight: 15 },
  footnote: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.muted,
    textAlign: 'center', fontStyle: 'italic', marginTop: 4,
  },
});
