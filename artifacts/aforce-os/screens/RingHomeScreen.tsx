/**
 * RingHomeScreen — the calm, idle ring-companion surface.
 *
 * Renders a single hydration orb whose color and number are driven by
 * the live ring stream + the sweatRateEngine. Auto-routes to the active
 * Sport Mode session view (/ring/session) when sustained vigorous
 * activity is detected. Includes a small "Start demo session" toggle
 * so the auto-trigger can be exercised without real hardware.
 *
 * Visual translation of the CalmCoach mockup
 * (artifacts/mockup-sandbox/src/components/mockups/aforce-ring/CalmCoach.tsx)
 * to React Native using the AForce OS palette.
 */

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../theme/colors';
import { computeSweatSession } from '../services/sweatRateEngine';
import {
  getRingSnapshot,
  intensityFromMovement,
  minutesSinceOnset,
  startMockSession,
  stopMockSession,
  useRingStream,
} from '../services/ringService';
import type { DeficitBand } from '../types/sweat';

const ORB_DIAMETER = 220;
const VIGOROUS_TICKS_TO_TRIGGER = 3;

const BAND_COLOR: Record<DeficitBand, { primary: string; glow: string; dim: string }> = {
  optimal: Colors.states.PEAK,
  mild: Colors.states.BALANCED,
  impaired: Colors.states.RECOVERING,
  danger: Colors.states.DEPLETED,
};

const BAND_LABEL: Record<DeficitBand, string> = {
  optimal: 'OPTIMAL',
  mild: 'MILD',
  impaired: 'MODERATE',
  danger: 'DANGER',
};

