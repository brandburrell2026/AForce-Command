/**
 * VoiceCheckInOverlay — the Voice Check-In™ Morning Calibration ritual.
 *
 * A full-screen, once-per-morning overlay (mounted in AppShell, mirroring
 * OpeningSequence — it touches NO routing). The selected coach asks three
 * questions — Energy (1–5), Stress (1–5), and today's main goal — and the
 * answers are persisted via the dedicated check-in service, which feeds the
 * display-only Brain Energy / Performance Forecast / Command Confidence /
 * Performance Memory surfaces. It never dispatches a hydration action, so it
 * cannot move a score (Score-Protection).
 *
 * Voice is purely additive:
 *   • The coach's intro, the three questions, and the acks are STATIC common
 *     phrases — spoken with `cachePolicy: 'static'` + an allowlisted phrase
 *     key so the server serves cached audio and spends no ElevenLabs credit
 *     on the repeat.
 *   • The closing calibration line is personalized, so it is spoken
 *     `cachePolicy: 'dynamic'` (live, never cached).
 *   • Everything is tap-driven: if voice is muted, offline, or autoplay is
 *     blocked, the ritual still completes silently from the on-screen text.
 *
 * Design lock: pure-black canvas, white type, brand red used only as thin
 * hairlines / eyebrows / progress (never fills). Water-First: the closing
 * copy leads with "HYDRATE NOW — start with water" before anything else.
 */
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme/colors';
import { speak, stopSpeaking } from '@/services/textToSpeech';
import { findVoice } from '@/services/voiceCatalog';
import { useAppStore } from '@/store/useAppStore';
import {
  CHECKIN_GOAL_IDS,
  type CheckInGoalId,
  type VoiceCheckInAnswers,
} from '@/utils/voiceCheckIn';
import {
  INTENT_IDS,
  coachingPostureForIntent,
  type CoachingToneKey,
  type IntentId,
} from '@/utils/intentCapture';
import { useIntentCapture } from '@/hooks/useIntentCapture';
import { useFlagsSlice } from '@/store/slices';

const BG = '#0D0D0D';
const WHITE = Colors.text.primary;
const DIM = Colors.text.secondary;
const MUTED = Colors.text.muted;
const BRAND = Colors.accent.brand;

const FONT_EXTRABOLD = 'Inter_800ExtraBold';
const FONT_BOLD = 'Inter_700Bold';
const FONT_SEMIBOLD = 'Inter_600SemiBold';
const FONT_MEDIUM = 'Inter_500Medium';

const EASE = Easing.inOut(Easing.ease);

type Step = 'energy' | 'stress' | 'goal' | 'intent' | 'closing';
const SCALE_VALUES = [1, 2, 3, 4, 5] as const;

/**
 * Tone-aware closing copy. Every variant LEADS with the Water-First line
 * ("HYDRATE NOW — start with water") before anything tone-specific. The
 * `neutral` keys are the original copy, used whenever Intent Capture is off or
 * no intent was selected — so the flow is byte-identical when the flag is off.
 */
const CLOSING_COPY: Record<
  CoachingToneKey,
  { spokenKey: string; spokenDefault: string; bodyKey: string; bodyDefault: string }
> = {
  neutral: {
    spokenKey: 'voiceCheckIn.closing_spoken',
    spokenDefault:
      'Hydrate now. Start with water. Your {{goal}} plan is locked. Let’s perform.',
    bodyKey: 'voiceCheckIn.closing_body',
    bodyDefault:
      'HYDRATE NOW — start with water. {{coach}} has your {{goal}} plan ready.',
  },
  ready: {
    spokenKey: 'voiceCheckIn.closing_spoken_ready',
    spokenDefault:
      'Hydrate now. Start with water. You’re ready — we push today. Lock in.',
    bodyKey: 'voiceCheckIn.closing_body_ready',
    bodyDefault:
      'HYDRATE NOW — start with water. You’re ready — {{coach}} is pushing the pace today.',
  },
  recovering: {
    spokenKey: 'voiceCheckIn.closing_spoken_recovering',
    spokenDefault:
      'Hydrate now. Start with water. We keep it steady and controlled today.',
    bodyKey: 'voiceCheckIn.closing_body_recovering',
    bodyDefault:
      'HYDRATE NOW — start with water. {{coach}} keeps today steady — controlled and consistent.',
  },
  notToday: {
    spokenKey: 'voiceCheckIn.closing_spoken_notToday',
    spokenDefault:
      'Hydrate now. Start with water. Today we protect and recover. No pressure.',
    bodyKey: 'voiceCheckIn.closing_body_notToday',
    bodyDefault:
      'HYDRATE NOW — start with water. {{coach}} keeps it light today — protect and recover.',
  },
};

