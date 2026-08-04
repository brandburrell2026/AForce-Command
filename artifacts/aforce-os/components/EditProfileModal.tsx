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
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AFModal } from './ui/AFModal';
import { KeyboardAwareScrollViewCompat } from './KeyboardAwareScrollViewCompat';
import { Icon } from './Icon';
import { HeightField, WeightField } from './bodyModel';
import { Colors } from '../theme/colors';
import { useAppStore } from '../store/useAppStore';
import {
  AURA_STATES,
  BIOLOGICAL_SEX_OPTIONS,
  CAFFEINE_HABIT_OPTIONS,
  OCCUPATION_TYPE_OPTIONS,
  TRAINING_LEVELS,
  PRIMARY_GOALS,
  SWEAT_CLASSIFICATIONS,
  WORKOUT_DURATION_MIN,
  WORKOUT_DURATION_MAX,
  type BiologicalSex,
  type CaffeineHabit,
  type OccupationType,
  type ProfileIdentity,
  type TrainingLevel,
  type PrimaryGoal,
  type SweatClassification,
} from '../utils/profileIdentity';
import type { AuraState } from '../types';

const FIELD_MAX_LEN = 48;
const AVATAR_URI_MAX_LEN = 2048;

const AURA_COLOR: Record<AuraState, string> = {
  IGNITE: Colors.states.DEPLETED.primary,
  FLOW: Colors.states.BALANCED.primary,
  STORM: Colors.accent.secondary,
  CALM: Colors.text.secondary,
  APEX: Colors.states.PEAK.primary,
};

// Maps hold i18n key SUFFIXES (under settings.editProfile.*); resolved
// to display text at the render sites via t(`settings.editProfile.${...}`).
const SEX_LABEL: Record<BiologicalSex, string> = {
  male: 'sex_male',
  female: 'sex_female',
  'non-binary': 'sex_nonbinary',
  unspecified: 'sex_prefer',
};

const SWEAT_LABEL: Record<SweatClassification, string> = {
  light: 'sweat_light',
  moderate: 'sweat_moderate',
  heavy: 'sweat_heavy',
  very_heavy: 'sweat_very_heavy',
};

const CAFFEINE_LABEL: Record<CaffeineHabit, string> = {
  none: 'caffeine_none',
  low: 'caffeine_low',
  moderate: 'caffeine_moderate',
  high: 'caffeine_high',
  unspecified: 'caffeine_skip',
};

const OCCUPATION_LABEL: Record<OccupationType, string> = {
  desk: 'occ_desk',
  active: 'occ_active',
  outdoor: 'occ_outdoor',
  shift: 'occ_shift',
  other: 'occ_other',
  unspecified: 'occ_skip',
};

interface TextFieldSpec {
  key: 'displayName' | 'nickname' | 'city' | 'country' | 'teamCircle' | 'territoryBadge';
  // i18n key SUFFIXES under settings.editProfile.*; resolved at render.
  labelKey: string;
  phKey: string;
  autoCapitalize: 'none' | 'words' | 'characters';
  hintKey?: string;
}

const TEXT_FIELDS: readonly TextFieldSpec[] = [
  {
    key: 'displayName',
    labelKey: 'field_displayName_label',
    phKey: 'field_displayName_ph',
    autoCapitalize: 'words',
    hintKey: 'field_displayName_hint',
  },
  { key: 'nickname', labelKey: 'field_nickname_label', phKey: 'field_nickname_ph', autoCapitalize: 'none' },
  { key: 'city', labelKey: 'field_city_label', phKey: 'field_city_ph', autoCapitalize: 'words' },
  { key: 'country', labelKey: 'field_country_label', phKey: 'field_country_ph', autoCapitalize: 'characters' },
  { key: 'teamCircle', labelKey: 'field_teamCircle_label', phKey: 'field_teamCircle_ph', autoCapitalize: 'words' },
  { key: 'territoryBadge', labelKey: 'field_territoryBadge_label', phKey: 'field_territoryBadge_ph', autoCapitalize: 'characters' },
];

interface NumericFieldSpec {
  key: 'bodyWeightLbs' | 'heightCm' | 'birthYear';
  // i18n key SUFFIXES under settings.editProfile.*; resolved at render.
  labelKey: string;
  phKey: string;
  /** Inclusive guardrail; out-of-range or non-numeric saves as `null`. */
  min: number;
  max: number;
  /** Max digit length (limits TextInput maxLength). */
  digits: number;
}

