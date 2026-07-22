/**
 * WhoopSnapshotCard — cinematic "live from WHOOP" panel.
 *
 * Visually mirrors the real WHOOP app: black canvas, green
 * (#1FA35A) wordmark, hero Recovery ring color-coded by WHOOP's
 * published thresholds (green ≥67%, yellow 34–66%, red ≤33%), Strain
 * shown on the official 0–21 scale in WHOOP teal, and a Sleep
 * Performance percentage. The recovery ring animates its stroke
 * fill-in on mount and a green dot pulses next to "CONNECTED" so the
 * panel reads as live telemetry, not a static graphic.
 *
 * Pure presentation. Numbers are passed in by the parent; this card
 * does not touch the score store or fetch anything itself.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── WHOOP brand palette ───────────────────────────────────────────
const CONNECTED_GREEN = '#1FA35A';
const WHOOP_TEAL = '#1E5BFF';
const WHOOP_GREEN = '#1FA35A';
const WHOOP_YELLOW = '#FFDE00';
const WHOOP_RED = '#FF2800';
const PANEL_BG_TOP = '#0A0A0A';
const PANEL_BG_BOTTOM = '#0D0D0D';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_MUTED = '#5C6066';

// Ring geometry
const RING_SIZE = 132;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Strain scale per WHOOP: 0–21
const STRAIN_MAX = 21;

interface WhoopSnapshotCardProps {
  /** Recovery 0–100. Color-codes the ring per WHOOP's published thresholds. */
  recoveryPct?: number | null;
  /** Strain 0–21 on WHOOP's scale. */
  strain?: number | null;
  /** Hours of sleep last night. */
  sleepHoursLastNight?: number | null;
  /** Sleep performance 0–100. Optional — defaults to a derived estimate. */
  sleepPerformance?: number | null;
  /** True while connected but the first real snapshot hasn't arrived yet.
   *  Shows an honest "syncing" state instead of claiming live/scored data. */
  syncing?: boolean;
}

function recoveryColor(pct: number | null | undefined): string {
  if (pct == null) return TEXT_MUTED;
  if (pct >= 67) return WHOOP_GREEN;
  if (pct >= 34) return WHOOP_YELLOW;
  return WHOOP_RED;
}

// null → '—' placeholder; otherwise a settings.whoop.strain_* key suffix.
function strainBucketKey(s: number | null | undefined): string | null {
  if (s == null) return null;
  if (s < 10) return 'strain_light';
  if (s < 14) return 'strain_moderate';
  if (s < 18) return 'strain_strenuous';
  return 'strain_all_out';
}

export function WhoopSnapshotCard({
  recoveryPct,
  strain,
  sleepHoursLastNight,
  sleepPerformance,
  syncing = false,
}: WhoopSnapshotCardProps) {
  const { t } = useTranslation();
  const recColor = recoveryColor(recoveryPct);
  const recValue = recoveryPct != null ? Math.round(recoveryPct) : null;
  const strainValue = strain != null ? strain.toFixed(1) : '—';
  const strainPct = strain != null ? Math.min(strain / STRAIN_MAX, 1) : 0;
  const sleepValue =
    sleepHoursLastNight != null ? `${sleepHoursLastNight.toFixed(1)}` : '—';
  // If no explicit sleep performance was passed, derive a believable
  // % from hours-vs-target (8h = 100%). Caps at 100.
  const sleepPerf =
    sleepPerformance != null
      ? Math.round(sleepPerformance)
      : sleepHoursLastNight != null
        ? Math.min(100, Math.round((sleepHoursLastNight / 8) * 100))
        : null;

  // Animated stroke fill-in on mount: progress 0 → 1 over 900ms.
  const ringProgress = useSharedValue(0);
  // Pulsing connection dot: opacity 1 ↔ 0.35 looped.
  const pulse = useSharedValue(1);
  // Strain bar fill-in.
  const strainProgress = useSharedValue(0);

  useEffect(() => {
    const target = recoveryPct != null ? Math.max(0, Math.min(100, recoveryPct)) / 100 : 0;
    ringProgress.value = withTiming(target, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
    strainProgress.value = withTiming(strainPct, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [recoveryPct, strainPct, ringProgress, strainProgress, pulse]);

  const animatedRingProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const animatedStrainBarStyle = useAnimatedStyle(() => ({
    width: `${strainProgress.value * 100}%`,
  }));

  return (
    <LinearGradient
      colors={[PANEL_BG_TOP, PANEL_BG_BOTTOM]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Header — WHOOP wordmark + live indicator */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>WHOOP</Text>
        <View style={styles.connectedRow}>
          <Animated.View style={[styles.pulseDot, animatedDotStyle]} />
          <Text style={styles.connectedText}>{syncing ? t('settings.whoop.syncing') : t('settings.whoop.connected')}</Text>
        </View>
      </View>

      {/* Hero — Recovery ring */}
      <View style={styles.heroRow}>
        <View style={styles.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            {/* Track */}
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="#1A1A1A"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            {/* Animated progress, rotated -90° so it starts at 12 o'clock */}
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={recColor}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              animatedProps={animatedRingProps}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.ringCenter} pointerEvents="none">
            <Text style={[styles.recoveryValue, { color: recColor }]}>
              {recValue != null ? `${recValue}%` : '—'}
            </Text>
            <Text style={styles.recoveryLabel}>{t('settings.whoop.recovery')}</Text>
          </View>
        </View>

        {/* Right-side stack — Strain + Sleep */}
        <View style={styles.statStack}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>{t('settings.whoop.strain')}</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: WHOOP_TEAL }]}>{strainValue}</Text>
              <Text style={styles.statDenom}>/ {STRAIN_MAX}</Text>
            </View>
            <Text style={styles.statSubtle}>{(() => { const k = strainBucketKey(strain); return k ? t(`settings.whoop.${k}`) : '—'; })()}</Text>
            <View style={styles.barTrack}>
              <Animated.View
                style={[styles.barFill, { backgroundColor: WHOOP_TEAL }, animatedStrainBarStyle]}
              />
            </View>
          </View>

          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>{t('settings.whoop.sleep')}</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: TEXT_PRIMARY }]}>{sleepValue}</Text>
              <Text style={styles.statDenom}>{t('settings.whoop.sleep_h')}</Text>
            </View>
            <Text style={styles.statSubtle}>
              {sleepPerf != null ? t('settings.whoop.sleep_performance', { pct: sleepPerf }) : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Footer — feeding score line */}
      <View style={styles.footer}>
        <View style={[styles.footerDot, { backgroundColor: CONNECTED_GREEN }]} />
        <Text style={styles.footerText}>
          {syncing ? t('settings.whoop.footer_syncing') : t('settings.whoop.footer_live')}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${CONNECTED_GREEN}33`,
    gap: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: 4,
    color: CONNECTED_GREEN,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WHOOP_GREEN,
  },
  connectedText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.6,
    color: TEXT_MUTED,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    letterSpacing: -1,
    lineHeight: 36,
  },
  recoveryLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  statStack: {
    flex: 1,
    gap: 14,
  },
  statBlock: {
    gap: 3,
  },
  statLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    color: TEXT_MUTED,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  statDenom: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: TEXT_MUTED,
  },
  statSubtle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.4,
    color: TEXT_MUTED,
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
    marginTop: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#161616',
    paddingTop: 10,
  },
  footerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  footerText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.6,
    color: TEXT_MUTED,
  },
});
