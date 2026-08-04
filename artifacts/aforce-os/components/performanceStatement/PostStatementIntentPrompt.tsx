/**
 * PostStatementIntentPrompt — the Intent Capture™ surface shown AFTER a
 * Performance Statement™ has been spoken.
 *
 * The spec wants the Ready / Recovering / Not Today choice "after Voice Check-In
 * OR a Performance Statement". The check-in path lives in VoiceCheckInOverlay;
 * this is the Performance Statement path. The statement itself stays voice-only
 * (PerformanceStatementMount renders nothing) — this is a SEPARATE, spec-
 * sanctioned surface, not a text/quote-card render of the statement.
 *
 * It is deliberately lightweight: a dim backdrop + a single bottom card with the
 * three choices and a "Not now" escape. Tap a choice → record it (source
 * 'performanceStatement') and dismiss; tap the backdrop / "Not now" → dismiss
 * without recording (intent capture is always optional).
 *
 * Score-Protection: selecting an intent only adjusts the coach's TONE/intensity
 * via the dedicated intent service — it dispatches no reducer action and never
 * awards, mutates, or fabricates a hydration point, performance band, or score.
 *
 * No double-ask: if an intent was already captured today (e.g. via the morning
 * check-in) this renders nothing and resolves immediately. The parent only
 * mounts it when `intent_capture_enabled` is on AND a statement was just spoken,
 * so with intent capture off it never runs (no store hydration, no UI).
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/theme/colors';
import { afMotion } from '@/theme/afTokens';
import { INTENT_IDS, type IntentId } from '@/utils/intentCapture';
import { useIntentCapture } from '@/hooks/useIntentCapture';

const CARD = '#0A0A0A';
const WHITE = Colors.text.primary;
const MUTED = Colors.text.muted;
const BRAND = Colors.accent.brand;

const FONT_EXTRABOLD = 'Inter_800ExtraBold';
const FONT_BOLD = 'Inter_700Bold';
const FONT_MEDIUM = 'Inter_500Medium';

const EASE = Easing.inOut(Easing.ease);
/** Let the spoken statement breathe before the prompt rises in. */
const ENTER_DELAY_MS = 600;

/** Reuses the already-localised check-in intent copy (en/es/fr/de/pt/it + more). */
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

export function PostStatementIntentPrompt({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { hydrated, todayIntent, record } = useIntentCapture();

  // Only decide once the per-day store has loaded, so we never flash the prompt
  // and then discover an intent was already captured today (e.g. via the morning
  // check-in). Until hydrated we render nothing and simply wait.
  const alreadyToday = hydrated && todayIntent != null;
  const show = hydrated && todayIntent == null;

  // If today's intent is already on record, resolve immediately (no double-ask).
  React.useEffect(() => {
    if (alreadyToday) onDone();
  }, [alreadyToday, onDone]);

  const opacity = useSharedValue(0);
  const ty = useSharedValue(24);
  // Arm interactivity only after the entrance delay so the (briefly invisible)
  // overlay can never steal or dismiss a tap before the user can see it.
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!show) return;
    // ENTER (afMotion pattern #1), delayed. Was 420ms — judged down to
    // durations.slow (360, diff 60ms): a card rising in after a spoken
    // pause, not a full-screen entrance that needs the longer register.
    // EASE (Easing.inOut(Easing.ease)) is NOT the standardOut curve, so it
    // stays local rather than being swapped for the token easing.
    opacity.value = withDelay(
      ENTER_DELAY_MS,
      withTiming(1, { duration: afMotion.durations.slow, easing: EASE, reduceMotion: ReduceMotion.System }),
    );
    ty.value = withDelay(
      ENTER_DELAY_MS,
      withTiming(0, { duration: afMotion.durations.slow, easing: EASE, reduceMotion: ReduceMotion.System }),
    );
    const id = setTimeout(() => setArmed(true), ENTER_DELAY_MS);
    return () => clearTimeout(id);
  }, [show, opacity, ty]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  if (!show) return null;

  const choose = (i: IntentId) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    void record(i, 'performanceStatement');
    onDone();
  };

  return (
    <Animated.View
      style={[styles.root, rootStyle]}
      pointerEvents={armed ? 'auto' : 'none'}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
      />
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.brandRule} />
        <Text style={styles.title}>
          {t('voiceCheckIn.intent.title', {
            defaultValue: 'How are you showing up today?',
          })}
        </Text>
        <Text style={styles.hint}>
          {t('voiceCheckIn.intent.hint', {
            defaultValue: 'This sets your coach’s tone — not your score.',
          })}
        </Text>
        <View style={styles.grid}>
          {INTENT_IDS.map((i) => {
            const opt = INTENT_OPTIONS[i];
            return (
              <Pressable
                key={i}
                onPress={() => choose(i)}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                accessibilityRole="button"
                accessibilityLabel={t(opt.labelKey, { defaultValue: opt.labelDefault })}
                testID={`ps-intent-${i}`}
              >
                <Text style={styles.chipLabel}>
                  {t(opt.labelKey, { defaultValue: opt.labelDefault })}
                </Text>
                <Text style={styles.chipSub}>
                  {t(opt.subKey, { defaultValue: opt.subDefault })}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
          testID="ps-intent-dismiss"
        >
          <Text style={styles.dismissText}>
            {t('voiceCheckIn.snooze', { defaultValue: 'Not now' })}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
    zIndex: 1100,
    elevation: 1100,
  },
  card: {
    backgroundColor: CARD,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 40,
  },
  brandRule: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: BRAND,
    marginBottom: 18,
  },
  title: {
    fontFamily: FONT_EXTRABOLD,
    fontSize: 26,
    letterSpacing: -0.5,
    color: WHITE,
  },
  hint: {
    fontFamily: FONT_MEDIUM,
    fontSize: 14,
    color: MUTED,
    marginTop: 10,
  },
  grid: {
    marginTop: 26,
    gap: 12,
  },
  chip: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipPressed: { opacity: 0.7, borderColor: BRAND },
  chipLabel: {
    fontFamily: FONT_BOLD,
    fontSize: 19,
    letterSpacing: 0.3,
    color: WHITE,
  },
  chipSub: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
  },
  dismiss: {
    alignSelf: 'center',
    marginTop: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissPressed: { opacity: 0.6 },
  dismissText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 14,
    letterSpacing: 0.5,
    color: MUTED,
  },
});
