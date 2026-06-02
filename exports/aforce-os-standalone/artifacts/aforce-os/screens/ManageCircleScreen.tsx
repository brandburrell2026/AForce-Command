/**
 * ManageCircleScreen — accept pending requests, organize active members
 * into groups, mute or remove. Premium dark, no comment threads.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { Icon } from '../components/Icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/theme/colors';
import {
  listCircle, listPending, setRelationshipStatus, removeFromCircle, moveToGroup,
} from '@/services/circleService';
import { useCircleSubscription } from '@/hooks/useCircleSubscription';
import type { CircleGroup, CircleUser } from '@/types/circle';

const GROUPS: { id: CircleGroup; label: string }[] = [
  { id: 'friends', label: 'Friends' },
  { id: 'team',    label: 'Team' },
  { id: 'coach',   label: 'Coach' },
  { id: 'family',  label: 'Family' },
];

function confirmRemove(name: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm?.(`Remove ${name} from your circle?`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert('Remove from circle', `Remove ${name} from your circle?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onConfirm },
  ]);
}

export const ManageCircleScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Subscribe to the circle store — covers both this screen's edits and any
  // edits other screens make to keep state coherent across the app.
  const v = useCircleSubscription();

  const active = React.useMemo(() => listCircle(), [v]);
  const pending = React.useMemo(() => listPending(), [v]);

  const accept = (u: CircleUser) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setRelationshipStatus(u.userId, 'active');
  };
  const decline = (u: CircleUser) => {
    removeFromCircle(u.userId);
  };
  const mute = (u: CircleUser) => {
    setRelationshipStatus(u.userId, u.status === 'muted' ? 'active' : 'muted');
  };
  const remove = (u: CircleUser) => {
    confirmRemove(u.name, () => { removeFromCircle(u.userId); });
  };
  const move = (u: CircleUser, g: CircleGroup) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    moveToGroup(u.userId, g);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12} accessibilityLabel="Back">
          <Icon name="chevron-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>MANAGE CIRCLE</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PENDING REQUESTS</Text>
            <View style={styles.list}>
              {pending.map(u => (
                <View key={u.userId} style={styles.row}>
                  <View style={styles.identity}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{u.initials}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{u.name}</Text>
                      <Text style={styles.sub}>{u.city ?? '—'}</Text>
                    </View>
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable onPress={() => decline(u)} style={[styles.btn, styles.btnGhost]} accessibilityLabel="Decline">
                      <Text style={styles.btnGhostText}>DECLINE</Text>
                    </Pressable>
                    <Pressable onPress={() => accept(u)} style={[styles.btn, styles.btnPrimary]} accessibilityLabel="Accept">
                      <Text style={styles.btnPrimaryText}>ACCEPT</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACTIVE MEMBERS</Text>
          <View style={styles.list}>
            {active.map(u => (
              <View key={u.userId} style={styles.row}>
                <View style={styles.identity}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{u.initials}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{u.name} {u.status === 'muted' ? <Text style={styles.muted}>· muted</Text> : null}</Text>
                    <Text style={styles.sub}>{u.city ?? '—'} · {labelForGroup(u.group)}</Text>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupRow}>
                  {GROUPS.map(g => {
                    const active = u.group === g.id;
                    return (
                      <Pressable
                        key={g.id}
                        onPress={() => move(u, g.id)}
                        style={[styles.groupChip, active && styles.groupChipActive]}
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.groupChipText, active && styles.groupChipTextActive]}>
                          {g.label.toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.rowActions}>
                  <Pressable onPress={() => mute(u)} style={[styles.btn, styles.btnGhost]}>
                    <Text style={styles.btnGhostText}>{u.status === 'muted' ? 'UNMUTE' : 'MUTE'}</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(u)} style={[styles.btn, styles.btnDanger]}>
                    <Text style={styles.btnDangerText}>REMOVE</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

function labelForGroup(g: CircleGroup): string {
  switch (g) {
    case 'friends': return 'Friend';
    case 'team':    return 'Team';
    case 'coach':   return 'Coach';
    case 'family':  return 'Family';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: Colors.text.primary, fontSize: 12, letterSpacing: 4, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 24 },
  section: { gap: 12 },
  sectionLabel: { color: Colors.text.muted, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  list: { gap: 12 },
  row: {
    backgroundColor: Colors.background.card, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: Colors.border.subtle, gap: 12,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.fill.strong,
  },
  avatarText: { color: Colors.text.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.8 },
  name: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
  muted: { color: Colors.text.muted, fontSize: 11, fontWeight: '400' },
  sub:  { color: Colors.text.muted, fontSize: 12, marginTop: 2 },
  groupRow: { gap: 6, paddingVertical: 4 },
  groupChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100,
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.medium,
  },
  groupChipActive: { backgroundColor: Colors.text.primary, borderColor: Colors.text.primary },
  groupChipText:   { color: Colors.text.primary, fontSize: 10, letterSpacing: 1.5, fontWeight: '600' },
  groupChipTextActive: { color: Colors.text.inverse },
  rowActions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.medium },
  btnGhostText: { color: Colors.text.primary, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  btnPrimary: { backgroundColor: Colors.text.primary },
  btnPrimaryText: { color: Colors.text.inverse, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  btnDanger: { backgroundColor: `${Colors.danger}22`, borderWidth: 1, borderColor: `${Colors.danger}55` },
  btnDangerText: { color: Colors.danger, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
});

export default ManageCircleScreen;