/** Intent option labels + sublabels (i18n keys with English defaults). */
const INTENT_OPTIONS: Record<
  IntentId,
  { labelKey: string; labelDefault: string; subKey: string; subDefault: string }
> = {
  ready: {
    labelKey: 'voiceCheckIn.intent.ready_label',
    labelDefault: 'Ready',
    subKey: 'voiceCheckIn.intent.ready_sub',
    subDefault: 'Full intensity — let’s push.',
  },
  recovering: {
    labelKey: 'voiceCheckIn.intent.recovering_label',
    labelDefault: 'Recovering',
    subKey: 'voiceCheckIn.intent.recovering_sub',
    subDefault: 'Steady and controlled.',
  },
  notToday: {
    labelKey: 'voiceCheckIn.intent.notToday_label',
    labelDefault: 'Not Today',
    subKey: 'voiceCheckIn.intent.notToday_sub',
    subDefault: 'Protect and recover.',
  },
};

interface Props {
  /** Records today's answers (persistence service). Does NOT close. */
  onComplete: (answers: VoiceCheckInAnswers) => void;
  /** Snooze the ritual (defer to later today) and close the overlay. */
  onSnooze: () => void;
  /** Close the overlay (after the ritual is complete). */
  onClose: () => void;
}

// ─── Fade — opacity+rise wrapper, re-runs whenever `stepKey` changes ──
function Fade({
  stepKey,
  children,
}: {
  stepKey: string;
  children: React.ReactNode;
}) {
  const o = useSharedValue(0);
  const ty = useSharedValue(10);
  React.useEffect(() => {
    o.value = 0;
    ty.value = 10;
    o.value = withTiming(1, { duration: 420, easing: EASE });
    ty.value = withTiming(0, { duration: 420, easing: EASE });
  }, [stepKey, o, ty]);
  const st = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: ty.value }],
  }));
  return <Animated.View style={[styles.stepFill, st]}>{children}</Animated.View>;
}

