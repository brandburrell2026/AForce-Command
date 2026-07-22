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
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@/components/Icon';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';
import { useAppStore } from '@/store/useAppStore';
import type { NotificationSettingKey } from '@/types';

interface ToggleRow {
  key: NotificationSettingKey;
  icon: IconName;
}

// Label + hint resolve under notifications.v2.row_<key>_{label,hint} at render.
const ROWS: ToggleRow[] = [
  { key: 'recheckReminders',    icon: 'clock' },
  { key: 'scoreDecayAlerts',    icon: 'activity' },
  { key: 'morningKickoff',      icon: 'sunrise' },
  { key: 'circleActivity',      icon: 'users' },
  { key: 'challengeDeadlines',  icon: 'flag' },
  { key: 'lowInventoryAlert',   icon: 'shopping-bag' },
];

export function NotificationsScreenV2() {
  const { t } = useTranslation();
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
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')} testID="notifications-back">
              <Icon name="chevron-left" size={20} color={af.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{t('notifications.v2.eyebrow')}</Text>
              <Text style={styles.title}>{t('notifications.v2.title')}</Text>
            </View>
          </View>

          <Text style={styles.intro}>{t('notifications.v2.intro')}</Text>

          <View style={styles.card}>
            {ROWS.map((row, idx) => (
              <View key={row.key}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <View style={styles.iconWrap}>
                      <Icon name={row.icon} size={14} color={af.cyan} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{t(`notifications.v2.row_${row.key}_label`)}</Text>
                      <Text style={styles.rowHint}>{t(`notifications.v2.row_${row.key}_hint`)}</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings[row.key]}
                    onValueChange={(v) => setNotificationSetting(row.key, v)}
                    accessibilityLabel={t(`notifications.v2.row_${row.key}_label`)}
                    trackColor={{ false: af.surface, true: af.green }}
                    thumbColor={af.textPrimary}
                    ios_backgroundColor={af.surface}
                    testID={`notification-toggle-${row.key}`}
                  />
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>{t('notifications.v2.footnote')}</Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  content: { paddingHorizontal: 20, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, color: af.textTertiary, letterSpacing: 2.5 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: af.textPrimary, marginTop: 2 },
  intro: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
  card: {
    backgroundColor: af.surface,
    borderRadius: 14, borderWidth: 1, borderColor: af.divider,
    padding: 4,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: af.divider, marginHorizontal: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: af.surface,
    borderWidth: 1, borderColor: af.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: af.textPrimary },
  rowHint: { fontFamily: 'Inter_400Regular', fontSize: 11, color: af.textTertiary, marginTop: 2, lineHeight: 15 },
  footnote: {
    fontFamily: 'Inter_400Regular', fontSize: 11, color: af.textTertiary,
    textAlign: 'center', fontStyle: 'italic', marginTop: 4,
  },
});