export default function RingHomeScreen() {
  const ring = useRingStream();
  const vigorousStreakRef = useRef(0);
  // If a session is already running when the user lands on home (e.g.
  // they just navigated *back* from /ring/session), suppress the
  // auto-route until activity actually stops. Otherwise tapping
  // "Stop demo session" would race against the auto-router and feel
  // broken.
  const skipAutoRouteRef = useRef(getRingSnapshot().sessionActive);
  const [now, setNow] = useState(() => Date.now());

  // Local clock so the "X min ago" label updates even between ring ticks.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-route to /ring/session when vigorous activity is sustained.
  // NOTE: depend on the whole biometrics object (a fresh ref each ring
  // tick) so this counter advances every tick, not only when movementClass
  // *changes*.
  useEffect(() => {
    // If we mounted mid-session, wait for activity to actually drop
    // before re-arming. This way navigating "back" to home and tapping
    // Stop reliably leaves the user here.
    if (skipAutoRouteRef.current) {
      if (!ring.sessionActive) skipAutoRouteRef.current = false;
      return;
    }
    if (ring.biometrics.movementClass === 'vigorous') {
      vigorousStreakRef.current += 1;
      if (vigorousStreakRef.current >= VIGOROUS_TICKS_TO_TRIGGER) {
        vigorousStreakRef.current = 0;
        router.replace('/ring/session');
      }
    } else {
      vigorousStreakRef.current = 0;
    }
  }, [ring.biometrics, ring.sessionActive]);

  // Live sweat-engine read. Only meaningful once GSR onset has fired and
  // some time has elapsed; otherwise we surface a calm "all good" state.
  const session = useMemo(() => {
    const elapsed = minutesSinceOnset(ring.biometrics, now);
    if (!ring.biometrics.gsrActive || elapsed < 0.5) return null;
    try {
      return computeSweatSession({
        mode: 'estimate',
        bodyWeight: 75,
        weightUnit: 'kg',
        height: 178,
        heightUnit: 'cm',
        sportId: 'soccer',
        durationMinutes: elapsed,
        intensity: intensityFromMovement(ring.biometrics.movementClass),
        ambientTempC: 24,
        ambientHumidityPct: 50,
        acclimatized: true,
        sodiumProfile: 'moderate',
      });
    } catch {
      return null;
    }
  }, [ring.biometrics, now]);

  const band: DeficitBand = session?.deficitBand ?? 'optimal';
  const bandColor = BAND_COLOR[band];
  const deficitText = session ? session.deficitPct.toFixed(1) : '0.0';
  const onsetMin = Math.floor(minutesSinceOnset(ring.biometrics, now));

  // Action card — always shows the next sip, falls back to a calm
  // "you're good" tone when there's no deficit yet.
  const sipOz = session
    ? Math.max(4, Math.round(session.prescription.replacementOz / 4))
    : 8;
  const nextSipMin = session ? Math.max(4, Math.round(session.autopilot.intervalMin / 2)) : 20;
  const actionTitle = session ? `Time for ${sipOz} oz` : 'You\'re good for now';
  const actionBody = session
    ? `About ${nextSipMin} minutes from now to stay ahead of your sweat loss.`
    : `We\'ll let you know when it\'s time to sip. Check-in in ~${nextSipMin} min.`;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — back + ring identity */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Feather name="chevron-left" size={22} color={Colors.text.secondary} />
          </Pressable>

          <View style={styles.identity}>
            <Text style={styles.identityLabel}>AFORCE RING</Text>
            <View style={styles.identityRow}>
              <View
                style={[
                  styles.connDot,
                  { backgroundColor: ring.connected ? Colors.states.BALANCED.primary : Colors.text.muted },
                ]}
              />
              <Text style={styles.identityValue}>
                {ring.connected ? 'Connected' : 'Searching…'}
              </Text>
            </View>
          </View>

          <View style={styles.batteryWrap}>
            <View style={styles.ringGlyphOuter}>
              <View style={styles.ringGlyphInner}>
                <View
                  style={[
                    styles.ringGlyphDot,
                    { backgroundColor: ring.sessionActive ? Colors.states.PEAK.primary : Colors.states.BALANCED.primary },
                  ]}
                />
              </View>
            </View>
            <View style={styles.batteryRow}>
              <Feather name="battery" size={12} color={Colors.text.muted} />
              <Text style={styles.batteryText}>{ring.batteryPct}%</Text>
            </View>
          </View>
        </View>

        {/* Hero orb */}
        <View style={styles.orbWrap}>
          <View
            style={[
              styles.orbGlow,
              { backgroundColor: bandColor.glow, opacity: 0.18 },
            ]}
          />
          <View
            style={[
              styles.orbOuterRing,
              { borderColor: bandColor.primary + '33' },
            ]}
          />
          <View
            style={[
              styles.orbCore,
              {
                backgroundColor: bandColor.dim,
                borderColor: bandColor.primary + '40',
              },
            ]}
          >
            <Text style={styles.orbLabel}>Deficit</Text>
            <View style={styles.orbValueRow}>
              <Text style={[styles.orbValue, { color: bandColor.primary }]}>
                {deficitText}
              </Text>
              <Text style={[styles.orbPct, { color: bandColor.primary + 'B3' }]}>%</Text>
            </View>
            <Text style={styles.orbBand}>{BAND_LABEL[band]}</Text>
          </View>
        </View>

        {/* Onset pill */}
        {ring.biometrics.gsrActive && (
          <View style={styles.pill}>
            <Feather name="activity" size={14} color={Colors.states.BALANCED.primary} />
            <Text style={styles.pillText}>
              Sweat onset detected {onsetMin === 0 ? 'just now' : `${onsetMin} min ago`}
            </Text>
          </View>
        )}

        <Text style={styles.subtle}>
          {ring.biometrics.gsrActive
            ? 'Your body temperature is slightly elevated. We\'re keeping an eye on it.'
            : 'Resting state. The ring will catch the next session automatically.'}
        </Text>

        {/* Action card */}
        <View style={styles.actionCard}>
          <View
            style={[
              styles.actionStripe,
              { backgroundColor: BAND_COLOR[band].primary, opacity: 0.5 },
            ]}
          />
          <View style={styles.actionRow}>
            <View
              style={[
                styles.actionIconWrap,
                { borderColor: BAND_COLOR[band].primary + '33', backgroundColor: BAND_COLOR[band].dim },
              ]}
            >
              <Feather name="bell" size={18} color={BAND_COLOR[band].primary} />
            </View>
            <View style={styles.actionBody}>
              <Text style={styles.actionTitle}>{actionTitle}</Text>
              <Text style={styles.actionBodyText}>{actionBody}</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.actionPrimary,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => Alert.alert('Logged', `Logged ${sipOz} oz to your hydration timeline.`)}
                accessibilityRole="button"
              >
                <Feather name="check" size={16} color={Colors.text.primary} />
                <Text style={styles.actionPrimaryText}>I&apos;m having it now</Text>
              </Pressable>

              <Pressable
                style={styles.actionSecondary}
                onPress={() =>
                  Alert.alert(
                    'All Signals',
                    'A full Mission-Control biometric panel (HR, skin temp, GSR, sweat rate, sodium) will live behind this tap.'
                  )
                }
                accessibilityRole="button"
              >
                <Feather name="bar-chart-2" size={14} color={Colors.text.muted} />
                <Text style={styles.actionSecondaryText}>View all signals</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Demo controls */}
        <View style={styles.demoBlock}>
          <Text style={styles.demoLabel}>DEMO · NO HARDWARE</Text>
          <Pressable
            onPress={() => (ring.sessionActive ? stopMockSession() : startMockSession())}
            style={({ pressed }) => [
              styles.demoBtn,
              {
                borderColor: ring.sessionActive
                  ? Colors.states.DEPLETED.primary + '55'
                  : Colors.states.PEAK.primary + '55',
                backgroundColor: ring.sessionActive
                  ? Colors.states.DEPLETED.dim
                  : Colors.states.PEAK.dim,
              },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
          >
            <Feather
              name={ring.sessionActive ? 'square' : 'play'}
              size={14}
              color={ring.sessionActive ? Colors.states.DEPLETED.primary : Colors.states.PEAK.primary}
            />
            <Text
              style={[
                styles.demoBtnText,
                { color: ring.sessionActive ? Colors.states.DEPLETED.primary : Colors.states.PEAK.primary },
              ]}
            >
              {ring.sessionActive ? 'Stop demo session' : 'Start demo session'}
            </Text>
          </Pressable>
          <Text style={styles.demoHint}>
            Starts a vigorous-activity stream so the ring auto-routes to Sport Mode after a few seconds.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  scroll: { paddingHorizontal: 22, paddingBottom: 32, gap: 20 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  identity: { flex: 1 },
  identityLabel: {
    color: Colors.text.muted,
    fontSize: 10, fontWeight: '700', letterSpacing: 1.6,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  identityValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  connDot: { width: 6, height: 6, borderRadius: 3 },

  batteryWrap: { alignItems: 'flex-end', gap: 6 },
  ringGlyphOuter: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: Colors.fill.light,
    alignItems: 'center', justifyContent: 'center',
  },
  ringGlyphInner: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#C8C8D0',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  ringGlyphDot: {
    width: 4, height: 4, borderRadius: 2,
    position: 'absolute', top: -1, right: -1,
  },
  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryText: { color: Colors.text.muted, fontSize: 11, fontWeight: '500' },

  // Orb
  orbWrap: {
    height: ORB_DIAMETER + 80,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  orbGlow: {
    position: 'absolute',
    width: ORB_DIAMETER + 80, height: ORB_DIAMETER + 80,
    borderRadius: (ORB_DIAMETER + 80) / 2,
  },
  orbOuterRing: {
    position: 'absolute',
    width: ORB_DIAMETER + 30, height: ORB_DIAMETER + 30,
    borderRadius: (ORB_DIAMETER + 30) / 2,
    borderWidth: 1,
  },
  orbCore: {
    width: ORB_DIAMETER, height: ORB_DIAMETER,
    borderRadius: ORB_DIAMETER / 2,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  orbLabel: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500', marginBottom: 4 },
  orbValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  orbValue: { fontSize: 56, fontWeight: '300', letterSpacing: -2 },
  orbPct: { fontSize: 22, fontWeight: '300', marginLeft: 2 },
  orbBand: {
    color: Colors.text.muted, fontSize: 11, fontWeight: '600',
    letterSpacing: 1.4, marginTop: 6,
  },

  // Pill + caption
  pill: {
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  pillText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' },
  subtle: {
    color: Colors.text.muted, fontSize: 12,
    textAlign: 'center', lineHeight: 18, paddingHorizontal: 24,
  },

  // Action card
  actionCard: {
    borderRadius: 22,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
    padding: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  actionStripe: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
  },
  actionRow: { flexDirection: 'row', gap: 14 },
  actionIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  actionBody: { flex: 1 },
  actionTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '600', lineHeight: 22 },
  actionBodyText: {
    color: Colors.text.secondary, fontSize: 13, marginTop: 4, marginBottom: 14, lineHeight: 18,
  },
  actionPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.fill.medium,
    borderWidth: 1, borderColor: Colors.border.medium,
  },
  actionPrimaryText: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  actionSecondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginTop: 6,
  },
  actionSecondaryText: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' },

  // Demo
  demoBlock: { marginTop: 4, alignItems: 'center', gap: 8 },
  demoLabel: { color: Colors.text.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.6 },
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1,
  },
  demoBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  demoHint: {
    color: Colors.text.muted, fontSize: 11,
    textAlign: 'center', paddingHorizontal: 32, lineHeight: 16,
  },
});
