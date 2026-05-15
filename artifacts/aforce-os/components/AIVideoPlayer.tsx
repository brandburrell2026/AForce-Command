/**
 * AIVideoPlayer
 *
 * Renders a short cinematic coaching "video" tied to a system command. In this
 * build the video is a Reanimated scene (instant, no buffering, web-safe). The
 * component contract is a real video player though — autoplay, overlays,
 * timer, expand/collapse — so swapping in mp4 / AI-generated content later is
 * a one-component change.
 *
 * Compact mode → renders inline (e.g. under the AICommandCard).
 * Tap → expands to a full-screen modal with the command, a countdown, and the
 * scene scaled up.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
  withDelay, Easing, cancelAnimation, interpolateColor,
} from 'react-native-reanimated';

import type { VideoConfig, VideoSceneKind } from '../types/video';
import type { Command } from '../types';
import { Colors } from '../theme/colors';
import { getStatusColor } from '../theme/statusColor';
import { useAppStore } from '../store/useAppStore';
import { useDisplayedAccent } from '../hooks/useDisplayedAccent';
import { speak, stopSpeaking } from '../services/textToSpeech';
import { buildVideoCoachLine } from '../services/videoCoachVoice';

// ─── Public props ─────────────────────────────────────────────────────────────
interface Props {
  video: VideoConfig;
  command: Command;
  /** Compact (inline) by default. */
  compact?: boolean;
  /** Optional: countdown in seconds shown on the overlay (e.g. recheck timer). */
  timerSeconds?: number;
  /**
   * Live 0-100 status score driving the centralized color band.
   * Optional — when omitted we fall back to a sensible mapping
   * from `video.themeLevel`.
   */
  score?: number;
}

// ─── Theme helpers ────────────────────────────────────────────────────────────
/**
 * Legacy 4-band PerformanceLevel → centre-of-band score so the
 * centralized `getStatusColor()` system has a number to operate on
 * when no live score is supplied.
 */
function levelToFallbackScore(level: VideoConfig['themeLevel']): number {
  switch (level) {
    case 'PEAK':       return 92; // OPTIMAL
    case 'BALANCED':   return 78; // STABLE
    case 'RECOVERING': return 55; // DECLINING
    case 'DEPLETED':   return 22; // CRITICAL
    default:           return 75;
  }
}

function formatTimer(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Scene: WaterStream ──────────────────────────────────────────────────────
function WaterStreamScene({ accent, glow }: { accent: string; glow: string }) {
  const dropY = useSharedValue(0);
  const splash = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  React.useEffect(() => {
    dropY.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.in(Easing.cubic) }),
      -1, false,
    );
    splash.value = withRepeat(
      withSequence(
        withDelay(1200, withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) })),
        withTiming(0, { duration: 200 }),
      ),
      -1, false,
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withDelay(1200, withTiming(0.65, { duration: 220 })),
        withTiming(0, { duration: 700 }),
      ),
      -1, false,
    );
    return () => { cancelAnimation(dropY); cancelAnimation(splash); cancelAnimation(ringOpacity); };
  }, []);

  const dropStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dropY.value * 90 },
      { scaleY: 1 + dropY.value * 1.4 },
    ],
    opacity: dropY.value < 0.95 ? 1 : 0,
  }));
  const splashStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + splash.value * 1.4 }],
    opacity: splash.value * 0.9,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (1 - ringOpacity.value) * 1.6 }],
    opacity: ringOpacity.value,
  }));

  return (
    <View style={sceneStyles.center}>
      <Animated.View style={[sceneStyles.dropletTrail, { backgroundColor: glow }, dropStyle]} />
      <View style={[sceneStyles.vessel, { borderColor: accent }]}>
        <Animated.View style={[sceneStyles.vesselFill, { backgroundColor: glow }, splashStyle]} />
      </View>
      <Animated.View style={[sceneStyles.ripple, { borderColor: accent }, ringStyle]} />
    </View>
  );
}

// ─── Scene: BreathRing ───────────────────────────────────────────────────────
function BreathRingScene({ accent, glow: _glow }: { accent: string; glow: string }) {
  const breath = useSharedValue(0);
  React.useEffect(() => {
    // 4 in · 2 hold · 6 out
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, false,
    );
    return () => cancelAnimation(breath);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + breath.value * 0.55 }],
    opacity: 0.3 + breath.value * 0.5,
  }));
  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + breath.value * 0.4 }],
    opacity: 0.18 + breath.value * 0.3,
  }));

  return (
    <View style={sceneStyles.center}>
      <Animated.View style={[sceneStyles.breathOuter, { borderColor: accent }, outerStyle]} />
      <Animated.View style={[sceneStyles.breathInner, { borderColor: accent, backgroundColor: `${accent}18` }, ringStyle]} />
    </View>
  );
}

