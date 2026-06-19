/**
 * Onboarding Engine — first-run setup wizard.
 *
 * Flow: Goal → Activity → Profile (body model + unit system) →
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
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { recordOnboardingCompleted } from '@/services/analytics';
import { emit } from '@/analytics/event_dispatcher';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useAppStore } from '@/store/useAppStore';
import { Colors } from '@/theme/colors';
import {
  ACTIVITY_LEVEL_MAX,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  WEIGHT_LBS_MAX,
  WEIGHT_LBS_MIN,
  type BiologicalSex,
  type CaffeineHabit,
  type OccupationType,
  type ProfileIdentity,
  type RecoveryGoal,
} from '@/utils/profileIdentity';
import {
  cmToNearestHalfInches,
  formatHalfInches,
  halfInchesToCm,
  inferMeasurementSystem,
  kgToLbs,
  lbsToKg,
  unitPreferencesForMeasurementSystem,
  type MeasurementSystem,
} from '@/utils/units';

type Step = 'goal' | 'activity' | 'profile' | 'lifestyle' | 'ready';
const INPUT_STEPS: Step[] = ['goal', 'activity', 'profile', 'lifestyle'];

// Age guardrails for the year-of-birth conversion.
const AGE_MIN = 13;
const AGE_MAX = 100;

// Imperial height stepper bounds, derived from the canonical cm range so
// the stepper can never produce an out-of-range value. Defaults seed the
// first tap (≈5'10" / 178 cm) so the user lands on a sensible value.
const MIN_HALF_INCHES = cmToNearestHalfInches(HEIGHT_CM_MIN);
const MAX_HALF_INCHES = cmToNearestHalfInches(HEIGHT_CM_MAX);
const DEFAULT_HALF_INCHES = 140; // 5'10"
const DEFAULT_CM = 178;

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

interface GoalOption {
  goal: RecoveryGoal;
  title: string;
  subtitle: string;
}

const GOAL_OPTIONS: readonly GoalOption[] = [
  { goal: 'PERFORMANCE', title: 'Peak Performance', subtitle: 'Train hard, perform at your limit' },
  { goal: 'RECOVERY', title: 'Faster Recovery', subtitle: 'Bounce back between sessions' },
  { goal: 'ENDURANCE', title: 'Go the Distance', subtitle: 'Sustained energy for long efforts' },
  { goal: 'BALANCE', title: 'Daily Balance', subtitle: 'Stay sharp through everyday demands' },
  { goal: 'LONGEVITY', title: 'Long-Term Health', subtitle: 'Habits that last for life' },
] as const;

interface ActivityOption {
  value: number;
  title: string;
  subtitle: string;
}

const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  { value: 2, title: 'Mostly Sedentary', subtitle: 'Desk-bound, little exercise' },
  { value: 4, title: 'Lightly Active', subtitle: 'Walks, light workouts weekly' },
  { value: 6, title: 'Moderately Active', subtitle: 'Train a few times a week' },
  { value: 8, title: 'Very Active', subtitle: 'Daily training or labor' },
  { value: ACTIVITY_LEVEL_MAX, title: 'Athlete / Pro', subtitle: 'High-volume competitive load' },
] as const;

const SEX_OPTIONS: readonly { value: BiologicalSex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-Binary' },
  { value: 'unspecified', label: 'Prefer not to say' },
] as const;

// Caffeine is REQUIRED to advance the lifestyle step — `unspecified` is
// intentionally omitted from the UI (it stays the silent default only if
// the user skips the whole wizard).
interface CaffeineOption {
  value: Exclude<CaffeineHabit, 'unspecified'>;
  title: string;
  subtitle: string;
}

const CAFFEINE_OPTIONS: readonly CaffeineOption[] = [
  { value: 'none', title: 'None', subtitle: 'No coffee, tea, or energy drinks' },
  { value: 'low', title: 'Light', subtitle: 'About a cup a day' },
  { value: 'moderate', title: 'Moderate', subtitle: '2–3 cups a day' },
  { value: 'high', title: 'Heavy', subtitle: '4+ cups a day' },
] as const;

const OCCUPATION_OPTIONS: readonly {
  value: Exclude<OccupationType, 'unspecified'>;
  label: string;
}[] = [
  { value: 'desk', label: 'Desk / Office' },
  { value: 'active', label: 'On My Feet' },
  { value: 'outdoor', label: 'Outdoor / Heat' },
  { value: 'shift', label: 'Shift / Irregular' },
  { value: 'other', label: 'Other' },
] as const;

const SYSTEM_OPTIONS: readonly { value: MeasurementSystem; label: string }[] = [
  { value: 'imperial', label: 'Imperial' },
  { value: 'metric', label: 'Metric' },
] as const;

function parseInRange(text: string, min: number, max: number): number | null {
  const n = Number.parseInt(text.trim(), 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export default function Onboarding() {
  const { setProfileIdentity, setUnitPreference, unitPreferences } = useAppStore();

  const [step, setStep] = React.useState<Step>('goal');
  const [goal, setGoal] = React.useState<RecoveryGoal | null>(null);
  const [activityLevel, setActivityLevel] = React.useState<number | null>(null);
  // Single unit system, seeded from whatever the user already has.
  const [system, setSystem] = React.useState<MeasurementSystem>(() =>
    inferMeasurementSystem(unitPreferences),
  );
  const [weightText, setWeightText] = React.useState('');
  const [ageText, setAgeText] = React.useState('');
  // Height is held per-system so the stepper math stays exact; one of
  // these is the active value depending on `system`.
  const [heightHalfInches, setHeightHalfInches] = React.useState<number | null>(null);
  const [heightCmInput, setHeightCmInput] = React.useState<number | null>(null);
  const [sex, setSex] = React.useState<BiologicalSex>('unspecified');
  const [caffeine, setCaffeine] = React.useState<CaffeineHabit | null>(null);
  const [occupation, setOccupation] = React.useState<OccupationType | null>(null);
  const [frequentTraveler, setFrequentTraveler] = React.useState(false);

  const tap = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const heightIsSet =
    system === 'metric' ? heightCmInput != null : heightHalfInches != null;
  const heightDisplay = !heightIsSet
    ? 'Tap to set'
    : system === 'metric'
      ? `${heightCmInput} cm`
      : formatHalfInches(heightHalfInches as number);

  const stepHeight = React.useCallback(
    (direction: 1 | -1) => {
      tap();
      if (system === 'metric') {
        setHeightCmInput((prev) =>
          prev == null
            ? DEFAULT_CM
            : clamp(prev + direction, HEIGHT_CM_MIN, HEIGHT_CM_MAX),
        );
      } else {
        setHeightHalfInches((prev) =>
          prev == null
            ? DEFAULT_HALF_INCHES
            : clamp(prev + direction, MIN_HALF_INCHES, MAX_HALF_INCHES),
        );
      }
    },
    [system, tap],
  );

  const switchSystem = React.useCallback(
    (next: MeasurementSystem) => {
      tap();
      if (next === system) return;
      // Carry any entered values across so the newly-active unit reflects
      // the same physical measurement.
      if (next === 'metric') {
        if (heightHalfInches != null) {
          setHeightCmInput(
            clamp(halfInchesToCm(heightHalfInches), HEIGHT_CM_MIN, HEIGHT_CM_MAX),
          );
        }
      } else if (heightCmInput != null) {
        setHeightHalfInches(
          clamp(cmToNearestHalfInches(heightCmInput), MIN_HALF_INCHES, MAX_HALF_INCHES),
        );
      }
      const wNum = Number.parseInt(weightText.trim(), 10);
      if (Number.isFinite(wNum)) {
        const converted = next === 'metric' ? lbsToKg(wNum) : kgToLbs(wNum);
        setWeightText(String(Math.round(converted)));
      }
      setSystem(next);
      // Adapt the whole OS — write all four unit preferences at once.
      const prefs = unitPreferencesForMeasurementSystem(next);
      setUnitPreference('weight', prefs.weight);
      setUnitPreference('temperature', prefs.temperature);
      setUnitPreference('volume', prefs.volume);
      setUnitPreference('height', prefs.height);
    },
    [system, heightHalfInches, heightCmInput, weightText, setUnitPreference, tap],
  );

  const finish = React.useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const patch: Partial<ProfileIdentity> = {};
    if (goal) patch.recoveryGoal = goal;
    if (activityLevel != null) patch.activityLevel = activityLevel;

    // Weight — entered in the active system's unit, stored as canonical lbs.
    const wNum = Number.parseInt(weightText.trim(), 10);
    if (Number.isFinite(wNum)) {
      const lbs = Math.round(system === 'metric' ? kgToLbs(wNum) : wNum);
      if (lbs >= WEIGHT_LBS_MIN && lbs <= WEIGHT_LBS_MAX) patch.bodyWeightLbs = lbs;
    }

    // Height — canonical integer cm from whichever system is active.
    const cm =
      system === 'metric'
        ? heightCmInput
        : heightHalfInches != null
          ? halfInchesToCm(heightHalfInches)
          : null;
    if (cm != null && cm >= HEIGHT_CM_MIN && cm <= HEIGHT_CM_MAX) patch.heightCm = cm;

    // Age (whole years) → birthYear. Year only — no DOB precision.
    const age = parseInRange(ageText, AGE_MIN, AGE_MAX);
    if (age != null) patch.birthYear = new Date().getFullYear() - age;

    if (sex !== 'unspecified') patch.biologicalSex = sex;
    if (caffeine) patch.caffeineHabit = caffeine;
    if (occupation) patch.occupationType = occupation;
    patch.frequentTraveler = frequentTraveler;

    setProfileIdentity(patch);
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
    goal,
    activityLevel,
    system,
    weightText,
    ageText,
    heightHalfInches,
    heightCmInput,
    sex,
    caffeine,
    occupation,
    frequentTraveler,
    setProfileIdentity,
  ]);

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
      if (s === 'activity') return 'goal';
      if (s === 'profile') return 'activity';
      if (s === 'lifestyle') return 'profile';
      if (s === 'ready') return 'lifestyle';
      return s;
    });
  }, [tap]);

  const stepIndex = INPUT_STEPS.indexOf(step);
  const canContinue =
    (step === 'goal' && goal != null) ||
    (step === 'activity' && activityLevel != null) ||
    step === 'profile' ||
    // Lifestyle fields are all optional — Continue is never gated here.
    // Anything left unset persists as its 'unspecified' / false default
    // and is a strict no-op in the demand engine.
    step === 'lifestyle';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header: back + progress + skip */}
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            hitSlop={12}
            disabled={step === 'goal'}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.headerBtn}
          >
            {step !== 'goal' && step !== 'ready' ? (
              <Icon name="chevron-left" size={22} color={Colors.text.secondary} />
            ) : null}
          </Pressable>

          {step !== 'ready' ? (
            <View style={styles.dots}>
              {INPUT_STEPS.map((s, i) => (
                <View
                  key={s}
                  style={[styles.dot, i <= stepIndex && styles.dotActive]}
                />
              ))}
            </View>
          ) : (
            <View style={styles.dots} />
          )}

          <Pressable
            onPress={() => {
              tap();
              finish();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip setup"
            style={styles.headerBtn}
          >
            {step !== 'ready' ? <Text style={styles.skip}>SKIP</Text> : null}
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'goal' && (
            <>
              <Text style={styles.kicker}>STEP 1 · YOUR GOAL</Text>
              <Text style={styles.title}>What are you{'\n'}optimizing for?</Text>
              <Text style={styles.lede}>
                We tune your hydration intelligence around this.
              </Text>
              <View style={styles.list}>
                {GOAL_OPTIONS.map((opt) => {
                  const selected = goal === opt.goal;
                  return (
                    <Pressable
                      key={opt.goal}
                      onPress={() => {
                        tap();
                        setGoal(opt.goal);
                      }}
                      style={[styles.card, selected && styles.cardSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={opt.title}
                    >
                      <View style={styles.cardText}>
                        <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                          {opt.title}
                        </Text>
                        <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
                      </View>
                      {selected ? (
                        <Icon name="check-circle" size={22} color={Colors.accent.primary} />
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
              <Text style={styles.kicker}>STEP 2 · ACTIVITY</Text>
              <Text style={styles.title}>How active{'\n'}are you?</Text>
              <Text style={styles.lede}>
                Sets your baseline fluid demand. You can change it later.
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
                      accessibilityLabel={opt.title}
                    >
                      <View style={styles.cardText}>
                        <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                          {opt.title}
                        </Text>
                        <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
                      </View>
                      {selected ? (
                        <Icon name="check-circle" size={22} color={Colors.accent.primary} />
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
              <Text style={styles.kicker}>STEP 3 · PROFILE</Text>
              <Text style={styles.title}>A few body{'\n'}basics</Text>
              <Text style={styles.lede}>
                Optional, but sharpens every recommendation.
              </Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>UNITS</Text>
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
                        accessibilityLabel={`${opt.label} units`}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            selected && styles.segmentLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>
                  BODY WEIGHT ({system === 'metric' ? 'KG' : 'LBS'})
                </Text>
                <TextInput
                  value={weightText}
                  onChangeText={setWeightText}
                  keyboardType="number-pad"
                  placeholder={system === 'metric' ? 'e.g. 80' : 'e.g. 175'}
                  placeholderTextColor={Colors.text.ghost}
                  style={styles.input}
                  maxLength={3}
                  accessibilityLabel={`Body weight in ${system === 'metric' ? 'kilograms' : 'pounds'}`}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>AGE</Text>
                <TextInput
                  value={ageText}
                  onChangeText={setAgeText}
                  keyboardType="number-pad"
                  placeholder="e.g. 32"
                  placeholderTextColor={Colors.text.ghost}
                  style={styles.input}
                  maxLength={3}
                  accessibilityLabel="Age in years"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>HEIGHT</Text>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => stepHeight(-1)}
                    style={styles.stepperBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease height"
                  >
                    <Text style={styles.stepperBtnLabel}>−</Text>
                  </Pressable>
                  <View style={styles.stepperValueWrap}>
                    <Text
                      style={[
                        styles.stepperValue,
                        !heightIsSet && styles.stepperValueMuted,
                      ]}
                      accessibilityLabel={`Height ${heightIsSet ? heightDisplay : 'not set'}`}
                    >
                      {heightDisplay}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => stepHeight(1)}
                    style={styles.stepperBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Increase height"
                  >
                    <Text style={styles.stepperBtnLabel}>+</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>BIOLOGICAL SEX</Text>
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
                        accessibilityLabel={opt.label}
                      >
                        <Text
                          style={[
                            styles.segmentLabel,
                            selected && styles.segmentLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {step === 'lifestyle' && (
            <>
              <Text style={styles.kicker}>STEP 4 · LIFESTYLE</Text>
              <Text style={styles.title}>Your daily{'\n'}rhythm</Text>
              <Text style={styles.lede}>
                Caffeine and your day shape how fast you lose water.
              </Text>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>DAILY CAFFEINE</Text>
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
                        accessibilityLabel={opt.title}
                      >
                        <View style={styles.cardText}>
                          <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                            {opt.title}
                          </Text>
                          <Text style={styles.cardSubtitle}>{opt.subtitle}</Text>
                        </View>
                        {selected ? (
                          <Icon name="check-circle" size={22} color={Colors.accent.primary} />
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
                  WORK ENVIRONMENT <Text style={styles.optionalTag}>· OPTIONAL</Text>
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
                        accessibilityLabel={opt.label}
                      >
                        <Text
                          style={[styles.pillLabel, selected && styles.pillLabelSelected]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.travelerRow}>
                  <View style={styles.travelerText}>
                    <Text style={styles.travelerTitle}>Frequent Traveler</Text>
                    <Text style={styles.travelerSubtitle}>
                      Flights and time-zone shifts dry you out faster.
                    </Text>
                  </View>
                  <Switch
                    value={frequentTraveler}
                    onValueChange={(v) => {
                      tap();
                      setFrequentTraveler(v);
                    }}
                    trackColor={{ true: Colors.accent.primary, false: Colors.fill.strong }}
                    thumbColor={Colors.text.primary}
                    accessibilityLabel="Frequent traveler"
                  />
                </View>
              </View>
            </>
          )}

          {step === 'ready' && (
            <View style={styles.ready}>
              <Icon name="check-circle" size={56} color={Colors.accent.primary} />
              <Text style={styles.readyTitle}>You&apos;re set.</Text>
              <Text style={styles.readyLede}>
                Your first command is waiting. Start with water — lock in
                your first cycle and watch your score respond.
              </Text>
              <Text style={styles.mantra}>PAUSE · HYDRATE · LOCK IN · PERFORM</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <Pressable
            onPress={step === 'ready' ? finish : goNext}
            disabled={!canContinue && step !== 'ready'}
            style={[
              styles.cta,
              !canContinue && step !== 'ready' && styles.ctaDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={step === 'ready' ? 'Enter AForce' : 'Continue'}
          >
            <Text style={styles.ctaLabel}>
              {step === 'ready' ? 'ENTER AFORCE' : 'CONTINUE'}
            </Text>
            <Icon name="arrow-right" size={18} color={Colors.text.inverse} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
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
    backgroundColor: Colors.fill.strong,
  },
  dotActive: { backgroundColor: Colors.accent.primary },
  skip: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 1.5,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  kicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: Colors.accent.primary,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 32,
    lineHeight: 36,
    color: Colors.text.primary,
    marginBottom: 12,
  },
  lede: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text.secondary,
    marginBottom: 24,
  },
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  cardSelected: {
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.subtle,
  },
  cardText: { flex: 1, paddingRight: 12 },
  cardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: Colors.text.primary,
    marginBottom: 3,
  },
  cardTitleSelected: { color: Colors.accent.primary },
  cardSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.text.secondary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border.strong,
  },
  field: { marginBottom: 22 },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: Colors.text.muted,
    marginBottom: 10,
  },
  optionalTag: {
    fontFamily: 'Inter_500Medium',
    color: Colors.text.ghost,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: Colors.text.primary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    lineHeight: 30,
    color: Colors.text.primary,
  },
  stepperValueWrap: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.text.primary,
  },
  stepperValueMuted: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.text.ghost,
  },
  segment: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentItem: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  segmentItemSelected: {
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.subtle,
  },
  segmentLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  segmentLabelSelected: { color: Colors.accent.primary },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  pillSelected: {
    borderColor: Colors.accent.primary,
    backgroundColor: Colors.accent.subtle,
  },
  pillLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.text.secondary,
  },
  pillLabelSelected: { color: Colors.accent.primary },
  travelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  travelerText: { flex: 1 },
  travelerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: 3,
  },
  travelerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.text.secondary,
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
    color: Colors.text.primary,
    marginTop: 8,
  },
  readyLede: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 23,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  mantra: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: Colors.accent.primary,
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
    backgroundColor: Colors.accent.primary,
    borderRadius: 16,
    paddingVertical: 18,
  },
  ctaDisabled: { opacity: 0.35 },
  ctaLabel: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 15,
    letterSpacing: 1.5,
    color: Colors.text.inverse,
  },
});
