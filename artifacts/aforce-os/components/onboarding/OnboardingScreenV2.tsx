/**
 * Onboarding Engine — first-run setup wizard.
 *
 * Flow: Name ("What should we call you?") → First Moment ("What's coming up
 *       first?", optional; only where One Breath planning is on) — both as in
 *       the approved prototype →
 *       Goal → Activity →
 *       Profile (body model + unit system) →
 *       Lifestyle (caffeine / occupation / travel) → Ready.
 * Designed for a sub-60s setup that lands the user in (tabs), where
 * the existing first command / first water cycle / first win loop
 * already lives — so this wizard captures intent, body model, and
 * lifestyle inputs only; it does NOT rebuild those moments.
 *
 * The first screen of the first-run flow — the cinematic intro is the
 * cold-launch OpeningSequence overlay, so there is no welcome lobby
 * ahead of this. This screen sets the `aforce.hasCompletedOnboarding`
 * flag on finish/skip, so an interrupted first run resumes here rather
 * than skipping setup.
 *
 * Persistence is Profile-side only (zero engine / server change):
 *   - goal          → ProfileIdentity.recoveryGoal (already engine-wired)
 *   - activityLevel → ProfileIdentity.activityLevel (feeds demand adapter)
 *   - weight/height → ProfileIdentity.bodyWeightLbs / heightCm
 *   - age           → ProfileIdentity.birthYear (year only, no DOB)
 *   - sex           → ProfileIdentity.biologicalSex
 *   - caffeine      → ProfileIdentity.caffeineHabit
 *   - occupation    → ProfileIdentity.occupationType
 *   - travel        → ProfileIdentity.frequentTraveler
 *
 * Units: one Imperial/Metric switch adapts the WHOLE OS by writing all
 * four unit preferences at once (weight/temperature/volume/height).
 * Imperial height is selected in half-inch steps; canonical storage is
 * always integer centimetres and pounds.
 *
 * Goal labels are consumer-facing; they map 1:1 onto the five engine
 * RecoveryGoals so personalization is real with no remap.
 *
 * Permissions: the Lifestyle step carries the ONE OS ask in first run —
 * foreground location, for weather-driven hydration demand — as a row whose
 * own copy states what it buys before the member touches the switch. It adds
 * no step (Lifestyle already covers work environment and travel) and no
 * required tap: declining leaves every reading estimated and labelled as
 * such, which is the app's behavior with no grant anyway.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticNotify, hapticSelection } from '@/services/haptics';
import { router } from 'expo-router';

import { recordOnboardingCompleted } from '@/services/analytics';
import { emit } from '@/analytics/event_dispatcher';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Icon } from '@/components/Icon';
import { HeightField, WeightField } from '@/components/bodyModel';
import { useUser } from '@clerk/expo';
import { useAppStore } from '@/store/useAppStore';
import { useFirstMomentAvailable } from '@/hooks/useFirstMomentAvailable';
import { writeFirstMomentChoice } from '@/services/firstMomentChoice';
import { FIRST_MOMENT_OPTIONS, type FirstMomentChoice } from '@/utils/firstMoment';
import { useProfileIdentitySlice } from '@/store/slices';
import { saveProfileVersion } from '@/services/profileSyncService';
import { af } from '@/theme';
import {
  ACTIVITY_LEVEL_MAX,
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
} from '@/utils/profileIdentity';
import {
  inferMeasurementSystem,
  unitPreferencesForMeasurementSystem,
  type MeasurementSystem,
} from '@/utils/units';

type Step =
  | 'name'
  | 'prep'
  | 'goal'
  | 'activity'
  | 'profile'
  | 'lifestyle'
  | 'ready';
// The first step is the approved prototype's "What should we call you?". The
// three older promise slides that used to open this wizard are gone: the
// promise now lives on the signed-out promise screen (components/auth/
// PromiseScreen), and nothing here repeats it.
const INPUT_STEPS: Step[] = ['goal', 'activity', 'profile', 'lifestyle'];

/** Longest first name the step accepts. */
export const FIRST_NAME_MAX = 40;

// Age guardrails for the year-of-birth conversion.
const AGE_MIN = 13;
const AGE_MAX = 100;

interface GoalOption {
  goal: PrimaryGoal;
  titleKey: string;
  subKey: string;
}

