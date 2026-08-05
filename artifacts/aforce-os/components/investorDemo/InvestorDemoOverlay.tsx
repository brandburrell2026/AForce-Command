/**
 * AForce — Investor Demo Overlay (60-second cinematic flow, Phase 10).
 *
 * Full-screen modal that plays SIX acts (ten seconds each = 60s):
 *
 *   1  Opening          — AForce wordmark + "The Performance Operating System."
 *   2  Readiness Score  — orb climbs Depleted → Peak, score 14 → 97.
 *   3  HydroScan        — product recognition + AI voice moment.
 *   4  Social Mode      — BAC safety overlay (crimson ring) on the orb.
 *   5  Territory + Heat — stylized map + Heat Guard escalates to WARNING.
 *   6  The Standard     — clean Peak orb + brand sign-off.
 *
 * Everything is SEEDED from `data/demoProfile.ts` (via the derived schedule
 * in `services/demo/investorDemoBeats.ts`). The overlay is fully
 * self-contained: it does not read live state, does not touch the engine
 * pipeline, and NEVER mutates / persists score (Score-Protection). It drives
 * its own animated score / orb visuals, and only Act 3 speaks — routed
 * through the real `commandSpeak()` pipeline so the ElevenLabs proxy + voice
 * bus light up exactly as they would in the field.
 *
 * Dismiss: tap ANYWHERE, hardware back, or wait for the 60-second auto-close.
 * Closing the overlay restores the underlying app instantly.
 *
 * Visibility is gated upstream by `demo_mode_enabled` (see
 * `shouldShowInvestorDemo` in featureFlags/flags.ts) so this overlay can
 * never mount in a production build.
 */

