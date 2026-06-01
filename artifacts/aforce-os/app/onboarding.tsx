/**
 * Onboarding Engine — first-run setup wizard.
 *
 * Flow: Goal Selection → Activity Level → Profile Setup → Ready.
 * Designed for a sub-60s setup that lands the user in (tabs), where
 * the existing first command / first water cycle / first win loop
 * already lives — so this wizard captures intent and body model only,
 * it does NOT rebuild those moments.
 *
 * Reached from welcome.tsx once `aforce.hasSeenWelcome` is set; this
 * screen sets the separate `aforce.hasCompletedOnboarding` flag on
 * finish/skip, so an interrupted first run resumes here rather than
 * skipping setup.
 *
 * Persistence is Profile-side only (zero engine / server change):
 *   - goal          → ProfileIdentity.recoveryGoal (already engine-wired)
 *   - activityLevel → ProfileIdentity.activityLevel (feeds demand adapter)
 *   - weight/height → ProfileIdentity.bodyWeightLbs / heightCm
 *   - sex           → ProfileIdentity.biologicalSex
 *
 * Goal labels are consumer-facing; they map 1:1 onto the five
 * engine RecoveryGoals so personalization is real with no remap.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
  type ProfileIdentity,
  type RecoveryGoal,
} from '@/utils/profileIdentity';

type Step = 'goal' | 'activity' | 'profile' | 'ready';
const INPUT_STEPS: Step[] = ['goal', 'activity', 'profile'];

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
  { value: 'unspecified', label: 'Prefer not to say' },
] as const;

function parseInRange(text: string, min: number, max: number): number | null {
  const n = Number.parseInt(text.trim(), 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export default function Onboarding() {
  const { setProfileIdentity } = useAppStore();

  const [step, setStep] = React.useState<Step>('goal');
  const [goal, setGoal] = React.useState<RecoveryGoal | null>(null);
  const [activityLevel, setActivityLevel] = React.useState<number | null>(null);
  const [weightText, setWeightText] = React.useState('');
  const [heightText, setHeightText] = React.useState('');
  const [sex, setSex] = React.useState<BiologicalSex>('unspecified');

  const tap = React.useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const finish = React.useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const patch: Partial<ProfileIdentity> = {};
    if (goal) patch.recoveryGoal = goal;
    if (activityLevel != null) patch.activityLevel = activityLevel;
    const w = parseInRange(weightText, WEIGHT_LBS_MIN, WEIGHT_LBS_MAX);
    if (w != null) patch.bodyWeightLbs = w;
    const h = parseInRange(heightText, HEIGHT_CM_MIN, HEIGHT_CM_MAX);
    if (h != null) patch.heightCm = h;
    if (sex !== 'unspecified') patch.biologicalSex = sex;
    setProfileIdentity(patch);
    try {
      await AsyncStorage.setItem('aforce.hasCompletedOnboarding', 'true');
    } catch {
      // Non-fatal — the user still enters the app; they may just see
      // the welcome again next cold start.
    }
    router.replace('/(tabs)');
  }, [goal, activityLevel, weightText, heightText, sex, setProfileIdentity]);

  const goNext = React.useCallback(() => {
    tap();
    setStep((s) => {
      if (s === 'goal') return 'activity';
      if (s === 'activity') return 'profile';
      if (s === 'profile') return 'ready';
      return s;
    });
  }, [tap]);

  const goBack = React.useCallback(() => {
    tap();
    setStep((s) => {
      if (s === 'activity') return 'goal';
      if (s === 'profile') return 'activity';
      if (s === 'ready') return 'profile';
      return s;
    });
  }, [tap]);

  const stepIndex = INPUT_STEPS.indexOf(step);
  const canContinue =
    (step === 'goal' && goal != null) ||
    (step === 'activity' && activityLevel != null) ||
    step === 'profile';

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
                <Text style={styles.fieldLabel}>BODY WEIGHT (LBS)</Text>
                <TextInput
                  value={weightText}
                  onChangeText={setWeightText}
                  keyboardType="number-pad"
                  placeholder="e.g. 175"
                  placeholderTextColor={Colors.text.ghost}
                  style={styles.input}
                  maxLength={3}
                  accessibilityLabel="Body weight in pounds"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>HEIGHT (CM)</Text>
                <TextInput
                  value={heightText}
                  onChangeText={setHeightText}
                  keyboardType="number-pad"
                  placeholder="e.g. 180"
                  placeholderTextColor={Colors.text.ghost}
                  style={styles.input}
                  maxLength={3}
                  accessibilityLabel="Height in centimeters"
                />
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
