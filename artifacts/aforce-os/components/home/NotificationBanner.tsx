/**
 * NotificationBanner — in-app surface for the Day 0/1/3/7 welcome
 * cadence defined by Spec Rule #10.
 *
 * No native push, no permission prompt. The spec's hidden scheduler
 * (`services/notifications`) already enforces the 1-per-calendar-day
 * cap and the cadence math; this banner is the smallest visible
 * surface that lets the cadence land — a single dismissible card at
 * the top of the home screen.
 *
 * Renders nothing when:
 *   - `spec_notifications` flag is off
 *   - the seed snapshot hasn't loaded yet
 *   - no notification is currently due
 *
 * Dismiss calls `recordDelivery` so the same day's notification
 * doesn't reappear on the next mount.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import { useFeatureFlags } from '@/store/useAppStore';
import {
  ensureNotificationsSnapshot,
  deriveScheduledNotifications,
  dueNotifications,
  recordDelivery,
  type NotificationsSnapshot,
  type ScheduledNotification,
} from '@/services/notifications';

export function NotificationBanner() {
  const flags = useFeatureFlags();
  const [snapshot, setSnapshot] = useState<NotificationsSnapshot | null>(null);

  // Seed on first mount when flag is on. Day 0 anchors to "now" so
  // the welcome card lands immediately for new installs.
  useEffect(() => {
    if (!flags.spec_notifications) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    void ensureNotificationsSnapshot(new Date().toISOString()).then((s) => {
      if (!cancelled) setSnapshot(s);
    });
    return () => {
      cancelled = true;
    };
  }, [flags.spec_notifications]);

  const due: ScheduledNotification | null = snapshot
    ? dueNotifications(
        deriveScheduledNotifications(snapshot.startAt),
        Date.now(),
        snapshot.delivered,
      )
    : null;

  const onDismiss = useCallback(async () => {
    if (!due) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const next = await recordDelivery(due.day, new Date().toISOString());
    if (next) setSnapshot(next);
  }, [due]);

  if (!flags.spec_notifications || !snapshot || !due) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card} testID="notification-banner">
        <View style={styles.dot} />
        <View style={styles.body}>
          <Text style={styles.title}>{due.title}</Text>
          <Text style={styles.subtitle}>{due.body}</Text>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          activeOpacity={0.7}
          style={styles.dismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          testID="notification-banner-dismiss"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="x" size={14} color={Colors.text.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.accent.primary}40`,
    backgroundColor: `${Colors.accent.primary}10`,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.primary,
  },
  body: { flex: 1 },
  title: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    letterSpacing: 0.1,
  },
  dismiss: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
});
