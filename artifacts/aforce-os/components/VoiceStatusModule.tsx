/**
 * VoiceStatusModule — AForce Command Voice Engine status card (cinematic).
 *
 * Premium command-center surface that lives on Home. Surfaces:
 *   - Live indicator + canonical engine name eyebrow with breathing dot.
 *   - Lifecycle badge that swaps through OFF / LIVE / RECEIVED /
 *     TRANSMITTING / EXECUTED / RETRY in time with the voice engine.
 *   - 3-up status grid: Voice (on/scope) | Risk State | Intensity.
 *   - Last spoken line with relative timestamp + category badge.
 *   - Full-width Replay button that turns into REPLAYING… while the
 *     engine is actively speaking.
 *
 * Subscribes to both the line bus (latest utterance) and the playback
 * bus (received → playing → executed → error → idle) so every state
 * shift animates without polling. Reanimated drives the breathing live
 * dot, the breathing border tint, and the press-scale on Replay.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '../theme/colors';
import { useEngineSlice } from '../store/slices';
import { useAppStore } from '../store/useAppStore';
import {
  BRAND_LANGUAGE,
  scoreBand,
  type ScoreBand,
  type VoiceIntensity,
  type VoiceScope,
} from '../services/voice/commandVoice';
import {
  getLastCommand,
  getPlaybackState,
  replayLastCommand,
  subscribe,
  subscribePlayback,
  type PlaybackState,
  type SpokenCommand,
} from '../services/voice/commandVoiceBus';

const BAND_LABELS: Record<ScoreBand, string> = {
  PEAK:     'PEAK',
  STABLE:   'STABLE',
  CORRECT:  'CORRECT',
  RISK:     'RISK',
  CRITICAL: 'CRITICAL',
};

const BAND_ACCENT: Record<ScoreBand, string> = {
  PEAK:     Colors.states.PEAK.primary,
  STABLE:   Colors.states.BALANCED.primary,
  CORRECT:  Colors.states.BALANCED.primary,
  RISK:     Colors.states.RECOVERING.primary,
  CRITICAL: Colors.states.DEPLETED.primary,
};

const INTENSITY_LABEL: Record<VoiceIntensity, string> = {
  calm:     'CALM',
  standard: 'STANDARD',
  pressure: 'PRESSURE',
};

const SCOPE_LABEL: Record<VoiceScope, string> = {
  all:      'ALL',
  risk:     'RISK ONLY',
  commands: 'CMDS ONLY',
  muted:    'MUTED',
};

const CATEGORY_LABEL: Record<NonNullable<SpokenCommand['category']>, string> = {
  score_band:     'SCORE BAND',
  risk_timer:     'RISK TIMER',
  system_command: 'PERFORMANCE COMMAND',
  completion:     'CYCLE COMPLETE',
};

function formatRelative(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

interface LifecycleVisual {
  label: string;
  color: string;
  /** When true, the live dot pulses fast and the border breathes. */
  active: boolean;
}

function lifecycleVisual(
  playback: PlaybackState,
  isLive: boolean,
  voiceEnabled: boolean,
  bandAccent: string,
): LifecycleVisual {
  if (playback === 'received')  return { label: 'RECEIVED',     color: bandAccent,                      active: true };
  if (playback === 'playing')   return { label: 'TRANSMITTING', color: bandAccent,                      active: true };
  if (playback === 'executed')  return { label: 'EXECUTED',     color: Colors.states.PEAK.primary,      active: true };
  if (playback === 'error')     return { label: 'AUDIO RETRY',  color: Colors.states.DEPLETED.primary,  active: false };
  if (!voiceEnabled)            return { label: 'OFF',          color: Colors.text.muted,               active: false };
  if (!isLive)                  return { label: 'MUTED',        color: Colors.text.muted,               active: false };
  return                              { label: 'LIVE',          color: Colors.states.PEAK.primary,      active: false };
}

