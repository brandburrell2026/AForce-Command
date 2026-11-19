/**
 * DevicesHome — the Devices section of Profile, laid out as the approved
 * prototype: one row per source with what it reads, its state and a pill,
 * one line of explanation, and "Manage devices and apps".
 *
 * The rows only report. Connecting, refreshing, disconnecting and every
 * error state live on the Manage view, which holds the same device cards as
 * before, unchanged. Each row's state comes from the same resolver those
 * cards use (`deviceSummaries` in panes/DevicesPane.tsx).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { af } from '@/theme';

export interface DevicesHomeRow {
  id: string;
  name: string;
  sub: string;
  pill: string;
}

export interface DevicesHomeProps {
  /** null while the connection checks are still running. */
  rows: readonly DevicesHomeRow[] | null;
  onManage: () => void;
}

export function DevicesHome({ rows, onManage }: DevicesHomeProps) {
  return (
    <View testID="profile-devices-home">
      <View style={styles.card}>
        {rows === null ? (
          <Text style={styles.checking} accessibilityLiveRegion="polite">Checking your connections…</Text>
        ) : (
          rows.map((r, i) => (
            <Pressable
              key={r.id}
              onPress={onManage}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}. ${r.sub}. ${r.pill}. Opens Manage devices and apps.`}
              style={({ pressed }) => [styles.row, i < rows.length - 1 && styles.ruled, pressed && styles.pressed]}
              testID={`devices-row-${r.id}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{r.name}</Text>
                <Text style={styles.rowSub}>{r.sub}</Text>
              </View>
              <View style={[styles.pill, r.pill === 'On' && styles.pillOn]}>
                <Text style={[styles.pillText, r.pill === 'On' && styles.pillTextOn]}>{r.pill}</Text>
              </View>
            </Pressable>
          ))
        )}
      </View>
      <Text style={styles.note}>
        Connect only what you want used. Each source shows what it reads.
      </Text>
      <Pressable
        onPress={onManage}
        accessibilityRole="button"
        accessibilityLabel="Manage devices and apps"
        style={({ pressed }) => [styles.manage, pressed && styles.pressed]}
        testID="devices-manage"
      >
        <Text style={styles.manageText}>Manage devices and apps</Text>
      </Pressable>
    </View>
  );
}

/** "‹ Devices" above the full device cards. */
export function DevicesManageHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.viewHeader}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to Devices"
        hitSlop={8}
        style={styles.back}
        testID="devices-manage-back"
      >
        <Icon name="chevron-left" size={18} color={af.textPrimary} />
        <Text style={styles.backText}>Devices</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.viewTitle}>MANAGE</Text>
    </View>
  );
}

const MONO = 'IBMPlexMono_400Regular';

const styles = StyleSheet.create({
  card: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20, paddingHorizontal: 18, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 12 },
  ruled: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: af.divider },
  pressed: { opacity: 0.72 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 17, color: af.textSecondary },
  pill: { borderWidth: 1, borderColor: af.border, borderRadius: 999, paddingHorizontal: 12, minHeight: 28, justifyContent: 'center' },
  pillOn: { backgroundColor: af.primaryFill, borderColor: af.primaryFill },
  pillText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: af.textSecondary },
  pillTextOn: { color: af.onPrimaryFill },
  checking: { fontFamily: 'Inter_400Regular', fontSize: 14, color: af.textSecondary, paddingVertical: 20 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary, marginBottom: 14 },
  manage: { minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: af.border, alignItems: 'center', justifyContent: 'center' },
  manageText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  viewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  backText: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  viewTitle: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
});
