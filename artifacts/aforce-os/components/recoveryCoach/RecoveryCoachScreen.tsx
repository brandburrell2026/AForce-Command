/**
 * RECOVERY COACH — the full-screen premium focused mode.
 * Spec: docs/specs/recovery-coach-premium-spec.md.
 *
 * Presentational: driven ENTIRELY by one RecoveryCommand (spec §7) via
 * deriveRecoveryCommandView. Renders the approved content hierarchy (§2) with the
 * semantic af.* tokens (§3), typography (§4), layout (§5), motion + Reduce-Motion
 * (§6), interaction states (§8), a11y (§9), and analytics (§10). No bottom nav,
 * no floating mic. Score-Protection: display only — the dose shown is the
 * command's `quantity`, never fabricated; nothing here writes a score.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, ScrollView, type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence,
  Easing, useReducedMotion, cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../Icon';
import { RecoveryCoachTokens as T } from '../../theme/recoveryCoachTokens';
import {
  deriveRecoveryCommandView, type RecoveryCommand,
} from '../../utils/recovery/recoveryCommand';
import { emit } from '../../analytics/event_dispatcher';

const SCREEN_VERSION = 'recovery_coach@1';

interface Props {
  command: RecoveryCommand;
  onClose: () => void;
  /** Fired when the primary action is confirmed (parent logs / advances the command). */
  onPrimary?: (command: RecoveryCommand) => void;
  /** Fired when the user asks to adjust the command. */
  onAdjust?: (command: RecoveryCommand) => void;
  /** Whether the device is offline (surfaces an 'Updated X min ago' label). */
  offline?: boolean;
  /** Test seam: fixed clock. Defaults to a live 1s tick. */
  nowOverride?: number;
}