import React from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { AFModal } from '@/components/ui/AFModal';
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
import { Typography } from '../../theme/typography';
import { DEMO_PROFILE } from '../../data/demoProfile';
import {
  commandSpeak,
  getPlaybackState,
  subscribePlayback,
  type PlaybackState,
} from '../../services/voice/commandVoiceBus';
import {
  INVESTOR_DEMO_BEATS,
  INVESTOR_DEMO_TOTAL_MS,
  scoreToBand,
  type DemoBand,
} from '../../services/demo/investorDemoBeats';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ORB_SIZE = Math.min(SCREEN_W, SCREEN_H) * 0.4;

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

  // Mirror the bus playback state so Act 3 can label RECEIVED / TRANSMITTING /
  // EXECUTED in real time and radiate the voice halo.
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

    INVESTOR_DEMO_BEATS.forEach((b, idx) => {
      timersRef.current.push(
        setTimeout(() => {
          setBeatIndex(idx);
          // Score-Protection: the only side effect a beat can have is
          // speaking a seeded line. Nothing here awards or mutates score.
          if (b.voice) {
            commandSpeak(b.voice.line, {
              level: b.voice.level,
              intensity: 'standard',
              category: b.voice.category,
            });
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
          }
        }, b.startMs),
      );
    });

    // Auto-close at exactly 60s so the investor lands back on the app.
    timersRef.current.push(
      setTimeout(() => {
        onClose();
      }, INVESTOR_DEMO_TOTAL_MS),
    );

    return clearAllTimers;
  }, [visible, clearAllTimers, onClose]);

  /* ---------------------------------------------------------------- *
   * Reanimated drivers.
   * ---------------------------------------------------------------- */

  // Animated score readout. For the Readiness act (scoreFrom set) we snap to
  // the starting value then tween upward over most of the act so the climb
  // 14 → 97 reads cinematically; other acts ease toward their score.
  const scoreSV = useSharedValue(beat.score);
  React.useEffect(() => {
    if (beat.scoreFrom != null) {
      scoreSV.value = beat.scoreFrom;
      scoreSV.value = withTiming(beat.score, {
        duration: Math.min(8200, beat.durationMs * 0.85),
        easing: Easing.out(Easing.cubic),
      });
    } else {
      scoreSV.value = withTiming(beat.score, {
        duration: Math.min(2200, beat.durationMs * 0.55),
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [beatIndex]);

  // Re-render the digit a few times per second while the score animates.
  // useAnimatedReaction + runOnJS is the correct UI→JS bridge (calling a JS
  // setter directly from a UI-thread derived value crashes on Android).
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

  // During the Readiness climb the orb re-tints continuously with the score
  // (Depleted → Recovering → Balanced → Peak); every other act uses its
  // authored band. The opening act uses the brand accent.
  const dynamicBand: DemoBand =
    beat.scene === 'readiness' ? scoreToBand(displayedScore) : beat.band;
  const accent =
    beat.scene === 'opening' ? Colors.accent.brand : BAND_ACCENT[dynamicBand];
  const glow =
    beat.scene === 'opening' ? Colors.accent.brandGlow : BAND_GLOW[dynamicBand];

  // Orb pulse — faster on hotter bands.
  const orbPulse = useSharedValue(0);
  React.useEffect(() => {
    cancelAnimation(orbPulse);
    if (!visible) return;
    const dur =
      dynamicBand === 'CRITICAL' ? 650
      : dynamicBand === 'RISK'   ? 950
      : dynamicBand === 'STABLE' || dynamicBand === 'CORRECT' ? 1500
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
  }, [visible, dynamicBand]);

  // Voice halo — radiates outward while the bus is playing (Act 3).
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

  // Social crimson ring — pulses around the orb during the Social act.
  const socialRing = useSharedValue(0);
  React.useEffect(() => {
    cancelAnimation(socialRing);
    if (!visible || beat.scene !== 'social') {
      socialRing.value = 0;
      return;
    }
    socialRing.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(socialRing);
  }, [visible, beat.scene]);

  // HydroScan reticle — a scan line sweeps the product chip during Act 3.
  const scanSweep = useSharedValue(0);
  React.useEffect(() => {
    cancelAnimation(scanSweep);
    if (!visible || beat.scene !== 'hydroScan') {
      scanSweep.value = 0;
      return;
    }
    scanSweep.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(scanSweep);
  }, [visible, beat.scene]);

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

  // Scene cross-fade — re-fades the center content on every act change.
  const sceneFade = useSharedValue(1);
  React.useEffect(() => {
    sceneFade.value = withSequence(
      withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
  }, [beatIndex]);

  /* --------------------------- animated styles --------------------------- */

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

  const socialRingStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(socialRing.value, [0, 0.2, 1], [0, 0.9, 0]),
    transform: [{ scale: interpolate(socialRing.value, [0, 1], [1.02, 1.4]) }],
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    top: `${interpolate(scanSweep.value, [0, 1], [6, 82])}%`,
    opacity: interpolate(scanSweep.value, [0, 0.5, 1], [0.4, 1, 0.4]),
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100])}%`,
    backgroundColor: accent,
  }));

  const sceneStyle = useAnimatedStyle(() => ({
    opacity: sceneFade.value,
    transform: [{ translateY: interpolate(sceneFade.value, [0, 1], [10, 0]) }],
  }));

  const onExit = React.useCallback(() => {
    clearAllTimers();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onClose();
  }, [clearAllTimers, onClose]);

  /* --------------------------- orb primitive --------------------------- */

  const renderOrb = (size: number) => (
    <View style={[styles.orbWrap, { width: size * 1.9, height: size * 1.9 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbHalo,
          {
            width: size * 1.55,
            height: size * 1.55,
            borderRadius: size * 0.775,
            backgroundColor: glow,
          },
          orbHaloStyle,
        ]}
      />
      {voiceActive && beat.scene === 'hydroScan' && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size * 1.85,
              height: size * 1.85,
              borderRadius: size * 0.925,
              borderColor: accent,
            },
            voiceHaloStyle,
          ]}
        />
      )}
      {beat.scene === 'social' && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size * 1.7,
              height: size * 1.7,
              borderRadius: size * 0.85,
              borderColor: Colors.accent.brand,
              borderWidth: 2.5,
            },
            socialRingStyle,
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.orbCore,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: accent,
            shadowColor: glow,
          },
          orbCoreStyle,
        ]}
      />
    </View>
  );

  /* --------------------------- per-act scene --------------------------- */

  const renderScene = () => {
    switch (beat.scene) {
      case 'opening':
        return (
          <View style={styles.center}>
            {renderOrb(ORB_SIZE * 0.62)}
            <Text style={styles.wordmark}>{DEMO_PROFILE.brand.wordmark}</Text>
            <View style={[styles.hairline, { backgroundColor: Colors.accent.brand }]} />
            <Text style={styles.openingTagline}>{DEMO_PROFILE.brand.tagline}</Text>
          </View>
        );

      case 'readiness':
        return (
          <View style={styles.center}>
            <Text style={styles.eyebrow}>{beat.title}</Text>
            <Text
              style={[styles.score, { color: accent, textShadowColor: glow }]}
              testID="investor-demo-score"
            >
              {displayedScore}
            </Text>
            <Text style={[styles.bandChip, { color: accent, borderColor: `${accent}55` }]}>
              {dynamicBand}
            </Text>
            {renderOrb(ORB_SIZE * 0.78)}
          </View>
        );

      case 'hydroScan':
        return (
          <View style={styles.center}>
            <Text style={styles.eyebrow}>{beat.title}</Text>
            {renderOrb(ORB_SIZE * 0.7)}
            <View style={styles.scanCard}>
              <Animated.View
                pointerEvents="none"
                style={[styles.scanLine, { backgroundColor: accent }, scanLineStyle]}
              />
              <Text style={styles.scanVerdict}>{beat.sceneData?.productVerdict}</Text>
              <Text style={styles.scanProduct}>{beat.sceneData?.productName}</Text>
            </View>
            <View style={styles.voiceRow}>
              <View style={[styles.voiceDot, { backgroundColor: accent }]} />
              <Text style={styles.voiceLine} numberOfLines={2}>
                {beat.voice?.line}
              </Text>
            </View>
          </View>
        );

      case 'social':
        return (
          <View style={styles.center}>
            <Text style={styles.eyebrow}>{beat.title}</Text>
            {renderOrb(ORB_SIZE * 0.72)}
            <View style={[styles.safetyCard, { borderColor: Colors.border.accent }]}>
              <Text style={[styles.safetyLabel, { color: Colors.accent.brand }]}>
                SAFETY OVERLAY
              </Text>
              <Text style={styles.safetyValue}>{beat.sceneData?.bacText}</Text>
            </View>
          </View>
        );

      case 'territoryHeat':
        return (
          <View style={styles.center}>
            <Text style={styles.eyebrow}>{beat.title}</Text>
            <View style={styles.mapWrap}>
              <View style={styles.mapGrid}>
                {Array.from({ length: 16 }).map((_, i) => (
                  <View key={i} style={styles.mapCell} />
                ))}
              </View>
              <View style={[styles.mapHot, { backgroundColor: glow, borderColor: accent }]} />
              <Text style={[styles.mapSector, { color: accent }]}>
                {beat.sceneData?.territoryLabel}
              </Text>
            </View>
            <View style={[styles.heatBanner, { borderColor: `${accent}66`, backgroundColor: `${accent}1A` }]}>
              <Text style={[styles.heatStatus, { color: accent }]}>{beat.sceneData?.heatStatus}</Text>
              <Text style={styles.heatDetail}>{beat.sceneData?.heatDetail}</Text>
            </View>
          </View>
        );

      case 'standard':
        return (
          <View style={styles.center}>
            {renderOrb(ORB_SIZE * 0.82)}
            <Text style={styles.wordmark}>{DEMO_PROFILE.brand.wordmark}</Text>
            <View style={[styles.hairline, { backgroundColor: Colors.accent.brand }]} />
            <Text style={styles.signOff}>{DEMO_PROFILE.brand.signOff}</Text>
          </View>
        );
    }
  };

  /* --------------------------- render --------------------------- */

  return (
    <AFModal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onExit}
      statusBarTranslucent
    >
      <Pressable
        style={styles.root}
        onPress={onExit}
        accessibilityRole="button"
        accessibilityLabel="Skip investor demo"
        testID="investor-demo-skip"
      >
        {/* Top bar — brand eyebrow + progress + skip hint */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={[styles.brandDot, { backgroundColor: accent, shadowColor: accent }]} />
            <Text style={styles.brandLabel} numberOfLines={1}>
              {DEMO_PROFILE.brand.wordmark} · INVESTOR DEMO
            </Text>
          </View>
          <Text style={styles.actCounter}>
            {String(beat.id).padStart(2, '0')} / {String(INVESTOR_DEMO_BEATS.length).padStart(2, '0')}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>

        {/* Center stage — the active act */}
        <Animated.View style={[styles.stage, sceneStyle]}>{renderScene()}</Animated.View>

        {/* Footer — verbatim spec caption + tap-to-skip affordance */}
        <View style={styles.footer}>
          <Text style={styles.caption} numberOfLines={2}>
            {beat.label}
          </Text>
          <Text style={styles.skipHint}>TAP ANYWHERE TO SKIP</Text>
        </View>
      </Pressable>
    </AFModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 36,
    gap: 18,
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
    fontFamily: Typography.fonts.mono,
    letterSpacing: 2.5,
    color: Colors.text.secondary,
    flexShrink: 1,
  },
  actCounter: {
    fontSize: 10,
    fontFamily: Typography.fonts.mono,
    letterSpacing: 2,
    color: Colors.text.muted,
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
  stage: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  orbWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbHalo: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  orbCore: {
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 38,
    elevation: 0,
  },
  // Opening / Standard
  wordmark: {
    fontSize: 52,
    fontFamily: Typography.fonts.display,
    letterSpacing: 2,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  hairline: {
    width: 64,
    height: 2,
    borderRadius: 1,
  },
  openingTagline: {
    fontSize: 14,
    fontFamily: Typography.fonts.medium,
    letterSpacing: 0.4,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  signOff: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Typography.fonts.medium,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  // Readiness
  eyebrow: {
    fontSize: 10,
    fontFamily: Typography.fonts.mono,
    letterSpacing: 3,
    color: Colors.text.muted,
  },
  score: {
    fontSize: 120,
    lineHeight: 128,
    fontFamily: Typography.fonts.display,
    letterSpacing: -3,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
  },
  bandChip: {
    fontSize: 10,
    fontFamily: Typography.fonts.mono,
    letterSpacing: 2.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  // HydroScan
  scanCard: {
    width: '78%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.8,
  },
  scanVerdict: {
    fontSize: 10,
    fontFamily: Typography.fonts.mono,
    letterSpacing: 2.4,
    color: Colors.text.muted,
    marginBottom: 6,
  },
  scanProduct: {
    fontSize: 16,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 0.4,
    color: Colors.text.primary,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  voiceLine: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Typography.fonts.medium,
    color: Colors.text.primary,
  },
  // Social
  safetyCard: {
    width: '78%',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: Colors.background.card,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  safetyLabel: {
    fontSize: 10,
    fontFamily: Typography.fonts.mono,
    letterSpacing: 2.4,
  },
  safetyValue: {
    fontSize: 15,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 0.4,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  // Territory + Heat
  mapWrap: {
    width: ORB_SIZE * 1.6,
    height: ORB_SIZE * 1.1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mapCell: {
    width: '25%',
    height: '25%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border.subtle,
  },
  mapHot: {
    width: '34%',
    height: '50%',
    borderRadius: 999,
    borderWidth: 1.5,
    opacity: 0.9,
  },
  mapSector: {
    position: 'absolute',
    bottom: 10,
    fontSize: 10,
    fontFamily: Typography.fonts.mono,
    letterSpacing: 2.4,
  },
  heatBanner: {
    width: '78%',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heatStatus: {
    fontSize: 13,
    fontFamily: Typography.fonts.bold,
    letterSpacing: 1.2,
  },
  heatDetail: {
    fontSize: 11,
    fontFamily: Typography.fonts.mono,
    letterSpacing: 1.4,
    color: Colors.text.secondary,
  },
  // Footer
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  caption: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Typography.fonts.medium,
    color: Colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  skipHint: {
    fontSize: 9,
    fontFamily: Typography.fonts.mono,
    letterSpacing: 2.5,
    color: Colors.text.muted,
  },
});
