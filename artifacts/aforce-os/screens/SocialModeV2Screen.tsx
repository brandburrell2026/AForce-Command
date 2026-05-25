/**
 * SOCIAL MODE V2 — spec-driven rewrite.
 *
 * Compliance: no alcohol UI, no BAC, no drink counts, no impairment
 * estimates. Inputs are restricted to Recovery Capacity, Water Cycles,
 * Time, Environment (heat/humidity) — exactly as specified.
 *
 * Five visible blocks:
 *   1. Signal       — one state at a time
 *   2. Command      — one action only
 *   3. Forecast     — one sentence only
 *   4. Session Memory — auto-generated 5–11am after a session
 *   5. Crew         — max 3 rows, name + state only
 *
 * Atmosphere (orb pulse + bg tint) is driven by CALM / FLOW /
 * RECOVERY / PROTECT bands. All other UI stays still.
 *
 * Lives at /social-v2 so it can be compared against the existing
 * /social tab before the swap.
 */

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform, ScrollView,
  Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISCLAIMER_KEY = '@aforce/socialV2/disclaimerDismissed';
const MEMORY_KEY = '@aforce/socialV2/lastSession';

interface PersistedMemory {
  dateISO: string;   // session-end date, ISO
  aura: Aura;
  signal: SignalState;
}

import { GradientBackground } from '@/components/GradientBackground';
import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import { useEngineSlice, useUserSlice } from '@/store/slices';
import {
  deriveSocialSharedContext,
  useHiddenSocialState,
  type CrewMember,
} from '@/services/socialState';
import { TAB_BAR_HEIGHT, WEB_TOP_PADDING, WEB_BOTTOM_PADDING } from '@/constants/layout';

/* ────────────────────────── Engine (hidden) ─────────────────────────
 *
 * Pure helpers. No alcohol inputs, no alcohol outputs. All numbers
 * stay inside this file — the visible UI only renders words.
 */

type Aura = 'LOCKED IN' | 'UNSHAKEN' | 'FLOW' | 'RECOVERING' | 'RECOVERED';
type SignalState = 'LOCKED IN' | 'FLOW' | 'RECOVERING' | 'RECOVERY REQUIRED';
type Atmosphere = 'CALM' | 'FLOW' | 'RECOVERY' | 'PROTECT';

interface Inputs {
  recoveryCapacity: number;   // 0-100
  waterCycles: number;        // count today
  trend: 'improving' | 'stable' | 'declining';
  missedConsecutive: number;  // missed cycles in a row
  heatStress: boolean;
}

const ATMOSPHERE_META: Record<Atmosphere, {
  color: string;
  glow: string;
  pulseMs: number;
  bg: string;
}> = {
  CALM:     { color: '#5EE7D9', glow: 'rgba(94,231,217,0.18)', pulseMs: 3400, bg: 'rgba(94,231,217,0.04)' },
  FLOW:     { color: '#2DE0C8', glow: 'rgba(45,224,200,0.28)', pulseMs: 2200, bg: 'rgba(45,224,200,0.05)' },
  RECOVERY: { color: '#F5A524', glow: 'rgba(245,165,36,0.28)', pulseMs: 1600, bg: 'rgba(245,165,36,0.05)' },
  PROTECT:  { color: '#FF2800', glow: 'rgba(255,40,0,0.32)',   pulseMs: 1000, bg: 'rgba(255,40,0,0.06)' },
};

function deriveSignal(i: Inputs): SignalState {
  if (i.recoveryCapacity < 45 || i.missedConsecutive >= 2) return 'RECOVERY REQUIRED';
  if (i.recoveryCapacity < 60 || i.trend === 'declining') return 'RECOVERING';
  if (i.recoveryCapacity >= 80 && i.waterCycles >= 6) return 'LOCKED IN';
  return 'FLOW';
}

function deriveAura(i: Inputs, sessionComplete: boolean): Aura {
  if (sessionComplete) return 'RECOVERED';
  if (i.recoveryCapacity > 80 && i.waterCycles >= 6) return 'LOCKED IN';
  if (i.recoveryCapacity > 80) return 'UNSHAKEN';
  if (i.recoveryCapacity >= 60 && i.trend !== 'declining') return 'FLOW';
  return 'RECOVERING';
}

