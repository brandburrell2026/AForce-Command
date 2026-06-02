/**
 * AForce — Investor Demo Overlay (60-second cinematic flow).
 *
 * Full-screen modal that scripts the AForce Command Voice Engine
 * end-to-end so investors can experience every system state in one
 * uninterrupted minute:
 *
 *   Optimal → Depletion → Risk → Calm Command → Ignored → Pressure
 *   Mode → Sharp Command → Cycle Complete → System Reset →
 *   Performance Restored.
 *
 * The overlay is fully self-contained: it does not mutate user state,
 * does not touch the engine pipeline, and does not persist anything.
 * It drives its own animated score / risk-timer / orb visuals while
 * still routing every voice line through the real `commandSpeak()`
 * pipeline so the ElevenLabs proxy, voice bus, and playback lifecycle
 * (the "RECEIVED → TRANSMITTING → EXECUTED" pulses on the live
 * `VoiceStatusModule`) all light up exactly as they would in the
 * field. Closing the overlay restores the underlying app instantly.
 */

import React from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '../../theme/colors';
import { BRAND_LANGUAGE } from '../../services/voice/commandVoice';
import {
  commandSpeak,
  getPlaybackState,
  markCycleExecuted,
  subscribePlayback,
  type PlaybackState,
} from '../../services/voice/commandVoiceBus';
import {
  INVESTOR_DEMO_BEATS,
  INVESTOR_DEMO_TOTAL_MS,
  type DemoBand,
  type DemoBeat,
} from '../../services/demo/investorDemoBeats';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ORB_SIZE = Math.min(SCREEN_W, SCREEN_H) * 0.42;

const BAND_ACCENT: Record<DemoBand, string> = {
  PEAK:     Colors.states.PEAK.primary,
  STABLE:   Colors.states.BALANCED.primary,
  CORRECT:  Colors.states.BALANCED.primary,
  RISK:     Colors.states.RECOVERING.primary,
  CRITICAL: Colors.states.DEPLETED.primary,
};

