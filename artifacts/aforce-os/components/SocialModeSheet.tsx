/**
 * SocialModeSheet — Recovery Mode control surface.
 *
 * Renamed in intent (not in filename — preserved for git history and
 * callsite stability) by chunk #3c of the Master Update. AForce no
 * longer presents this surface as a drink-logging tool. Instead it
 * surfaces the Recovery Capacity Score with three explicit lifecycle
 * states:
 *
 *   - OFF       : intro copy + "Start Recovery Session" CTA.
 *   - ACTIVE    : RecoveryCapacityCard + decay multiplier readout
 *                 + "End Session" CTA.
 *   - RECOVERY  : 8h post-session window — RecoveryCapacityCard
 *                 + RecoveryModeCard checklist + "Done" CTA.
 *
 * All drink-picker grids, BAC numbers, impairment badges, and
 * transportation-safety prompts were removed; the underlying API
 * actions still exist (`onLogDrink`, `onConfirmHydration`) so callers
 * compile, but no UI calls them. They will be retired in chunk #3d
 * once every callsite is on the new lifecycle.
 */

import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../theme/colors';
import { af, afMotion } from '../theme/afTokens';
import { Icon, type IconName } from './Icon';
import { PulseRing } from './PulseRing';
import { RecoveryCapacityCard } from './RecoveryCapacityCard';
import { RecoveryModeCard } from './RecoveryModeCard';
import { RecoveryModePaywall } from './RecoveryModePaywall';
import { useAppStore } from '../store/useAppStore';
import { gate } from '../featureFlags/subscriptionGate';
import { RECOVERY_WINDOW_MS } from '../services/socialModeEngine';
import { RECOVERY_PRESET_LIST, presetMetaFor, type RecoveryPresetId } from '../services/recoveryCapacity';
import type { DrinkType, ScoreEngineOutput, SocialModeState } from '../types';

/**
 * ─── Chunk #7a polish primitives ──────────────────────────────────
 * Tiny, additive Reanimated wrappers used by the modifier surface.
 * Kept inline so the polish is self-contained and easy to audit.
 *
 * `PulseRing` (the glow behind the CRUISE / SHIELD live-timer pills) moved
 * out to components/PulseRing.tsx (RC-1 Wave-2A) so its reduced-motion gate
 * can be unit-tested without mounting this whole sheet.
 */

