/**
 * EditProfileModal — bottom-sheet editor for the premium identity card
 * AND the BODY MODEL (weight / height / birth year / biological sex).
 *
 * Surfaced when the user taps the pencil icon on the profile header.
 * Edits the persisted `ProfileIdentity` slice. Display name and
 * subscription tier are intentionally NOT editable here — those come
 * from Clerk and Stripe respectively.
 *
 * UX notes:
 *   - Local draft state, committed only on "Save". Cancel reverts.
 *   - Text fields hard-capped at 48 chars to match the sanitiser.
 *   - Aura is a single-select segmented control over AURA_STATES.
 *   - Body weight + height + birth year are numeric inputs with
 *     guardrail ranges (sanitiser silently clamps junk to null).
 *   - Biological sex is a segmented control. "Unspecified" is the
 *     default and is treated by the engine as "no sex-specific
 *     adjustment" — never a hidden assumption.
 *   - Empty body fields are a valid save (clears the field; the
 *     engine falls back to its built-in defaults).
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
import {
  AURA_STATES,
  BIOLOGICAL_SEX_OPTIONS,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  RECOVERY_GOALS,
  WEIGHT_LBS_MAX,
  WEIGHT_LBS_MIN,
  type BiologicalSex,
  type ProfileIdentity,
  type RecoveryGoal,
} from '../utils/profileIdentity';
import type { AuraState } from '../types';

const FIELD_MAX_LEN = 48;
const AVATAR_URI_MAX_LEN = 2048;

const RECOVERY_GOAL_COLOR: Record<RecoveryGoal, string> = {
  PERFORMANCE: Colors.states.PEAK.primary,
  RECOVERY: Colors.states.RECOVERING.primary,
  ENDURANCE: Colors.accent.secondary,
  BALANCE: Colors.states.BALANCED.primary,
  LONGEVITY: Colors.text.secondary,
};

const AURA_COLOR: Record<AuraState, string> = {
  IGNITE: Colors.states.DEPLETED.primary,
  FLOW: Colors.states.BALANCED.primary,
  STORM: Colors.accent.secondary,
  CALM: Colors.text.secondary,
  APEX: Colors.states.PEAK.primary,
};

const SEX_LABEL: Record<BiologicalSex, string> = {
  male: 'MALE',
  female: 'FEMALE',
  unspecified: 'PREFER NOT TO SAY',
};

interface TextFieldSpec {
  key: 'displayName' | 'nickname' | 'city' | 'country' | 'teamCircle' | 'territoryBadge';
  label: string;
  placeholder: string;
  autoCapitalize: 'none' | 'words' | 'characters';
  hint?: string;
}

const TEXT_FIELDS: readonly TextFieldSpec[] = [
  {
    key: 'displayName',
    label: 'Display Name',
    placeholder: 'Coach Rock',
    autoCapitalize: 'words',
    hint: 'Real name or alias — your call. Leave empty to use your sign-in name.',
  },
  { key: 'nickname', label: 'Handle', placeholder: 'MiamiPulse', autoCapitalize: 'none' },
  { key: 'city', label: 'City', placeholder: 'Miami', autoCapitalize: 'words' },
  { key: 'country', label: 'Country', placeholder: 'USA', autoCapitalize: 'characters' },
  { key: 'teamCircle', label: 'Team / Circle', placeholder: 'South Beach Run Club', autoCapitalize: 'words' },
  { key: 'territoryBadge', label: 'Territory Badge', placeholder: 'MIAMI HEAT ZONE', autoCapitalize: 'characters' },
];

interface NumericFieldSpec {
  key: 'bodyWeightLbs' | 'heightCm' | 'birthYear';
  label: string;
  placeholder: string;
  /** Inclusive guardrail; out-of-range or non-numeric saves as `null`. */
  min: number;
  max: number;
  /** Max digit length (limits TextInput maxLength). */
  digits: number;
}

const NUMERIC_FIELDS: readonly NumericFieldSpec[] = [
  { key: 'bodyWeightLbs', label: 'Body Weight (lb)', placeholder: 'e.g. 175', min: WEIGHT_LBS_MIN, max: WEIGHT_LBS_MAX, digits: 3 },
  { key: 'heightCm', label: 'Height (cm)', placeholder: 'e.g. 180', min: HEIGHT_CM_MIN, max: HEIGHT_CM_MAX, digits: 3 },
  { key: 'birthYear', label: 'Birth Year', placeholder: 'e.g. 1990', min: 1900, max: new Date().getFullYear(), digits: 4 },
];

/** "" when the field is unset so the placeholder shows. */
function numToInput(v: number | null): string {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}