const BAND_GLOW: Record<DemoBand, string> = {
  PEAK:     Colors.states.PEAK.glow,
  STABLE:   Colors.states.BALANCED.glow,
  CORRECT:  Colors.states.BALANCED.glow,
  RISK:     Colors.states.RECOVERING.glow,
  CRITICAL: Colors.states.DEPLETED.glow,
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function InvestorDemoOverlay({ visible, onClose }: Props) {
  const [beatIndex, setBeatIndex] = React.useState(0);
  const beat = INVESTOR_DEMO_BEATS[beatIndex];

  // Mirror the bus playback state so the caption strip can label
  // RECEIVED / TRANSMITTING / EXECUTED in real time.
  const [playback, setPlayback] = React.useState<PlaybackState>(() => getPlaybackState());
  React.useEffect(() => {
    if (!visible) return;
    return subscribePlayback(setPlayback);
  }, [visible]);

  /* ---------------------------------------------------------------- *
   * Beat scheduler — chains setTimeouts and tears them all down on
   * close so an aborted demo never fires a stale beat.
   * ---------------------------------------------------------------- */
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = React.useRef<number>(0);

  const clearAllTimers = React.useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  React.useEffect(() => {
    if (!visible) {
      clearAllTimers();
      return;
    }
    setBeatIndex(0);
    startedAtRef.current = Date.now();

    INVESTOR_DEMO_BEATS.forEach((b, idx) => {
      timersRef.current.push(
        setTimeout(() => {
          setBeatIndex(idx);
          if (b.voice) {
            commandSpeak(b.voice.line, {
              level: b.voice.level,
              intensity: b.intensity,
              category: b.voice.category,
            });
          }
          if (b.executed) {
            markCycleExecuted();
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }
          }
        }, b.startMs),
      );
    });

    // Auto-close at the end so the investor lands back on the app.
    timersRef.current.push(
      setTimeout(() => {
        onClose();
      }, INVESTOR_DEMO_TOTAL_MS + 800),
    );

    return clearAllTimers;
  }, [visible, clearAllTimers, onClose]);

  /* ---------------------------------------------------------------- *
   * Reanimated drivers — score countdown, orb breathing, voice halo,
   * top progress strip, caption fades.
   * ---------------------------------------------------------------- */

  // Animated score readout — interpolates between beats so the digit
  // tweens cinematically rather than snapping.
  const scoreSV = useSharedValue(beat.score);
  React.useEffect(() => {
    scoreSV.value = withTiming(beat.score, {
      duration: Math.min(2200, beat.durationMs * 0.55),
      easing: Easing.out(Easing.cubic),
    });
  }, [beat.score, beat.durationMs]);

  // Re-render the digit a few times per second while the score animates.
  // useDerivedValue runs on the UI thread, so calling React's JS setter
  // from inside it crashes on Android ("setDisplayedScore is not a
  // function"). useAnimatedReaction + runOnJS is the correct bridge.
  const [displayedScore, setDisplayedScore] = React.useState(beat.score);
  useAnimatedReaction(
    () => Math.round(scoreSV.value),
    (next, prev) => {
      if (next !== prev) {
        runOnJS(setDisplayedScore)(next);
      }
    },
    [scoreSV],
  );

  // Orb pulse — faster on critical bands.
  const orbPulse = useSharedValue(0);
  React.useEffect(() => {
    cancelAnimation(orbPulse);
    if (!visible) return;
    const dur =
      beat.band === 'CRITICAL' ? 600
      : beat.band === 'RISK'   ? 900
      : beat.band === 'STABLE' || beat.band === 'CORRECT' ? 1400
      : 1900;
    orbPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(orbPulse);
  }, [visible, beat.band]);

  // Voice halo — radiates outward while the bus is playing.
  const voiceHalo = useSharedValue(0);
  const voiceActive = playback === 'received' || playback === 'playing';
  React.useEffect(() => {
    cancelAnimation(voiceHalo);
    if (!voiceActive) {
      voiceHalo.value = withTiming(0, { duration: 320 });
      return;
    }
    voiceHalo.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(voiceHalo);
  }, [voiceActive]);

  // Top progress strip — straight 60-second linear sweep.
  const progress = useSharedValue(0);
  React.useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: INVESTOR_DEMO_TOTAL_MS,
      easing: Easing.linear,
    });
    return () => cancelAnimation(progress);
  }, [visible]);

  // Beat title fade — re-fades on every beat change.
  const titleFade = useSharedValue(1);
  React.useEffect(() => {
    titleFade.value = 0;
    titleFade.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) });
  }, [beatIndex]);

  // ─── Chunk #7d v3 pacing ──────────────────────────────────────────
  // Caption cross-fade: when the voice line changes between beats the
  // old line previously snapped. Now we fade out → swap → fade in so
  // the transcript breathes with the engine.
  const captionFade = useSharedValue(1);
  React.useEffect(() => {
    captionFade.value = withSequence(
      withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 340, easing: Easing.out(Easing.cubic) }),
    );
  }, [beatIndex]);

  // Lifecycle pill scale-in: pop on every label transition (RECEIVED →
  // TRANSMITTING → EXECUTED) so investors can SEE the state flip,
  // not just read a snap-change.
  const lifecyclePop = useSharedValue(1);
  const lifecycleLabel =
    playback === 'received'  ? 'RECEIVED'
    : playback === 'playing' ? 'TRANSMITTING'
    : playback === 'executed' ? 'EXECUTED'
    : playback === 'error'   ? 'AUDIO RETRY'
    : null;
  React.useEffect(() => {
    if (!lifecycleLabel) return;
    lifecyclePop.value = 0.85;
    lifecyclePop.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.back(1.6)) });
  }, [lifecycleLabel]);

  // Brand dot breathing — eyebrow now feels alive instead of static.
  const brandPulse = useSharedValue(0);
  React.useEffect(() => {
    if (!visible) {
      cancelAnimation(brandPulse);
      brandPulse.value = 0;
      return;
    }
    brandPulse.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    return () => cancelAnimation(brandPulse);
  }, [visible]);

  /* --------------------------- styles --------------------------- */

  const accent = BAND_ACCENT[beat.band];
  const glow   = BAND_GLOW[beat.band];

  const orbHaloStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(orbPulse.value, [0, 1], [0.35, 0.85]),
    transform: [{ scale: interpolate(orbPulse.value, [0, 1], [1, 1.18]) }],
  }));

  const orbCoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(orbPulse.value, [0, 1], [0.97, 1.05]) }],
    shadowOpacity: interpolate(orbPulse.value, [0, 1], [0.55, 1]),
  }));

  const voiceHaloStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(voiceHalo.value, [0, 0.15, 1], [0, 0.85, 0]),
    transform: [{ scale: interpolate(voiceHalo.value, [0, 1], [1, 1.55]) }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100])}%`,
    backgroundColor: accent,
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleFade.value,
    transform: [{ translateY: interpolate(titleFade.value, [0, 1], [8, 0]) }],
  }));

  const captionStyle = useAnimatedStyle(() => ({
    opacity: captionFade.value,
    transform: [{ translateY: interpolate(captionFade.value, [0, 1], [6, 0]) }],
  }));

  const lifecyclePillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lifecyclePop.value, [0.85, 1], [0.4, 1]),
    transform: [{ scale: lifecyclePop.value }],
  }));

  const brandDotStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(brandPulse.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(brandPulse.value, [0, 1], [0.85, 1.15]) }],
  }));

  const onExit = React.useCallback(() => {
    clearAllTimers();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onClose();
  }, [clearAllTimers, onClose]);

  /* --------------------------- render --------------------------- */

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onExit}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Top bar — eyebrow + EXIT */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <Animated.View style={[styles.brandDot, { backgroundColor: accent, shadowColor: accent }, brandDotStyle]} />
            <Text style={styles.brandLabel} numberOfLines={1}>
              {BRAND_LANGUAGE.engineName.toUpperCase()} · INVESTOR DEMO
            </Text>
          </View>
          <Pressable
            onPress={onExit}
            hitSlop={12}
            style={({ pressed }) => [styles.exitBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Exit investor demo"
            testID="investor-demo-exit"
          >
            <Text style={styles.exitLabel}>EXIT</Text>
          </Pressable>
        </View>

        {/* Linear progress strip */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>

        {/* Beat counter */}
        <View style={styles.beatRow}>
          <Text style={styles.beatCounter}>
            BEAT {String(beat.id).padStart(2, '0')} / {String(INVESTOR_DEMO_BEATS.length).padStart(2, '0')}
          </Text>
          <Text style={styles.intensityChip}>
            INTENSITY · {beat.intensity.toUpperCase()}
          </Text>
        </View>

        {/* Score + risk timer */}
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>HYDRATION SCORE</Text>
          <Text
            style={[styles.scoreValue, { color: accent, textShadowColor: glow }]}
            testID="investor-demo-score"
          >
            {displayedScore}
          </Text>
          <View style={styles.scoreSubRow}>
            <Text style={[styles.bandChip, { color: accent, borderColor: `${accent}55` }]}>
              {beat.band}
            </Text>
            <Text style={styles.riskChip}>
              RISK WINDOW · {beat.riskMin}m
            </Text>
          </View>
        </View>

        {/* Orb */}
        <View style={styles.orbWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.orbHalo,
              {
                width: ORB_SIZE * 1.55,
                height: ORB_SIZE * 1.55,
                borderRadius: ORB_SIZE * 0.775,
                backgroundColor: glow,
              },
              orbHaloStyle,
            ]}
          />
          {/* Voice halo — radiates outward only while bus is mid-utterance */}
          {voiceActive && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.voiceHalo,
                {
                  width: ORB_SIZE * 1.85,
                  height: ORB_SIZE * 1.85,
                  borderRadius: ORB_SIZE * 0.925,
                  borderColor: accent,
                },
                voiceHaloStyle,
              ]}
            />
          )}
          <Animated.View
            style={[
              styles.orbCore,
              {
                width: ORB_SIZE,
                height: ORB_SIZE,
                borderRadius: ORB_SIZE / 2,
                backgroundColor: accent,
                shadowColor: glow,
              },
              orbCoreStyle,
            ]}
          />
        </View>

        {/* Beat title + subtitle */}
        <Animated.View style={[styles.titleBlock, titleStyle]}>
          <Text style={[styles.beatTitle, { color: accent }]} numberOfLines={1}>
            {beat.title}
          </Text>
          <Text style={styles.beatSubtitle}>{beat.subtitle}</Text>
        </Animated.View>

        {/* Voice caption */}
        <View style={styles.captionBlock}>
          <View style={styles.captionHeader}>
            <Text style={styles.captionEyebrow}>VOICE STREAM</Text>
            {lifecycleLabel ? (
              <Animated.View
                style={[
                  styles.lifecyclePill,
                  {
                    borderColor: `${accent}66`,
                    backgroundColor: `${accent}1A`,
                  },
                  lifecyclePillStyle,
                ]}
              >
                <Text style={[styles.lifecycleText, { color: accent }]}>{lifecycleLabel}</Text>
              </Animated.View>
            ) : (
              <Text style={styles.lifecycleStandby}>STANDBY</Text>
            )}
          </View>
          <Animated.Text
            numberOfLines={3}
            style={[
              styles.captionLine,
              !beat.voice && { color: Colors.text.muted, fontStyle: 'italic' },
              playback === 'executed' && { color: Colors.states.PEAK.primary },
              captionStyle,
            ]}
          >
            {beat.voice?.line ?? 'Engine standing by. Awaiting performance event.'}
          </Animated.Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
    gap: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.95,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  brandLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    color: Colors.text.secondary,
    flexShrink: 1,
  },
  exitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  exitLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: Colors.text.secondary,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  beatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  beatCounter: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.4,
    color: Colors.text.muted,
  },
  intensityChip: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.4,
    color: Colors.text.secondary,
  },
  scoreBlock: {
    alignItems: 'center',
    gap: 6,
  },
  scoreLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 3,
    color: Colors.text.muted,
  },
  scoreValue: {
    fontSize: 96,
    lineHeight: 104,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -3,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  scoreSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bandChip: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  riskChip: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.4,
    color: Colors.text.muted,
  },
  orbWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  orbHalo: {
    position: 'absolute',
  },
  voiceHalo: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  orbCore: {
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 38,
    elevation: 0,
  },
  titleBlock: {
    alignItems: 'center',
    gap: 6,
  },
  beatTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    textAlign: 'center',
  },
  beatSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  captionBlock: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captionEyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    color: Colors.text.muted,
  },
  lifecyclePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  lifecycleText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
  lifecycleStandby: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: Colors.text.muted,
  },
  captionLine: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.primary,
  },
});
