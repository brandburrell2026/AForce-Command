/**
 * Home — AForce OS performance command surface (cinematic edition).
 *
 * Premium dark dashboard inspired by elite fitness/recovery platforms.
 * The Readiness ring is wired to the live hydration score from the
 * scoring engine; remaining metrics (Strain / Recovery / Sleep / HRV /
 * resting HR / active burn / SpO₂ / recovery time) are presentational
 * placeholders until those signal sources land.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';

import { useAppStore } from '@/store/useAppStore';
import { TAB_BAR_HEIGHT } from '@/constants/layout';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Tokens ───────────────────────────────────────────────────────
const C = {
  bg:       '#080808',
  red:      '#E01818',
  green:    '#4ade80',
  amber:    '#f59e0b',
  white:    '#ffffff',
  text65:   'rgba(255,255,255,0.65)',
  text45:   'rgba(255,255,255,0.45)',
  text35:   'rgba(255,255,255,0.35)',
  text25:   'rgba(255,255,255,0.25)',
  cardBg:   'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  redTint:  'rgba(224,24,24,0.12)',
  redBorder:'rgba(224,24,24,0.35)',
};
// Match the rest of the app — Inter only.
const F = {
  display: 'Inter_700Bold',
  body:    'Inter_400Regular',
  bodyM:   'Inter_500Medium',
  bodyB:   'Inter_700Bold',
};

const COL = 380;          // max content width
const PAD = 22;           // outer horizontal padding

// ─── Mock metric stream — until real signals are wired ────────────
const STATS = [
  { label: 'Strain',   value: '14.2', tone: C.amber },
  { label: 'Recovery', value: '74%',  tone: C.green },
  { label: 'Sleep',    value: '7h 12m', tone: C.green },
  { label: 'HRV',      value: '62 ms', tone: C.green },
];
const METRICS: { icon: string; value: string; label: string }[] = [
  { icon: '❤︎',  value: '54',   label: 'Resting HR' },
  { icon: '🔥', value: '412',  label: 'Active Burn' },
  { icon: '◉',  value: '98%',  label: 'SpO₂' },
  { icon: '⏱', value: '6h',   label: 'Recovery Time' },
];
// 7-day HRV trend, normalized 0..1 for the sparkline
const HRV_SERIES = [0.42, 0.55, 0.48, 0.62, 0.58, 0.71, 0.78];
const HRV_CURRENT = '62 ms';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colWidth = Math.min(width, COL);

  // Live readiness — derive from live hydration score (0..100).
  const { state } = useAppStore();
  const liveScore = state?.engineOutput?.score ?? 83;
  const readiness = Math.max(0, Math.min(100, Math.round(liveScore)));

  // ─── Animation drivers ──────────────────────────────────────────
  const ringProgress = useSharedValue(0);
  const livePulse    = useSharedValue(1);
  const glow         = useSharedValue(0.18);

  React.useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    // Ring draws over 1.5s after the hero appears
    ringProgress.value = withDelay(
      450,
      withTiming(readiness / 100, { duration: 1500, easing: Easing.out(Easing.cubic) }),
    );
    // LIVE dot pulse
    livePulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1,    { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, false,
    );
    // Hero glow pulse
    glow.value = withRepeat(
      withSequence(
        withTiming(0.32, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.16, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, false,
    );
    return () => {
      cancelAnimation(ringProgress);
      cancelAnimation(livePulse);
      cancelAnimation(glow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness]);

  // Re-target ring when score changes after first paint
  React.useEffect(() => {
    ringProgress.value = withTiming(readiness / 100, { duration: 900, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness]);

  const handleBegin = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    router.push('/protocol');
  };
  const handleReport = () => router.push('/check');

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 12,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.col, { width: colWidth }]}>
          {/* 1 — LIVE pill */}
          <LivePill pulse={livePulse} />

          {/* 2 — Hero wordmark */}
          <Hero glow={glow} />

          {/* 3 — Readiness ring + side stats */}
          <ReadinessBlock score={readiness} ringProgress={ringProgress} />

          {/* 4 — HRV sparkline */}
          <SparklineCard
            width={colWidth - PAD * 2}
            series={HRV_SERIES}
            current={HRV_CURRENT}
          />

          {/* 5 — 2x2 metrics */}
          <View style={styles.metricsGrid}>
            {METRICS.map((m) => (
              <MetricCard key={m.label} {...m} />
            ))}
          </View>

          {/* 6 — Tagline + chips */}
          <View style={styles.taglineWrap}>
            <Text style={styles.taglineLight}>
              Performance is{' '}
              <Text style={styles.taglineBold}>non-negotiable.</Text>
            </Text>
            <View style={styles.chipsRow}>
              {['Closed-loop', 'Real-time', 'Deterministic'].map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 7 — Primary CTA */}
          <Pressable
            onPress={handleBegin}
            accessibilityRole="button"
            accessibilityLabel="Begin protocol"
            style={({ pressed }) => [
              styles.ctaPrimary,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaPrimaryText}>BEGIN PROTOCOL</Text>
            <View style={styles.ctaArrowBadge}>
              <Feather name="arrow-right" size={14} color={C.white} />
            </View>
          </Pressable>

          {/* 8 — Secondary ghost CTA */}
          <Pressable
            onPress={handleReport}
            accessibilityRole="button"
            accessibilityLabel="View full report"
            style={({ pressed }) => [
              styles.ctaGhost,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.ctaGhostText}>View Full Report</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── LivePill — pulsing red dot + label ───────────────────────────
function LivePill({ pulse }: { pulse: ReturnType<typeof useSharedValue<number>> }) {
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.livePill}>
      <Animated.View style={[styles.liveDot, dotStyle]} />
      <Text style={styles.liveLabel}>LIVE MONITORING</Text>
    </View>
  );
}