/** Treats empty / non-numeric input as `null` (unset). */
function inputToNum(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

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
  // Mirror the numeric fields as raw input strings so the user can
  // freely edit (incl. clearing) without us coercing every keystroke.
  // Committed back to `draft` on save via `inputToNum`.
  const [numericText, setNumericText] = useState<Record<string, string>>(() => ({
    bodyWeightLbs: numToInput(initialValue.bodyWeightLbs),
    heightCm: numToInput(initialValue.heightCm),
    birthYear: numToInput(initialValue.birthYear),
  }));

  useEffect(() => {
    if (visible) {
      setDraft(initialValue);
      setNumericText({
        bodyWeightLbs: numToInput(initialValue.bodyWeightLbs),
        heightCm: numToInput(initialValue.heightCm),
        birthYear: numToInput(initialValue.birthYear),
      });
    }
  }, [visible, initialValue]);

  const setField = <K extends keyof ProfileIdentity>(key: K, value: ProfileIdentity[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleSave = () => {
    // Trim text + coerce numeric drafts on submit so leading/trailing
    // whitespace never lands in persisted state and out-of-range
    // numbers fall back to `null` (the sanitiser also clamps on
    // hydrate, but doing it here too keeps the UI honest).
    const coerceNumeric = (raw: string, min: number, max: number): number | null => {
      const n = inputToNum(raw);
      if (n == null) return null;
      const rounded = Math.round(n);
      if (rounded < min || rounded > max) return null;
      return rounded;
    };
    // Avatar URI: drop unknown schemes on save so the modal can't
    // persist a hostile <Image> source even if the sanitiser is
    // later relaxed. Mirrors the rules in `asAvatarUri`.
    const safeAvatar = (() => {
      const raw = draft.avatarUri.trim();
      if (raw.length === 0 || raw.length > AVATAR_URI_MAX_LEN) return '';
      const lower = raw.toLowerCase();
      const ok =
        lower.startsWith('https://') ||
        lower.startsWith('http://') ||
        lower.startsWith('data:image/');
      return ok ? raw : '';
    })();
    const sanitized: ProfileIdentity = {
      displayName: draft.displayName.trim(),
      nickname: draft.nickname.trim(),
      avatarUri: safeAvatar,
      city: draft.city.trim(),
      country: draft.country.trim(),
      teamCircle: draft.teamCircle.trim(),
      territoryBadge: draft.territoryBadge.trim(),
      auraState: draft.auraState,
      recoveryGoal: draft.recoveryGoal,
      bodyWeightLbs: coerceNumeric(numericText.bodyWeightLbs, WEIGHT_LBS_MIN, WEIGHT_LBS_MAX),
      heightCm: coerceNumeric(numericText.heightCm, HEIGHT_CM_MIN, HEIGHT_CM_MAX),
      birthYear: coerceNumeric(numericText.birthYear, 1900, new Date().getFullYear()),
      biologicalSex: draft.biologicalSex,
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
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>AVATAR IMAGE URL</Text>
              <TextInput
                value={draft.avatarUri}
                onChangeText={(t) => setField('avatarUri', t)}
                placeholder="https://… or data:image/…"
                placeholderTextColor={Colors.text.muted}
                maxLength={AVATAR_URI_MAX_LEN}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
                accessibilityLabel="Avatar image URL"
                testID="edit-profile-avatarUri"
              />
              <Text style={styles.hint}>
                Paste an https:// link or a data:image/ URI. Other schemes are dropped on save.
              </Text>
            </View>

            {TEXT_FIELDS.map((field) => (
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
                  testID={`edit-profile-${field.key}`}
                />
                {field.hint ? <Text style={styles.hint}>{field.hint}</Text> : null}
              </View>
            ))}

            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>BODY MODEL</Text>
            <Text style={styles.sectionHint}>
              Helps the system tune recommendations to your body. Skip any field — the engine falls back to safe defaults.
            </Text>

            {NUMERIC_FIELDS.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.fieldLabel}>{field.label.toUpperCase()}</Text>
                <TextInput
                  value={numericText[field.key]}
                  onChangeText={(t) =>
                    setNumericText((m) => ({ ...m, [field.key]: t.replace(/[^0-9]/g, '') }))
                  }
                  placeholder={field.placeholder}
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={field.digits}
                  autoCorrect={false}
                  style={styles.input}
                  accessibilityLabel={field.label}
                  testID={`edit-profile-${field.key}`}
                />
              </View>
            ))}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>BIOLOGICAL SEX</Text>
              <View style={styles.auraRow}>
                {BIOLOGICAL_SEX_OPTIONS.map((sex) => {
                  const selected = draft.biologicalSex === sex;
                  return (
                    <Pressable
                      key={sex}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setField('biologicalSex', sex);
                      }}
                      style={[
                        styles.auraOption,
                        selected && {
                          backgroundColor: `${Colors.accent.primary}22`,
                          borderColor: Colors.accent.primary,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Biological sex ${sex}`}
                      testID={`edit-profile-sex-${sex}`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? Colors.accent.primary : Colors.text.secondary },
                        ]}
                      >
                        {SEX_LABEL[sex]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionDivider} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>RECOVERY GOAL</Text>
              <View style={styles.auraRow}>
                {RECOVERY_GOALS.map((goal) => {
                  const selected = draft.recoveryGoal === goal;
                  const color = RECOVERY_GOAL_COLOR[goal];
                  return (
                    <Pressable
                      key={goal}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setField('recoveryGoal', goal);
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
                      accessibilityLabel={`Recovery goal ${goal}`}
                      testID={`edit-profile-recoveryGoal-${goal}`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? color : Colors.text.secondary },
                        ]}
                      >
                        {goal}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

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
              testID="edit-profile-save"
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
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    letterSpacing: 2.5,
    marginTop: 8,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    marginBottom: 14,
    lineHeight: 17,
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
  hint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    marginTop: 6,
    lineHeight: 15,
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