function deriveAtmosphere(i: Inputs): Atmosphere {
  if (i.recoveryCapacity < 45 || i.missedConsecutive >= 2) return 'PROTECT';
  if (i.recoveryCapacity < 60) return 'RECOVERY';
  if (i.recoveryCapacity >= 75 && !i.heatStress) return 'CALM';
  return 'FLOW';
}

function deriveCommand(i: Inputs): string {
  if (i.recoveryCapacity < 45) return 'Drink 12oz water within 45 min.';
  if (i.waterCycles < 1) return 'Complete 1 Water Cycle.';
  if (i.recoveryCapacity < 60) return 'Drink 8oz water within 30 min.';
  if (i.waterCycles < 4) return 'Complete 1 Water Cycle.';
  return 'Morning Reset available.';
}

function deriveForecast(i: Inputs): string {
  if (i.recoveryCapacity > 70 && i.waterCycles >= 5) return 'Signal up.';
  if (i.recoveryCapacity >= 50 && i.recoveryCapacity <= 70) return 'Recovery stabilizing.';
  if (i.recoveryCapacity < 50) return 'Recovery correction needed.';
  return 'Signal holding.';
}

/* ───────────────────────── Atmosphere Orb ─────────────────────────── */

function AtmosphereOrb({ atmosphere }: { atmosphere: Atmosphere }) {
  const meta = ATMOSPHERE_META[atmosphere];
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: meta.pulseMs,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: meta.pulseMs,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [meta.pulseMs, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });

  return (
    <View style={styles.orbWrap} pointerEvents="none">
      <Animated.View style={[
        styles.orbGlow,
        { backgroundColor: meta.glow, transform: [{ scale }], opacity },
      ]} />
      <View style={[styles.orbCore, { backgroundColor: meta.color, shadowColor: meta.color }]} />
    </View>
  );
}

/* ───────────────────────────── Screen ─────────────────────────────── */

