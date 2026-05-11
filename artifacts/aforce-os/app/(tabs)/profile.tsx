/**
 * Profile & Settings — goals, weight, activity type, hardware pairing,
 * subscription tier, and the demo Feature Flag panel that previews
 * Phase 2 (Clutch) and Phase 3 (Guardian).
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform, Pressable, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { WhoopSnapshotCard } from '@/components/WhoopSnapshotCard';
import { Icon } from '@/components/Icon';
import { Colors } from '@/theme/colors';
import { mockUserProfile } from '@/data/mockData';
import { HEALTH_PROVIDERS, type HealthProviderId } from '@/data/healthProviders';
import { buildDemoSnapshot } from '@/data/providerDemoSnapshots';
import {
  isAppleHealthSupported,
  requestAppleHealthPermissions,
  fetchAppleHealthSnapshot,
  type AppleHealthSnapshot,
} from '@/services/appleHealth';
import { useAppStore } from '@/store/useAppStore';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '@/featureFlags/flags';
import type { FeatureFlags } from '@/types';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useTranslation } from 'react-i18next';
import { useAuth, useUser } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { createPortalSession } from '@/lib/api';
import { refreshEntitlement } from '@/hooks/useEntitlement';
import { AFORCE_VOICES } from '@/services/voiceCatalog';
import {
  BRAND_LANGUAGE,
  type VoiceIntensity,
  type VoiceScope,
} from '@/services/voice/commandVoice';
import { replayLastCommand, getLastCommand } from '@/services/voice/commandVoiceBus';

// Lazy-loaded haptics — `expo-haptics` rejects on web (no native
// module). The `import('expo-haptics')` form bundles the module on
// native and no-ops cleanly on web. We swallow rejections so a
// haptics failure can never surface to the user.
const hapticSelection = () => {
  import('expo-haptics').then(m => m.selectionAsync().catch(() => {})).catch(() => {});
};

const TIER_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  core:           { label: 'AForce Core',           desc: 'Start your performance system.',                      color: Colors.states.BALANCED.primary },
  athlete:        { label: 'AForce Athlete',        desc: 'Train and perform with precision.',                   color: Colors.states.PEAK.primary },
  system:         { label: 'AForce System',         desc: 'Full performance control — software + product.',      color: Colors.states.PEAK.primary },
  team_starter:   { label: 'Team Core Starter',     desc: 'Run your team with intelligence. Up to 25 members.',  color: Colors.states.BALANCED.primary },
  team_growth:    { label: 'Team Core Growth',      desc: 'Scale team performance. Up to 50 members.',           color: Colors.states.BALANCED.primary },
  team_pro:       { label: 'Team Core Pro',         desc: 'Operate at a higher level. Up to 100 members.',       color: Colors.states.BALANCED.primary },
  clutch_starter: { label: 'Clutch Starter',        desc: 'Control performance in real time.',                   color: Colors.clutch.primary },
  clutch_pro:     { label: 'Clutch Pro',            desc: 'Advance live decision making.',                       color: Colors.clutch.primary },
  clutch_elite:   { label: 'Clutch Elite',          desc: 'Elite team command system.',                          color: Colors.clutch.primary },
  guardian_core:  { label: 'Guardian Core',         desc: 'Protect athletes before breakdown.',                  color: Colors.guardian.primary },
  guardian_elite: { label: 'Guardian Elite',        desc: 'Elite roster protection system.',                     color: Colors.guardian.primary },
  all_access:     { label: 'AForce All-Access',     desc: 'Full performance OS across every layer.',             color: Colors.states.PEAK.primary },
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    state, setFeatureFlags, setAppleHealthSnapshot, setProviderBiometrics, setLanguage,
    activateSocialMode, logSocialDrink, deactivateSocialMode,
    voiceCoachEnabled, setVoiceCoachEnabled,
    selectedVoiceId, setSelectedVoiceId,
    voiceIntensity, setVoiceIntensity,
    voiceScope, setVoiceScope,
    setInvestorDemoActive,
  } = useAppStore();
  // Tracks the in-flight demo so we can disable the row + show the
  // active label without blocking the rest of Profile. Cleared once
  // the final dispatch settles.
  const [demoBusy, setDemoBusy] = useState<null | 'social' | 'recovery' | 'reset'>(null);

  // Seed Social Mode with a realistic-but-mild drink load so the
  // banner shows BAC math + impairment chips immediately. Order
  // matters: activate first (server creates the row), then drinks
  // append to it.
  const runSocialDemo = React.useCallback(async () => {
    setDemoBusy('social');
    try {
      await activateSocialMode();
      await logSocialDrink('beer');
      await logSocialDrink('cocktail');
    } finally {
      setDemoBusy(null);
    }
  }, [activateSocialMode, logSocialDrink]);

  // Recovery Mode = post-drinking. We log a heavier session (so
  // timeToClearMinutes is meaningfully > 0) then deactivate, which
  // sets endedAt = now and slides the user into the 8h recovery
  // window. RecoveryModeCard then renders inside the Social sheet.
  const runRecoveryDemo = React.useCallback(async () => {
    setDemoBusy('recovery');
    try {
      await activateSocialMode();
      await logSocialDrink('cocktail');
      await logSocialDrink('liquor');
      await logSocialDrink('wine');
      await deactivateSocialMode();
    } finally {
      setDemoBusy(null);
    }
  }, [activateSocialMode, logSocialDrink, deactivateSocialMode]);

  // "End demo" — calls deactivate. If the user is already in the
  // recovery window this is a no-op on the server. The 8h window
  // expires naturally; there is no hard reset endpoint by design.
  const endDemo = React.useCallback(async () => {
    setDemoBusy('reset');
    try { await deactivateSocialMode(); } finally { setDemoBusy(null); }
  }, [deactivateSocialMode]);

  const socialActive = !!state.userState.socialMode?.active;
  const inRecovery = !!state.userState.socialMode && !state.userState.socialMode.active && !!state.userState.socialMode.endedAt;
  const { t } = useTranslation();

  // Real Clerk identity for the profile header. Other `mockUserProfile`
  // fields (weight, target, tier, etc.) stay mocked until they're wired
  // to a real API. `useUser()` is safe here — ClerkProvider always
  // wraps the tab group via the root _layout.
  const { user: clerkUser } = useUser();
  const displayName = clerkUser?.fullName ?? clerkUser?.firstName ?? mockUserProfile.name;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const [remindersEnabled, setRemindersEnabled] = useState(mockUserProfile.remindersEnabled);
  // Mocked OAuth state for the third-party health platforms shown in
  // the "HEALTH PLATFORMS" card. In a real build, each id would map
  // to its provider SDK / OAuth grant. Here we toggle locally so the
  // UX (LIVE pill / disconnect) is honest about what the user did.
  const [linkedProviders, setLinkedProviders] = useState<Set<HealthProviderId>>(
    () => new Set(),
  );
  // Latest Apple Health snapshot — null until the user grants
  // permission AND the bridge actually returns data. Rendered in a
  // small "Live from Apple Health" panel so the user can see the
  // numbers AForce is pulling.
  const [appleSnapshot, setAppleSnapshot] = useState<AppleHealthSnapshot | null>(null);

  const refreshAppleSnapshot = React.useCallback(async () => {
    if (!isAppleHealthSupported()) return;
    const snap = await fetchAppleHealthSnapshot();
    setAppleSnapshot(snap);
    // Push into the global score so HRV / sleep actually move the orb
    // and show up in the score breakdown. We tag it with fetchedAt so
    // downstream consumers can decide whether to trust it.
    setAppleHealthSnapshot({ ...snap, fetchedAt: Date.now() });
  }, [setAppleHealthSnapshot]);

  const connectAppleHealth = async (): Promise<boolean> => {
    if (!isAppleHealthSupported()) {
      Alert.alert(
        'Apple Health needs a native iOS build',
        "Apple Health uses HealthKit, which only works in a native iOS build of AForce — not in the web preview or on Android. Build with EAS / a dev client on iPhone, then tap Connect again.",
      );
      return false;
    }
    const granted = await requestAppleHealthPermissions();
    if (!granted) {
      Alert.alert(
        'Apple Health permission not granted',
        'AForce will stay disconnected until you allow access. Open Settings → Health → Data Access & Devices → AForce OS to change this later.',
      );
      return false;
    }
    await refreshAppleSnapshot();
    return true;
  };

  const toggleProvider = async (id: HealthProviderId, name: string) => {
    if (Platform.OS !== 'web') hapticSelection();

    // ─── Disconnect path ──────────────────────────────────────────────
    if (linkedProviders.has(id)) {
      const disconnectMessage =
        id === 'apple_health'
          ? 'AForce will stop pulling Apple Health data. Permission stays granted in iOS Settings until you revoke it there.'
          : 'AForce will stop pulling biometrics from this source.';

      const performDisconnect = () => {
        setLinkedProviders((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        if (id === 'apple_health') {
          setAppleSnapshot(null);
          setAppleHealthSnapshot(null);
        } else {
          // Clear the biometric snapshot from the score so the
          // recovery / activity contribution disappears immediately.
          setProviderBiometrics(id, null);
        }
      };

      // RN Web: Alert.alert with multi-button onPress callbacks is a
      // no-op, so fall back to the browser's native confirm dialog.
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(`Disconnect ${name}? ${disconnectMessage}`)) {
          performDisconnect();
        }
        return;
      }

      Alert.alert(`Disconnect ${name}?`, disconnectMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: performDisconnect },
      ]);
      return;
    }

    // ─── Connect path ─────────────────────────────────────────────────
    if (id === 'apple_health') {
      const ok = await connectAppleHealth();
      if (ok) {
        setLinkedProviders((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
      return;
    }

    const performAuthorize = () => {
      setLinkedProviders((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      // Seed a demo snapshot so the score immediately reflects the
      // newly connected provider. Real OAuth ships in v1.1 native.
      const snap = buildDemoSnapshot(id);
      if (snap) setProviderBiometrics(id, snap);
    };

    const authorizeMessage = `You'll be redirected to ${name} to authorize AForce. Mocked in this build — a representative biometric snapshot is seeded so the hydration score reflects the connection.`;

    // RN Web: skip the broken multi-button Alert and use window.confirm.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Connect ${name}? ${authorizeMessage}`)) {
        performAuthorize();
      }
      return;
    }

    Alert.alert(`Connect ${name}`, authorizeMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Authorize', onPress: performAuthorize },
    ]);
  };
  const layout = useResponsiveLayout();

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84;
  const tierKey = mockUserProfile.subscriptionTier;
  const tier = TIER_LABELS[tierKey] ?? TIER_LABELS.core;

  const toggleFlag = (key: keyof FeatureFlags) => {
    setFeatureFlags({ ...state.featureFlags, [key]: !state.featureFlags[key] });
  };

  const allOn = Object.keys(DEMO_ALL_ON_FLAGS).every((k) => state.featureFlags[k as keyof FeatureFlags] === DEMO_ALL_ON_FLAGS[k as keyof FeatureFlags]);

  return (
    <View style={styles.root}>
      <GradientBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: topPadding + 8,
              paddingBottom: bottomPadding + 24,
              ...(layout.isWide
                ? { maxWidth: layout.contentMaxWidth, alignSelf: 'center', width: '100%' }
                : null),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.title}>Commander</Text>

          {(() => {
            // ─── Reusable section fragments ──────────────────────
            // Same single-source-of-truth pattern as Home: define
            // the cards once, arrange them as one column on phones
            // or two columns on Fold-open / tablet so neither code
            // path drifts.

            const profileCard = (
              <View style={[styles.profileCard, { borderColor: `${tier.color}33` }]}>
                <View style={[styles.avatar, { backgroundColor: `${tier.color}20`, borderColor: `${tier.color}55` }]}>
                  <Text style={[styles.avatarText, { color: tier.color }]}>
                    {avatarInitial}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{displayName}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: `${tier.color}15`, borderColor: `${tier.color}44` }]}>
                    <Icon name="award" size={10} color={tier.color} />
                    <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            );

            const goalsCard = (
              <>
                <SectionHeader label="GOALS" />
                <View style={styles.card}>
                  <SettingRow icon="target" label="Daily Target" value={`${mockUserProfile.dailyTarget} units`} />
                  <Divider />
                  <SettingRow icon="droplet" label="Daily Ounces Target" value={`${mockUserProfile.dailyTarget * 12} ounces`} />
                  <Divider />
                  <SettingRow icon="user" label="Body Weight" value={`${mockUserProfile.bodyWeightLbs} lb`} />
                  <Divider />
                  <SettingRow icon="activity" label="Activity Type" value={mockUserProfile.activityType} />
                  <Divider />
                  <SettingRow icon="sunrise" label="Wake Time" value={mockUserProfile.wakeTimeHHMM} />
                  <Divider />
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Icon name="bell" size={16} color={Colors.states.BALANCED.primary} />
                      <Text style={styles.settingLabel}>Reminders</Text>
                    </View>
                    <Switch
                      value={remindersEnabled}
                      onValueChange={setRemindersEnabled}
                      trackColor={{ false: Colors.fill.medium, true: Colors.states.PEAK.primary }}
                      thumbColor={Colors.text.primary}
                      ios_backgroundColor={Colors.fill.medium}
                    />
                  </View>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/notifications')}
                    testID="profile-notifications-link"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="sliders" size={16} color={Colors.states.BALANCED.primary} />
                      <View>
                        <Text style={styles.settingLabel}>Notification Preferences</Text>
                        <Text style={styles.settingSubLabel}>Score alerts · Risk timer · Recovery · Reorder</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                </View>
              </>
            );

            const protocolToolsCard = (
              <>
                <SectionHeader label="PROTOCOL TOOLS" hint="Sport-science calculators" />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => router.push('/sweat')}
                    testID="profile-sweat-link"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="droplet" size={16} color={Colors.states.BALANCED.primary} />
                      <View>
                        <Text style={styles.settingLabel}>Sweat Calculator</Text>
                        <Text style={styles.settingSubLabel}>ACSM sweat-rate · Baker sodium · AForce Rx</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/sensors')}
                    testID="profile-sensors-link"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="upload" size={16} color={Colors.states.BALANCED.primary} />
                      <View>
                        <Text style={styles.settingLabel}>Sensor Import</Text>
                        <Text style={styles.settingSubLabel}>hDrop · Nix · Gatorade Gx — CSV/JSON</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/cruise')}
                    testID="profile-cruise-link"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="anchor" size={16} color="#00E5FF" />
                      <View>
                        <Text style={styles.settingLabel}>Cruise Mode · Premium</Text>
                        <Text style={styles.settingSubLabel}>Hydration intelligence for life at sea</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/achievements')}
                    testID="profile-achievements-link"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="award" size={16} color={Colors.states.PEAK.primary} />
                      <View>
                        <Text style={styles.settingLabel}>Achievements</Text>
                        <Text style={styles.settingSubLabel}>Streaks · badges · unlock progress</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/science')}
                    testID="profile-science-link"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="book-open" size={16} color={Colors.text.secondary} />
                      <View>
                        <Text style={styles.settingLabel}>Science & Methodology</Text>
                        <Text style={styles.settingSubLabel}>Formulas · citations · export PDF</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                </View>
              </>
            );

            const hardwareCard = (
              <>
                <SectionHeader label="HARDWARE" />
                <View style={styles.card}>
                  <Pressable onPress={() => router.push('/phantom')} testID="profile-phantom-link">
                    <HardwareRow
                      name="PHANTOM Band"
                      kind="Private consumer wearable · BLE · 30s sync"
                      ledColor={Colors.states.BALANCED.primary}
                      status="MANAGE ›"
                    />
                  </Pressable>
                  <Divider />
                  <HardwareRow
                    name="CLUTCH Clip"
                    kind="Athlete clip · BLE · 15s in-game"
                    ledColor={Colors.clutch.primary}
                    status="UNPAIRED"
                  />
                </View>
              </>
            );

            const connectedDevicesCard = (
              <>
                <SectionHeader label="CONNECTED DEVICES" />
                <View style={styles.card}>
                  {mockUserProfile.connectedDevices.map((device, i) => (
                    <React.Fragment key={device}>
                      <View style={styles.deviceRow}>
                        <View style={styles.deviceLeft}>
                          <View style={[styles.deviceDot, { backgroundColor: Colors.states.PEAK.primary }]} />
                          <Text style={styles.deviceName}>{device}</Text>
                        </View>
                        <Text style={[styles.deviceStatus, { color: Colors.states.PEAK.primary }]}>LIVE</Text>
                      </View>
                      {i < mockUserProfile.connectedDevices.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </View>

                <SectionHeader label="HEALTH PLATFORMS" hint="Pull biometrics from these services" />
                <View style={styles.card}>
                  {HEALTH_PROVIDERS.map((p, i) => {
                    const linked = linkedProviders.has(p.id);
                    return (
                      <React.Fragment key={p.id}>
                        <Pressable
                          onPress={() => toggleProvider(p.id, p.name)}
                          style={({ pressed }) => [
                            styles.providerRow,
                            pressed && { backgroundColor: `${p.brand}10` },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={
                            linked ? `Disconnect ${p.name}` : `Connect ${p.name}`
                          }
                          testID={`provider-${p.id}`}
                        >
                          <View
                            style={[
                              styles.providerIcon,
                              {
                                backgroundColor: `${p.brand}1F`,
                                borderColor: `${p.brand}66`,
                              },
                            ]}
                          >
                            <Feather name={p.icon} size={16} color={p.brand} />
                          </View>
                          <View style={styles.providerBody}>
                            <Text style={styles.deviceName}>{p.name}</Text>
                            <Text style={styles.providerSub}>{p.pulls}</Text>
                          </View>
                          {linked ? (
                            <Text
                              style={[styles.deviceStatus, { color: Colors.states.PEAK.primary }]}
                            >
                              LIVE
                            </Text>
                          ) : (
                            <View
                              style={[
                                styles.connectPill,
                                { borderColor: `${p.brand}88` },
                              ]}
                            >
                              <Text style={[styles.connectPillText, { color: p.brand }]}>
                                CONNECT
                              </Text>
                            </View>
                          )}
                        </Pressable>
                        {p.id === 'whoop' && linked && (() => {
                          // Cinematic WHOOP-styled live panel. Numbers come
                          // straight from DEMO_PROVIDER_SNAPSHOTS.whoop —
                          // the same payload the score engine consumes — so
                          // what the user sees here matches what's moving
                          // the orb. Swaps to a real OAuth-backed snapshot
                          // in v1.1.
                          const snap = buildDemoSnapshot('whoop');
                          if (!snap) return null;
                          return (
                            <WhoopSnapshotCard
                              recoveryPct={snap.recoveryPct}
                              strain={snap.strain}
                              sleepHoursLastNight={snap.sleepHoursLastNight}
                            />
                          );
                        })()}
                        {p.id === 'apple_health' && linked && appleSnapshot && (
                          <View style={styles.snapshotBlock}>
                            <View style={styles.snapshotHeader}>
                              <Text style={styles.snapshotLabel}>LIVE FROM APPLE HEALTH</Text>
                              <Pressable
                                onPress={() => refreshAppleSnapshot()}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel="Refresh Apple Health"
                              >
                                <Feather
                                  name="refresh-cw"
                                  size={12}
                                  color={Colors.text.secondary}
                                />
                              </Pressable>
                            </View>
                            <View style={styles.snapshotGrid}>
                              <SnapshotCell
                                label="Resting HR"
                                value={
                                  appleSnapshot.restingHeartRate != null
                                    ? `${Math.round(appleSnapshot.restingHeartRate)} bpm`
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label="HRV"
                                value={
                                  appleSnapshot.hrvSdnn != null
                                    ? `${Math.round(appleSnapshot.hrvSdnn)} ms`
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label="Steps"
                                value={
                                  appleSnapshot.stepsToday != null
                                    ? Math.round(appleSnapshot.stepsToday).toLocaleString()
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label="Sleep"
                                value={
                                  appleSnapshot.sleepHoursLastNight != null
                                    ? `${appleSnapshot.sleepHoursLastNight.toFixed(1)} h`
                                    : '—'
                                }
                              />
                            </View>
                          </View>
                        )}
                        {i < HEALTH_PROVIDERS.length - 1 && <Divider />}
                      </React.Fragment>
                    );
                  })}
                </View>
              </>
            );

            const demoAccessCard = (
              <>
                <SectionHeader label="DEMO ACCESS" hint="Preview Phase 2 + Phase 3" />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => setFeatureFlags(allOn ? DEFAULT_FLAGS : DEMO_ALL_ON_FLAGS)}
                    style={[styles.demoMaster, { borderColor: allOn ? Colors.states.PEAK.primary : Colors.border.medium }]}
                  >
                    <Icon name={allOn ? 'eye-off' : 'eye'} size={14} color={allOn ? Colors.states.PEAK.primary : Colors.text.secondary} />
                    <Text style={[styles.demoMasterText, { color: allOn ? Colors.states.PEAK.primary : Colors.text.primary }]}>
                      {allOn ? 'Lock all demo features' : 'Unlock all demo features'}
                    </Text>
                  </Pressable>

                  <FlagRow flag="clutch_access_enabled" label="Clutch Access" desc="Phase 2 — Command the Team" color={Colors.clutch.primary} state={state} onToggle={toggleFlag} />
                  <FlagRow flag="clutch_heat_mode_enabled" label="Heat Mode" desc="Aggressive cadence under heat stress" color={Colors.clutch.primary} state={state} onToggle={toggleFlag} />
                  <FlagRow flag="clutch_inventory_enabled" label="Auto Replenish" desc="Inventory + restock automation" color={Colors.clutch.primary} state={state} onToggle={toggleFlag} />
                  <FlagRow flag="clutch_clip_enabled" label="CLUTCH Clip" desc="Coach-visible BLE hardware" color={Colors.clutch.primary} state={state} onToggle={toggleFlag} />

                  <FlagRow flag="guardian_intelligence_enabled" label="Guardian Intelligence" desc="Phase 3 — Protect the Roster" color={Colors.guardian.primary} state={state} onToggle={toggleFlag} />
                  <FlagRow flag="guardian_body_map_enabled" label="Body Risk Map" desc="Per-body-region risk visualization" color={Colors.guardian.primary} state={state} onToggle={toggleFlag} />
                  <FlagRow flag="guardian_alerts_enabled" label="Critical Alerts" desc="Coach + medical escalations" color={Colors.guardian.primary} state={state} onToggle={toggleFlag} />

                  <FlagRow flag="phantom_wearable_enabled" label="PHANTOM Band" desc="Private consumer wearable" color={Colors.states.BALANCED.primary} state={state} onToggle={toggleFlag} />
                </View>
              </>
            );

            const demoModesCard = (
              <>
                <SectionHeader label={t('profile.demo_modes.label')} hint={t('profile.demo_modes.hint')} />
                <View style={styles.card}>
                  <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }}>
                    <Text style={{ color: Colors.text.secondary, fontSize: 12, lineHeight: 17 }}>
                      {t('profile.demo_modes.intro')}
                    </Text>
                  </View>

                  <Pressable
                    onPress={runSocialDemo}
                    disabled={demoBusy !== null}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.demo_modes.activate_social')}
                    style={[
                      styles.demoMaster,
                      {
                        borderColor: socialActive ? '#9D7CFB' : Colors.border.medium,
                        opacity: demoBusy && demoBusy !== 'social' ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Icon name="moon" size={14} color={socialActive ? '#9D7CFB' : Colors.text.secondary} />
                    <Text style={[styles.demoMasterText, { color: socialActive ? '#9D7CFB' : Colors.text.primary }]}>
                      {demoBusy === 'social'
                        ? t('profile.demo_modes.activating_social')
                        : socialActive
                          ? t('profile.demo_modes.social_active')
                          : t('profile.demo_modes.activate_social')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={runRecoveryDemo}
                    disabled={demoBusy !== null}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.demo_modes.enter_recovery')}
                    style={[
                      styles.demoMaster,
                      {
                        borderColor: inRecovery ? '#F4B23F' : Colors.border.medium,
                        opacity: demoBusy && demoBusy !== 'recovery' ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Icon name="sun" size={14} color={inRecovery ? '#F4B23F' : Colors.text.secondary} />
                    <Text style={[styles.demoMasterText, { color: inRecovery ? '#F4B23F' : Colors.text.primary }]}>
                      {demoBusy === 'recovery'
                        ? t('profile.demo_modes.entering_recovery')
                        : inRecovery
                          ? t('profile.demo_modes.recovery_active')
                          : t('profile.demo_modes.enter_recovery')}
                    </Text>
                  </Pressable>

                  {(socialActive || inRecovery) && (
                    <Pressable
                      onPress={endDemo}
                      disabled={demoBusy !== null}
                      accessibilityRole="button"
                      accessibilityLabel={t('profile.demo_modes.end_night')}
                      style={[
                        styles.demoMaster,
                        { borderColor: Colors.border.medium, opacity: demoBusy ? 0.5 : 1 },
                      ]}
                    >
                      <Icon name="x" size={14} color={Colors.text.secondary} />
                      <Text style={[styles.demoMasterText, { color: Colors.text.primary }]}>
                        {demoBusy === 'reset'
                          ? t('profile.demo_modes.ending')
                          : socialActive ? t('profile.demo_modes.end_night') : t('profile.demo_modes.auto_clearing')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            );

            // Voice Coach toggle (T3) — re-enables the AI voice persona.
            // Each new AI command is read aloud via the selected coach
            // voice (ElevenLabs when picked, else device synthesizer).
            // Both the on/off toggle AND the picked voice survive a
            // refresh via AsyncStorage in the store.
            const voiceCard = (
              <>
                <SectionHeader label={t('profile.voice_section.label')} />
                <View style={styles.card}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Icon
                        name={voiceCoachEnabled ? 'volume-2' : 'volume-x'}
                        size={16}
                        color={voiceCoachEnabled ? Colors.states.PEAK.primary : Colors.text.secondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingLabel}>{t('profile.voice_section.row_label')}</Text>
                        <Text style={[styles.flagDesc, { marginTop: 2 }]}>
                          {voiceCoachEnabled
                            ? 'Voice persona reads each new AI command aloud.'
                            : 'AI commands are visual-only.'}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={voiceCoachEnabled}
                      onValueChange={setVoiceCoachEnabled}
                      testID="profile-voice-coach-toggle"
                    />
                  </View>

                  {voiceCoachEnabled ? (
                    <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 12 }}>
                      <Text style={[styles.flagDesc, { marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }]}>
                        Coach voice
                      </Text>
                      <View style={{ gap: 6 }}>
                        <Pressable
                          onPress={() => setSelectedVoiceId(null)}
                          style={[
                            voicePickerStyles.row,
                            selectedVoiceId === null && voicePickerStyles.rowSelected,
                          ]}
                          testID="profile-voice-device"
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={voicePickerStyles.rowLabel}>Device default</Text>
                            <Text style={voicePickerStyles.rowDesc}>Built-in iOS / Android voice. Works offline.</Text>
                          </View>
                          {selectedVoiceId === null ? (
                            <Icon name="check" size={16} color={Colors.states.PEAK.primary} />
                          ) : null}
                        </Pressable>
                        {AFORCE_VOICES.map((v) => {
                          const selected = selectedVoiceId === v.id;
                          return (
                            <Pressable
                              key={v.id}
                              onPress={() => setSelectedVoiceId(v.id)}
                              style={[voicePickerStyles.row, selected && voicePickerStyles.rowSelected]}
                              testID={`profile-voice-${v.label.toLowerCase()}`}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={voicePickerStyles.rowLabel}>
                                  {v.label}
                                  <Text style={voicePickerStyles.rowGender}>
                                    {'  '}· {v.gender === 'male' ? 'M' : 'F'}
                                  </Text>
                                </Text>
                                <Text style={voicePickerStyles.rowDesc}>{v.description}</Text>
                              </View>
                              {selected ? (
                                <Icon name="check" size={16} color={Colors.states.PEAK.primary} />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={[styles.flagDesc, { marginTop: 10, fontSize: 11 }]}>
                        ElevenLabs voices stream from our server. If the network drops, we fall back to your device voice.
                      </Text>

                      {/* AForce Command Voice Engine — intensity picker.
                          Calm = full sentences, Standard = spec phrases
                          (auto-Pressure when DEPLETED), Pressure = forced
                          short sharp lines for every command. */}
                      <Text style={[styles.flagDesc, { marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }]}>
                        Voice intensity
                      </Text>
                      <View style={voicePickerStyles.segmentRow}>
                        {(['calm', 'standard', 'pressure'] as const).map((opt) => {
                          const selected = voiceIntensity === opt;
                          const accent = opt === 'pressure'
                            ? Colors.states.DEPLETED.primary
                            : opt === 'calm'
                              ? Colors.states.BALANCED.primary
                              : Colors.states.PEAK.primary;
                          return (
                            <Pressable
                              key={opt}
                              onPress={() => setVoiceIntensity(opt as VoiceIntensity)}
                              style={[
                                voicePickerStyles.segment,
                                selected && {
                                  borderColor: `${accent}AA`,
                                  backgroundColor: `${accent}1A`,
                                },
                              ]}
                              testID={`profile-voice-intensity-${opt}`}
                            >
                              <Text
                                style={[
                                  voicePickerStyles.segmentLabel,
                                  selected && { color: accent },
                                ]}
                              >
                                {opt.toUpperCase()}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={[styles.flagDesc, { marginTop: 6, fontSize: 11 }]}>
                        {voiceIntensity === 'calm'
                          ? 'Measured Performance Command tone. Full sentences.'
                          : voiceIntensity === 'pressure'
                            ? `${BRAND_LANGUAGE.pressureMode} active. Short, sharp, direct.`
                            : 'Default — spec phrases, auto-engages Pressure Mode when DEPLETED.'}
                      </Text>

                      {/* AForce Command Voice Engine — scope picker.
                          Controls which categories of voice events are
                          allowed to fire. 'muted' is silent at the
                          category gate even if the master toggle is on. */}
                      <Text style={[styles.flagDesc, { marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }]}>
                        When voice plays
                      </Text>
                      <View style={voicePickerStyles.segmentRow}>
                        {(['all', 'risk', 'commands', 'muted'] as const).map((opt) => {
                          const selected = voiceScope === opt;
                          const label =
                            opt === 'all' ? 'ALWAYS'
                              : opt === 'risk' ? 'RISK'
                                : opt === 'commands' ? 'CMDS'
                                  : 'MUTED';
                          const accent = opt === 'muted'
                            ? Colors.text.muted
                            : Colors.states.PEAK.primary;
                          return (
                            <Pressable
                              key={opt}
                              onPress={() => setVoiceScope(opt as VoiceScope)}
                              style={[
                                voicePickerStyles.segment,
                                selected && {
                                  borderColor: `${accent}AA`,
                                  backgroundColor: `${accent}1A`,
                                },
                              ]}
                              testID={`profile-voice-scope-${opt}`}
                            >
                              <Text
                                style={[
                                  voicePickerStyles.segmentLabel,
                                  selected && { color: accent },
                                ]}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={[styles.flagDesc, { marginTop: 6, fontSize: 11 }]}>
                        {voiceScope === 'all' && 'Every voice event — score band, risk timer, commands, completion.'}
                        {voiceScope === 'risk' && 'Score-band crossings + risk-timer alerts only.'}
                        {voiceScope === 'commands' && 'Performance Commands + cycle completion only.'}
                        {voiceScope === 'muted' && 'No voice events. Master toggle stays on for replay.'}
                      </Text>

                      {/* Replay last command — surfaces the same data the
                          Voice Status module on Home shows. */}
                      <Pressable
                        onPress={() => { replayLastCommand(); }}
                        disabled={!getLastCommand()}
                        style={({ pressed }) => [
                          voicePickerStyles.replayBtn,
                          {
                            borderColor: getLastCommand()
                              ? `${Colors.states.PEAK.primary}55`
                              : Colors.border.subtle,
                            backgroundColor: getLastCommand()
                              ? pressed
                                ? `${Colors.states.PEAK.primary}1A`
                                : `${Colors.states.PEAK.primary}10`
                              : 'transparent',
                          },
                        ]}
                        testID="profile-voice-replay"
                      >
                        <Text
                          style={[
                            voicePickerStyles.replayLabel,
                            { color: getLastCommand() ? Colors.states.PEAK.primary : Colors.text.muted },
                          ]}
                        >
                          {getLastCommand() ? 'REPLAY LAST COMMAND' : 'NOTHING TO REPLAY YET'}
                        </Text>
                      </Pressable>

                      {/* Investor Demo launcher — kicks off the 60-second
                          cinematic flow that walks through every Voice
                          Engine state in sequence. Self-contained
                          overlay; never mutates user state. */}
                      <Pressable
                        onPress={() => { setInvestorDemoActive(true); }}
                        style={({ pressed }) => [
                          voicePickerStyles.replayBtn,
                          {
                            marginTop: 10,
                            borderColor: `${Colors.states.PEAK.primary}66`,
                            backgroundColor: pressed
                              ? `${Colors.states.PEAK.primary}1F`
                              : `${Colors.states.PEAK.primary}12`,
                          },
                        ]}
                        testID="profile-investor-demo-launch"
                        accessibilityRole="button"
                        accessibilityLabel="Launch investor demo"
                      >
                        <Text
                          style={[
                            voicePickerStyles.replayLabel,
                            { color: Colors.states.PEAK.primary },
                          ]}
                        >
                          ▶  LAUNCH INVESTOR DEMO · 60s
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </>
            );

            const phaseEntryRow = (
              <View style={styles.phaseRow}>
                <Pressable
                  onPress={() => router.push('/clutch')}
                  style={[styles.phaseCard, { borderColor: `${Colors.clutch.primary}55` }]}
                >
                  <View style={[styles.phaseIcon, { backgroundColor: `${Colors.clutch.primary}1A` }]}>
                    <Icon name="users" size={20} color={Colors.clutch.primary} />
                  </View>
                  <Text style={[styles.phaseTitle, { color: Colors.clutch.primary }]}>CLUTCH</Text>
                  <Text style={styles.phaseDesc}>Command the Team</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/guardian')}
                  style={[styles.phaseCard, { borderColor: `${Colors.guardian.primary}55` }]}
                >
                  <View style={[styles.phaseIcon, { backgroundColor: `${Colors.guardian.primary}1A` }]}>
                    <Icon name="shield" size={20} color={Colors.guardian.primary} />
                  </View>
                  <Text style={[styles.phaseTitle, { color: Colors.guardian.primary }]}>GUARDIAN</Text>
                  <Text style={styles.phaseDesc}>Protect the Roster</Text>
                </Pressable>
              </View>
            );

            const subscriptionBlock = (
              <>
                <SectionHeader label="SUBSCRIPTION" />
                <SubscriptionPanel />
              </>
            );

            const settingsBlock = (
              <>
                <SectionHeader label={t('profile.settings').toUpperCase()} />
                <View style={styles.card}>
                  <View style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
                    <LanguageSelector onPersist={(lang) => setLanguage(lang)} />
                  </View>
                </View>
              </>
            );

            if (layout.isWide) {
              // Two-column wide layout: compact info on the left,
              // tall demo flag list + phase entries + subscription
              // on the right. Roughly balances column heights.
              return (
                <View style={styles.twoCol} testID="profile-two-col">
                  <View style={[styles.col, styles.colLeft]}>
                    {profileCard}
                    {goalsCard}
                    {protocolToolsCard}
                    {hardwareCard}
                    {connectedDevicesCard}
                  </View>
                  <View style={[styles.col, styles.colRight]} testID="profile-right-col">
                    {settingsBlock}
                    {voiceCard}
                    {demoModesCard}
                    {demoAccessCard}
                    {phaseEntryRow}
                    {subscriptionBlock}
                  </View>
                </View>
              );
            }

            return (
              <>
                {profileCard}
                {settingsBlock}
                {voiceCard}
                {goalsCard}
                {protocolToolsCard}
                {hardwareCard}
                {connectedDevicesCard}
                {demoModesCard}
                {demoAccessCard}
                {phaseEntryRow}
                {subscriptionBlock}
              </>
            );
          })()}

          <SignOutRow />

          <Text style={styles.version}>AForce OS v1.0.0 · Phase 1 Core</Text>
          <Text style={styles.patent}>PATENT PENDING</Text>
          <Text style={styles.patentSub}>
            U.S. Provisional Patent Application · Docket AFG-101-US-P{'\n'}
            Closed-Loop Real-Time Physiological Performance Operating System{'\n'}
            and Methods of Use · Filed May 2026
          </Text>
        </ScrollView>
      </GradientBackground>
    </View>
  );
}

/**
 * Account row: shows the signed-in user's email + a sign-out button.
 * Safe: only rendered inside <ClerkProvider> via the root _layout.
 */
function SignOutRow() {
  const auth = useAuth();
  const userHook = useUser();
  if (!auth.isSignedIn) return null;
  const email = userHook.user?.primaryEmailAddress?.emailAddress;
  return (
    <View style={signOutStyles.row}>
      {email && <Text style={signOutStyles.email}>{email}</Text>}
      <Pressable
        onPress={() => {
          Alert.alert('Sign out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => auth.signOut() },
          ]);
        }}
        style={({ pressed }) => [signOutStyles.btn, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Feather name="log-out" size={14} color={Colors.text.primary} />
        <Text style={signOutStyles.btnText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const signOutStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
  },
  email: {
    fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.text.secondary, flex: 1,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.text.primary },
});

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel} accessibilityRole="header">{label}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

function SnapshotCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.snapshotCell}>
      <Text style={styles.snapshotCellLabel}>{label}</Text>
      <Text style={styles.snapshotCellValue}>{value}</Text>
    </View>
  );
}

function SettingRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={16} color={Colors.states.BALANCED.primary} />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function HardwareRow({ name, kind, ledColor, status }: { name: string; kind: string; ledColor: string; status: string }) {
  return (
    <View style={styles.hardwareRow}>
      <View style={[styles.led, { backgroundColor: ledColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.hardwareName}>{name}</Text>
        <Text style={styles.hardwareKind}>{kind}</Text>
      </View>
      <Text style={styles.hardwareStatus}>{status}</Text>
    </View>
  );
}

function FlagRow({
  flag, label, desc, color, state, onToggle,
}: {
  flag: keyof FeatureFlags;
  label: string;
  desc: string;
  color: string;
  state: ReturnType<typeof useAppStore>['state'];
  onToggle: (k: keyof FeatureFlags) => void;
}) {
  const value = state.featureFlags[flag];
  return (
    <View style={styles.flagRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.flagLabel, value && { color }]}>{label}</Text>
        <Text style={styles.flagDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={() => onToggle(flag)}
        trackColor={{ false: Colors.fill.medium, true: color }}
        thumbColor={Colors.text.primary}
        ios_backgroundColor={Colors.fill.medium}
      />
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function SubscriptionPanel() {
  const router = useRouter();
  const { state } = useAppStore();
  const sub = state.subscription;
  const [portalBusy, setPortalBusy] = React.useState(false);

  const onManage = React.useCallback(async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const returnUrl = Linking.createURL('/profile');
      const { url } = await createPortalSession(returnUrl);
      await WebBrowser.openBrowserAsync(url);
      // Pick up plan changes (cancellation, upgrade, payment-method swap)
      // immediately on browser close instead of waiting for the next poll.
      await refreshEntitlement();
    } catch {
      // No Stripe customer yet (user never checked out) — fall through
      // to the in-app management screen which still owns plan-pause /
      // plan-resume for non-Stripe demo flows.
      router.push('/subscription/manage');
    } finally {
      setPortalBusy(false);
    }
  }, [portalBusy, router]);

  const planName = TIER_LABELS[sub.planId]?.label ?? 'AForce';
  const accent =
    sub.planId.startsWith('guardian') ? Colors.guardian.primary :
    sub.planId.startsWith('clutch')   ? Colors.clutch.primary :
    sub.planId === 'system' || sub.planId === 'athlete' ? Colors.states.PEAK.primary :
    Colors.states.BALANCED.primary;
  const statusLabel =
    sub.status === 'active'   ? 'ACTIVE' :
    sub.status === 'trialing' ? 'TRIAL' :
    sub.status === 'paused'   ? 'PAUSED' :
    sub.status === 'past_due' ? 'PAST DUE' : 'CANCELED';

  return (
    <View style={[styles.subscriptionCard, { borderColor: `${accent}33` }]}>
      <View style={styles.subscriptionTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tierName, { color: accent }]}>{planName}</Text>
          <Text style={styles.tierDesc}>
            {sub.product
              ? 'AForce OS + monthly product shipment.'
              : 'AForce OS subscription.'}
          </Text>
        </View>
        <View style={[styles.tierTag, { backgroundColor: `${accent}1A`, borderColor: `${accent}55` }]}>
          <Text style={[styles.tierTagText, { color: accent }]}>{statusLabel}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          style={[styles.upgradeBtn, { borderColor: `${accent}44`, flex: 1, opacity: portalBusy ? 0.6 : 1 }]}
          activeOpacity={0.85}
          onPress={onManage}
          disabled={portalBusy}
          accessibilityRole="button"
          accessibilityLabel="Manage subscription"
          accessibilityState={{ busy: portalBusy, disabled: portalBusy }}
        >
          <Text style={[styles.upgradeBtnText, { color: accent }]}>Manage</Text>
          <Feather name="settings" size={14} color={accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.upgradeBtn, { borderColor: `${accent}44`, flex: 1, backgroundColor: `${accent}10` }]}
          activeOpacity={0.85}
          onPress={() => router.push('/subscription')}
        >
          <Text style={[styles.upgradeBtnText, { color: accent }]}>Upgrade</Text>
          <Feather name="arrow-up-right" size={14} color={accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20 },
  eyebrow: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 3, marginBottom: 4, marginTop: 8,
  },
  title: {
    fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.text.primary,
    letterSpacing: -0.5, marginBottom: 24,
  },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.background.card, borderRadius: 20, borderWidth: 1,
    padding: 20, marginBottom: 28,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  profileInfo: { flex: 1, gap: 8 },
  profileName: {
    fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.3,
  },
  tierBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1,
  },
  tierLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, marginTop: 6,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 2.5,
  },
  sectionHint: {
    fontSize: 10, fontFamily: 'Inter_500Medium', color: Colors.text.secondary, letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.background.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border.subtle, marginBottom: 22, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text.primary },
  settingSubLabel: { fontSize: 11, color: Colors.text.muted, marginTop: 2 },
  settingValue: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.text.secondary },
  divider: { height: 1, backgroundColor: Colors.border.subtle, marginHorizontal: 16 },
  hardwareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  led: { width: 10, height: 10, borderRadius: 5 },
  hardwareName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary },
  hardwareKind: { fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted, marginTop: 2 },
  hardwareStatus: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5,
  },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deviceDot: { width: 7, height: 7, borderRadius: 4 },
  deviceName: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text.primary },
  deviceStatus: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  providerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  providerIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  providerBody: { flex: 1, gap: 2 },
  providerSub: {
    fontSize: 12, color: Colors.text.secondary, fontFamily: 'Inter_400Regular',
  },
  connectPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  connectPillText: {
    fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1.4,
  },
  snapshotBlock: {
    marginHorizontal: 16, marginBottom: 12,
    padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,45,85,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,45,85,0.18)',
    gap: 10,
  },
  snapshotHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  snapshotLabel: {
    fontSize: 10, fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4, color: Colors.text.secondary,
  },
  snapshotGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
  },
  snapshotCell: {
    width: '50%', paddingVertical: 4, gap: 2,
  },
  snapshotCellLabel: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.muted,
  },
  snapshotCellValue: {
    fontSize: 16, fontFamily: 'Inter_700Bold', color: Colors.text.primary,
  },
  flagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.border.subtle,
  },
  flagLabel: {
    fontSize: 14, fontFamily: 'Inter_600SemiBold', color: Colors.text.primary,
  },
  flagDesc: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted, marginTop: 2,
  },
  demoMaster: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, marginHorizontal: 12, marginTop: 12, marginBottom: 4,
    borderRadius: 10, borderWidth: 1,
  },
  demoMasterText: {
    fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1,
  },
  phaseRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  phaseCard: {
    flex: 1, backgroundColor: Colors.background.card, borderRadius: 16,
    borderWidth: 1, padding: 16, alignItems: 'center', gap: 8,
  },
  phaseIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  phaseTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2.5,
  },
  phaseDesc: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: Colors.text.secondary,
  },
  subscriptionCard: {
    backgroundColor: Colors.background.card, borderRadius: 16, borderWidth: 1,
    padding: 20, gap: 16, marginBottom: 22,
  },
  subscriptionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  tierName: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3, marginBottom: 4 },
  tierDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: Colors.text.secondary, lineHeight: 18 },
  tierTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  tierTagText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  upgradeBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  twoCol: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginTop: 4,
  },
  col: { flex: 1 },
  // Slight bias so the (taller) demo flag list on the right gets a
  // touch more breathing room without hard-overriding the layout.
  colLeft: { flex: 0.95 },
  colRight: { flex: 1.05 },
  version: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: Colors.text.muted,
    textAlign: 'center', marginTop: 12, marginBottom: 8,
  },
  patent: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold', color: Colors.text.muted,
    letterSpacing: 2.5, textAlign: 'center', marginTop: 4,
  },
  patentSub: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: Colors.text.muted,
    textAlign: 'center', marginTop: 4, marginBottom: 16, lineHeight: 14,
    opacity: 0.7,
  },
});

const voicePickerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
  },
  rowSelected: {
    borderColor: Colors.states.PEAK.primary,
    backgroundColor: `${Colors.states.PEAK.primary}14`,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.primary,
  },
  rowGender: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.text.muted,
  },
  rowDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.text.muted,
    marginTop: 2,
  },
  // AForce Command Voice Engine — segmented intensity / scope pickers.
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    color: Colors.text.secondary,
  },
  replayBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  replayLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
});
