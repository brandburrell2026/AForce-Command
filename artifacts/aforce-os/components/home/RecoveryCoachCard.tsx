/**
 * RecoveryCoachCard — the signature AI experience of AForce OS.
 *
 * Premium black/red performance card with a live indicator, urgency
 * badge, hero recommendation, three telemetry tiles (projected score,
 * recheck timer, status), and a voice mic FAB. Smooth fade-in + a
 * breathing glow that pulses on the accent color.
 *
 * Replaces the older CommandConsole (AICommandCard + VoiceStatusModule)
 * on the home screen — designed to be the *only* AI surface above the
 * bottom nav.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { Command, PerformanceState } from '../../types';
import { Colors } from '../../theme/colors';
import { Icon, type IconName } from '../Icon';

interface Props {
  command: Command;
  performanceState: PerformanceState;
  accentOverride?: string;
  projectedScore: number;
  recheckSeconds: number | null;
  onVoicePress: () => void;
}

const URGENCY_ICONS: Record<string, IconName> = {
  low: 'check-circle',
  medium: 'zap',
  high: 'alert-triangle',
  critical: 'alert-octagon',
};

const URGENCY_LABELS: Record<string, string> = {
  low: 'HOLD',
  medium: 'ACT NOW',
  high: 'HIGH PRIORITY',
  critical: 'CRITICAL',
};

function formatRecheck(seconds: number | null): string {
  if (seconds == null || !isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function RecoveryCoachCardImpl({
  command,
  performanceState,
  accentOverride,
  projectedScore,
  recheckSeconds,
  onVoicePress,
}: Props) {
  const accent = accentOverride ?? performanceState.color;
  const urgency = command.urgencyLevel ?? 'medium';
  const urgencyIcon = URGENCY_ICONS[urgency] ?? 'zap';
  const urgencyLabel = URGENCY_LABELS[urgency] ?? 'ACT NOW';

  // ── Animations ─────────────────────────────────────────────────────
  // Fade-in on mount.
  const appear = useSharedValue(0);
  // Slow breathing glow on the outer halo.
  const glow = useSharedValue(0.45);
  // LIVE dot pulse.
  const livePulse = useSharedValue(1);

  React.useEffect(() => {
    appear.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    glow.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.45, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    livePulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, []);

  const appearStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: (1 - appear.value) * 12 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const liveDotStyle = useAnimatedStyle(() => ({ opacity: livePulse.value }));

  // Subtle mic press scale.
  const micScale = useSharedValue(1);
  const micStyle = useAnimatedStyle(() => ({ transform: [{ scale: micScale.value }] }));
  const onMicIn = () => {
    micScale.value = withTiming(0.94, { duration: 120 });
  };
  const onMicOut = () => {
    micScale.value = withDelay(80, withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
  };

  return (
    <Animated.View style={[styles.outer, appearStyle]} testID="recovery-coach-card">
      {/* Breathing outer glow halo — sits behind the card. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            shadowColor: accent,
            backgroundColor: `${accent}0D`,
            borderColor: `${accent}40`,
          },
          glowStyle,
        ]}
      />

      <View
        style={[
          styles.card,
          {
            borderColor: `${accent}55`,
            shadowColor: accent,
          },
        ]}
      >
        {/* Header: RECOVERY COACH eyebrow + LIVE indicator + urgency */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.eyebrow}>RECOVERY COACH</Text>
            <View style={styles.liveWrap}>
              <Animated.View style={[styles.liveDot, { backgroundColor: accent }, liveDotStyle]} />
              <Text style={[styles.liveText, { color: accent }]}>LIVE</Text>
            </View>
          </View>
          <View style={[styles.urgencyBadge, { backgroundColor: `${accent}1A`, borderColor: `${accent}66` }]}>
            <Icon name={urgencyIcon} size={10} color={accent} />
            <Text style={[styles.urgencyText, { color: accent }]}>{urgencyLabel}</Text>
          </View>
        </View>

        {/* Hero recommendation */}
        <Text style={styles.commandText} numberOfLines={3}>
          {command.action}
        </Text>

        {command.explanation ? (
          <Text style={styles.explanation} numberOfLines={2}>
            {command.explanation}
          </Text>
        ) : null}

        {/* Telemetry tiles: PROJECTED · RECHECK · STATUS */}
        <View style={[styles.statRow, { borderTopColor: `${accent}22` }]}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>PROJECTED</Text>
            <Text style={[styles.statValue, { color: accent }]}>{projectedScore}</Text>
            <Text style={styles.statUnit}>score</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>RECHECK</Text>
            <Text style={styles.statValue}>{formatRecheck(recheckSeconds)}</Text>
            <Text style={styles.statUnit}>countdown</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>STATUS</Text>
            <Text style={[styles.statValue, styles.statStatus, { color: accent }]} numberOfLines={1}>
              {performanceState.level}
            </Text>
            <Text style={styles.statUnit}>state</Text>
          </View>
        </View>

        {/* Voice mic — round FAB, accent ring, taps to open voice overlay */}
        <Pressable
          onPress={onVoicePress}
          onPressIn={onMicIn}
          onPressOut={onMicOut}
          accessibilityRole="button"
          accessibilityLabel="Talk to recovery coach"
          testID="recovery-coach-voice"
          style={styles.micWrap}
        >
          <Animated.View
            style={[
              styles.mic,
              {
                borderColor: accent,
                backgroundColor: `${accent}22`,
                shadowColor: accent,
              },
              micStyle,
            ]}
          >
            <Icon name="mic" size={20} color={accent} />
          </Animated.View>
          <Text style={[styles.micHint, { color: `${accent}CC` }]}>TAP TO TALK</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export const RecoveryCoachCard = React.memo(RecoveryCoachCardImpl);

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 8,
    position: 'relative',
  },
  halo: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 26,
    borderWidth: 1,
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  card: {
    backgroundColor: '#0A0A0C',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 26,
    minHeight: 320,
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.text.primary,
    letterSpacing: 3,
  },
  liveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 2,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  urgencyText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  commandText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: Colors.text.primary,
    marginTop: 8,
  },
  explanation: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: Colors.text.secondary,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 4,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border.subtle,
    marginVertical: 4,
  },
  statLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  statStatus: {
    fontSize: 14,
    letterSpacing: 1.2,
  },
  statUnit: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    color: Colors.text.muted,
    letterSpacing: 1.4,
    marginTop: 4,
  },
  micWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  mic: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  micHint: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 2,
  },
});