function VoiceStatusModuleImpl() {
  const engine = useEngineSlice();
  const { voiceCoachEnabled, voiceIntensity, voiceScope } = useAppStore();

  // Re-render whenever the bus speaks a new line.
  const [last, setLast] = React.useState<SpokenCommand | null>(() => getLastCommand());
  React.useEffect(() => subscribe(setLast), []);

  // Re-render on every playback transition.
  const [playback, setPlayback] = React.useState<PlaybackState>(() => getPlaybackState());
  React.useEffect(() => subscribePlayback(setPlayback), []);

  // Tick once a minute so the relative timestamp stays fresh without
  // wasting render budget on a per-second clock.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const band = scoreBand(engine.score);
  const bandLabel = BAND_LABELS[band];
  const bandAccent = BAND_ACCENT[band];

  const isLive = voiceCoachEnabled && voiceScope !== 'muted';
  const visual = lifecycleVisual(playback, isLive, voiceCoachEnabled, bandAccent);

  // Replay state — disabled when there's nothing to replay or the
  // engine is muted. While the engine is mid-utterance, the button
  // shows REPLAYING… and is disabled to prevent double-fires.
  const isPlaying = playback === 'received' || playback === 'playing';
  const replayDisabled = !last || !isLive || isPlaying;
  const onReplay = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    replayLastCommand();
  }, []);

  /* ----------------------- Reanimated drivers ----------------------- */

  // Live dot — breathes slowly when LIVE, pulses fast during RECEIVED /
  // PLAYING / EXECUTED, static when OFF / MUTED / ERROR.
  const dotPulse = useSharedValue(0);
  React.useEffect(() => {
    cancelAnimation(dotPulse);
    if (visual.active) {
      dotPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 520, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else if (isLive) {
      dotPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      dotPulse.value = withTiming(0, { duration: 240 });
    }
    return () => cancelAnimation(dotPulse);
  }, [visual.active, isLive]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity:  interpolate(dotPulse.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(dotPulse.value, [0, 1], [1, visual.active ? 1.55 : 1.2]) }],
  }));

  // Border breathes when the engine is mid-utterance, holds steady tint
  // during EXECUTED, returns to subtle resting border otherwise.
  const borderPulse = useSharedValue(0);
  React.useEffect(() => {
    cancelAnimation(borderPulse);
    if (isPlaying) {
      borderPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else if (playback === 'executed') {
      borderPulse.value = withTiming(1, { duration: 220 });
    } else if (playback === 'error') {
      borderPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 240 }),
          withTiming(0.4, { duration: 240 }),
        ),
        4,
        false,
      );
    } else {
      borderPulse.value = withTiming(0, { duration: 320 });
    }
    return () => cancelAnimation(borderPulse);
  }, [playback, isPlaying]);

  const cardAnimStyle = useAnimatedStyle(() => {
    // 0 = subtle resting border, 1 = full visual.color tint.
    const alpha = 0.20 + 0.45 * borderPulse.value;
    const hex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return {
      borderColor: `${visual.color}${hex}`,
      shadowOpacity: 0.10 + 0.35 * borderPulse.value,
    };
  });

  // Replay press scale.
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const handlePressIn  = () => { pressScale.value = withTiming(0.96, { duration: 90 }); };
  const handlePressOut = () => { pressScale.value = withTiming(1,    { duration: 160 }); };

  /* ------------------------------------------------------------------ */

  const replayLabel = isPlaying
    ? 'REPLAYING…'
    : !last
      ? 'STANDBY · NOTHING TO REPLAY'
      : !isLive
        ? 'VOICE MUTED · ENABLE TO REPLAY'
        : 'REPLAY LAST COMMAND';

  return (
    <Animated.View
      style={[
        styles.card,
        { shadowColor: visual.color },
        cardAnimStyle,
      ]}
      testID="voice-status-module"
    >
      {/* Eyebrow row — engine name + lifecycle badge */}
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowLeft}>
          <Animated.View
            style={[
              styles.liveDot,
              {
                backgroundColor: visual.color,
                shadowColor: visual.color,
              },
              dotStyle,
            ]}
          />
          <Text style={styles.eyebrow} numberOfLines={1}>
            {BRAND_LANGUAGE.engineName.toUpperCase()}
          </Text>
        </View>
        <View
          style={[
            styles.lifecyclePill,
            {
              borderColor: `${visual.color}55`,
              backgroundColor: visual.active ? `${visual.color}1A` : 'transparent',
            },
          ]}
        >
          <Text style={[styles.lifecycleText, { color: visual.color }]} numberOfLines={1}>
            {visual.label}
          </Text>
        </View>
      </View>

      {/* 3-up status grid */}
      <View style={styles.grid}>
        <View style={styles.gridCell}>
          <Text style={styles.cellLabel}>VOICE</Text>
          <Text
            style={[
              styles.cellValue,
              { color: isLive ? Colors.text.primary : Colors.text.muted },
            ]}
          >
            {voiceCoachEnabled ? 'ON' : 'OFF'}
          </Text>
          <Text style={styles.cellSub}>{SCOPE_LABEL[voiceScope]}</Text>
        </View>
        <View style={[styles.gridCell, styles.gridCellMid]}>
          <Text style={styles.cellLabel}>{BRAND_LANGUAGE.riskState.toUpperCase()}</Text>
          <Text style={[styles.cellValue, { color: bandAccent }]}>{bandLabel}</Text>
          <Text style={styles.cellSub}>SCORE {Math.round(engine.score)}</Text>
        </View>
        <View style={styles.gridCell}>
          <Text style={styles.cellLabel}>INTENSITY</Text>
          <Text
            style={[
              styles.cellValue,
              voiceIntensity === 'pressure' && { color: Colors.states.DEPLETED.primary },
            ]}
          >
            {INTENSITY_LABEL[voiceIntensity]}
          </Text>
          <Text style={styles.cellSub}>
            {voiceIntensity === 'pressure'
              ? BRAND_LANGUAGE.pressureMode.toUpperCase()
              : voiceIntensity === 'calm'
                ? 'MEASURED'
                : 'CONTROLLED'}
          </Text>
        </View>
      </View>

      {/* Last command */}
      <View style={styles.lastBlock}>
        <View style={styles.lastHeader}>
          <Text style={styles.lastEyebrow}>LAST COMMAND</Text>
          {last ? (
            <Text style={styles.lastMeta}>
              {CATEGORY_LABEL[last.category]} · {formatRelative(now - last.at)}
            </Text>
          ) : (
            <Text style={styles.lastMeta}>STANDBY</Text>
          )}
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.lastLine,
            !last && { color: Colors.text.muted, fontStyle: 'italic' },
            playback === 'executed' && { color: Colors.states.PEAK.primary },
            playback === 'error' && { color: Colors.states.DEPLETED.primary },
          ]}
        >
          {last?.line ?? 'Engine standing by. Awaiting performance event.'}
        </Text>
      </View>

      {/* Replay */}
      <Animated.View style={pressStyle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Replay last AForce voice command"
          accessibilityState={{ disabled: replayDisabled, busy: isPlaying }}
          disabled={replayDisabled}
          onPress={onReplay}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.replayBtn,
            {
              borderColor: replayDisabled ? Colors.border.subtle : `${visual.color}66`,
              backgroundColor: replayDisabled
                ? 'transparent'
                : pressed ? `${visual.color}26` : `${visual.color}14`,
            },
          ]}
          testID="voice-status-replay"
        >
          <Text
            style={[
              styles.replayText,
              { color: replayDisabled ? Colors.text.muted : visual.color },
            ]}
            numberOfLines={1}
          >
            {replayLabel}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export const VoiceStatusModule = React.memo(VoiceStatusModuleImpl);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginVertical: 8,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: Colors.background.card,
    gap: 16,
    // shadow set dynamically by lifecycle
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    elevation: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.95,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    color: Colors.text.secondary,
    flexShrink: 1,
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
  grid: {
    flexDirection: 'row',
    gap: 0,
    paddingTop: 4,
  },
  gridCell: {
    flex: 1,
    gap: 4,
  },
  gridCellMid: {
    paddingHorizontal: 12,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.subtle,
  },
  cellLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
    color: Colors.text.muted,
  },
  cellValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
    color: Colors.text.primary,
  },
  cellSub: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    color: Colors.text.muted,
  },
  lastBlock: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.subtle,
    gap: 8,
  },
  lastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastEyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    color: Colors.text.muted,
  },
  lastMeta: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
    color: Colors.text.muted,
  },
  lastLine: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.text.primary,
  },
  replayBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  replayText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
});