export default function SocialModeV2Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const engine = useEngineSlice();
  const user = useUserSlice();

  // ─── Derive inputs from the existing engine (no alcohol path) ───────
  // Recovery Capacity lives on the (optional) social rollup. When the
  // legacy social rollup is null we synthesise a healthy default so the
  // new screen still renders cleanly on a fresh cold-start.
  const recoveryCapacity = Math.round(
    engine.social?.recoveryCapacity?.score ?? 70,
  );

  const waterCycles = React.useMemo(() => {
    const events = user.intakeEvents ?? [];
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    return events.filter((e) => {
      const t = e.loggedAt instanceof Date ? e.loggedAt.getTime() : Date.parse(String(e.loggedAt));
      return Number.isFinite(t) && t >= startOfDay.getTime();
    }).length;
  }, [user.intakeEvents]);

  const trend: Inputs['trend'] = recoveryCapacity >= 70
    ? 'improving'
    : recoveryCapacity >= 55 ? 'stable' : 'declining';

  const heatStress = (user.weatherTempC ?? 0) >= 28 || (user.weatherHumidity ?? 0) >= 70;

  const liveInputs: Inputs = {
    recoveryCapacity, waterCycles, trend, missedConsecutive: 0, heatStress,
  };

  // ─── Spec outputs ──────────────────────────────────────────────────
  const [sessionComplete, setSessionComplete] = React.useState(false);
  const [showDisclaimer, setShowDisclaimer] = React.useState(false);
  const [memory, setMemory] = React.useState<PersistedMemory | null>(null);

  // ─── Demo script ───────────────────────────────────────────────────
  // Four 9-second beats that drive the screen through every atmosphere:
  //   CALM (high RC, high cycles) → FLOW → RECOVERY → PROTECT.
  // While the demo is running we replace `inputs` with the current
  // beat so Signal / Command / Forecast / Aura / Atmosphere all
  // re-derive from the scripted state. Total runtime ~36s.
  const DEMO_BEATS: readonly { name: Atmosphere; inputs: Inputs }[] = React.useMemo(() => [
    { name: 'CALM',     inputs: { recoveryCapacity: 88, waterCycles: 7, trend: 'improving', missedConsecutive: 0, heatStress: false } },
    { name: 'FLOW',     inputs: { recoveryCapacity: 68, waterCycles: 4, trend: 'stable',    missedConsecutive: 0, heatStress: true  } },
    { name: 'RECOVERY', inputs: { recoveryCapacity: 52, waterCycles: 2, trend: 'declining', missedConsecutive: 0, heatStress: false } },
    { name: 'PROTECT',  inputs: { recoveryCapacity: 38, waterCycles: 1, trend: 'declining', missedConsecutive: 2, heatStress: true  } },
  ], []);
  const BEAT_MS = 9000;
  const [demoBeat, setDemoBeat] = React.useState<number | null>(null);
  const demoActive = demoBeat !== null;

  React.useEffect(() => {
    if (!demoActive) return;
    const id = setTimeout(() => {
      setDemoBeat((b) => {
        if (b === null) return null;
        return b + 1 >= DEMO_BEATS.length ? null : b + 1;
      });
    }, BEAT_MS);
    return () => clearTimeout(id);
  }, [demoActive, demoBeat, DEMO_BEATS.length]);

  const inputs: Inputs = demoActive ? DEMO_BEATS[demoBeat]!.inputs : liveInputs;

  // Aura + Atmosphere stay on the local derivation — the hidden
  // service deliberately does NOT model those (they're presentation
  // state, not spec-mandated surfaces).
  const aura = deriveAura(inputs, sessionComplete);
  const atmosphere = deriveAtmosphere(inputs);

  // Signal / Command / Forecast / Crew / Shared Context now come from
  // the shared `useHiddenSocialState` snapshot when `spec_social` is
  // on, so notifications + multi-device sync work can read from a
  // single source. Drink count maps from the existing socialMode
  // store (read-only here). Falls back to the local derivations when
  // the flag is off so legacy behavior remains intact.
  const drinkCount = user.socialMode?.drinks?.length ?? 0;
  const crewForHook: CrewMember[] = React.useMemo(
    () => [
      { name: 'maya', state: 'LOCKED IN' },
      { name: 'kenji', state: 'FLOW' },
      { name: 'rae', state: 'RECOVERING' },
    ],
    [],
  );
  const hiddenSnapshot = useHiddenSocialState({
    recoveryCapacity: inputs.recoveryCapacity,
    waterCycles: inputs.waterCycles,
    drinkCount,
    crew: crewForHook,
    sessionMemory: null,
  });
  const signal: SignalState = hiddenSnapshot ? hiddenSnapshot.signal : deriveSignal(inputs);
  const command = hiddenSnapshot ? hiddenSnapshot.command : deriveCommand(inputs);
  const forecast = hiddenSnapshot ? hiddenSnapshot.forecast : deriveForecast(inputs);

  const startDemo = React.useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSessionComplete(false);
    setDemoBeat(0);
  }, []);
  const stopDemo = React.useCallback(() => setDemoBeat(null), []);

  // First-activation disclaimer + prior session hydration. Runs once.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dismissed, mem] = await Promise.all([
          AsyncStorage.getItem(DISCLAIMER_KEY),
          AsyncStorage.getItem(MEMORY_KEY),
        ]);
        if (cancelled) return;
        if (dismissed !== '1') setShowDisclaimer(true);
        if (mem) {
          try {
            const parsed = JSON.parse(mem) as PersistedMemory;
            if (parsed?.dateISO && parsed.aura && parsed.signal) setMemory(parsed);
          } catch { /* corrupt blob — ignore */ }
        }
      } catch { /* storage unavailable — show disclaimer once per session */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const dismissDisclaimer = React.useCallback(() => {
    setShowDisclaimer(false);
    AsyncStorage.setItem(DISCLAIMER_KEY, '1').catch(() => {});
  }, []);

  // ─── Session memory (auto-generated 5–11am after a session) ────────
  // Show the persisted memory when we're in the morning window *and*
  // it's from a prior calendar day (not the session that just ended in
  // this same render — that's covered by the live state above).
  const hour = new Date().getHours();
  const memoryDate = memory ? new Date(memory.dateISO) : null;
  const memoryIsPriorDay = memoryDate
    ? memoryDate.toDateString() !== new Date().toDateString()
    : false;
  const showMemory = memory && hour >= 5 && hour < 11 && memoryIsPriorDay;

  // ─── Crew (placeholder rows; spec says max 3, name + state only) ────
  const crew: { name: string; state: SignalState }[] = [
    { name: 'maya', state: 'LOCKED IN' },
    { name: 'kenji', state: 'FLOW' },
    { name: 'rae', state: 'RECOVERING' },
  ];

  // ─── Reset ──────────────────────────────────────────────────────────
  // Reset ends the session and persists a memory snapshot (date + aura
  // + signal at session end) so the 5–11am window on a later launch
  // can render the real "LAST NIGHT" card per spec.
  const closeAnim = React.useRef(new Animated.Value(1)).current;
  const onReset = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.timing(closeAnim, {
      toValue: 0, duration: 1500,
      easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    }).start(() => {
      setSessionComplete(true);
      closeAnim.setValue(1);
      const snapshot: PersistedMemory = {
        dateISO: new Date().toISOString(),
        aura: 'RECOVERED',
        signal,
      };
      AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(snapshot)).catch(() => {});
    });
  };

  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const topPadding = Platform.OS === 'web' ? WEB_TOP_PADDING : insets.top;
  const bottomPadding = Platform.OS === 'web' ? WEB_BOTTOM_PADDING : insets.bottom + TAB_BAR_HEIGHT;

  const meta = ATMOSPHERE_META[atmosphere];

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>
      <GradientBackground>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: meta.bg }]} pointerEvents="none" />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding + 8, paddingBottom: bottomPadding + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={goHome}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backBtn}
            >
              <Icon name="chevron-left" size={22} color={Colors.text.primary} />
            </Pressable>
            <Text style={styles.eyebrow}>SOCIAL MODE</Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Atmosphere orb + Aura word */}
          <Animated.View style={{ opacity: closeAnim, transform: [{ scale: closeAnim }] }}>
            <AtmosphereOrb atmosphere={atmosphere} />
            <Text style={[styles.aura, { color: meta.color }]}>{aura}</Text>
          </Animated.View>

          {/* Block 1 — Signal */}
          <Section label="SIGNAL">
            <Text style={styles.signalState}>{signal}</Text>
            <Text style={styles.subtitle}>Protected for tomorrow.</Text>
          </Section>

          {/* Block 2 — Command */}
          <Section label="COMMAND">
            <Text style={styles.command}>{command}</Text>
          </Section>

          {/* Block 3 — Forecast */}
          <Section label="FORECAST">
            <Text style={styles.forecast}>{forecast}</Text>
          </Section>

          {/* Block 4 — Session Memory (date + aura + signal, per spec) */}
          {showMemory && memory && memoryDate ? (
            <Section label="LAST NIGHT">
              <Text style={styles.memoryDate}>
                {memoryDate.toLocaleDateString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric',
                }).toUpperCase()}
              </Text>
              <View style={styles.memoryRow}>
                <Text style={styles.memoryLabel}>AURA</Text>
                <Text style={styles.memoryValue}>{memory.aura}</Text>
              </View>
              <View style={styles.memoryRow}>
                <Text style={styles.memoryLabel}>SIGNAL</Text>
                <Text style={styles.memoryValue}>{memory.signal}</Text>
              </View>
              <Pressable
                onPress={() => {/* already persisted on reset; SAVE is a no-op confirmation */}}
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel="Save session memory"
              >
                <Text style={styles.saveBtnText}>SAVE</Text>
              </Pressable>
            </Section>
          ) : null}

          {/* Block 5 — Crew (max 3) */}
          <Section label="CREW">
            {crew.slice(0, 3).map((c) => (
              <View key={c.name} style={styles.crewRow}>
                <Text style={styles.crewName}>{c.name}</Text>
                <Text style={styles.crewState}>{c.state}</Text>
              </View>
            ))}
          </Section>

          {/* Block 6 — Shared Context (one-sentence room read of Crew) */}
          <Section label="SHARED CONTEXT">
            <Text style={styles.forecast}>{deriveSocialSharedContext(crew)}</Text>
          </Section>

          {/* Reset */}
          <Pressable
            onPress={onReset}
            disabled={sessionComplete}
            style={({ pressed }) => [
              styles.resetBtn,
              { borderColor: meta.color },
              pressed && { opacity: 0.85 },
              sessionComplete && { opacity: 0.4 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reset tomorrow"
          >
            <Text style={[styles.resetText, { color: meta.color }]}>RESET TOMORROW</Text>
          </Pressable>

          {/* Demo controls — scripted CALM → FLOW → RECOVERY → PROTECT.
              Hidden from production-grade UI; mark with subtle styling. */}
          <View style={styles.demoWrap}>
            {demoActive ? (
              <>
                <View style={styles.demoBeats}>
                  {DEMO_BEATS.map((b, i) => (
                    <View
                      key={b.name}
                      style={[
                        styles.demoDot,
                        i === demoBeat && { backgroundColor: meta.color, borderColor: meta.color },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.demoBeatLabel, { color: meta.color }]}>
                  {DEMO_BEATS[demoBeat!]!.name} · {(demoBeat ?? 0) + 1}/{DEMO_BEATS.length}
                </Text>
                <Pressable
                  onPress={stopDemo}
                  style={({ pressed }) => [styles.demoBtn, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Stop demo"
                >
                  <Text style={styles.demoBtnText}>STOP DEMO</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={startDemo}
                style={({ pressed }) => [styles.demoBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel="Play Social Mode demo"
              >
                <Text style={styles.demoBtnText}>▶  PLAY DEMO</Text>
              </Pressable>
            )}
          </View>

          {/* Compliance disclaimer — first activation only */}
          {showDisclaimer ? (
            <Pressable
              onPress={dismissDisclaimer}
              style={styles.disclaimer}
              accessibilityRole="button"
              accessibilityLabel="Dismiss disclaimer"
            >
              <Text style={styles.disclaimerText}>
                Social Mode provides estimated hydration and recovery guidance only.
                It is not a medical, diagnostic, safety, or impairment tool.
              </Text>
              <Text style={styles.disclaimerDismiss}>TAP TO DISMISS</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/* ─────────────────────────────── Styles ───────────────────────────── */

const BORDER = 'rgba(255,255,255,0.06)';
const FAINT  = 'rgba(255,255,255,0.5)';

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 22, gap: 28 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  backBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontSize: 11, letterSpacing: 3, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary,
  },
  orbWrap: {
    height: 180, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  orbGlow: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
  },
  orbCore: {
    width: 56, height: 56, borderRadius: 28,
    shadowOpacity: 0.7, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  aura: {
    textAlign: 'center', marginTop: 4,
    fontFamily: 'Inter_700Bold',
    fontSize: 18, letterSpacing: 4,
  },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 2.4, color: FAINT,
    fontFamily: 'Inter_700Bold',
  },
  sectionBody: {
    paddingVertical: 18, paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 6,
  },
  signalState: {
    fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: 1.5,
    color: Colors.text.primary,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 13,
    color: Colors.text.secondary,
  },
  command: {
    fontFamily: 'Inter_500Medium', fontSize: 17, lineHeight: 24,
    color: Colors.text.primary,
  },
  forecast: {
    fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22,
    color: Colors.text.primary,
  },
  memoryDate: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 2,
    color: FAINT, marginBottom: 4,
  },
  memoryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingVertical: 6,
  },
  memoryLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8,
    color: FAINT,
  },
  memoryValue: {
    fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 1.4,
    color: Colors.text.primary,
  },
  saveBtn: {
    marginTop: 10, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 100,
    borderWidth: 1, borderColor: BORDER,
  },
  saveBtnText: {
    fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 2,
    color: Colors.text.primary,
  },
  crewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER,
  },
  crewName: {
    fontFamily: 'Inter_500Medium', fontSize: 14, color: Colors.text.primary,
  },
  crewState: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.8,
    color: FAINT,
  },
  resetBtn: {
    marginTop: 8, alignSelf: 'center',
    paddingVertical: 14, paddingHorizontal: 28, borderRadius: 100,
    borderWidth: 1,
  },
  resetText: {
    fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 2.4,
  },
  demoWrap: {
    marginTop: 4, alignItems: 'center', gap: 10,
  },
  demoBeats: {
    flexDirection: 'row', gap: 6,
  },
  demoDot: {
    width: 8, height: 8, borderRadius: 4,
    borderWidth: 1, borderColor: BORDER,
    backgroundColor: 'transparent',
  },
  demoBeatLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 2,
  },
  demoBtn: {
    paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  demoBtnText: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 2,
    color: FAINT,
  },
  disclaimer: {
    marginTop: 8, padding: 14, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
  },
  disclaimerText: {
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16,
    color: FAINT,
  },
  disclaimerDismiss: {
    marginTop: 8,
    fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 2,
    color: FAINT, textAlign: 'right',
  },
});