/**
 * Press-to-scale wrapper. Built on `Animated.createAnimatedComponent(Pressable)`
 * so the animated transform rides directly on the `Pressable` itself —
 * no extra wrapper view to swallow `flex` from a parent row layout.
 * Honors `disabled` and forwards every accessibility / test prop.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PressableScale({
  onPress, disabled, testID, accessibilityRole, accessibilityLabel,
  style, children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityRole?: 'button';
  accessibilityLabel?: string;
  style?: any;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withTiming(0.96, { duration: 90 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 260 }); }}
      disabled={disabled}
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[style, aStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Hours-and-minutes display for a future timestamp, or null when expired. */
function formatRemaining(until: Date | undefined, now: number = Date.now()): string | null {
  if (!until) return null;
  const ms = until.getTime() - now;
  if (ms <= 0) return null;
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}H ${m}M` : `${m}M`;
}

interface Props {
  visible: boolean;
  onDismiss: () => void;
  socialMode: SocialModeState | undefined;
  social: ScoreEngineOutput['social'];
  onActivate: (preset?: RecoveryPresetId | null) => void;
  /** @deprecated retained for callsite compatibility; no UI invokes it post-3c. */
  onLogDrink: (type: DrinkType) => void;
  /** @deprecated retained for callsite compatibility; no UI invokes it post-3c. */
  onConfirmHydration: (confirmed: boolean) => void;
  onDeactivate: () => void;
  /** Chunk #5: engage Cruise Mode (extends recovery window 8h→24h). */
  onActivateCruise: () => void;
  /** Chunk #5: engage Voyage Shield (floors recovery score at 60 for 12h). */
  onActivateShield: () => void;
}

const AMBER = af.amber; // RC-2 Ruling E: #F4B23F retired to the approved af.amber (#FFA01E)
const TEAL  = '#19E5C6';

export function SocialModeSheet({
  visible, onDismiss, socialMode, social,
  onActivate, onDeactivate,
  onActivateCruise, onActivateShield,
}: Props) {
  const { t } = useTranslation();
  const { state } = useAppStore();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(60);
  // Local preset selection. Persists only until activation — once the
  // session is live, the active preset comes from `socialMode.preset`.
  const [selectedPreset, setSelectedPreset] = React.useState<RecoveryPresetId | null>(null);

  // Reset the local selection whenever the sheet is closed so the user
  // doesn't inherit a stale pick on their next open.
  useEffect(() => { if (!visible) setSelectedPreset(null); }, [visible]);

  useEffect(() => {
    if (visible) {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      // ENTER (afMotion pattern #1): durations.standard + easing.standardOut,
      // was 220ms/Easing.out(quad) — exact duration match, token easing curve.
      opacity.value = withTiming(1, { duration: afMotion.durations.standard, easing: Easing.bezier(...afMotion.easing.standardOut) });
      translateY.value = withSpring(0, afMotion.springs.standard);
      // was { damping: 18, stiffness: 220 } — the dominant sheet spring, token match.
    } else {
      // EXIT (afMotion pattern #2): durations.selection, was 180ms — diff 30ms.
      opacity.value = withTiming(0, { duration: afMotion.durations.selection });
      translateY.value = withTiming(60, { duration: afMotion.durations.selection });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const isActive   = !!social?.active;
  const inRecovery = !!social?.inRecoveryWindow && !isActive;

  // Accent follows the live band when we have one; otherwise fall back
  // to the calm teal "Stable" tint for the OFF state.
  const accent = social?.recoveryCapacity?.meta.color ?? TEAL;

  // Minutes remaining in the recovery window, derived from session end
  // time and the rollup's *effective* window (extends to 24h when
  // Cruise is active — chunk #5). Falls back to the 8h constant if the
  // rollup isn't present yet.
  const recoveryMinutesLeft: number = (() => {
    const endedAt = socialMode?.endedAt;
    if (!endedAt) return 0;
    const windowMs = social?.windowMs ?? RECOVERY_WINDOW_MS;
    const ms = windowMs - (Date.now() - endedAt.getTime());
    return Math.max(0, Math.round(ms / 60_000));
  })();

  const handleActivate = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onActivate(selectedPreset);
  };

  const activePreset = presetMetaFor(socialMode?.preset);

  const handleDeactivate = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDeactivate();
  };

  // ─── Chunk #5: Cruise / Voyage Shield modifiers ────────────────
  const cruiseActive = !!social?.cruiseActive;
  const shieldActive = !!social?.voyageShieldActive;
  const cruiseRemaining = formatRemaining(socialMode?.cruiseUntil);
  const shieldRemaining = formatRemaining(socialMode?.voyageShieldUntil);
  // Reuse the existing Recovery Mode entitlement gate for both modifiers
  // — anyone on Recovery+ already has the right plan, and a single gate
  // keeps the upgrade story coherent until product splits them apart.
  const shieldGate = gate(state.subscription, 'recovery_mode_enabled');

  const handleCruise = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onActivateCruise();
  };
  const handleShield = () => {
    if (!shieldGate.allowed) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onActivateShield();
  };

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <Animated.View
        style={[
          styles.sheet,
          sheetStyle,
          {
            borderColor: `${accent}33`,
            paddingTop: Math.max(insets.top, 12) + 8,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          },
        ]}
        testID="social-mode-sheet"
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: accent }]}>RECOVERY MODE</Text>
            <Text style={styles.headline}>
              {inRecovery ? 'Recovery window active'
                : isActive ? 'Recovery session — live'
                : 'Recovery capacity, on demand'}
            </Text>
          </View>
          <Pressable
            hitSlop={12}
            onPress={onDismiss}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={18} color={Colors.text.secondary} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── OFF state ──────────────────────────────────────────── */}
          {!isActive && !inRecovery && (
            <>
              <Text style={styles.body}>
                Start a session whenever you’re in elevated-stress mode —
                travel, heat, late nights, hard training blocks. AForce
                will blend your AutoPilot score, hydration compliance,
                and environment into a single Recovery Capacity reading
                you can watch in real time.
              </Text>

              <Text style={styles.sectionLabel}>OPTIONAL · PICK A CONTEXT</Text>
              <View style={styles.presetRow}>
                {RECOVERY_PRESET_LIST.map((p) => {
                  const isSel = selectedPreset === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                        setSelectedPreset(isSel ? null : p.id);
                      }}
                      style={[
                        styles.presetChip,
                        {
                          borderColor: isSel ? `${TEAL}99` : 'rgba(255,255,255,0.10)',
                          backgroundColor: isSel ? `${TEAL}1A` : 'rgba(255,255,255,0.03)',
                        },
                      ]}
                      testID={`recovery-preset-${p.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSel }}
                      accessibilityLabel={`${p.label} preset`}
                    >
                      <Icon
                        name={p.icon as IconName}
                        size={18}
                        color={isSel ? TEAL : Colors.text.secondary}
                      />
                      <Text style={[
                        styles.presetLabel,
                        { color: isSel ? TEAL : Colors.text.primary },
                      ]}>
                        {p.label.toUpperCase()}
                      </Text>
                      <Text style={styles.presetBlurb} numberOfLines={2}>{p.blurb}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={handleActivate}
                style={[styles.primaryBtn, { borderColor: `${TEAL}66`, backgroundColor: `${TEAL}14` }]}
                testID="recovery-start-session"
                accessibilityRole="button"
                accessibilityLabel="Start recovery session"
              >
                <Feather name="play" size={16} color={TEAL} />
                <Text style={[styles.primaryBtnText, { color: TEAL }]}>
                  START RECOVERY SESSION
                </Text>
              </Pressable>
            </>
          )}

          {/* ─── ACTIVE state ──────────────────────────────────────── */}
          {isActive && social && (
            <>
              {activePreset && (
                <View
                  style={[styles.activePresetChip, { borderColor: `${TEAL}55`, backgroundColor: `${TEAL}14` }]}
                  testID={`recovery-active-preset-${activePreset.id}`}
                >
                  <Icon name={activePreset.icon as IconName} size={14} color={TEAL} />
                  <Text style={[styles.activePresetText, { color: TEAL }]}>
                    {activePreset.label.toUpperCase()} PRESET
                  </Text>
                </View>
              )}
              <RecoveryCapacityCard recovery={social.recoveryCapacity} />

              <View style={styles.statusRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>×{social.alcoholMultiplier.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>DECAY MULTIPLIER</Text>
                </View>
                <View style={[styles.statBlock, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.statValue, { color: accent }]}>
                    {social.recoveryCapacity.meta.label.toUpperCase()}
                  </Text>
                  <Text style={styles.statLabel}>CURRENT BAND</Text>
                </View>
              </View>

              {(cruiseActive || shieldActive) && (
                <View style={styles.modifierPillRow}>
                  {cruiseActive && (
                    <View
                      style={[styles.modifierPill, { borderColor: `${TEAL}55`, backgroundColor: `${TEAL}14` }]}
                      testID="recovery-modifier-cruise-active"
                    >
                      <PulseRing color={TEAL} />
                      <Feather name="navigation" size={12} color={TEAL} />
                      <Text style={[styles.modifierPillText, { color: TEAL }]}>
                        CRUISE · {cruiseRemaining ?? '—'}
                      </Text>
                    </View>
                  )}
                  {shieldActive && (
                    <View
                      style={[styles.modifierPill, { borderColor: `${AMBER}66`, backgroundColor: `${AMBER}14` }]}
                      testID="recovery-modifier-shield-active"
                    >
                      <PulseRing color={AMBER} />
                      <Feather name="shield" size={12} color={AMBER} />
                      <Text style={[styles.modifierPillText, { color: AMBER }]}>
                        SHIELD · {shieldRemaining ?? '—'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.modifierBtnRow}>
                <PressableScale
                  onPress={handleCruise}
                  style={[
                    styles.modifierBtn,
                    { borderColor: cruiseActive ? `${TEAL}66` : 'rgba(255,255,255,0.08)' },
                  ]}
                  testID="recovery-engage-cruise"
                  accessibilityRole="button"
                  accessibilityLabel={cruiseActive ? 'Extend Cruise Mode' : 'Engage Cruise Mode (24h recovery window)'}
                >
                  <Feather name="navigation" size={14} color={TEAL} />
                  <Text style={[styles.modifierBtnText, { color: TEAL }]}>
                    {cruiseActive ? 'EXTEND CRUISE' : 'CRUISE · 24H'}
                  </Text>
                </PressableScale>
                <PressableScale
                  onPress={handleShield}
                  disabled={!shieldGate.allowed}
                  style={[
                    styles.modifierBtn,
                    {
                      borderColor: shieldActive ? `${AMBER}66` : 'rgba(255,255,255,0.08)',
                      opacity: shieldGate.allowed ? 1 : 0.45,
                    },
                  ]}
                  testID="recovery-engage-shield"
                  accessibilityRole="button"
                  accessibilityLabel={
                    !shieldGate.allowed
                      ? 'Voyage Shield — upgrade to Recovery+'
                      : shieldActive ? 'Extend Voyage Shield' : 'Engage Voyage Shield (12h score floor)'
                  }
                >
                  <Feather name={shieldGate.allowed ? 'shield' : 'lock'} size={14} color={AMBER} />
                  <Text style={[styles.modifierBtnText, { color: AMBER }]}>
                    {!shieldGate.allowed ? 'SHIELD · LOCKED' : shieldActive ? 'EXTEND SHIELD' : 'SHIELD · 12H'}
                  </Text>
                </PressableScale>
              </View>

              <PressableScale
                onPress={handleDeactivate}
                style={[styles.primaryBtn, { borderColor: `${AMBER}66` }]}
                testID="recovery-end-session"
                accessibilityRole="button"
                accessibilityLabel="End recovery session"
              >
                <Feather name="moon" size={16} color={AMBER} />
                <Text style={[styles.primaryBtnText, { color: AMBER }]}>END SESSION</Text>
              </PressableScale>
            </>
          )}

          {/* ─── RECOVERY window ──────────────────────────────────── */}
          {inRecovery && social && (
            <>
              <Text style={styles.body}>
                Your recovery window is still open. AForce keeps watching
                your capacity until it closes — protect the score.
              </Text>

              <RecoveryCapacityCard recovery={social.recoveryCapacity} />

              {gate(state.subscription, 'recovery_mode_enabled').allowed ? (
                <RecoveryModeCard timeToClearMinutes={recoveryMinutesLeft} />
              ) : (
                <RecoveryModePaywall />
              )}

              <Pressable
                onPress={onDismiss}
                style={[styles.primaryBtn, { borderColor: `${TEAL}66` }]}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Feather name="check" size={16} color={TEAL} />
                <Text style={[styles.primaryBtnText, { color: TEAL }]}>DONE</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 1000,
  },
  sheet: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
    backgroundColor: '#101015',
    borderTopWidth: 0,
    paddingHorizontal: 22,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 2, marginBottom: 4 },
  headline: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text.primary, lineHeight: 23 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { fontSize: 14, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, lineHeight: 20, marginBottom: 16 },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, marginBottom: 14, gap: 12,
  },
  statBlock: { flex: 1 },
  statValue: { fontSize: 22, fontFamily: 'Inter_700Bold', color: Colors.text.primary },
  statLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.4, marginTop: 2 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 1.6, marginTop: 4, marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row', gap: 8, marginBottom: 14,
  },
  presetChip: {
    flex: 1, minHeight: 92, paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: 14, borderWidth: 1, alignItems: 'center', gap: 4,
  },
  presetLabel: {
    fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, marginTop: 4,
  },
  presetBlurb: {
    fontSize: 10, lineHeight: 13, color: Colors.text.muted,
    fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 2,
  },
  activePresetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
    marginBottom: 10,
  },
  activePresetText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  modifierPillRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 4, flexWrap: 'wrap' },
  modifierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
    overflow: 'hidden', // contains the PulseRing absolute halo
  },
  modifierPillText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.4 },
  modifierBtnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  modifierBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  modifierBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2 },
});