// ─── Hero — AFORCE / OS wordmark + subtitle, with glow ────────────
function Hero({ glow }: { glow: ReturnType<typeof useSharedValue<number>> }) {
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <View style={styles.heroWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.heroGlow, glowStyle]}
      />
      <Text style={styles.heroLine}>
        <Text style={styles.heroWhite}>AFORCE</Text>
        <Text style={styles.heroRed}> OS</Text>
      </Text>
      <Text style={styles.heroSub}>THE PERFORMANCE OPERATING SYSTEM</Text>
    </View>
  );
}

// ─── ReadinessBlock — animated SVG ring + side stats ──────────────
function ReadinessBlock({
  score,
  ringProgress,
}: {
  score: number;
  ringProgress: ReturnType<typeof useSharedValue<number>>;
}) {
  const SIZE = 132;
  const STROKE = 8;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - ringProgress.value),
  }));

  return (
    <View style={styles.readinessRow}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.red} stopOpacity="1" />
              <Stop offset="1" stopColor="#ff5a3c" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={STROKE}
            fill="none"
          />
          {/* Progress — rotated -90° so it draws from 12 o'clock */}
          <G rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`}>
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke="url(#ringGrad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRC}
              animatedProps={animatedCircleProps}
            />
          </G>
        </Svg>
        <View style={styles.ringCenter} pointerEvents="none">
          <Text style={styles.ringScore}>{score}</Text>
          <Text style={styles.ringLabel}>READY</Text>
        </View>
      </View>

      <View style={styles.statsCol}>
        {STATS.map((s) => (
          <View key={s.label} style={styles.statRow}>
            <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
            <Text style={[styles.statValue, { color: s.tone }]}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── SparklineCard — area chart + endpoint dot ────────────────────
function SparklineCard({
  width: w,
  series,
  current,
}: { width: number; series: number[]; current: string }) {
  const H = 78;
  const PADX = 14;
  const PADY = 12;
  const innerW = w - PADX * 2;
  const innerH = H;
  const stepX = innerW / (series.length - 1);
  const points = series.map((v, i) => ({
    x: PADX + i * stepX,
    y: PADY + (1 - v) * innerH,
  }));
  const linePath =
    `M ${points[0].x} ${points[0].y} ` +
    points
      .slice(1)
      .map((p, i) => {
        const prev = points[i];
        const mx = (prev.x + p.x) / 2;
        return `Q ${mx} ${prev.y} ${mx} ${(prev.y + p.y) / 2} T ${p.x} ${p.y}`;
      })
      .join(' ');
  const last = points[points.length - 1];
  const baseY = PADY + innerH;
  const fillPath = `${linePath} L ${last.x} ${baseY} L ${PADX} ${baseY} Z`;

  return (
    <View style={[styles.card, { paddingHorizontal: 0, paddingVertical: 0 }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>HEART RATE VARIABILITY</Text>
        <Text style={styles.cardValue}>{current}</Text>
      </View>
      <Svg width={w} height={H + PADY * 2}>
        <Defs>
          <LinearGradient id="hrvFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.green} stopOpacity="0.45" />
            <Stop offset="1" stopColor={C.green} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={fillPath} fill="url(#hrvFill)" />
        <Path
          d={linePath}
          stroke={C.green}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={last.x} cy={last.y} r={5} fill={C.green} opacity={0.25} />
        <Circle cx={last.x} cy={last.y} r={2.5} fill={C.green} />
      </Svg>
    </View>
  );
}

// ─── MetricCard — single 2x2 cell ────────────────────────────────
function MetricCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  const [hovered, setHovered] = React.useState(false);
  const webHover =
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {};
  return (
    <View style={styles.metricCard} {...webHover}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
      <View style={[styles.metricAccent, { opacity: hovered ? 1 : 0 }]} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { alignItems: 'center', paddingHorizontal: PAD },
  col: { gap: 22 },

  // Live pill
  livePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.redTint,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.redBorder,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 7,
    backgroundColor: C.red,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 0 10px ${C.red}` } as object)
      : {
          shadowColor: C.red, shadowOpacity: 0.9, shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        }),
  },
  liveLabel: {
    fontFamily: F.bodyM,
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.red,
  },

  // Hero
  heroWrap: { marginTop: 8, marginBottom: 4 },
  heroGlow: {
    position: 'absolute',
    width: 280, height: 280, borderRadius: 280,
    backgroundColor: C.red,
    top: -70, left: -40,
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(80px)' } as object)
      : {
          shadowColor: C.red, shadowOpacity: 0.7, shadowRadius: 80,
          shadowOffset: { width: 0, height: 0 },
        }),
  },
  heroLine: {
    fontFamily: F.display,
    fontSize: 92,
    lineHeight: 92,
    letterSpacing: -1,
  },
  heroWhite: { color: C.white, fontFamily: F.display },
  heroRed:   { color: C.red,   fontFamily: F.display },
  heroSub: {
    fontFamily: F.bodyM,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.text35,
    marginTop: 4,
  },

  // Readiness
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 14,
    padding: 18,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringScore: {
    fontFamily: F.display,
    fontSize: 48,
    lineHeight: 48,
    color: C.white,
  },
  ringLabel: {
    fontFamily: F.bodyM,
    fontSize: 9,
    letterSpacing: 2.2,
    color: C.text45,
    marginTop: 2,
  },
  statsCol: { flex: 1, gap: 8 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  statLabel: {
    fontFamily: F.bodyM,
    fontSize: 9,
    letterSpacing: 1.6,
    color: C.text45,
  },
  statValue: {
    fontFamily: F.display,
    fontSize: 18,
    letterSpacing: 0.2,
  },

  // Card / sparkline
  card: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cardTitle: {
    fontFamily: F.bodyM,
    fontSize: 9,
    letterSpacing: 1.8,
    color: C.text45,
  },
  cardValue: {
    fontFamily: F.display,
    fontSize: 20,
    color: C.white,
  },

  // Metrics 2x2
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 14,
    padding: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
  },
  metricIcon: {
    fontSize: 16,
    color: C.text65,
    marginBottom: 6,
  },
  metricValue: {
    fontFamily: F.display,
    fontSize: 36,
    lineHeight: 38,
    color: C.white,
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontFamily: F.bodyM,
    fontSize: 9,
    letterSpacing: 1.8,
    color: C.text45,
    marginTop: 4,
  },
  metricAccent: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 2,
    backgroundColor: C.red,
  },

  // Tagline + chips
  taglineWrap: { gap: 12, marginTop: 4 },
  taglineLight: {
    fontFamily: F.body,
    fontSize: 18,
    lineHeight: 24,
    color: C.text65,
  },
  taglineBold: {
    fontFamily: F.bodyB,
    color: C.white,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.cardBg,
  },
  chipText: {
    fontFamily: F.bodyM,
    fontSize: 10,
    letterSpacing: 1.4,
    color: C.text65,
  },

  // CTAs
  ctaPrimary: {
    height: 56,
    borderRadius: 4,
    backgroundColor: C.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 12px 40px rgba(224,24,24,0.45)` } as object)
      : {
          shadowColor: C.red, shadowOpacity: 0.45, shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
        }),
  },
  ctaPrimaryText: {
    fontFamily: F.bodyB,
    fontSize: 13,
    letterSpacing: 3,
    color: C.white,
  },
  ctaArrowBadge: {
    width: 22, height: 22, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaGhost: {
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGhostText: {
    fontFamily: F.bodyM,
    fontSize: 12,
    letterSpacing: 2,
    color: C.text65,
  },
});
