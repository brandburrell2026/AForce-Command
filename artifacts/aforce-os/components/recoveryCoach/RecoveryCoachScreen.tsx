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
import { hapticImpact } from '@/services/haptics';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../Icon';
import { af } from '@/theme';

/**
 * S2-13: the RecoveryCoachTokens file was 9/11 a value-for-value duplicate
 * of `af.*` and is deleted; those nine now come from the one palette. The
 * two survivors below are NOT duplicates — the coach's focused-mode
 * surfaces are deliberately a touch deeper than `af.surface`/`surfaceRaised`
 * (see the deleted file's header, preserved here): a private command field.
 */
const COACH_SURFACE = '#0D0E10'; //        sheets + expanded details
const COACH_SURFACE_RAISED = '#141518'; // elevated interactive surface
import { afMotion } from '../../theme/afTokens';
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
  const { t } = useTranslation();
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
  const title = view.state === 'expired' ? view.title : showRechecking ? t('coach.v2.recheck_in_progress') : view.title;
  const primaryLabel = view.state === 'expired' ? view.primaryActionLabel : showAck ? t('coach.v2.water_logged') : view.primaryActionLabel;
  const isExpired = view.state === 'expired';

  // ── Motion: entrance + pulse (Reduce-Motion → static) ──
  const enterOpacity = useSharedValue(0);
  const enterY = useSharedValue(12);
  const pulseScale = useSharedValue(1);
  const ringScale = useSharedValue(0.94);
  const ringOpacity = useSharedValue(0.24);
  useEffect(() => {
    // ENTER (afMotion pattern #1): durations.slow + easing.standardOut. Was
    // 420ms/Easing.bezier(0.22,1,0.36,1) — the LITERAL standardOut curve
    // already, now imported from the token instead of redeclared. Duration
    // judged down to slow (360, diff 60ms): a content-entrance fade+rise,
    // not a hero cinematic reveal (the pulse loop below stays untouched —
    // already reduced-motion gated).
    enterOpacity.value = withTiming(1, { duration: afMotion.durations.slow, easing: Easing.bezier(...afMotion.easing.standardOut) });
    enterY.value = withTiming(0, { duration: afMotion.durations.slow, easing: Easing.bezier(...afMotion.easing.standardOut) });
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
    if (Platform.OS !== 'web') hapticImpact('medium');
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
  const remMin = Math.floor(view.countdownSeconds / 60);
  const remSec = view.countdownSeconds % 60;
  const progressA11y = t('coach.v2.progress_a11y', {
    pct: Math.round(view.progress * 100),
    min: remMin,
    sec: remSec,
  });

  return (
    <View style={[styles.root, { backgroundColor: af.canvasFocused }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header} accessibilityRole="header">
          <View style={styles.headerLeft}>
            <View style={styles.headerLabelRow}>
              <View style={[styles.liveDot, { backgroundColor: af.red }]} />
              <Text style={[styles.headerLabel, { color: af.textPrimary }]}>{t('coach.v2.header_label')}</Text>
            </View>
            <Text style={[styles.status, { color: af.textSecondary }]}>{offline ? t('coach.v2.status_offline') : t('coach.v2.status_live')}</Text>
          </View>
          <Pressable
            onPress={onCloseTap}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('coach.v2.close_a11y')}
            style={[styles.close, { borderColor: af.border }]}
          >
            <Icon name="x" size={20} color={af.textSecondary} />
          </Pressable>
        </View>

        <Animated.View style={enterStyle}>
          {/* Ambient pulse (decorative) */}
          <View style={styles.pulseZone} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {/* Soft radial atmosphere (§5) — Signal Red at low alpha, well below the pulse. */}
            <View style={[styles.pulseAtmosphere, { backgroundColor: af.redDim }]} />
            <Animated.View style={[styles.pulseRing, { borderColor: af.redHairline }, ringStyle]} />
            <Animated.View style={[styles.pulseCore, { backgroundColor: af.red }, coreStyle]} />
          </View>

          {/* Command block */}
          <View style={styles.commandBlock}>
            <Text style={[styles.eyebrow, { color: af.textTertiary }]}>{t('coach.v2.eyebrow')}</Text>
            <Text style={[styles.title, { color: af.textPrimary }]} accessibilityRole="text">{title}</Text>
            {!isExpired && view.instruction ? (
              <Text style={[styles.instruction, { color: af.textSecondary }]}>{view.instruction}</Text>
            ) : null}
            {view.updatedAgoLabel ? (
              <Text style={[styles.updatedAgo, { color: af.textTertiary }]}>{view.updatedAgoLabel}</Text>
            ) : null}
          </View>

          {/* Countdown */}
          {!isExpired ? (
            <View style={styles.countdownBlock} accessible accessibilityLabel={t('coach.v2.countdown_a11y', { label: view.timerLabel, countdown: view.countdown })}>
              <View style={[styles.timerHairline, { backgroundColor: af.red }]} />
              <Text style={[styles.timerLabel, { color: af.textTertiary }]}>{view.timerLabel}</Text>
              <Text style={[styles.timer, { color: af.textPrimary }]}>{view.countdown}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={onPrimaryTap}
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: af.red, opacity: pressed ? 0.9 : 1 }]}
            >
              {showAck && !isExpired ? <Icon name="check" size={18} color={af.textPrimary} /> : null}
              <Text style={[styles.primaryLabel, { color: af.textPrimary }]}>{primaryLabel}</Text>
            </Pressable>
            {!isExpired ? (
              <Pressable
                onPress={onAdjustTap}
                accessibilityRole="button"
                accessibilityLabel={t('coach.v2.adjust')}
                style={({ pressed }) => [styles.secondaryBtn, { borderColor: af.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.secondaryLabel, { color: af.textPrimary }]}>{t('coach.v2.adjust')}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Why this command */}
          {!isExpired ? (
            <Pressable onPress={onWhyTap} accessibilityRole="button" accessibilityState={{ expanded: whyOpen }} accessibilityLabel={t('coach.v2.why')} style={styles.whyLink}>
              <Text style={[styles.whyText, { color: af.textSecondary }]}>{t('coach.v2.why')}</Text>
              <Icon name={whyOpen ? 'chevron-up' : 'chevron-down'} size={14} color={af.textTertiary} />
            </Pressable>
          ) : null}
          {whyOpen && !isExpired ? (
            <View style={[styles.whySheet, { backgroundColor: COACH_SURFACE, borderColor: af.divider }]}>
              <Text style={[styles.whyBody, { color: af.textSecondary }]}>{view.rationale}</Text>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Progress footer — anchored above bottom safe area */}
      {!isExpired ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]} accessible accessibilityLabel={progressA11y}>
          <View style={styles.footerInner}>
            <View
              style={[styles.track, { backgroundColor: af.divider }]}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <View style={[styles.trackFill, { width: progressPct, backgroundColor: af.red }]} />
            </View>
            <View style={styles.footerLabels}>
              <Text style={[styles.footerLabel, { color: af.textTertiary }]}>{t('coach.v2.recovery_focus')}</Text>
              <Text style={[styles.footerLabel, { color: af.textTertiary }]}>{view.durationLabel}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 300 },
  // Content clamps to the spec's 430pt max readable width and centers on large
  // phones/tablets (§5), so buttons/header/footer don't stretch edge-to-edge.
  content: { paddingHorizontal: 24, minHeight: '100%', width: '100%', maxWidth: 430, alignSelf: 'center' },
  header: { minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { gap: 6 },
  headerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  headerLabel: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 1.9 },
  status: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  close: {
    // 44pt iOS / 48dp Android minimum touch target (§9).
    ...Platform.select({ android: { width: 48, height: 48, borderRadius: 24 }, default: { width: 44, height: 44, borderRadius: 22 } }),
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  pulseZone: { height: 264, alignItems: 'center', justifyContent: 'center' },
  pulseAtmosphere: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.5 },
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
  primaryBtn: { minHeight: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryLabel: { fontSize: 17, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  secondaryBtn: { minHeight: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  whyLink: { marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  whyText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  whySheet: { marginTop: 16, padding: 16, borderRadius: 14, borderWidth: 1 },
  whyBody: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  // Footer clamps to the same 430pt readable width, centered (§5).
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  footerInner: { width: '100%', maxWidth: 430, paddingHorizontal: 24 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 2 },
  footerLabels: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.8 },
});