// ─── Scene: PulseBuild ───────────────────────────────────────────────────────
/**
 * The "voice bars" equalizer. Pulse cadence honors the band's
 * animationSpeed so worse bands beat faster, and pressure mode
 * multiplies on top — speedMultiplier > 1 = faster bars.
 */
function PulseBuildScene({
  accent,
  speedMultiplier = 1,
}: {
  accent: string;
  glow: string;
  speedMultiplier?: number;
}) {
  const bar1 = useSharedValue(0);
  const bar2 = useSharedValue(0);
  const bar3 = useSharedValue(0);
  const bar4 = useSharedValue(0);
  const bar5 = useSharedValue(0);
  const bars = [bar1, bar2, bar3, bar4, bar5];

  React.useEffect(() => {
    const upMs = Math.max(140, Math.round(380 / speedMultiplier));
    const downMs = Math.max(200, Math.round(520 / speedMultiplier));
    const stagger = Math.max(40, Math.round(100 / speedMultiplier));
    bars.forEach((b, i) => {
      b.value = withRepeat(
        withDelay(i * stagger, withSequence(
          withTiming(1, { duration: upMs, easing: Easing.out(Easing.cubic) }),
          withTiming(0.25, { duration: downMs }),
        )),
        -1, false,
      );
    });
    return () => bars.forEach(b => cancelAnimation(b));
  }, [speedMultiplier]);

  const b1 = useAnimatedStyle(() => ({ height: 18 + bar1.value * 70, opacity: 0.4 + bar1.value * 0.6 }));
  const b2 = useAnimatedStyle(() => ({ height: 18 + bar2.value * 70, opacity: 0.4 + bar2.value * 0.6 }));
  const b3 = useAnimatedStyle(() => ({ height: 18 + bar3.value * 70, opacity: 0.4 + bar3.value * 0.6 }));
  const b4 = useAnimatedStyle(() => ({ height: 18 + bar4.value * 70, opacity: 0.4 + bar4.value * 0.6 }));
  const b5 = useAnimatedStyle(() => ({ height: 18 + bar5.value * 70, opacity: 0.4 + bar5.value * 0.6 }));
  const styles = [b1, b2, b3, b4, b5];

  return (
    <View style={sceneStyles.barsRow}>
      {styles.map((s, i) => (
        <Animated.View key={i} style={[sceneStyles.bar, { backgroundColor: accent }, s]} />
      ))}
    </View>
  );
}

// ─── Scene: RedAlert ─────────────────────────────────────────────────────────
function RedAlertScene({ accent }: { accent: string; glow: string }) {
  const flash = useSharedValue(0);
  const ring = useSharedValue(0);
  React.useEffect(() => {
    flash.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 320 }),
        withTiming(0.15, { duration: 320 }),
      ),
      -1, false,
    );
    ring.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
      -1, false,
    );
    return () => { cancelAnimation(flash); cancelAnimation(ring); };
  }, []);

  const coreStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(flash.value, [0, 1], [`${accent}33`, `${accent}DD`]),
    opacity: 0.55 + flash.value * 0.45,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + ring.value * 1.4 }],
    opacity: 1 - ring.value,
  }));

  return (
    <View style={sceneStyles.center}>
      <Animated.View style={[sceneStyles.alertRing, { borderColor: accent }, ringStyle]} />
      <Animated.View style={[sceneStyles.alertCore, coreStyle]} />
    </View>
  );
}

// ─── Scene: SunriseSweep ─────────────────────────────────────────────────────
function SunriseSweepScene({ accent, glow }: { accent: string; glow: string }) {
  const sun = useSharedValue(0);
  React.useEffect(() => {
    sun.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }),
      -1, true,
    );
    return () => cancelAnimation(sun);
  }, []);
  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 40 - sun.value * 70 }],
    opacity: 0.4 + sun.value * 0.6,
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.1 + sun.value * 0.4,
    transform: [{ scale: 1 + sun.value * 0.3 }],
  }));
  return (
    <View style={sceneStyles.center}>
      <Animated.View style={[sceneStyles.sunHalo, { backgroundColor: glow }, haloStyle]} />
      <Animated.View style={[sceneStyles.sunCore, { backgroundColor: accent }, sunStyle]} />
      <View style={[sceneStyles.horizon, { backgroundColor: `${accent}55` }]} />
    </View>
  );
}

