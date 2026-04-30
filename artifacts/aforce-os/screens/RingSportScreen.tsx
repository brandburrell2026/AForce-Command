/**
 * RingSportScreen — auto-triggered active-session HUD.
 *
 * Entered automatically by RingHomeScreen when the ring detects sustained
 * vigorous activity. Renders the Sport Mode mockup as a native screen:
 * sport badge, big chronometer, 4-tile biometric grid, live deficit card,
 * and a "Next sip" timer with Log button. Auto-routes back to /ring when
 * the activity stops for several ticks.
 *
 * Visual translation of the SportMode mockup
 * (artifacts/mockup-sandbox/src/components/mockups/aforce-ring/SportMode.tsx)
 * to React Native using the AForce OS palette.
 */

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../theme/colors';
import { computeSweatSession } from '../services/sweatRateEngine';
import {
  intensityFromMovement,
  minutesSinceOnset,
  stopMockSession,
  useRingStream,
} from '../services/ringService';

const IDLE_TICKS_TO_EXIT = 5;
const NEXT_SIP_SECONDS = 180; // 3-minute autopilot recheck while active

function fmtElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function RingSportScreen() {
  const ring = useRingStream();
  const idleStreakRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const [sipCountdown, setSipCountdown] = useState(NEXT_SIP_SECONDS);

  // 1Hz local clock — drives the chronometer + countdown smoothly.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setSipCountdown((prev) => (prev > 0 ? prev - 1 : NEXT_SIP_SECONDS));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-exit when activity stops for several ticks.
  useEffect(() => {
    // NOTE: depend on the whole biometrics object (a fresh ref each ring
    // tick) so this counter advances every tick, not only when
    // movementClass *changes*.
    if (ring.biometrics.movementClass !== 'vigorous') {
      idleStreakRef.current += 1;
      if (idleStreakRef.current >= IDLE_TICKS_TO_EXIT) {
        idleStreakRef.current = 0;
        router.replace('/ring');
      }
    } else {
      idleStreakRef.current = 0;
    }
  }, [ring.biometrics]);

  const elapsedMs = ring.biometrics.gsrOnsetAt ? now - ring.biometrics.gsrOnsetAt : 0;
  const elapsedSecs = Math.max(0, Math.floor(elapsedMs / 1000));
  const elapsedMin = elapsedSecs / 60;

  const session = useMemo(() => {
    if (elapsedMin < 0.5) return null;
    try {
      return computeSweatSession({
        mode: 'estimate',
        bodyWeight: 75,
        weightUnit: 'kg',
        height: 178,
        heightUnit: 'cm',
        sportId: 'soccer',
        durationMinutes: elapsedMin,
        intensity: intensityFromMovement(ring.biometrics.movementClass),
        ambientTempC: 24,
        ambientHumidityPct: 50,
        acclimatized: true,
        sodiumProfile: 'moderate',
      });
    } catch {
      return null;
    }
  }, [ring.biometrics.movementClass, elapsedMin]);

  const sweatRateLh = session?.sweatRateLh ?? 1.8;
  const deficitOz = session ? session.sweatLossL * 33.814 : 0; // L → oz
  const sodiumMg = session?.sodiumLossMg ?? 0;

  const TEAL = Colors.states.BALANCED.primary;
  const AMBER = Colors.states.RECOVERING.primary;
  const LIME = Colors.states.PEAK.primary;
  const RED = Colors.states.DEPLETED.primary;
  const PURPLE = Colors.guardian.primary;

  const sportLabel = `${(ring.biometrics.sport ?? 'Active').toUpperCase()} · ZONE ${ring.biometrics.hrZone}`;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Glow accents */}
      <View style={[styles.glowTopRight, { backgroundColor: LIME }]} />
      <View style={[styles.glowBottomLeft, { backgroundColor: TEAL }]} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>LIVE SESSION</Text>
          <Text style={styles.headerValue}>AForce Engine Active</Text>
        </View>
        <View style={styles.ringBadge}>
          <View style={styles.ringBadgeGlyph}>
            <View style={[styles.ringBadgeDot, { backgroundColor: LIME }]} />
          </View>
          <Text style={styles.ringBadgeText}>A-RING PRO</Text>
        </View>
      </View>

      {/* Sport pill */}
      <View style={styles.sportRow}>
        <View style={[styles.sportPill, { borderColor: LIME + '55', backgroundColor: LIME + '14' }]}>
          <Feather name="activity" size={14} color={LIME} />
          <Text style={[styles.sportPillText, { color: LIME }]}>{sportLabel}</Text>
        </View>
      </View>

      {/* Chronometer */}
      <View style={styles.chronoWrap}>
        <Text style={styles.chronoText}>{fmtElapsed(elapsedSecs)}</Text>
        <Text style={styles.chronoLabel}>DURATION</Text>
      </View>

      {/* Metric grid */}
      <View style={styles.grid}>
        <Tile
          icon={<Feather name="heart" size={14} color={RED} />}
          label="HR"
          value={ring.biometrics.heartRateBpm.toString()}
          unit="bpm"
        />
        <Tile
          icon={<Feather name="droplet" size={14} color={TEAL} />}
          label="SWEAT"
          value={sweatRateLh.toFixed(2)}
          unit="L/h"
        />
        <Tile
          icon={<Feather name="thermometer" size={14} color={AMBER} />}
          label="TEMP"
          value={ring.biometrics.skinTempC.toFixed(1)}
          unit="°C"
        />
        <Tile
          icon={<Feather name="zap" size={14} color={PURPLE} />}
          label="GSR"
          value={ring.biometrics.gsrActive ? 'Active' : 'Idle'}
          unit={
            ring.biometrics.gsrOnsetAt
              ? `Onset @ ${fmtElapsed(Math.floor((ring.biometrics.gsrOnsetAt % 86_400_000) / 1000))}`
              : ''
          }
          unitTiny
        />
      </View>

      <View style={styles.bottom}>
        {/* Live deficit card */}
        <View style={[styles.deficitCard, { borderColor: TEAL + '55' }]}>
          <View style={styles.deficitTopRow}>
            <View>
              <Text style={styles.deficitLabel}>LIVE DEFICIT</Text>
              <View style={styles.deficitValueRow}>
                <Text style={[styles.deficitValue, { color: TEAL }]}>{deficitOz.toFixed(1)}</Text>
                <Text style={styles.deficitUnit}>oz</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.deficitLabel}>NA+ LOSS</Text>
              <Text style={styles.naValue}>
                {Math.round(sodiumMg)}
                <Text style={styles.naUnit}> mg</Text>
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, (deficitOz / 20) * 100)}%`,
                  backgroundColor: TEAL,
                },
              ]}
            />
          </View>
        </View>

        {/* Next sip pill */}
        <View style={[styles.sipPill, { backgroundColor: AMBER }]}>
          <View style={styles.sipIcon}>
            <Feather name="clock" size={20} color="#000" />
          </View>
          <View style={styles.sipMid}>
            <Text style={styles.sipLabel}>NEXT SIP IN</Text>
            <Text style={styles.sipCountdown}>{fmtCountdown(sipCountdown)}</Text>
          </View>
          <Pressable
            onPress={() => {
              setSipCountdown(NEXT_SIP_SECONDS);
              Alert.alert('Logged', 'Logged 8 oz to your active session.');
            }}
            style={({ pressed }) => [styles.sipBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.sipBtnText}>LOG 8 OZ</Text>
          </Pressable>
        </View>

        {/* Stop session control */}
        <Pressable
          onPress={() => {
            stopMockSession();
            router.replace('/ring');
          }}
          style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Feather name="square" size={12} color={Colors.text.muted} />
          <Text style={styles.endBtnText}>End session</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface TileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  unitTiny?: boolean;
}

function Tile({ icon, label, value, unit, unitTiny }: TileProps) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        {icon}
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <View style={styles.tileValueRow}>
        <Text style={styles.tileValue}>{value}</Text>
        {!unitTiny && unit ? <Text style={styles.tileUnit}>{unit}</Text> : null}
      </View>
      {unitTiny && unit ? <Text style={styles.tileUnitTiny}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary, overflow: 'hidden' },

  glowTopRight: {
    position: 'absolute',
    top: -120, right: -100,
    width: 320, height: 320, borderRadius: 160,
    opacity: 0.15,
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: 120, left: -120,
    width: 320, height: 320, borderRadius: 160,
    opacity: 0.13,
  },

  header: {
    paddingTop: 8, paddingHorizontal: 22, paddingBottom: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLabel: {
    color: Colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.6,
  },
  headerValue: { color: Colors.text.primary, fontSize: 14, fontWeight: '600', marginTop: 2 },

  ringBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  ringBadgeGlyph: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1.5, borderColor: '#C0C0C8',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1A24',
  },
  ringBadgeDot: { width: 4, height: 4, borderRadius: 2 },
  ringBadgeText: {
    color: Colors.text.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
  },

  sportRow: { paddingHorizontal: 22, marginTop: 4, alignItems: 'center' },
  sportPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  sportPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },

  chronoWrap: { alignItems: 'center', marginTop: 18, marginBottom: 14 },
  chronoText: {
    color: Colors.text.primary,
    fontSize: 72, fontWeight: '900', letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  chronoLabel: {
    color: Colors.text.muted, fontSize: 12, fontWeight: '700', letterSpacing: 2, marginTop: 2,
  },

  grid: {
    paddingHorizontal: 22,
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  tile: {
    flexBasis: '48%', flexGrow: 1,
    borderRadius: 18,
    backgroundColor: Colors.background.card,
    borderWidth: 1, borderColor: Colors.border.subtle,
    padding: 14,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  tileLabel: {
    color: Colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
  },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  tileValue: { color: Colors.text.primary, fontSize: 26, fontWeight: '800' },
  tileUnit: { color: Colors.text.muted, fontSize: 11, fontWeight: '700' },
  tileUnitTiny: { color: Colors.text.muted, fontSize: 10, marginTop: 2 },

  bottom: {
    marginTop: 'auto',
    paddingHorizontal: 22, paddingBottom: 12,
    gap: 12,
  },

  deficitCard: {
    borderRadius: 22, padding: 16,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
  },
  deficitTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  deficitLabel: {
    color: Colors.text.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1.6,
  },
  deficitValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  deficitValue: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  deficitUnit: { color: Colors.text.secondary, fontSize: 13, fontWeight: '700' },
  naValue: { color: Colors.text.primary, fontSize: 18, fontWeight: '800', marginTop: 4 },
  naUnit: { color: Colors.text.muted, fontSize: 10 },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden', marginTop: 14,
  },
  progressFill: { height: 6, borderRadius: 3 },

  sipPill: {
    height: 60, borderRadius: 30,
    paddingHorizontal: 6,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sipIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  sipMid: { alignItems: 'center' },
  sipLabel: { color: 'rgba(0,0,0,0.55)', fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  sipCountdown: {
    color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  sipBtn: {
    height: 48, paddingHorizontal: 18, borderRadius: 24,
    backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  sipBtnText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },

  endBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8,
  },
  endBtnText: { color: Colors.text.muted, fontSize: 12, fontWeight: '500' },
});
