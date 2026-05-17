/**
 * EditProfileModal — bottom-sheet editor for the premium identity card.
 *
 * Surfaced when the user taps the pencil icon on the profile header.
 * Edits the persisted `ProfileIdentity` slice (nickname / city /
 * country / team-circle / territory badge / aura). Display name and
 * subscription tier are intentionally NOT editable here — those come
 * from Clerk and Stripe respectively.
 *
 * UX notes:
 *   - Local draft state, committed only on "Save". Cancel reverts.
 *   - Each TextInput is hard-capped at 48 chars to match the sanitiser.
 *   - Aura is a single-select segmented control over AURA_STATES.
 *   - Empty strings are a valid save (clears the chip on the card).
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from './Icon';
import { Colors } from '../theme/colors';
import { AURA_STATES, type ProfileIdentity } from '../utils/profileIdentity';
import type { AuraState } from '../types';

const FIELD_MAX_LEN = 48;

const AURA_COLOR: Record<AuraState, string> = {
  IGNITE: Colors.states.DEPLETED.primary,
  FLOW: Colors.states.BALANCED.primary,
  STORM: Colors.accent.secondary,
  CALM: Colors.text.secondary,
  APEX: Colors.states.PEAK.primary,
};

interface FieldSpec {
  key: keyof Omit<ProfileIdentity, 'auraState'>;
  label: string;
  placeholder: string;
  autoCapitalize: 'none' | 'words' | 'characters';
}

const FIELDS: readonly FieldSpec[] = [
  { key: 'nickname', label: 'Handle', placeholder: 'MiamiPulse', autoCapitalize: 'none' },
  { key: 'city', label: 'City', placeholder: 'Miami', autoCapitalize: 'words' },
  { key: 'country', label: 'Country', placeholder: 'USA', autoCapitalize: 'characters' },
  { key: 'teamCircle', label: 'Team / Circle', placeholder: 'South Beach Run Club', autoCapitalize: 'words' },
  { key: 'territoryBadge', label: 'Territory Badge', placeholder: 'MIAMI HEAT ZONE', autoCapitalize: 'characters' },
];

interface Props {
  visible: boolean;
  initialValue: ProfileIdentity;
  onClose: () => void;
  onSave: (next: ProfileIdentity) => void;
}

export function EditProfileModal({ visible, initialValue, onClose, onSave }: Props) {
  // Local draft so typing doesn't dispatch on every keystroke. Reset
  // whenever the modal is re-opened so a previous cancelled edit
  // doesn't leak back in.
  const [draft, setDraft] = useState<ProfileIdentity>(initialValue);

  useEffect(() => {
    if (visible) setDraft(initialValue);
  }, [visible, initialValue]);

  const setField = <K extends keyof ProfileIdentity>(key: K, value: ProfileIdentity[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleSave = () => {
    // Trim on submit so leading/trailing whitespace never lands in
    // persisted state (the sanitiser would catch it on next hydrate
    // anyway, but in-session reads would briefly show the whitespace).
    const sanitized: ProfileIdentity = {
      nickname: draft.nickname.trim(),
      city: draft.city.trim(),
      country: draft.country.trim(),
      teamCircle: draft.teamCircle.trim(),
      territoryBadge: draft.territoryBadge.trim(),
      auraState: draft.auraState,
    };
    Haptics.selectionAsync().catch(() => {});
    onSave(sanitized);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>EDIT IDENTITY</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close edit profile"
            >
              <Icon name="x" size={20} color={Colors.text.muted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {FIELDS.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.fieldLabel}>{field.label.toUpperCase()}</Text>
                <TextInput
                  value={draft[field.key]}
                  onChangeText={(t) => setField(field.key, t)}
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.text.muted}
                  maxLength={FIELD_MAX_LEN}
                  autoCapitalize={field.autoCapitalize}
                  autoCorrect={false}
                  style={styles.input}
                  accessibilityLabel={field.label}
                />
              </View>
            ))}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>AURA</Text>
              <View style={styles.auraRow}>
                {AURA_STATES.map((aura) => {
                  const selected = draft.auraState === aura;
                  const color = AURA_COLOR[aura];
                  return (
                    <Pressable
                      key={aura}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setField('auraState', aura);
                      }}
                      style={[
                        styles.auraOption,
                        selected && {
                          backgroundColor: `${color}22`,
                          borderColor: color,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${aura} aura`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? color : Colors.text.secondary },
                        ]}
                      >
                        {aura}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={[styles.btn, styles.btnGhost]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.btnGhostText}>CANCEL</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={[styles.btn, styles.btnPrimary]}
              accessibilityRole="button"
              accessibilityLabel="Save identity"
            >
              <Text style={styles.btnPrimaryText}>SAVE</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border.subtle,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: 2.5,
  },
  body: { paddingHorizontal: 24 },
  bodyContent: { paddingBottom: 12 },
  field: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.muted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
  },
  auraRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  auraOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.primary,
  },
  auraLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  btnGhostText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.secondary,
    letterSpacing: 2,
  },
  btnPrimary: {
    backgroundColor: Colors.accent.primary,
  },
  btnPrimaryText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    letterSpacing: 2,
  },
});
