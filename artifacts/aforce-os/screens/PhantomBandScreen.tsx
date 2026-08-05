/**
 * Phantom Band Screen — settings, status, gestures, and previews for the
 * private companion device. Reached from Profile → Hardware → Phantom Band,
 * or from the Phantom Band card on Home.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/Icon';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { HardwareConnectionStatus } from '@/components/HardwareConnectionStatus';
import { BandSignalPreview } from '@/components/BandSignalPreview';
import { phantomBandService } from '@/services/phantomBandService';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { ledForLevel } from '@/services/ledSignalService';
import { describeHaptic } from '@/services/hapticService';
import { useAppStore } from '@/store/useAppStore';
import {
  GESTURE_ACTION,
  type BandGesture,
  type HapticPattern,
  type PhantomBandState,
} from '@/types/hardware';

const HAPTIC_PREVIEWS: { id: HapticPattern; label: string }[] = [
  { id: 'tap',             label: 'Command Confirmed' },
  { id: 'protocol_open',   label: 'Protocol Window Open' },
  { id: 'recovery_needed', label: 'Recovery Needed' },
  { id: 'depleted',        label: 'Depleted' },
  { id: 'critical_heat',   label: 'Critical Heat Risk' },
];

const GESTURES: BandGesture[] = ['single_tap', 'double_tap', 'long_press', 'press_and_hold'];

export function PhantomBandScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const { state } = useAppStore();
  const [bandState, setBandState] = useState<PhantomBandState>(phantomBandService.getState());

  const topPadding = Platform.OS === 'web' ? 24 : insets.top + 8;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom + 24;

  // Subscribe to band state changes.
  useEffect(() => phantomBandService.on('state', setBandState), []);

  // NOTE: performance-level mirroring lives on the Home screen (single owner
  // for the engine→band pipeline). We only read state here.
  const level = state.engineOutput.performanceState.level;

  const ledPattern = bandState.ledPattern.color === 'off'
    ? ledForLevel(level)
    : bandState.ledPattern;

  const lastSyncLabel = useMemo(() => {
    if (!bandState.lastSyncAt) return '—';
    const secondsAgo = Math.max(0, Math.round((Date.now() - bandState.lastSyncAt) / 1000));
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.round(secondsAgo / 60)}m ago`;
  }, [bandState.lastSyncAt, bandState.connection]);

  const isConnected = bandState.connection === 'connected' || bandState.connection === 'syncing';

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: topPadding, paddingBottom: bottomPadding },
            // Cap line length on Fold-open / tablet so the band
            // hero/preview don't stretch edge-to-edge.
            layout.isWide && {
              maxWidth: layout.contentMaxWidth,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12} testID="phantom-back">
              <Icon name="chevron-left" size={20} color={Colors.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>HARDWARE</Text>
              <Text style={styles.title}>PHANTOM Band</Text>
            </View>
          </View>

          {/* Hero card with connection + signal preview */}
          <View style={styles.heroCard}>
            <HardwareConnectionStatus status={bandState.connection} />
            <BandSignalPreview
              pattern={ledPattern}
              caption={
                bandState.mirroredLevel
                  ? `MIRRORING ${bandState.mirroredLevel}`
                  : isConnected ? 'STANDING BY' : 'OFFLINE — last state cached'
              }
            />

            <View style={styles.heroRow}>
              <Stat label="BATTERY" value={bandState.device ? `${bandState.device.batteryLevel}%` : '—'} />
              <Stat label="SIGNAL"  value={bandState.device ? `${bandState.device.signalStrengthDb} dBm` : '—'} />
              <Stat label="SYNC"    value={isConnected ? lastSyncLabel : '—'} />
            </View>

            <View style={styles.actionRow}>
              {bandState.connection === 'unpaired' || bandState.connection === 'disconnected' ? (
                <PrimaryButton
                  label="PAIR BAND"
                  icon="bluetooth"
                  onPress={() => phantomBandService.pair()}
                  testID="phantom-pair"
                />
              ) : (
                <>
                  <PrimaryButton
                    label="SYNC NOW"
                    icon="refresh-cw"
                    onPress={() => phantomBandService.syncNow()}
                    testID="phantom-sync"
                  />
                  <SecondaryButton
                    label="DISCONNECT"
                    icon="wifi-off"
                    onPress={() => phantomBandService.disconnect()}
                    testID="phantom-disconnect"
                  />
                  <SecondaryButton
                    label="SIMULATE SIP"
                    icon="droplet"
                    onPress={() => phantomBandService.simulateSip({ oz: 4, fluidType: 'aforce_stick' })}
                    testID="phantom-simulate-sip"
                  />
                </>
              )}
            </View>
          </View>

          {/* Gestures */}
          <SectionHeader label="GESTURE MAPPING" hint="Tap any gesture to simulate it" />
          <View style={styles.card}>
            {GESTURES.map((g, i) => {
              const m = GESTURE_ACTION[g];
              return (
                <View key={g}>
                  <Pressable
                    onPress={() => phantomBandService.reportGesture(g)}
                    style={styles.gestureRow}
                    testID={`phantom-gesture-${g}`}
                  >
                    <View style={styles.gestureLeft}>
                      <Icon
                        name={gestureIcon(g)}
                        size={18}
                        color={Colors.states.BALANCED.primary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.gestureLabel}>{m.label}</Text>
                        <Text style={styles.gestureDesc}>{m.description}</Text>
                      </View>
                    </View>
                    <Text style={styles.gestureBadge}>{gestureName(g)}</Text>
                  </Pressable>
                  {i < GESTURES.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>

          {/* Haptic preview */}
          <SectionHeader label="HAPTIC PREVIEW" hint="Replay each pattern on device" />
          <View style={styles.card}>
            {HAPTIC_PREVIEWS.map((h, i) => (
              <View key={h.id}>
                <Pressable
                  onPress={() => phantomBandService.sendHaptic(h.id)}
                  style={styles.hapticRow}
                  testID={`phantom-haptic-${h.id}`}
                >
                  <View style={styles.hapticLeft}>
                    <Icon name="zap" size={14} color={Colors.states.PEAK.primary} />
                    <Text style={styles.hapticLabel}>{h.label}</Text>
                  </View>
                  <Text style={styles.hapticDesc}>{describeHaptic(h.id)}</Text>
                </Pressable>
                {i < HAPTIC_PREVIEWS.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          {/* Identity placeholder */}
          <SectionHeader label="DEVICE" />
          <View style={styles.card}>
            <DeviceRow label="Name" value={bandState.device?.name ?? 'PHANTOM Band'} />
            <View style={styles.divider} />
            <DeviceRow label="Device ID" value={bandState.device?.deviceId ?? '—'} />
            <View style={styles.divider} />
            <DeviceRow label="Firmware" value={bandState.device?.firmwareVersion ?? '—'} />
            <View style={styles.divider} />
            <Pressable style={styles.deviceRow} onPress={() => { /* rename placeholder */ }} testID="phantom-rename">
              <Text style={styles.deviceLabel}>Rename Band</Text>
              <Icon name="edit-2" size={14} color={Colors.text.muted} />
            </Pressable>
          </View>

          <Text style={styles.footnote}>
            PHANTOM Band is a private trigger surface for AForce OS. It mirrors your performance state silently and never displays messages.
          </Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function PrimaryButton({ label, icon, onPress, testID }: { label: string; icon: IconName; onPress: () => void; testID?: string }) {
  return (
    // RC-1 fix: paddingVertical 12 + an 11pt label was a ~38pt-tall button —
    // under the 44pt minimum. hitSlop 6 brings the effective target to
    // ~44-50pt without resizing the visible pill.
    <Pressable onPress={onPress} style={styles.primaryButton} hitSlop={6} testID={testID}>
      <Icon name={icon} size={14} color={Colors.background.primary} />
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, icon, onPress, testID }: { label: string; icon: IconName; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton} hitSlop={6} testID={testID}>
      <Icon name={icon} size={14} color={Colors.text.primary} />
      <Text style={styles.secondaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function DeviceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.deviceRow}>
      <Text style={styles.deviceLabel}>{label}</Text>
      <Text style={styles.deviceValue}>{value}</Text>
    </View>
  );
}

function gestureIcon(g: BandGesture): IconName {
  switch (g) {
    case 'single_tap':     return 'circle';
    case 'double_tap':     return 'mic';
    case 'long_press':     return 'activity';
    case 'press_and_hold': return 'alert-octagon';
  }
}

function gestureName(g: BandGesture): string {
  switch (g) {
    case 'single_tap':     return 'TAP';
    case 'double_tap':     return 'DOUBLE-TAP';
    case 'long_press':     return 'LONG PRESS';
    case 'press_and_hold': return 'PRESS + HOLD';
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20, gap: 16 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.fill.light,
    borderWidth: 1, borderColor: Colors.border.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.text.muted, letterSpacing: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24, color: Colors.text.primary, marginTop: 2 },

  heroCard: {
    marginTop: 4,
    padding: 18,
    borderRadius: 16,
    backgroundColor: Colors.fill.light,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 12,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
  stat: { alignItems: 'center', gap: 4 },
  statLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: Colors.text.muted, letterSpacing: 1.6 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 14, color: Colors.text.primary },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  primaryButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10,
    backgroundColor: Colors.text.primary,
  },
  primaryButtonLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.background.primary, letterSpacing: 1.4,
  },
  secondaryButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: Colors.border.medium,
  },
  secondaryButtonLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 11, color: Colors.text.primary, letterSpacing: 1.4,
  },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, color: Colors.text.muted, letterSpacing: 1.8 },
  sectionHint: { fontFamily: 'Inter_500Medium', fontSize: 10, color: Colors.text.muted },

  card: {
    backgroundColor: Colors.fill.light,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginHorizontal: 14 },

  gestureRow: { paddingVertical: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  gestureLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  gestureLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text.primary },
  gestureDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.text.muted, marginTop: 2 },
  gestureBadge: {
    fontFamily: 'Inter_700Bold', fontSize: 9, color: Colors.text.secondary,
    letterSpacing: 1.4,
    backgroundColor: Colors.fill.medium,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },

  hapticRow: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hapticLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hapticLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.text.primary },
  hapticDesc: { fontFamily: 'Inter_400Regular', fontSize: 10, color: Colors.text.muted },

  deviceRow: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deviceLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.text.secondary },
  deviceValue: { fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.text.primary },

  footnote: {
    marginTop: 8, marginBottom: 12,
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16,
    color: Colors.text.muted, textAlign: 'center',
  },
});
