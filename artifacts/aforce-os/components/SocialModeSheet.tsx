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
import { Icon, type IconName } from './Icon';
import { RecoveryCapacityCard } from './RecoveryCapacityCard';
import { RecoveryModeCard } from './RecoveryModeCard';
import { RecoveryModePaywall } from './RecoveryModePaywall';
import { useAppStore } from '../store/useAppStore';
import { gate } from '../featureFlags/subscriptionGate';
import { RECOVERY_WINDOW_MS } from '../services/socialModeEngine';
import { RECOVERY_PRESET_LIST, presetMetaFor, type RecoveryPresetId } from '../services/recoveryCapacity';
import type { DrinkType, ScoreEngineOutput, SocialModeState } from '../types';

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
}

const AMBER = '#F4B23F';
const TEAL  = '#19E5C6';

export function SocialModeSheet({
  visible, onDismiss, socialMode, social,
  onActivate, onDeactivate,
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
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(60, { duration: 180 });
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

  // Minutes remaining in the 8h recovery window, derived purely from
  // session end time — no BAC math involved.
  const recoveryMinutesLeft: number = (() => {
    const endedAt = socialMode?.endedAt;
    if (!endedAt) return 0;
    const ms = RECOVERY_WINDOW_MS - (Date.now() - endedAt.getTime());
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
          <Pressable hitSlop={12} onPress={onDismiss} style={styles.closeBtn}>
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

              <Pressable
                onPress={handleDeactivate}
                style={[styles.primaryBtn, { borderColor: `${AMBER}66` }]}
                testID="recovery-end-session"
                accessibilityRole="button"
                accessibilityLabel="End recovery session"
              >
                <Feather name="moon" size={16} color={AMBER} />
                <Text style={[styles.primaryBtnText, { color: AMBER }]}>END SESSION</Text>
              </Pressable>
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
});