// Section 19 Primary Goal (the §19 canonical 7-value objective). Replaces the
// older 5-value recoveryGoal question (B′): one goal question, no junk 7→5
// mapping. recoveryGoal is retained only as a display fallback (no engine
// consumes it) — see docs / profileIdentity.ts.
const GOAL_OPTIONS: readonly GoalOption[] = [
  { goal: 'Fat Loss', titleKey: 'goal_fatloss_title', subKey: 'goal_fatloss_sub' },
  { goal: 'Lean Performance', titleKey: 'goal_lean_title', subKey: 'goal_lean_sub' },
  { goal: 'Strength & Muscle', titleKey: 'goal_strength_title', subKey: 'goal_strength_sub' },
  { goal: 'Performance Maintenance', titleKey: 'goal_maintenance_title', subKey: 'goal_maintenance_sub' },
  { goal: 'Endurance', titleKey: 'goal_endurance_title', subKey: 'goal_endurance_sub' },
  { goal: 'Recovery Optimization', titleKey: 'goal_recovery_title', subKey: 'goal_recovery_sub' },
  { goal: 'Everyday Energy', titleKey: 'goal_everyday_title', subKey: 'goal_everyday_sub' },
] as const;

interface ActivityOption {
  value: number;
  titleKey: string;
  subKey: string;
}

const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  { value: 2, titleKey: 'activity_sedentary_title', subKey: 'activity_sedentary_sub' },
  { value: 4, titleKey: 'activity_light_title', subKey: 'activity_light_sub' },
  { value: 6, titleKey: 'activity_moderate_title', subKey: 'activity_moderate_sub' },
  { value: 8, titleKey: 'activity_very_title', subKey: 'activity_very_sub' },
  { value: ACTIVITY_LEVEL_MAX, titleKey: 'activity_athlete_title', subKey: 'activity_athlete_sub' },
] as const;

const SEX_OPTIONS: readonly { value: BiologicalSex; labelKey: string }[] = [
  { value: 'male', labelKey: 'sex_male' },
  { value: 'female', labelKey: 'sex_female' },
  { value: 'non-binary', labelKey: 'sex_nonbinary' },
  { value: 'unspecified', labelKey: 'sex_prefer' },
] as const;

// Caffeine is REQUIRED to advance the lifestyle step — `unspecified` is
// intentionally omitted from the UI (it stays the silent default only if
// the user skips the whole wizard).
interface CaffeineOption {
  value: Exclude<CaffeineHabit, 'unspecified'>;
  titleKey: string;
  subKey: string;
}

const CAFFEINE_OPTIONS: readonly CaffeineOption[] = [
  { value: 'none', titleKey: 'caffeine_none_title', subKey: 'caffeine_none_sub' },
  { value: 'low', titleKey: 'caffeine_light_title', subKey: 'caffeine_light_sub' },
  { value: 'moderate', titleKey: 'caffeine_moderate_title', subKey: 'caffeine_moderate_sub' },
  { value: 'high', titleKey: 'caffeine_heavy_title', subKey: 'caffeine_heavy_sub' },
] as const;

const OCCUPATION_OPTIONS: readonly {
  value: Exclude<OccupationType, 'unspecified'>;
  labelKey: string;
}[] = [
  { value: 'desk', labelKey: 'occ_desk' },
  { value: 'active', labelKey: 'occ_feet' },
  { value: 'outdoor', labelKey: 'occ_outdoor' },
  { value: 'shift', labelKey: 'occ_shift' },
  { value: 'other', labelKey: 'occ_other' },
] as const;

const SYSTEM_OPTIONS: readonly { value: MeasurementSystem; labelKey: string }[] = [
  { value: 'imperial', labelKey: 'sys_imperial' },
  { value: 'metric', labelKey: 'sys_metric' },
] as const;