const NUMERIC_FIELDS: readonly NumericFieldSpec[] = [
  // Body weight + height are handled by the shared, unit-aware
  // BodyMeasure fields (canonical lbs / cm). Birth year stays a plain
  // numeric input here.
  { key: 'birthYear', labelKey: 'field_birthYear_label', phKey: 'field_birthYear_ph', min: 1900, max: new Date().getFullYear(), digits: 4 },
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
  const { t } = useTranslation();
  // Local draft so typing doesn't dispatch on every keystroke. Reset
  // whenever the modal is re-opened so a previous cancelled edit
  // doesn't leak back in.
  const [draft, setDraft] = useState<ProfileIdentity>(initialValue);
  // Mirror the numeric fields as raw input strings so the user can
  // freely edit (incl. clearing) without us coercing every keystroke.
  // Committed back to `draft` on save via `inputToNum`.
  const [numericText, setNumericText] = useState<Record<string, string>>(() => ({
    birthYear: numToInput(initialValue.birthYear),
    typicalWorkoutDurationMin: numToInput(initialValue.typicalWorkoutDurationMin),
  }));
  // Body weight + height units follow the user's global unit preference
  // so the editor matches onboarding and the rest of the OS.
  const { unitPreferences } = useAppStore();

  useEffect(() => {
    if (visible) {
      setDraft(initialValue);
      setNumericText({
        birthYear: numToInput(initialValue.birthYear),
        goalWeightLbs: numToInput(initialValue.goalWeightLbs),
        typicalWorkoutDurationMin: numToInput(initialValue.typicalWorkoutDurationMin),
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
      // Body weight + height are already canonical (lbs / cm) and
      // range-validated by the shared BodyMeasure fields.
      bodyWeightLbs: draft.bodyWeightLbs,
      heightCm: draft.heightCm,
      birthYear: coerceNumeric(numericText.birthYear, 1900, new Date().getFullYear()),
      biologicalSex: draft.biologicalSex,
      // The identity editor doesn't expose activity level (onboarding
      // owns it) — preserve the captured value rather than dropping it.
      activityLevel: draft.activityLevel,
      // Lifestyle fields are captured in onboarding; preserve them
      // through an identity edit rather than resetting to defaults.
      caffeineHabit: draft.caffeineHabit,
      occupationType: draft.occupationType,
      frequentTraveler: draft.frequentTraveler,
      // Performance Profile (Section 19). trainingLevel / primaryGoal /
      // sweatClassification are MAJOR variables — a change mints a version.
      // goalWeightLbs + typicalWorkoutDurationMin are baseline inputs only.
      trainingLevel: draft.trainingLevel,
      primaryGoal: draft.primaryGoal,
      sweatClassification: draft.sweatClassification,
      // Goal weight is held canonically (lbs) by the unit-aware WeightField.
      goalWeightLbs: draft.goalWeightLbs,
      typicalWorkoutDurationMin: coerceNumeric(
        numericText.typicalWorkoutDurationMin ?? '',
        WORKOUT_DURATION_MIN,
        WORKOUT_DURATION_MAX,
      ),
    };
    Haptics.selectionAsync().catch(() => {});
    onSave(sanitized);
  };

  return (
    <AFModal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{t('settings.editProfile.title')}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('settings.editProfile.close_a11y')}
            >
              <Icon name="x" size={20} color={Colors.text.muted} />
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
          >
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('settings.editProfile.avatar_label')}</Text>
              <TextInput
                value={draft.avatarUri}
                onChangeText={(next) => setField('avatarUri', next)}
                placeholder={t('settings.editProfile.avatar_ph')}
                placeholderTextColor={Colors.text.muted}
                maxLength={AVATAR_URI_MAX_LEN}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
                accessibilityLabel={t('settings.editProfile.avatar_a11y')}
                testID="edit-profile-avatarUri"
              />
              <Text style={styles.hint}>
                {t('settings.editProfile.avatar_hint')}
              </Text>
            </View>

            {TEXT_FIELDS.map((field) => {
              const label = t(`settings.editProfile.${field.labelKey}`);
              return (
              <View key={field.key} style={styles.field}>
                <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
                <TextInput
                  value={draft[field.key]}
                  onChangeText={(next) => setField(field.key, next)}
                  placeholder={t(`settings.editProfile.${field.phKey}`)}
                  placeholderTextColor={Colors.text.muted}
                  maxLength={FIELD_MAX_LEN}
                  autoCapitalize={field.autoCapitalize}
                  autoCorrect={false}
                  style={styles.input}
                  accessibilityLabel={label}
                  testID={`edit-profile-${field.key}`}
                />
                {field.hintKey ? (
                  <Text style={styles.hint}>{t(`settings.editProfile.${field.hintKey}`)}</Text>
                ) : null}
              </View>
              );
            })}

            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>{t('settings.editProfile.section_body_model')}</Text>
            <Text style={styles.sectionHint}>
              {t('settings.editProfile.section_body_model_hint')}
            </Text>

            <WeightField
              bodyWeightLbs={draft.bodyWeightLbs}
              unit={unitPreferences.weight}
              onChange={(lbs) => setField('bodyWeightLbs', lbs)}
              testID="edit-profile-bodyWeightLbs"
            />
            <HeightField
              heightCm={draft.heightCm}
              unit={unitPreferences.height}
              onChange={(cm) => setField('heightCm', cm)}
              allowClear
              testID="edit-profile-heightCm"
            />

            {NUMERIC_FIELDS.map((field) => (
              <View key={field.key} style={styles.field}>
                <Text style={styles.fieldLabel}>{t(`settings.editProfile.${field.labelKey}`).toUpperCase()}</Text>
                <TextInput
                  value={numericText[field.key]}
                  onChangeText={(next) =>
                    setNumericText((m) => ({ ...m, [field.key]: next.replace(/[^0-9]/g, '') }))
                  }
                  placeholder={t(`settings.editProfile.${field.phKey}`)}
                  placeholderTextColor={Colors.text.muted}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={field.digits}
                  autoCorrect={false}
                  style={styles.input}
                  accessibilityLabel={t(`settings.editProfile.${field.labelKey}`)}
                  testID={`edit-profile-${field.key}`}
                />
              </View>
            ))}

            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>{t('settings.editProfile.section_bio')}</Text>
            <Text style={styles.sectionHint}>
              {t('settings.editProfile.section_bio_hint')}
            </Text>

            <View style={styles.field}>
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
                      accessibilityLabel={t('settings.editProfile.bio_a11y', { sex })}
                      testID={`edit-profile-sex-${sex}`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? Colors.accent.primary : Colors.text.secondary },
                        ]}
                      >
                        {t(`settings.editProfile.${SEX_LABEL[sex]}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>{t('settings.editProfile.section_perf')}</Text>
            <Text style={styles.sectionHint}>
              {t('settings.editProfile.section_perf_hint')}
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('settings.editProfile.field_training')}</Text>
              <View style={styles.auraRow}>
                {TRAINING_LEVELS.map((level) => {
                  const selected = draft.trainingLevel === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setField('trainingLevel', level);
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
                      accessibilityLabel={t('settings.editProfile.training_a11y', { level })}
                      testID={`edit-profile-trainingLevel-${level}`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? Colors.accent.primary : Colors.text.secondary },
                        ]}
                      >
                        {level}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('settings.editProfile.field_primary_goal')}</Text>
              <View style={styles.auraRow}>
                {PRIMARY_GOALS.map((goal) => {
                  const selected = draft.primaryGoal === goal;
                  return (
                    <Pressable
                      key={goal}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setField('primaryGoal', goal);
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
                      accessibilityLabel={t('settings.editProfile.primary_goal_a11y', { goal })}
                      testID={`edit-profile-primaryGoal-${goal}`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? Colors.accent.primary : Colors.text.secondary },
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
              <Text style={styles.fieldLabel}>{t('settings.editProfile.field_sweat')}</Text>
              <View style={styles.auraRow}>
                {SWEAT_CLASSIFICATIONS.map((level) => {
                  const selected = draft.sweatClassification === level;
                  const label = t(`settings.editProfile.${SWEAT_LABEL[level]}`);
                  return (
                    <Pressable
                      key={level}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setField('sweatClassification', level);
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
                      accessibilityLabel={t('settings.editProfile.sweat_a11y', { label })}
                      testID={`edit-profile-sweatClassification-${level}`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? Colors.accent.primary : Colors.text.secondary },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <WeightField
              bodyWeightLbs={draft.goalWeightLbs}
              unit={unitPreferences.weight}
              label={t('settings.editProfile.goal_weight', {
                unit:
                  unitPreferences.weight === 'kg'
                    ? t('settings.editProfile.unit_kg')
                    : t('settings.editProfile.unit_lbs'),
              })}
              onChange={(lbs) => setField('goalWeightLbs', lbs)}
              testID="edit-profile-goalWeightLbs"
            />

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('settings.editProfile.field_workout')}</Text>
              <TextInput
                value={numericText.typicalWorkoutDurationMin}
                onChangeText={(next) =>
                  setNumericText((m) => ({
                    ...m,
                    typicalWorkoutDurationMin: next.replace(/[^0-9]/g, ''),
                  }))
                }
                placeholder={t('settings.editProfile.workout_ph')}
                placeholderTextColor={Colors.text.muted}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={3}
                autoCorrect={false}
                style={styles.input}
                accessibilityLabel={t('settings.editProfile.workout_a11y')}
                testID="edit-profile-typicalWorkoutDurationMin"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('settings.editProfile.field_aura')}</Text>
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
                      accessibilityLabel={t('settings.editProfile.aura_a11y', { aura })}
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

            <View style={styles.sectionDivider} />
            <Text style={styles.sectionLabel}>{t('settings.editProfile.section_lifestyle')}</Text>
            <Text style={styles.sectionHint}>
              {t('settings.editProfile.section_lifestyle_hint')}
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('settings.editProfile.field_caffeine')}</Text>
              <View style={styles.auraRow}>
                {CAFFEINE_HABIT_OPTIONS.map((opt) => {
                  const selected = draft.caffeineHabit === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setField('caffeineHabit', opt);
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
                      accessibilityLabel={t('settings.editProfile.caffeine_a11y', { opt })}
                      testID={`edit-profile-caffeine-${opt}`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? Colors.accent.primary : Colors.text.secondary },
                        ]}
                      >
                        {t(`settings.editProfile.${CAFFEINE_LABEL[opt]}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('settings.editProfile.field_occupation')}</Text>
              <View style={styles.auraRow}>
                {OCCUPATION_TYPE_OPTIONS.map((opt) => {
                  const selected = draft.occupationType === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setField('occupationType', opt);
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
                      accessibilityLabel={t('settings.editProfile.occupation_a11y', { opt })}
                      testID={`edit-profile-occupation-${opt}`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? Colors.accent.primary : Colors.text.secondary },
                        ]}
                      >
                        {t(`settings.editProfile.${OCCUPATION_LABEL[opt]}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('settings.editProfile.field_traveler')}</Text>
              <View style={styles.auraRow}>
                {[false, true].map((val) => {
                  const selected = draft.frequentTraveler === val;
                  return (
                    <Pressable
                      key={String(val)}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setField('frequentTraveler', val);
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
                      accessibilityLabel={t(
                        val
                          ? 'settings.editProfile.traveler_a11y_yes'
                          : 'settings.editProfile.traveler_a11y_no',
                      )}
                      testID={`edit-profile-traveler-${val ? 'yes' : 'no'}`}
                    >
                      <Text
                        style={[
                          styles.auraLabel,
                          { color: selected ? Colors.accent.primary : Colors.text.secondary },
                        ]}
                      >
                        {t(val ? 'settings.editProfile.traveler_yes' : 'settings.editProfile.traveler_no')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </KeyboardAwareScrollViewCompat>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={[styles.btn, styles.btnGhost]}
              accessibilityRole="button"
              accessibilityLabel={t('settings.editProfile.cancel_a11y')}
            >
              <Text style={styles.btnGhostText}>{t('settings.editProfile.cancel_btn')}</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={[styles.btn, styles.btnPrimary]}
              accessibilityRole="button"
              accessibilityLabel={t('settings.editProfile.save_a11y')}
              testID="edit-profile-save"
            >
              <Text style={styles.btnPrimaryText}>{t('settings.editProfile.save_btn')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </AFModal>
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