export function RecoveryCoachScreen({ command, onClose, onPrimary, onAdjust, offline, nowOverride }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [now, setNow] = useState<number>(() => nowOverride ?? Date.now());
  const [ackAt, setAckAt] = useState<number | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  // 1s countdown tick (spec §6: update once per second, no layout shift). Skipped
  // under a fixed test clock.
  useEffect(() => {
    if (nowOverride !== undefined) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [nowOverride]);

  // Analytics: one view per mount.
  useEffect(() => {
    void emit('recovery_coach_viewed', { commandId: command.id, commandState: command.state, sourceVersion: command.sourceVersion, screenVersion: SCREEN_VERSION });
  }, [command.id]);

  const view = deriveRecoveryCommandView(command, now, { offline });

  // Optimistic §8 acknowledged → rechecking overlay (self-contained interaction).
  const ackElapsed = ackAt !== null ? now - ackAt : null;
  const showAck = ackElapsed !== null && ackElapsed < 800 || view.acknowledged;
  const showRechecking = (ackElapsed !== null && ackElapsed >= 800) || view.state === 'rechecking';
  const title = view.state === 'expired' ? view.title : showRechecking ? 'Recheck in progress' : view.title;
  const primaryLabel = view.state === 'expired' ? view.primaryActionLabel : showAck ? 'Water logged' : view.primaryActionLabel;
  const isExpired = view.state === 'expired';

  // ── Motion: entrance + pulse (Reduce-Motion → static) ──
  const enterOpacity = useSharedValue(0);
  const enterY = useSharedValue(12);
  const pulseScale = useSharedValue(1);
  const ringScale = useSharedValue(0.94);
  const ringOpacity = useSharedValue(0.24);
  useEffect(() => {
    enterOpacity.value = withTiming(1, { duration: 420, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    enterY.value = withTiming(0, { duration: 420, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    if (!reduceMotion) {
      const ease = Easing.inOut(Easing.quad);
      pulseScale.value = withRepeat(withSequence(
        withTiming(1.025, { duration: 1600, easing: ease }),
        withTiming(1.0, { duration: 1600, easing: ease }),
      ), -1, false);
      ringScale.value = withRepeat(withSequence(
        withTiming(1.05, { duration: 1600, easing: ease }),
        withTiming(0.94, { duration: 1600, easing: ease }),
      ), -1, false);
      ringOpacity.value = withRepeat(withSequence(
        withTiming(0.06, { duration: 1600, easing: ease }),
        withTiming(0.24, { duration: 1600, easing: ease }),
      ), -1, false);
    }
    return () => { cancelAnimation(pulseScale); cancelAnimation(ringScale); cancelAnimation(ringOpacity); };
  }, [reduceMotion]);

  const enterStyle = useAnimatedStyle(() => ({ opacity: enterOpacity.value, transform: [{ translateY: enterY.value }] }));
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }], opacity: ringOpacity.value }));

  const onPrimaryTap = () => {
    if (isExpired) {
      void emit('recovery_coach_primary_tapped', { commandId: command.id, commandState: 'expired', screenVersion: SCREEN_VERSION });
      onPrimary?.(command);
      return;
    }
    if (ackAt !== null) return; // prevent duplicate logging (spec §8 rechecking)
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setAckAt(nowOverride ?? Date.now());
    void emit('recovery_coach_primary_tapped', { commandId: command.id, commandState: command.state, screenVersion: SCREEN_VERSION });
    void emit('recovery_coach_completed', { commandId: command.id, screenVersion: SCREEN_VERSION });
    onPrimary?.(command);
  };

  const onAdjustTap = () => {
    void emit('recovery_coach_adjust_tapped', { commandId: command.id, screenVersion: SCREEN_VERSION });
    onAdjust?.(command);
  };

  const onWhyTap = () => {
    setWhyOpen((o) => !o);
    if (!whyOpen) void emit('recovery_coach_why_opened', { commandId: command.id, screenVersion: SCREEN_VERSION });
  };

  const onCloseTap = () => {
    void emit('recovery_coach_dismissed', { commandId: command.id, commandState: view.state, screenVersion: SCREEN_VERSION });
    onClose();
  };

  const progressPct = `${Math.round(view.progress * 100)}%` as const;
  const progressA11y = `Recovery focus, ${Math.round(view.progress * 100)} percent, next check in ${view.countdown.replace(':', ' minutes ')} seconds`;

  return (
    <View style={[styles.root, { backgroundColor: T.canvas }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header} accessibilityRole="header">
          <View style={styles.headerLeft}>
            <View style={styles.headerLabelRow}>
              <View style={[styles.liveDot, { backgroundColor: T.red }]} />
              <Text style={[styles.headerLabel, { color: T.textPrimary }]}>RECOVERY COACH</Text>
            </View>
            <Text style={[styles.status, { color: T.textSecondary }]}>{offline ? 'Offline' : 'Live guidance'}</Text>
          </View>
          <Pressable
            onPress={onCloseTap}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close Recovery Coach"
            style={[styles.close, { borderColor: T.border }]}
          >
            <Icon name="x" size={20} color={T.textSecondary} />
          </Pressable>
        </View>

        <Animated.View style={enterStyle}>
          {/* Ambient pulse (decorative) */}
          <View style={styles.pulseZone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Animated.View style={[styles.pulseRing, { borderColor: T.redHairline }, ringStyle]} />
            <Animated.View style={[styles.pulseCore, { backgroundColor: T.red }, coreStyle]} />
          </View>

          {/* Command block */}
          <View style={styles.commandBlock}>
            <Text style={[styles.eyebrow, { color: T.textTertiary }]}>YOUR NEXT MOVE</Text>
            <Text style={[styles.title, { color: T.textPrimary }]} accessibilityRole="text">{title}</Text>
            {!isExpired && view.instruction ? (
              <Text style={[styles.instruction, { color: T.textSecondary }]}>{view.instruction}</Text>
            ) : null}
            {view.updatedAgoLabel ? (
              <Text style={[styles.updatedAgo, { color: T.textTertiary }]}>{view.updatedAgoLabel}</Text>
            ) : null}
          </View>

          {/* Countdown */}
          {!isExpired ? (
            <View style={styles.countdownBlock} accessibilityLabel={`${view.timerLabel}, ${view.countdown}`}>
              <View style={[styles.timerHairline, { backgroundColor: T.red }]} />
              <Text style={[styles.timerLabel, { color: T.textTertiary }]}>{view.timerLabel}</Text>
              <Text style={[styles.timer, { color: T.textPrimary }]}>{view.countdown}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={onPrimaryTap}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: T.red, opacity: pressed ? 0.9 : 1 }]}
            >
              {showAck && !isExpired ? <Icon name="check" size={18} color={T.textPrimary} /> : null}
              <Text style={[styles.primaryLabel, { color: T.textPrimary }]}>{primaryLabel}</Text>
            </Pressable>
            {!isExpired ? (
              <Pressable
                onPress={onAdjustTap}
                accessibilityRole="button"
                accessibilityLabel="Adjust command"
                style={({ pressed }) => [styles.secondaryBtn, { borderColor: T.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.secondaryLabel, { color: T.textPrimary }]}>Adjust command</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Why this command */}
          {!isExpired ? (
            <Pressable onPress={onWhyTap} accessibilityRole="button" accessibilityLabel="Why this command" style={styles.whyLink}>
              <Text style={[styles.whyText, { color: T.textSecondary }]}>Why this command</Text>
              <Icon name={whyOpen ? 'chevron-up' : 'chevron-down'} size={14} color={T.textTertiary} />
            </Pressable>
          ) : null}
          {whyOpen && !isExpired ? (
            <View style={[styles.whySheet, { backgroundColor: T.surface, borderColor: T.divider }]}>
              <Text style={[styles.whyBody, { color: T.textSecondary }]}>{view.rationale}</Text>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Progress footer — anchored above bottom safe area */}
      {!isExpired ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]} accessibilityLabel={progressA11y}>
          <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
            <View style={[styles.trackFill, { width: progressPct, backgroundColor: T.red }]} />
          </View>
          <View style={styles.footerLabels}>
            <Text style={[styles.footerLabel, { color: T.textTertiary }]}>RECOVERY FOCUS</Text>
            <Text style={[styles.footerLabel, { color: T.textTertiary }]}>{view.durationLabel}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 300 },
  content: { paddingHorizontal: 24, minHeight: '100%' },
  header: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { gap: 6 },
  headerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  headerLabel: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 1.9 },
  status: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pulseZone: { height: 264, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 240, height: 240, borderRadius: 120, borderWidth: 1 },
  pulseCore: { width: 88, height: 88, borderRadius: 44, opacity: 0.72 },
  commandBlock: { alignItems: 'center', maxWidth: 342, alignSelf: 'center' },
  eyebrow: { fontSize: 11, lineHeight: 14, fontFamily: 'Inter_600SemiBold', letterSpacing: 2 },
  title: { marginTop: 20, fontSize: 38, lineHeight: 44, fontFamily: 'Inter_500Medium', letterSpacing: -0.76, textAlign: 'center' },
  instruction: { marginTop: 14, fontSize: 17, lineHeight: 24, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  updatedAgo: { marginTop: 8, fontSize: 12, fontFamily: 'Inter_400Regular' },
  countdownBlock: { marginTop: 36, alignItems: 'center' },
  timerHairline: { width: 32, height: 1, marginBottom: 14 },
  timerLabel: { fontSize: 11, lineHeight: 14, fontFamily: 'Inter_600SemiBold', letterSpacing: 2 },
  timer: { marginTop: 14, fontSize: 72, lineHeight: 76, fontFamily: 'Inter_400Regular', letterSpacing: 2.9, fontVariant: ['tabular-nums'] },
  actions: { marginTop: 32, gap: 12 },
  primaryBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryLabel: { fontSize: 17, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: { height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  whyLink: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  whyText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  whySheet: { marginTop: 16, padding: 16, borderRadius: 14, borderWidth: 1 },
  whyBody: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  footer: { position: 'absolute', left: 24, right: 24, bottom: 0 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 2 },
  footerLabels: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.8 },
});