function parseInRange(text: string, min: number, max: number): number | null {
  const n = Number.parseInt(text.trim(), 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function OnboardingScreenV2() {
  const { t } = useTranslation();
  const { setProfileIdentity, setUnitPreference, unitPreferences } = useAppStore();
  const currentIdentity = useProfileIdentitySlice();

  const clerkUser = useUser().user;
  const [step, setStep] = React.useState<Step>('name');
  // First name lives on the member's account (Clerk), where Home's greeting
  // and the profile initials already read it. Prefilled when the account has
  // one (Google sign-up); saved only when the member changes it.
  const [firstName, setFirstName] = React.useState('');
  const [nameTouched, setNameTouched] = React.useState(false);
  const [nameSaving, setNameSaving] = React.useState(false);
  const [nameError, setNameError] = React.useState(false);
  // "What's coming up first?" — optional, one answer, and shown only where
  // the Home card it chooses can really open a plan.
  const prepAvailable = useFirstMomentAvailable();
  const afterName: Step = prepAvailable ? 'prep' : 'goal';
  const [prep, setPrep] = React.useState<FirstMomentChoice | null>(null);
  const accountFirstName = clerkUser?.firstName ?? '';
  React.useEffect(() => {
    if (!nameTouched && accountFirstName) setFirstName(accountFirstName);
  }, [accountFirstName, nameTouched]);
  const [primaryGoal, setPrimaryGoal] = React.useState<PrimaryGoal | null>(null);
  const [activityLevel, setActivityLevel] = React.useState<number | null>(null);
  // Performance Profile (Section 19).
  const [trainingLevel, setTrainingLevel] = React.useState<TrainingLevel | null>(null);
  const [sweatClass, setSweatClass] = React.useState<SweatClassification | null>(null);
  // Goal weight is held canonically (lbs); the unit-aware WeightField converts.
  const [goalWeightLbs, setGoalWeightLbs] = React.useState<number | null>(null);
  const [workoutText, setWorkoutText] = React.useState('');
  // Single unit system, seeded from whatever the user already has.
  const [system, setSystem] = React.useState<MeasurementSystem>(() =>
    inferMeasurementSystem(unitPreferences),
  );
  const [bodyWeightLbs, setBodyWeightLbs] = React.useState<number | null>(null);
  const [ageText, setAgeText] = React.useState('');
  // Height + weight are held canonically (cm / lbs); the shared
  // BodyMeasure fields re-derive the display for the active unit system.
  const [heightCm, setHeightCm] = React.useState<number | null>(null);
  const [sex, setSex] = React.useState<BiologicalSex>('unspecified');
  const [caffeine, setCaffeine] = React.useState<CaffeineHabit | null>(null);
  const [occupation, setOccupation] = React.useState<OccupationType | null>(null);
  const [frequentTraveler, setFrequentTraveler] = React.useState(false);
  // Location is the one OS permission this wizard asks for, and it is asked
  // ON the LIFESTYLE step, directly beneath the sentence that explains what
  // it buys — the founder rule is that no permission may be requested before
  // the member understands why. Nothing outside this row may request it: the
  // store's weather effect only ever *reads* the grant (see
  // `store/useAppStore.tsx`). 'unknown' means we have not asked and cannot
  // say; it is not a denial.
  const [locationPermission, setLocationPermission] =
    React.useState<'unknown' | 'granted' | 'denied'>('unknown');
  // A denial the OS will not re-prompt for makes the switch a dead control;
  // the denied line already points at Settings, so lock it rather than leave
  // a tap that visibly does nothing.
  const [locationCanAskAgain, setLocationCanAskAgain] = React.useState(true);

  const tap = React.useCallback(() => {
    hapticSelection();
  }, []);

  // Reflect a grant this install already holds (a re-run of setup, or a
  // member who granted elsewhere) so we neither re-ask nor show an "off"
  // row that contradicts the system. A query, never a prompt.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const Location = await import('expo-location');
        const { status } = await Location.getForegroundPermissionsAsync();
        if (!cancelled && status === 'granted') setLocationPermission('granted');
      } catch {
        // expo-location unavailable (web / test runtime) — stay 'unknown'.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const askForLocation = React.useCallback(async () => {
    tap();
    try {
      const Location = await import('expo-location');
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted' ? 'granted' : 'denied');
      setLocationCanAskAgain(canAskAgain);
    } catch {
      setLocationPermission('denied');
      setLocationCanAskAgain(false);
    }
  }, [tap]);

  const switchSystem = React.useCallback(
    (next: MeasurementSystem) => {
      tap();
      if (next === system) return;
      // Height/weight are stored canonically (cm / lbs), so switching the
      // system only re-labels the inputs — the shared fields re-derive the
      // display for the new unit; no value conversion is needed here.
      setSystem(next);
      // Adapt the whole OS — write all four unit preferences at once.
      const prefs = unitPreferencesForMeasurementSystem(next);
      setUnitPreference('weight', prefs.weight);
      setUnitPreference('temperature', prefs.temperature);
      setUnitPreference('volume', prefs.volume);
      setUnitPreference('height', prefs.height);
    },
    [system, setUnitPreference, tap],
  );

  const finish = React.useCallback(async () => {
    hapticNotify('success');
    const patch: Partial<ProfileIdentity> = {};
    // §19 (B′): one goal question → primaryGoal (the major snapshot slot).
    if (primaryGoal) patch.primaryGoal = primaryGoal;
    if (activityLevel != null) patch.activityLevel = activityLevel;

    // Weight + height are already canonical (lbs / cm) and range-validated
    // by the shared BodyMeasure fields — persist them as-is.
    if (bodyWeightLbs != null) patch.bodyWeightLbs = bodyWeightLbs;
    if (heightCm != null) patch.heightCm = heightCm;

    // Age (whole years) → birthYear. Year only — no DOB precision.
    const age = parseInRange(ageText, AGE_MIN, AGE_MAX);
    if (age != null) patch.birthYear = new Date().getFullYear() - age;

    if (sex !== 'unspecified') patch.biologicalSex = sex;
    if (caffeine) patch.caffeineHabit = caffeine;
    if (occupation) patch.occupationType = occupation;
    patch.frequentTraveler = frequentTraveler;

    // Performance Profile (Section 19). Training level + sweat level are MAJOR
    // variables; goal weight + workout duration are baseline inputs only.
    if (trainingLevel) patch.trainingLevel = trainingLevel;
    if (sweatClass) patch.sweatClassification = sweatClass;
    if (goalWeightLbs != null) patch.goalWeightLbs = goalWeightLbs;
    const workout = parseInRange(workoutText, WORKOUT_DURATION_MIN, WORKOUT_DURATION_MAX);
    if (workout != null) patch.typicalWorkoutDurationMin = workout;

    setProfileIdentity(patch);

    // Q3: a completed onboarding mints the initial Profile Version™ through
    // the Section-18 path. Build the merged identity locally (the store
    // update is async) and let the sync service diff + POST. Best-effort —
    // a failed POST keeps the local profile and retries on the next save.
    const nextIdentity: ProfileIdentity = { ...currentIdentity, ...patch };
    void saveProfileVersion(nextIdentity).catch(() => {});

    try {
      await AsyncStorage.setItem('aforce.hasCompletedOnboarding', 'true');
    } catch {
      // Non-fatal — the user still enters the app; they may just see
      // the welcome again next cold start.
    }
    // Internal analytics (Priority #4) — record onboarding completion at
    // its precise moment. Best-effort; never blocks entry to the app.
    void recordOnboardingCompleted(new Date().toISOString());
    // Internal analytics pipeline (Task #39) — consent-gated no-op until
    // the user opts in.
    void emit('onboarding_completed');
    router.replace('/(tabs)');
  }, [
    primaryGoal,
    activityLevel,
    bodyWeightLbs,
    ageText,
    heightCm,
    sex,
    caffeine,
    occupation,
    frequentTraveler,
    trainingLevel,
    sweatClass,
    goalWeightLbs,
    workoutText,
    currentIdentity,
    setProfileIdentity,
  ]);

  // Saves the name to the member's account, then moves on. A blank or
  // unchanged name saves nothing. If the save fails the member is told once,
  // and the next press moves on without it rather than trapping them here.
  const submitName = React.useCallback(async () => {
    tap();
    if (nameSaving) return;
    const next = firstName.trim();
    if (!next || next === accountFirstName || !clerkUser || nameError) {
      setNameError(false);
      setStep(afterName);
      return;
    }
    setNameSaving(true);
    try {
      await clerkUser.update({ firstName: next });
      setStep(afterName);
    } catch {
      setNameError(true);
    } finally {
      setNameSaving(false);
    }
  }, [tap, nameSaving, firstName, accountFirstName, clerkUser, nameError, afterName]);

  // Keeps the answer (or clears it, for "Decide later") and moves on. The
  // write is best-effort and never holds the member here.
  const submitPrep = React.useCallback(() => {
    tap();
    void writeFirstMomentChoice(prep);
    setStep('goal');
  }, [tap, prep]);

  const goNext = React.useCallback(() => {
    tap();
    setStep((s) => {
      if (s === 'goal') return 'activity';
      if (s === 'activity') return 'profile';
      if (s === 'profile') return 'lifestyle';
      if (s === 'lifestyle') return 'ready';
      return s;
    });
  }, [tap]);

  const goBack = React.useCallback(() => {
    tap();
    setStep((s) => {
      if (s === 'prep') return 'name';
      if (s === 'goal') return prepAvailable ? 'prep' : 'name';
      if (s === 'activity') return 'goal';
      if (s === 'profile') return 'activity';
      if (s === 'lifestyle') return 'profile';
      if (s === 'ready') return 'lifestyle';
      return s;
    });
  }, [tap, prepAvailable]);

  const stepIndex = INPUT_STEPS.indexOf(step);
  const canContinue =
    // The name is optional — Continue is never gated on it.
    (step === 'name' && !nameSaving) ||
    // Optional: with nothing picked the button reads "Decide later".
    step === 'prep' ||
    (step === 'goal' && primaryGoal != null) ||
    (step === 'activity' && activityLevel != null) ||
    step === 'profile' ||
    // Lifestyle fields are all optional — Continue is never gated here.
    // Anything left unset persists as its 'unspecified' / false default
    // and is a strict no-op in the demand engine.
    step === 'lifestyle';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        {/* Header: back + progress + skip */}
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={12}
            disabled={step === 'name'}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.v2.back_a11y')}
            style={styles.headerBtn}
          >
            {step !== 'name' && step !== 'ready' ? (
              <Icon name="chevron-left" size={22} color={af.textSecondary} />
            ) : null}
          </Pressable>

          {step === 'ready' ? (
            <View style={styles.dots} />
          ) : step === 'name' || step === 'prep' ? (
            <Text style={styles.stepLabel}>
              {t(step === 'name' ? 'onboarding.v2.name_eyebrow' : 'onboarding.v2.prep_eyebrow').toUpperCase()}
            </Text>
          ) : (
            <View style={styles.dots}>
              {INPUT_STEPS.map((s, i) => (
                <View
                  key={s}
                  style={[styles.dot, i <= stepIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}

          <Pressable
            onPress={() => {
              tap();
              finish();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.v2.skip_a11y')}
            accessibilityElementsHidden={step === 'ready'}
            importantForAccessibility={step === 'ready' ? 'no-hide-descendants' : 'auto'}
            style={styles.headerBtn}
          >
            {step !== 'ready' ? <Text style={styles.skip}>{t('onboarding.v2.skip')}</Text> : null}
          </Pressable>
        </View>

        <KeyboardAwareScrollViewCompat
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={24}
        >
          {step === 'name' && (
            <View testID="onboarding-name">
              <Text accessibilityRole="header" style={styles.nameTitle}>{t('onboarding.v2.name_title')}</Text>
              <Text style={styles.nameSub}>{t('onboarding.v2.name_sub')}</Text>
              <Text style={styles.nameLabel}>{t('onboarding.v2.name_label')}</Text>
              <TextInput
                style={styles.nameInput}
                value={firstName}
                onChangeText={(v) => {
                  setNameTouched(true);
                  setNameError(false);
                  setFirstName(v.slice(0, FIRST_NAME_MAX));
                }}
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="done"
                onSubmitEditing={submitName}
                maxLength={FIRST_NAME_MAX}
                placeholder={t('onboarding.v2.name_label')}
                placeholderTextColor={af.textTertiary}
                accessibilityLabel={t('onboarding.v2.name_label')}
                testID="onboarding-name-input"
              />
              {nameError ? (
                <Text style={styles.nameError} accessibilityRole="alert" accessibilityLiveRegion="polite">
                  {t('onboarding.v2.name_error')}
                </Text>
              ) : null}
            </View>
          )}

          {step === 'prep' && (
            <View testID="onboarding-prep">
              <Text accessibilityRole="header" style={styles.nameTitle}>{t('onboarding.v2.prep_title')}</Text>
              <Text style={styles.nameSub}>{t('onboarding.v2.prep_sub')}</Text>
              <View style={styles.prepList} accessibilityRole="radiogroup">
                {FIRST_MOMENT_OPTIONS.map((opt) => {
                  const selected = prep === opt.value;
                  const label = t(`onboarding.v2.prep_${opt.value}`);
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        tap();
                        setPrep(selected ? null : opt.value);
                      }}
                      style={[styles.prepRow, selected && styles.prepRowOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={label}
                      testID={`onboarding-prep-${opt.value}`}
                    >
                      <Text style={styles.prepRowText}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 'goal' && (
            <>
              <Text style={styles.kicker}>{t('onboarding.v2.goal_kicker')}</Text>
              <Text style={styles.title}>{t('onboarding.v2.goal_title')}</Text>
              <Text style={styles.lede}>
                {t('onboarding.v2.goal_lede')}
              </Text>
              <View style={styles.list}>
                {GOAL_OPTIONS.map((opt) => {
                  const selected = primaryGoal === opt.goal;
                  return (
                    <Pressable
                      key={opt.goal}
                      onPress={() => {
                        tap();
                        setPrimaryGoal(opt.goal);
                      }}
                      style={[styles.card, selected && styles.cardSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t(`onboarding.v2.${opt.titleKey}`)}
                    >
                      <View style={styles.cardText}>
                        <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                          {t(`onboarding.v2.${opt.titleKey}`)}
                        </Text>
                        <Text style={styles.cardSubtitle}>{t(`onboarding.v2.${opt.subKey}`)}</Text>
                      </View>
                      {selected ? (
                        <Icon name="check-circle" size={22} color={af.red} />
                      ) : (
                        <View style={styles.radio} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 'activity' && (
            <>
              <Text style={styles.kicker}>{t('onboarding.v2.activity_kicker')}</Text>
              <Text style={styles.title}>{t('onboarding.v2.activity_title')}</Text>
              <Text style={styles.lede}>
                {t('onboarding.v2.activity_lede')}
              </Text>
              <View style={styles.list}>
                {ACTIVITY_OPTIONS.map((opt) => {
                  const selected = activityLevel === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        tap();
                        setActivityLevel(opt.value);
                      }}
                      style={[styles.card, selected && styles.cardSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t(`onboarding.v2.${opt.titleKey}`)}
                    >
                      <View style={styles.cardText}>
                        <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                          {t(`onboarding.v2.${opt.titleKey}`)}
                        </Text>
                        <Text style={styles.cardSubtitle}>{t(`onboarding.v2.${opt.subKey}`)}</Text>
                      </View>
                      {selected ? (
                        <Icon name="check-circle" size={22} color={af.red} />
                      ) : (
                        <View style={styles.radio} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {step === 'profile' && (
            <>
              <Text style={styles.kicker}>{t('onboarding.v2.profile_kicker')}</Text>
              <Text style={styles.title}>{t('onboarding.v2.profile_title')}</Text>
              <Text style={styles.lede}>
                {t('onboarding.v2.profile_lede')}
              </Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('onboarding.v2.field_units')}</Text>
                <View style={styles.segment}>
                  {SYSTEM_OPTIONS.map((opt) => {
                    const selected = system === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => switchSystem(opt.value)}
                        style={[styles.segmentItem, selected && styles.segmentItemSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t('onboarding.v2.units_a11y', { unit: t(`onboarding.v2.${opt.labelKey}`) })}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            selected && styles.segmentLabelSelected,
                          ]}
                        >
                          {t(`onboarding.v2.${opt.labelKey}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <WeightField
                bodyWeightLbs={bodyWeightLbs}
                unit={system === 'metric' ? 'kg' : 'lbs'}
                onChange={setBodyWeightLbs}
              />

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('onboarding.v2.field_age')}</Text>
                <TextInput
                  value={ageText}
                  onChangeText={setAgeText}
                  keyboardType="number-pad"
                  placeholder={t('onboarding.v2.placeholder_age')}
                  placeholderTextColor={af.textDisabled}
                  style={styles.input}
                  maxLength={3}
                  accessibilityLabel={t('onboarding.v2.a11y_age')}
                />
              </View>

              <HeightField
                heightCm={heightCm}
                unit={system === 'metric' ? 'cm' : 'ft'}
                onChange={setHeightCm}
              />

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('onboarding.v2.field_sex')}</Text>
                <View style={styles.segment}>
                  {SEX_OPTIONS.map((opt) => {
                    const selected = sex === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => {
                          tap();
                          setSex(opt.value);
                        }}
                        style={[styles.segmentItem, selected && styles.segmentItemSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t(`onboarding.v2.${opt.labelKey}`)}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            selected && styles.segmentLabelSelected,
                          ]}
                        >
                          {t(`onboarding.v2.${opt.labelKey}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('onboarding.v2.field_training')}</Text>
                <View style={styles.segment}>
                  {TRAINING_LEVELS.map((level) => {
                    const selected = trainingLevel === level;
                    return (
                      <Pressable
                        key={level}
                        onPress={() => {
                          tap();
                          setTrainingLevel(level);
                        }}
                        style={[styles.segmentItem, selected && styles.segmentItemSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t('onboarding.v2.training_a11y', { level })}
                      >
                        <Text
                          style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}
                        >
                          {level}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('onboarding.v2.field_sweat')}</Text>
                <View style={styles.segment}>
                  {SWEAT_CLASSIFICATIONS.map((level) => {
                    const selected = sweatClass === level;
                    const label =
                      level === 'very_heavy'
                        ? t('onboarding.v2.sweat_very_heavy')
                        : level.charAt(0).toUpperCase() + level.slice(1);
                    return (
                      <Pressable
                        key={level}
                        onPress={() => {
                          tap();
                          setSweatClass(level);
                        }}
                        style={[styles.segmentItem, selected && styles.segmentItemSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t('onboarding.v2.sweat_a11y', { label })}
                      >
                        <Text
                          style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <WeightField
                bodyWeightLbs={goalWeightLbs}
                unit={system === 'metric' ? 'kg' : 'lbs'}
                label={t('onboarding.v2.goal_weight_label', { unit: system === 'metric' ? t('onboarding.v2.unit_kg') : t('onboarding.v2.unit_lbs') })}
                onChange={setGoalWeightLbs}
              />

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('onboarding.v2.field_workout')}</Text>
                <TextInput
                  value={workoutText}
                  onChangeText={(value) => setWorkoutText(value.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder={t('onboarding.v2.placeholder_workout')}
                  placeholderTextColor={af.textDisabled}
                  style={styles.input}
                  maxLength={3}
                  accessibilityLabel={t('onboarding.v2.a11y_workout')}
                />
              </View>
            </>
          )}

          {step === 'lifestyle' && (
            <>
              <Text style={styles.kicker}>{t('onboarding.v2.lifestyle_kicker')}</Text>
              <Text style={styles.title}>{t('onboarding.v2.lifestyle_title')}</Text>
              <Text style={styles.lede}>
                {t('onboarding.v2.lifestyle_lede')}
              </Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('onboarding.v2.field_caffeine')}</Text>
                <View style={styles.list}>
                  {CAFFEINE_OPTIONS.map((opt) => {
                    const selected = caffeine === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => {
                          tap();
                          setCaffeine(opt.value);
                        }}
                        style={[styles.card, selected && styles.cardSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t(`onboarding.v2.${opt.titleKey}`)}
                      >
                        <View style={styles.cardText}>
                          <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                            {t(`onboarding.v2.${opt.titleKey}`)}
                          </Text>
                          <Text style={styles.cardSubtitle}>{t(`onboarding.v2.${opt.subKey}`)}</Text>
                        </View>
                        {selected ? (
                          <Icon name="check-circle" size={22} color={af.red} />
                        ) : (
                          <View style={styles.radio} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  {t('onboarding.v2.field_work_env')}<Text style={styles.optionalTag}>{t('onboarding.v2.optional_tag')}</Text>
                </Text>
                <View style={styles.pillWrap}>
                  {OCCUPATION_OPTIONS.map((opt) => {
                    const selected = occupation === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => {
                          tap();
                          setOccupation(selected ? null : opt.value);
                        }}
                        style={[styles.pill, selected && styles.pillSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t(`onboarding.v2.${opt.labelKey}`)}
                      >
                        <Text
                          style={[styles.pillLabel, selected && styles.pillLabelSelected]}
                        >
                          {t(`onboarding.v2.${opt.labelKey}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.travelerRow}>
                  <View style={styles.travelerText}>
                    <Text style={styles.travelerTitle}>{t('onboarding.v2.traveler_title')}</Text>
                    <Text style={styles.travelerSubtitle}>
                      {t('onboarding.v2.traveler_sub')}
                    </Text>
                  </View>
                  <Switch
                    value={frequentTraveler}
                    onValueChange={(v) => {
                      tap();
                      setFrequentTraveler(v);
                    }}
                    trackColor={{ true: af.red, false: af.surfaceRaised }}
                    thumbColor={af.textPrimary}
                    accessibilityLabel={t('onboarding.v2.traveler_a11y')}
                  />
                </View>
              </View>

              {/* The explanation is on screen before — and beside — the ask.
                  Last row of the last input step, so it is the final thing
                  read before Continue. */}
              <View style={styles.field}>
                <View style={styles.travelerRow}>
                  <View style={styles.travelerText}>
                    <Text style={styles.travelerTitle}>{t('onboarding.v2.location_title')}</Text>
                    <Text style={styles.travelerSubtitle}>
                      {t('onboarding.v2.location_sub')}
                    </Text>
                    {locationPermission !== 'unknown' ? (
                      <Text style={styles.locationStatus} testID="onboarding-location-status">
                        {locationPermission === 'granted'
                          ? t('onboarding.v2.location_connected')
                          : t('onboarding.v2.location_denied')}
                      </Text>
                    ) : null}
                  </View>
                  <Switch
                    value={locationPermission === 'granted'}
                    // Granted is terminal here — the OS owns revocation, same
                    // posture as the calendar screen's "Connected · read-only".
                    disabled={locationPermission === 'granted' || !locationCanAskAgain}
                    onValueChange={(v) => {
                      if (!v) return;
                      void askForLocation();
                    }}
                    trackColor={{ true: af.red, false: af.surfaceRaised }}
                    thumbColor={af.textPrimary}
                    accessibilityLabel={t('onboarding.v2.location_a11y')}
                    testID="onboarding-location-switch"
                  />
                </View>
              </View>
            </>
          )}

          {step === 'ready' && (
            <View style={styles.ready}>
              <Icon name="check-circle" size={56} color={af.red} />
              <Text style={styles.readyTitle}>{t('onboarding.v2.ready_title')}</Text>
              <Text style={styles.readyLede}>
                {t('onboarding.v2.ready_lede')}
              </Text>
              <Text style={styles.mantra}>{t('onboarding.v2.mantra')}</Text>
            </View>
          )}
        </KeyboardAwareScrollViewCompat>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <Pressable
            onPress={step === 'ready' ? finish : step === 'name' ? submitName : step === 'prep' ? submitPrep : goNext}
            disabled={!canContinue && step !== 'ready'}
            style={[
              styles.cta,
              !canContinue && step !== 'ready' && styles.ctaDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              step === 'ready'
                ? t('onboarding.v2.cta_enter_a11y')
                : step === 'prep' && prep == null
                  ? t('onboarding.v2.prep_later')
                  : t('onboarding.v2.cta_continue_a11y')
            }
          >
            <Text style={styles.ctaLabel}>
              {step === 'ready'
                ? t('onboarding.v2.cta_enter')
                : step === 'prep' && prep == null
                  ? t('onboarding.v2.prep_later')
                  : t('onboarding.v2.cta_continue')}
            </Text>
            <Icon name="arrow-right" size={18} color={af.onPrimaryFill} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerBtn: { width: 56, height: 28, justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: af.surfaceRaised,
  },
  dotActive: { backgroundColor: af.red },
  skip: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: af.textSecondary,
    textAlign: 'right',
  },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  stepLabel: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, lineHeight: 14, letterSpacing: 2,
    color: af.textSecondary,
  },
  nameTitle: {
    fontFamily: 'Inter_600SemiBold', fontSize: 32, lineHeight: 34, letterSpacing: -0.96,
    color: af.textPrimary, marginTop: 18, marginBottom: 8,
  },
  nameSub: {
    fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22,
    color: af.textSecondary, marginBottom: 22,
  },
  nameLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary, marginBottom: 6 },
  nameInput: {
    minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.canvas, paddingHorizontal: 14,
    color: af.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 16,
  },
  prepList: { gap: 8 },
  prepRow: {
    minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: af.border,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  prepRowOn: { borderColor: af.textPrimary, backgroundColor: af.surfacePressed },
  prepRowText: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 20, color: af.textPrimary },
  nameError: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.redText, marginTop: 10 },
  kicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: af.redText,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 32,
    lineHeight: 36,
    color: af.textPrimary,
    marginBottom: 12,
  },
  lede: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: af.textSecondary,
    marginBottom: 24,
  },
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.divider,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  cardSelected: {
    borderColor: af.red,
    backgroundColor: af.redDim,
  },
  cardText: { flex: 1, paddingRight: 12 },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: af.textPrimary,
    marginBottom: 3,
  },
  cardTitleSelected: { color: af.redText },
  cardSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: af.textSecondary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: af.borderStrong,
  },
  field: { marginBottom: 22 },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: af.textTertiary,
    marginBottom: 10,
  },
  optionalTag: {
    fontFamily: 'Inter_500Medium',
    color: af.textDisabled,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.divider,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: af.textPrimary,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentItem: {
    flex: 1,
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.divider,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  segmentItemSelected: {
    borderColor: af.red,
    backgroundColor: af.redDim,
  },
  segmentLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: af.textSecondary,
    textAlign: 'center',
  },
  segmentLabelSelected: { color: af.redText },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.divider,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  pillSelected: {
    borderColor: af.red,
    backgroundColor: af.redDim,
  },
  pillLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: af.textSecondary,
  },
  pillLabelSelected: { color: af.redText },
  travelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.divider,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  travelerText: { flex: 1 },
  travelerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: af.textPrimary,
    marginBottom: 3,
  },
  travelerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: af.textSecondary,
  },
  locationStatus: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: af.textTertiary,
    marginTop: 6,
  },
  ready: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    gap: 16,
  },
  readyTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 34,
    color: af.textPrimary,
    marginTop: 8,
  },
  readyLede: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 23,
    color: af.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  mantra: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: af.redText,
    marginTop: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: af.primaryFill,
    borderRadius: 16,
    paddingVertical: 18,
  },
  ctaDisabled: { opacity: 0.35 },
  ctaLabel: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 15,
    letterSpacing: 1.5,
    color: af.onPrimaryFill,
  },
});
