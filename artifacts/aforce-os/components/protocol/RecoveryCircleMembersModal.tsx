/**
 * RecoveryCircleMembersModal — local-only member management for the
 * Recovery Circle. Spec Rule #11 forbids invites, sharing, or any
 * referral copy, so this modal is intentionally a private, on-device
 * list:
 *   - shows the existing members (max 3)
 *   - lets the user add a name (and optional role) up to the cap
 *   - lets the user remove a member
 *
 * No share sheet, no contact picker, no server round-trip. The
 * `RecoveryCircle` service persists to AsyncStorage; this UI is just
 * a thin form over `setRecoveryCircle`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  Platform,
} from 'react-native';

import { Colors } from '@/theme/colors';
import { Icon } from '@/components/Icon';
import {
  CIRCLE_MAX,
  clampMembers,
  setRecoveryCircle,
  type RecoveryCircleMember,
  type RecoveryCircleSnapshot,
} from '@/services/recoveryCircle';

interface Props {
  visible: boolean;
  snapshot: RecoveryCircleSnapshot | null;
  onClose: () => void;
  onChange: (next: RecoveryCircleSnapshot) => void;
}

function makeId(): string {
  // No external uuid dep — a timestamp + small random suffix is unique
  // enough for an on-device list capped at 3.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function RecoveryCircleMembersModal({ visible, snapshot, onClose, onChange }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset draft when the modal opens or the snapshot identity changes.
  useEffect(() => {
    if (visible) {
      setName('');
      setRole('');
    }
  }, [visible]);

  const members = snapshot?.members ?? [];
  const atCap = members.length >= CIRCLE_MAX;

  const persist = useCallback(
    async (nextMembers: RecoveryCircleMember[]) => {
      if (!snapshot) return;
      const next: RecoveryCircleSnapshot = {
        ...snapshot,
        members: clampMembers(nextMembers),
      };
      setSaving(true);
      try {
        await setRecoveryCircle(next);
        onChange(next);
      } finally {
        setSaving(false);
      }
    },
    [snapshot, onChange],
  );

  const onAdd = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || atCap || !snapshot) return;
    const member: RecoveryCircleMember = {
      id: makeId(),
      name: trimmed,
      ...(role.trim() ? { role: role.trim() } : {}),
    };
    await persist([...members, member]);
    setName('');
    setRole('');
  }, [name, role, atCap, snapshot, members, persist]);

  const onRemove = useCallback(
    async (id: string) => {
      await persist(members.filter((m) => m.id !== id));
    },
    [members, persist],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => { /* swallow */ }}>
          <View style={styles.header}>
            <Text style={styles.eyebrow}>RECOVERY CIRCLE</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={20} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.help}>
            Private. Up to {CIRCLE_MAX} people who know you're in recovery. No invites are sent.
          </Text>

          {members.length === 0 ? (
            <Text style={styles.empty}>No members yet.</Text>
          ) : (
            <View style={styles.list}>
              {members.map((m) => (
                <View key={m.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{m.name}</Text>
                    {m.role ? <Text style={styles.rowRole}>{m.role}</Text> : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => onRemove(m.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${m.name}`}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeText}>REMOVE</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {atCap ? (
            <Text style={styles.atCap}>Circle full ({CIRCLE_MAX} of {CIRCLE_MAX}).</Text>
          ) : (
            <View style={styles.form}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor={Colors.text.muted}
                style={styles.input}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                accessibilityLabel="Member name"
              />
              <TextInput
                value={role}
                onChangeText={setRole}
                placeholder="Role (optional) — partner, coach, sponsor"
                placeholderTextColor={Colors.text.muted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={onAdd}
                accessibilityLabel="Member role"
              />
              <TouchableOpacity
                onPress={onAdd}
                disabled={!name.trim() || saving}
                style={[
                  styles.addBtn,
                  (!name.trim() || saving) && { opacity: 0.4 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Add member"
              >
                <Text style={styles.addBtnText}>ADD</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 20,
    gap: 14,
    ...(Platform.OS === 'web' ? { cursor: 'default' as any } : {}),
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
    color: Colors.accent.primary,
  },
  help: { fontSize: 12, fontFamily: 'Inter_400Regular', color: Colors.text.muted, lineHeight: 18 },
  empty: { fontSize: 12, color: Colors.text.muted, fontStyle: 'italic' },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.fill.medium,
  },
  rowText: { flex: 1 },
  rowName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary },
  rowRole: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted, marginTop: 2 },
  removeBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  removeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
    color: Colors.text.muted,
  },
  atCap: { fontSize: 12, color: Colors.text.muted, fontFamily: 'Inter_500Medium' },
  form: { gap: 8 },
  input: {
    backgroundColor: Colors.fill.medium,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text.primary,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: Colors.accent.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnText: {
    color: '#000',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
  },
});
