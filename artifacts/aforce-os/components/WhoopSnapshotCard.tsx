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
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';

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

  // A11y fix (Squad-F HIGH #1): the connection-dot pulse was an ungated
  // `withRepeat(..., -1)` loop with no reduced-motion check and no teardown —
  // it ran forever, including for users who have motion reduction on, and
  // kept animating on Reanimated's UI thread even after this card unmounted.
  // The ring/strain reveal tweens were finite but had the same gap. Pattern
  // mirrors components/ui/AFReadinessArc.tsx:77-116 — gate on the shared
  // hooks/useReducedMotion, and cancelAnimation in both the static branch and
  // the unmount cleanup.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const target = recoveryPct != null ? Math.max(0, Math.min(100, recoveryPct)) / 100 : 0;

    if (reducedMotion) {
      // Static alternative: jump straight to the resolved values — no reveal
      // tween, no looping pulse (the connection dot holds fully opaque).
      cancelAnimation(ringProgress);
      cancelAnimation(strainProgress);
      cancelAnimation(pulse);
      ringProgress.value = target;
      strainProgress.value = strainPct;
      pulse.value = 1;
    } else {
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
    }

    // Unmount (and re-run) teardown: always cancel so nothing keeps
    // animating on the UI thread past this render's inputs. This repo has no
    // established pattern for pausing Reanimated loops on screen-blur (sibling
    // loops — StatusPulseOrb, AFReadinessArc's `alive` halo — don't do it
    // either); unmount cleanup + the reduced-motion gate is what's implemented
    // here, consistent with those.
    return () => {
      cancelAnimation(ringProgress);
      cancelAnimation(strainProgress);
      cancelAnimation(pulse);
    };
  }, [recoveryPct, strainPct, reducedMotion, ringProgress, strainProgress, pulse]);

  const animatedRingProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const animatedStrainBarStyle = useAnimatedStyle(() => ({
    width: `${strainProgress.value * 100}%`,
  }));

  // A11y fix (Squad-F HIGH #2): this card had zero accessibility props —
  // every metric was a bare pair of sibling <Text> nodes, so a screen reader
  // read the recovery ring, strain block, and sleep block as loose fragments
  // (a raw "—" on a null metric, with no indication of what was missing).
  // Each block below is grouped into ONE accessible element with a composed,
  // honest label — including the null-metric case, which must say something
  // meaningful rather than announce a bare dash.
  const connectionStateLabel = syncing ? t('settings.whoop.syncing') : t('settings.whoop.connected');
  const recoveryA11yLabel =
    recValue != null
      ? t('settings.whoop.recovery_a11y', { value: recValue })
      : t('settings.whoop.recovery_a11y_unknown');
  const strainBucket = strainBucketKey(strain);
  const strainA11yLabel =
    strain != null
      ? t('settings.whoop.strain_a11y', {
          value: strainValue,
          max: STRAIN_MAX,
          bucket: strainBucket ? t(`settings.whoop.${strainBucket}`) : '',
        })
      : t('settings.whoop.strain_a11y_unknown');
  const sleepA11yLabel =
    sleepHoursLastNight != null && sleepPerf != null
      ? t('settings.whoop.sleep_a11y', { hours: sleepValue, pct: sleepPerf })
      : sleepHoursLastNight != null
        ? t('settings.whoop.sleep_a11y_hours_only', { hours: sleepValue })
        : sleepPerf != null
          ? t('settings.whoop.sleep_a11y_pct_only', { pct: sleepPerf })
          : t('settings.whoop.sleep_a11y_unknown');
  const footerLabel = syncing ? t('settings.whoop.footer_syncing') : t('settings.whoop.footer_live');

  return (
    <LinearGradient
      colors={[PANEL_BG_TOP, PANEL_BG_BOTTOM]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Header — WHOOP wordmark + live indicator */}
      <View style={styles.header}>
        <Text style={styles.wordmark} accessibilityRole="header">WHOOP</Text>
        <View
          style={styles.connectedRow}
          accessible
          accessibilityLabel={connectionStateLabel}
          accessibilityLiveRegion="polite"
          testID="whoop-connection-state"
        >
          <Animated.View
            style={[styles.pulseDot, animatedDotStyle]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <Text style={styles.connectedText}>{connectionStateLabel}</Text>
        </View>
      </View>

      {/* Hero — Recovery ring */}
      <View style={styles.heroRow}>
        <View style={styles.ringWrap}>
          <Svg
            width={RING_SIZE}
            height={RING_SIZE}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
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
          <View
            style={styles.ringCenter}
            pointerEvents="none"
            accessible
            accessibilityLabel={recoveryA11yLabel}
            testID="whoop-recovery"
          >
            {/*
             * Dynamic Type fix (Squad-F HIGH #5b): these numerics sit inside a
             * fixed 132px ring (RING_SIZE); uncapped Dynamic Type would blow
             * past the ring's geometry. AF_MAX_DISPLAY_FONT_SCALE
             * (theme/afTokens.ts) is the documented clamp for exactly this —
             * oversized DISPLAY numerals in a fixed hero shape — never
             * applied to body copy. The ring itself is NOT resized.
             */}
            <Text
              style={[styles.recoveryValue, { color: recColor }]}
              maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}
            >
              {recValue != null ? `${recValue}%` : '—'}
            </Text>
            <Text style={styles.recoveryLabel} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
              {t('settings.whoop.recovery')}
            </Text>
          </View>
        </View>

        {/* Right-side stack — Strain + Sleep */}
        <View style={styles.statStack}>
          <View style={styles.statBlock} accessible accessibilityLabel={strainA11yLabel} testID="whoop-strain">
            <Text style={styles.statLabel}>{t('settings.whoop.strain')}</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: WHOOP_TEAL }]}>{strainValue}</Text>
              <Text style={styles.statDenom}>/ {STRAIN_MAX}</Text>
            </View>
            <Text style={styles.statSubtle}>{strainBucket ? t(`settings.whoop.${strainBucket}`) : '—'}</Text>
            <View
              style={styles.barTrack}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Animated.View
                style={[styles.barFill, { backgroundColor: WHOOP_TEAL }, animatedStrainBarStyle]}
              />
            </View>
          </View>

          <View style={styles.statBlock} accessible accessibilityLabel={sleepA11yLabel} testID="whoop-sleep">
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
      <View style={styles.footer} accessible accessibilityLabel={footerLabel} testID="whoop-footer">
        <View
          style={[styles.footerDot, { backgroundColor: CONNECTED_GREEN }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <Text style={styles.footerText}>{footerLabel}</Text>
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