// ─── Scene dispatch ──────────────────────────────────────────────────────────
function Scene({
  kind,
  accent,
  glow,
  speedMultiplier,
}: {
  kind: VideoSceneKind;
  accent: string;
  glow: string;
  speedMultiplier: number;
}) {
  switch (kind) {
    case 'water_stream':   return <WaterStreamScene  accent={accent} glow={glow} />;
    case 'breath_ring':    return <BreathRingScene   accent={accent} glow={glow} />;
    case 'pulse_build':    return <PulseBuildScene   accent={accent} glow={glow} speedMultiplier={speedMultiplier} />;
    case 'red_alert':      return <RedAlertScene     accent={accent} glow={glow} />;
    case 'sunrise_sweep':  return <SunriseSweepScene accent={accent} glow={glow} />;
    default:               return <WaterStreamScene  accent={accent} glow={glow} />;
  }
}

// ─── Main player ─────────────────────────────────────────────────────────────
export function AIVideoPlayer({ video, command, compact = true, timerSeconds, score }: Props) {
  const [expanded, setExpanded] = React.useState(false);

  // Centralized status color — every accent on this player reads from
  // the same StatusColor contract, keyed off the live engine score so
  // the cinematic surface tunes to the current band. Pressure Mode
  // (driven by the user's voice intensity setting) amplifies the
  // saturation, glow, and voice-bar tempo.
  const { voiceIntensity } = useAppStore();
  const isPressure = voiceIntensity === 'pressure';
  // Subscribe to the in-flight tweened accent so this card flips hue on
  // the same frame the orb does. Falls back to the static band color
  // when no provider is mounted (e.g. fullscreen overlay outside Home).
  const displayed = useDisplayedAccent();
  const resolvedScore = displayed?.displayedScore ?? score ?? levelToFallbackScore(video.themeLevel);
  const status = getStatusColor(resolvedScore, { pressure: isPressure });
  const accent = displayed?.primary ?? status.primary;
  const glow = displayed?.glow ?? status.glow;
  const speedMultiplier = status.animationSpeed;

  // Progress bar (loops video duration)
  const progress = useSharedValue(0);
  React.useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: video.durationSec * 1000, easing: Easing.linear }),
      -1, false,
    );
    return () => cancelAnimation(progress);
  }, [video.videoId, video.durationSec]);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(2, progress.value * 100)}%`,
  }));

  const handleExpand = React.useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setExpanded(true);
  }, []);
  const handleCollapse = React.useCallback(() => setExpanded(false), []);

  // ─── AI Coach voice ────────────────────────────────────────────────────────
  // When the user opens the full-screen overlay, speak the same content
  // they see — overlay title + subtitle + command action + explanation —
  // tuned by the video's themeLevel persona (DEPLETED lands with controlled
  // urgency, PEAK is calm, etc.). Stop speaking on close / unmount so the
  // coach never talks over a navigated-away screen.
  React.useEffect(() => {
    if (!expanded) return;
    const line = buildVideoCoachLine(video, command);
    if (!line) return;
    speak(line, { level: video.themeLevel });
    return () => {
      stopSpeaking();
    };
  }, [
    expanded,
    video.videoId,
    video.themeLevel,
    video.overlayTitle,
    video.overlaySubtitle,
    command.action,
    command.explanation,
  ]);

  // ─── Inline / compact ──────────────────────────────────────────────────────
  return (
    <>
      <Pressable
        onPress={handleExpand}
        accessibilityRole="button"
        accessibilityLabel="Open coaching video"
        style={({ pressed }) => [
          styles.card,
          { borderColor: `${accent}44` },
          pressed && styles.cardPressed,
        ]}
      >
        <View style={[styles.glow, { backgroundColor: `${accent}10` }]} />

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={[styles.liveDot, { backgroundColor: accent }]} />
          <Text style={[styles.eyebrow, { color: accent }]}>COMMAND VOICE ENGINE · LIVE</Text>
          <View style={{ flex: 1 }} />
          <Feather name="maximize-2" size={12} color={Colors.text.muted} />
        </View>

        {/* Scene stage */}
        <View style={[styles.stage, compact ? styles.stageCompact : styles.stageFull]}>
          <Scene kind={video.scene} accent={accent} glow={glow} speedMultiplier={speedMultiplier} />
          <View style={styles.overlayTextBlock} pointerEvents="none">
            <Text style={[styles.overlayTitle, { color: '#fff' }]}>{video.overlayTitle}</Text>
            <Text style={styles.overlaySub}>{video.overlaySubtitle}</Text>
          </View>
        </View>

        {/* Progress + meta */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { backgroundColor: accent }, progressStyle]} />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{video.videoCategory.replace(/_/g, ' ').toUpperCase()}</Text>
          <Text style={styles.metaText}>
            {timerSeconds != null ? `RECHECK ${formatTimer(timerSeconds)}` : `${video.durationSec}s`}
          </Text>
        </View>
      </Pressable>

      {/* Expanded full-screen */}
      <Modal visible={expanded} transparent animationType="fade" onRequestClose={handleCollapse}>
        <View style={styles.modalRoot}>
          <View style={styles.modalScrim} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.liveDot, { backgroundColor: accent }]} />
              <Text style={[styles.eyebrow, { color: accent }]}>COMMAND VOICE ENGINE</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={handleCollapse} hitSlop={12}>
                <Feather name="x" size={22} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.stage, styles.stageFullScreen]}>
              <Scene kind={video.scene} accent={accent} glow={glow} speedMultiplier={speedMultiplier} />
              <View style={styles.overlayTextBlock} pointerEvents="none">
                <Text style={[styles.overlayTitleLg, { color: '#fff' }]}>{video.overlayTitle}</Text>
                <Text style={styles.overlaySubLg}>{video.overlaySubtitle}</Text>
              </View>
            </View>

            <View style={styles.commandBox}>
              <Text style={styles.commandLabel}>COMMAND</Text>
              <Text style={styles.commandText}>{command.action}</Text>
              <Text style={styles.commandExpl}>{command.explanation}</Text>
            </View>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { backgroundColor: accent }, progressStyle]} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{video.videoCategory.replace(/_/g, ' ').toUpperCase()}</Text>
              <Text style={styles.metaText}>
                {timerSeconds != null ? `RECHECK ${formatTimer(timerSeconds)}` : `${video.durationSec}s`}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    backgroundColor: Colors.background.card,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.92 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
  stage: {
    backgroundColor: '#03030C',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stageCompact: { height: 150, marginHorizontal: 12, borderRadius: 12 },
  stageFull: { height: 220, marginHorizontal: 12, borderRadius: 14 },
  stageFullScreen: { flex: 1, marginHorizontal: 0, borderRadius: 0 },
  overlayTextBlock: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
  },
  overlayTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.4,
  },
  overlaySub: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  overlayTitleLg: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
  },
  overlaySubLg: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  metaText: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    color: Colors.text.muted,
  },

  // Expanded modal
  modalRoot: { flex: 1, backgroundColor: '#000' },
  modalScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.background.overlay,
  },
  modalContent: { flex: 1, paddingTop: 56, paddingBottom: 28 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  commandBox: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 16,
    backgroundColor: Colors.background.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  commandLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: Colors.text.muted,
    marginBottom: 6,
  },
  commandText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
    lineHeight: 23,
    marginBottom: 6,
  },
  commandExpl: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.secondary,
    lineHeight: 17,
  },
});

const sceneStyles = StyleSheet.create({
  center: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  // water_stream
  dropletTrail: {
    position: 'absolute',
    width: 6,
    height: 22,
    borderRadius: 3,
    top: '15%',
    shadowColor: '#fff',
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  vessel: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginTop: 30,
  },
  vesselFill: {
    width: '100%',
    height: '60%',
  },
  ripple: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    marginTop: 30,
  },
  // breath_ring
  breathOuter: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
  },
  breathInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
  },
  // pulse_build
  barsRow: {
    flexDirection: 'row',
    gap: 10,
    height: '70%',
    alignItems: 'flex-end',
  },
  bar: {
    width: 14,
    borderRadius: 4,
  },
  // red_alert
  alertCore: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  alertRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
  },
  // sunrise_sweep
  sunCore: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 4,
  },
  sunHalo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    top: '20%',
  },
  horizon: {
    position: 'absolute',
    bottom: '22%',
    left: '12%',
    right: '12%',
    height: 1,
  },
});