function haptic() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function VoiceCheckInOverlay({ onComplete, onSnooze, onClose }: Props) {
  const { t } = useTranslation();
  const { selectedVoiceId } = useAppStore();

  const coachLabel = React.useMemo(() => {
    const v = findVoice(selectedVoiceId);
    return v ? `Coach ${v.label}` : t('voiceCheckIn.coach_default', { defaultValue: 'Your coach' });
  }, [selectedVoiceId, t]);

  const [step, setStep] = React.useState<Step>('energy');
  const [energy, setEnergy] = React.useState<number | null>(null);
  const [stress, setStress] = React.useState<number | null>(null);
  const [goal, setGoal] = React.useState<CheckInGoalId | null>(null);
  const [intent, setIntent] = React.useState<IntentId | null>(null);

  const flags = useFlagsSlice();
  const intentEnabled = flags.intent_capture_enabled;
  const { record: recordIntent } = useIntentCapture();

  // Tone-aware closing copy from the declared intent (neutral when none / flag
  // off) — display + spoken only; coachingPostureForIntent never touches score.
  const closingCopy = React.useMemo(
    () => CLOSING_COPY[coachingPostureForIntent(intent).toneKey],
    [intent],
  );

  const finishedRef = React.useRef(false);
  // Speak each phrase at most once per step entry (never on bare re-render).
  const spokenRef = React.useRef<Record<string, boolean>>({});

  const speakOnce = React.useCallback(
    (id: string, text: string, phraseKey?: string) => {
      if (spokenRef.current[id]) return;
      spokenRef.current[id] = true;
      if (!text.trim()) return;
      speak(
        text,
        phraseKey
          ? { cachePolicy: 'static', phraseKey }
          : { cachePolicy: 'dynamic' },
      );
    },
    [],
  );

  // Coach intro — spoken once on mount (static, cached).
  React.useEffect(() => {
    speakOnce(
      'intro',
      t('voiceCheckIn.intro_spoken', {
        defaultValue: "{{coach}} here. Let's calibrate your morning.",
        coach: coachLabel,
      }),
      'checkin.intro',
    );
    return () => {
      stopSpeaking();
    };
  }, [coachLabel, speakOnce, t]);

  // Speak the active question (static, cached) as each step opens.
  React.useEffect(() => {
    if (step === 'energy') {
      speakOnce(
        'q_energy',
        t('voiceCheckIn.q_energy_spoken', {
          defaultValue: "How's your energy this morning? One to five.",
        }),
        'checkin.q_energy',
      );
    } else if (step === 'stress') {
      speakOnce(
        'q_stress',
        t('voiceCheckIn.q_stress_spoken', {
          defaultValue: "And your stress? One to five.",
        }),
        'checkin.q_stress',
      );
    } else if (step === 'goal') {
      speakOnce(
        'q_goal',
        t('voiceCheckIn.q_goal_spoken', {
          defaultValue: "What's today's main goal?",
        }),
        'checkin.q_goal',
      );
    } else if (step === 'intent') {
      speakOnce(
        'q_intent',
        t('voiceCheckIn.intent.q_spoken', {
          defaultValue:
            'How are you showing up today? Ready, recovering, or not today?',
        }),
        'checkin.q_intent',
      );
    }
  }, [step, speakOnce, t]);

  const ack = React.useCallback(() => {
    haptic();
    // A single shared ack key — spoken once so we don't stutter on every tap.
    speakOnce(
      'ack',
      t('voiceCheckIn.ack_spoken', { defaultValue: 'Got it.' }),
      'checkin.ack',
    );
  }, [speakOnce, t]);

  const answerEnergy = (v: number) => {
    setEnergy(v);
    ack();
    setStep('stress');
  };
  const answerStress = (v: number) => {
    setStress(v);
    ack();
    setStep('goal');
  };
  const answerGoal = (g: CheckInGoalId) => {
    setGoal(g);
    haptic();
    setStep(intentEnabled ? 'intent' : 'closing');
  };
  const answerIntent = (i: IntentId) => {
    setIntent(i);
    haptic();
    // Persist to the dedicated intent store — no reducer dispatch, no score.
    void recordIntent(i, 'voiceCheckIn');
    setStep('closing');
  };

  const goalLabel = React.useCallback(
    (g: CheckInGoalId) =>
      t(`voiceCheckIn.goal_${g}`, {
        defaultValue:
          g === 'train'
            ? 'Train'
            : g === 'compete'
              ? 'Compete'
              : g === 'recover'
                ? 'Recover'
                : 'Focus',
      }),
    [t],
  );

  // Closing: persist the answers + speak the personalized (dynamic) line.
  React.useEffect(() => {
    if (step !== 'closing') return;
    if (finishedRef.current) return;
    if (energy == null || stress == null || goal == null) return;
    finishedRef.current = true;

    onComplete({ energy, stress, goal });

    speakOnce(
      'closing',
      t(closingCopy.spokenKey, {
        defaultValue: closingCopy.spokenDefault,
        goal: goalLabel(goal).toLowerCase(),
        coach: coachLabel,
      }),
      // No phraseKey → dynamic, live, never cached.
    );
  }, [
    step,
    energy,
    stress,
    goal,
    onComplete,
    speakOnce,
    goalLabel,
    t,
    closingCopy,
    coachLabel,
  ]);

  const dismiss = React.useCallback(() => {
    stopSpeaking();
    haptic();
    onSnooze();
  }, [onSnooze]);

  // The "LOCK IN" button closes the overlay. The answers were already
  // persisted in the closing effect when the step became 'closing'.
  const onLockIn = React.useCallback(() => {
    stopSpeaking();
    haptic();
    onClose();
  }, [onClose]);

  const totalSteps = intentEnabled ? 4 : 3;
  const stepIndex =
    step === 'energy'
      ? 1
      : step === 'stress'
        ? 2
        : step === 'goal'
          ? 3
          : step === 'intent'
            ? 4
            : totalSteps;

  return (
    <View style={styles.root} accessibilityViewIsModal>
      {/* Top chrome: eyebrow + dismiss */}
      <View style={styles.topBar}>
        <Text style={styles.eyebrow}>
          {t('voiceCheckIn.eyebrow', { defaultValue: 'MORNING CALIBRATION' })}
        </Text>
        {step !== 'closing' && (
          <Pressable
            onPress={dismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('voiceCheckIn.skip_a11y', {
              defaultValue: 'Dismiss morning check-in',
            })}
            testID="voice-checkin-snooze"
          >
            <Text style={styles.snooze}>
              {t('voiceCheckIn.snooze', { defaultValue: 'Not now' })}
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.coachLine}>{coachLabel}</Text>

      {step !== 'closing' && (
        <View style={styles.progressRow}>
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
            <View
              key={i}
              style={[styles.progressPip, i <= stepIndex && styles.progressPipOn]}
            />
          ))}
          <Text style={styles.progressLabel}>
            {t('voiceCheckIn.step', {
              defaultValue: '{{current}} of {{total}}',
              current: stepIndex,
              total: totalSteps,
            })}
          </Text>
        </View>
      )}

      <View style={styles.body}>
        {step === 'energy' && (
          <Fade stepKey="energy">
            <Text style={styles.qTitle}>
              {t('voiceCheckIn.q_energy_title', { defaultValue: "How's your energy?" })}
            </Text>
            <Text style={styles.qHint}>
              {t('voiceCheckIn.q_energy_hint', {
                defaultValue: '1 = drained · 5 = electric',
              })}
            </Text>
            <Scale value={energy} onPick={answerEnergy} />
          </Fade>
        )}

        {step === 'stress' && (
          <Fade stepKey="stress">
            <Text style={styles.qTitle}>
              {t('voiceCheckIn.q_stress_title', { defaultValue: "How's your stress?" })}
            </Text>
            <Text style={styles.qHint}>
              {t('voiceCheckIn.q_stress_hint', {
                defaultValue: '1 = calm · 5 = maxed out',
              })}
            </Text>
            <Scale value={stress} onPick={answerStress} />
          </Fade>
        )}

        {step === 'goal' && (
          <Fade stepKey="goal">
            <Text style={styles.qTitle}>
              {t('voiceCheckIn.q_goal_title', {
                defaultValue: "What's today's main goal?",
              })}
            </Text>
            <View style={styles.goalGrid}>
              {CHECKIN_GOAL_IDS.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => answerGoal(g)}
                  style={({ pressed }) => [
                    styles.goalChip,
                    pressed && styles.goalChipPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={goalLabel(g)}
                  testID={`voice-checkin-goal-${g}`}
                >
                  <Text style={styles.goalChipText}>{goalLabel(g)}</Text>
                </Pressable>
              ))}
            </View>
          </Fade>
        )}

        {step === 'intent' && (
          <Fade stepKey="intent">
            <Text style={styles.qTitle}>
              {t('voiceCheckIn.intent.title', {
                defaultValue: 'How are you showing up today?',
              })}
            </Text>
            <Text style={styles.qHint}>
              {t('voiceCheckIn.intent.hint', {
                defaultValue: 'This sets your coach’s tone — not your score.',
              })}
            </Text>
            <View style={styles.intentGrid}>
              {INTENT_IDS.map((i) => {
                const opt = INTENT_OPTIONS[i];
                return (
                  <Pressable
                    key={i}
                    onPress={() => answerIntent(i)}
                    style={({ pressed }) => [
                      styles.intentChip,
                      pressed && styles.intentChipPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t(opt.labelKey, {
                      defaultValue: opt.labelDefault,
                    })}
                    testID={`voice-checkin-intent-${i}`}
                  >
                    <Text style={styles.intentChipLabel}>
                      {t(opt.labelKey, { defaultValue: opt.labelDefault })}
                    </Text>
                    <Text style={styles.intentChipSub}>
                      {t(opt.subKey, { defaultValue: opt.subDefault })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Fade>
        )}

        {step === 'closing' && (
          <Fade stepKey="closing">
            <Text style={styles.closingEyebrow}>
              {t('voiceCheckIn.closing_title', { defaultValue: 'CALIBRATION LOCKED' })}
            </Text>
            <View style={styles.brandRule} />
            <Text style={styles.closingBody}>
              {t(closingCopy.bodyKey, {
                defaultValue: closingCopy.bodyDefault,
                coach: coachLabel,
                goal: goal ? goalLabel(goal).toLowerCase() : '',
              })}
            </Text>
            <Pressable
              onPress={onLockIn}
              style={({ pressed }) => [
                styles.lockInBtn,
                pressed && styles.lockInBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('voiceCheckIn.cta_done', { defaultValue: 'Lock in' })}
              testID="voice-checkin-lockin"
            >
              <Text style={styles.lockInText}>
                {t('voiceCheckIn.cta_done', { defaultValue: 'LOCK IN' })}
              </Text>
            </Pressable>
          </Fade>
        )}
      </View>
    </View>
  );
}

// ─── Scale — 1..5 tappable pills ─────────────────────────────────────
function Scale({
  value,
  onPick,
}: {
  value: number | null;
  onPick: (v: number) => void;
}) {
  return (
    <View style={styles.scaleRow}>
      {SCALE_VALUES.map((v) => {
        const on = value === v;
        return (
          <Pressable
            key={v}
            onPress={() => onPick(v)}
            style={({ pressed }) => [
              styles.scalePill,
              on && styles.scalePillOn,
              pressed && styles.scalePillPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={String(v)}
            testID={`voice-checkin-scale-${v}`}
          >
            <Text style={[styles.scaleNum, on && styles.scaleNumOn]}>{v}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 1100,
    elevation: 1100,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 48,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: FONT_BOLD,
    fontSize: 12,
    letterSpacing: 3,
    color: BRAND,
  },
  snooze: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    letterSpacing: 0.5,
    color: MUTED,
  },
  coachLine: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 15,
    color: DIM,
    marginTop: 22,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  progressPip: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  progressPipOn: { backgroundColor: BRAND },
  progressLabel: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    letterSpacing: 1,
    color: MUTED,
    marginLeft: 8,
  },
  body: { flex: 1, justifyContent: 'center' },
  stepFill: { width: '100%' },
  qTitle: {
    fontFamily: FONT_EXTRABOLD,
    fontSize: 30,
    letterSpacing: -0.5,
    color: WHITE,
  },
  qHint: {
    fontFamily: FONT_MEDIUM,
    fontSize: 14,
    color: MUTED,
    marginTop: 10,
    marginBottom: 30,
  },
  scaleRow: { flexDirection: 'row', gap: 10 },
  scalePill: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scalePillOn: { borderColor: BRAND, backgroundColor: 'rgba(193,40,27,0.10)' },
  scalePillPressed: { opacity: 0.7 },
  scaleNum: {
    fontFamily: FONT_BOLD,
    fontSize: 22,
    color: DIM,
  },
  scaleNumOn: { color: WHITE },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 30,
  },
  goalChip: {
    width: '47%',
    paddingVertical: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  goalChipPressed: { opacity: 0.7, borderColor: BRAND },
  goalChipText: {
    fontFamily: FONT_BOLD,
    fontSize: 17,
    letterSpacing: 0.5,
    color: WHITE,
  },
  intentGrid: {
    marginTop: 30,
    gap: 12,
  },
  intentChip: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  intentChipPressed: { opacity: 0.7, borderColor: BRAND },
  intentChipLabel: {
    fontFamily: FONT_BOLD,
    fontSize: 19,
    letterSpacing: 0.3,
    color: WHITE,
  },
  intentChipSub: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
  },
  closingEyebrow: {
    fontFamily: FONT_BOLD,
    fontSize: 13,
    letterSpacing: 3,
    color: BRAND,
  },
  brandRule: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: BRAND,
    marginVertical: 18,
  },
  closingBody: {
    fontFamily: FONT_SEMIBOLD,
    fontSize: 22,
    lineHeight: 31,
    color: WHITE,
    marginBottom: 36,
  },
  lockInBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 34,
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: WHITE,
  },
  lockInBtnPressed: { opacity: 0.85 },
  lockInText: {
    fontFamily: FONT_EXTRABOLD,
    fontSize: 14,
    letterSpacing: 2,
    color: '#000000',
  },
});
