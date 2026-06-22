/**
 * Profile & Settings — goals, weight, activity type, hardware pairing,
 * subscription tier, and the demo Feature Flag panel that previews
 * Phase 2 (Clutch) and Phase 3 (Guardian).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform, Pressable, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/Icon';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { WhoopSnapshotCard } from '@/components/WhoopSnapshotCard';
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
import { useUnitPreferencesSlice, useProfileIdentitySlice } from '@/store/slices';
import { EditProfileModal } from '@/components/EditProfileModal';
import type { UnitPreferences } from '@/utils/units';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '@/featureFlags/flags';
import type { FeatureFlags, AuraState } from '@/types';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { LanguageSelector } from '@/components/LanguageSelector';
import {
  COACH_MODES,
  setCoachMode,
  useCoachModeSetting,
  type CoachMode,
} from '@/services/coachMode';
import { useTranslation } from 'react-i18next';
import { useAuth, useUser } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { createPortalSession } from '@/lib/api';
import { useGetMyReferralInfo } from '@workspace/api-client-react';
import { openShareSheet } from '@/services/shareService';
import { refreshEntitlement } from '@/hooks/useEntitlement';
import { AFORCE_VOICES } from '@/services/voiceCatalog';
import {
  BRAND_LANGUAGE,
  type VoiceIntensity,
  type VoiceScope,
} from '@/services/voice/commandVoice';
import { replayLastCommand, getLastCommand } from '@/services/voice/commandVoiceBus';
import { useDevMode, setDevMode } from '@/services/devMode';
import { AnalyticsConsentRow } from '@/components/settings/AnalyticsConsentRow';
import { getJsonAforceApi } from '@/services/aforceApiClient';
import {
  getGarminStatus,
  startGarminConnect,
  disconnectGarmin,
  syncGarminSnapshot,
} from '@/services/garmin';
import {
  deriveGarminUiState,
  isLiveGarminState,
  shouldShowGarminDemoSnapshot,
  garminScoreSnapshot,
  type GarminUiState,
} from '@/utils/garminProviderState';
import type { ProviderSnapshot } from '@/types/biometrics';

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
    setUnitPreference,
    setProfileIdentity,
  } = useAppStore();
  const unitPreferences = useUnitPreferencesSlice();
  const coachMode = useCoachModeSetting();
  const profileIdentity = useProfileIdentitySlice();
  const devMode = useDevMode();

  // ──────────────────────────────────────────────────────────────────
  // WHOOP token encryption status — admin-only readout. Hidden behind
  // Developer Mode so it never appears for end users. Fetched lazily
  // when devMode flips on, refreshable via a button. Endpoint is
  // gated server-side by requireAdmin; non-admin callers see 401/403
  // and we surface that as an error string.
  // ──────────────────────────────────────────────────────────────────
  type EncryptionStatus = {
    total: number;
    encrypted: number;
    plaintextOnly: number;
    halfEncrypted: number;
    encryptionKeyConfigured: boolean;
    backfillCronEnabled: boolean;
  };
  const [encStatus, setEncStatus] = useState<EncryptionStatus | null>(null);
  const [encError, setEncError] = useState<string | null>(null);
  const [encLoading, setEncLoading] = useState<boolean>(false);
  const refreshEncStatus = useCallback(async () => {
    setEncLoading(true);
    setEncError(null);
    try {
      const data = await getJsonAforceApi<EncryptionStatus>(
        '/admin/whoop/encryption-status',
      );
      setEncStatus(data);
    } catch (err) {
      setEncError(err instanceof Error ? err.message : 'request failed');
      setEncStatus(null);
    } finally {
      setEncLoading(false);
    }
  }, []);
  useEffect(() => {
    if (devMode) void refreshEncStatus();
  }, [devMode, refreshEncStatus]);
  // Spec #7 — referral loop. Server auto-issues a code on first read,
  // so the hook is fired unconditionally; auth flows through the same
  // bridge the rest of the app uses.
  const referralQ = useGetMyReferralInfo();
  // Edit modal local state — kept in the screen rather than the store
  // so closing the app doesn't leave the modal "open" on next launch.
  const [isEditingProfile, setIsEditingProfile] = useState(false);
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
  // "Real name OR alias" — the user-editable displayName wins over the
  // Clerk-provided name when set. Empty string falls through to Clerk
  // (the auth source of truth) and finally to the mock fixture so the
  // card never renders blank.
  const clerkName = clerkUser?.fullName ?? clerkUser?.firstName ?? mockUserProfile.name;
  const profileIdentityForName = state.profileIdentity;
  const displayName =
    (profileIdentityForName.displayName && profileIdentityForName.displayName.trim()) ||
    clerkName;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const [remindersEnabled, setRemindersEnabled] = useState(mockUserProfile.remindersEnabled);
  // Active group on the premium tab bar. Defaults to PERFORMANCE so the
  // user lands on engine modules / goals on first open.
  const [profileTab, setProfileTab] = useState<ProfileTabId>('performance');
  // Mocked OAuth state for the third-party health platforms shown in
  // the "HEALTH PLATFORMS" card. In a real build, each id would map
  // to its provider SDK / OAuth grant. Here we toggle locally so the
  // UX (LIVE pill / disconnect) is honest about what the user did.
  const [linkedProviders, setLinkedProviders] = useState<Set<HealthProviderId>>(
    () => new Set(),
  );
  // Garmin is the one provider with a REAL backend OAuth flow, so its
  // state is tracked separately from the mocked `linkedProviders` set.
  // Starts 'not_connected'; a mount-time status check corrects it to the
  // server truth ('credentials_missing' when the integration is dormant,
  // 'connected' when this user already authorized). 'demo' is only ever
  // reachable via an explicit opt-in — never from a real connect.
  const [garminState, setGarminState] = useState<GarminUiState>('not_connected');
  // DISPLAY-ONLY demo snapshot for Garmin. Rendered in a clearly-labeled
  // "demo" card and NEVER written into the score-consumed biometrics —
  // Score-Protection is enforced via `garminScoreSnapshot`.
  const [garminDemoSnapshot, setGarminDemoSnapshot] = useState<ProviderSnapshot | null>(null);
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

  // ─── Garmin: real backend OAuth flow ──────────────────────────────────
  // Sync the Garmin connection state from the server. In the current
  // dormant build (no creds configured) this resolves to
  // 'credentials_missing'; once creds land it reflects the real per-user
  // connection. An explicit demo session is never clobbered by a re-check.
  const refreshGarminState = useCallback(async () => {
    try {
      const status = await getGarminStatus();
      // A real `connected` server state ALWAYS wins (deriveGarminUiState),
      // so a stale demo preview is superseded the moment a real connection
      // appears. An explicit demo opt-in is otherwise preserved.
      setGarminState((prev) =>
        deriveGarminUiState({ serverState: status.state, demoOptIn: prev === 'demo' }),
      );
      if (status.state === 'connected') {
        // Real connection supersedes any demo preview; drop the display-only
        // demo snapshot, then pull measured data (the server persists it —
        // no client-side seeding).
        setGarminDemoSnapshot(null);
        await syncGarminSnapshot();
      }
    } catch {
      // Network/unknown error — leave the current state untouched.
    }
  }, []);

  useEffect(() => {
    void refreshGarminState();
  }, [refreshGarminState]);

  // Explicit, clearly-labeled demo opt-in. `deriveGarminUiState` guarantees
  // this can only ever produce the 'demo' state — never a live connection —
  // and only the 'demo' state seeds a snapshot (Score-Protection).
  const seedGarminDemo = () => {
    const next = deriveGarminUiState({
      serverState: 'credentials_missing',
      demoOptIn: true,
    });
    setGarminState(next);
    // DISPLAY-ONLY: the demo snapshot is rendered in a clearly-labeled card.
    const demo = shouldShowGarminDemoSnapshot(next) ? buildDemoSnapshot('garmin') : null;
    setGarminDemoSnapshot(demo);
    // Score-Protection: route the score channel through the gate, which
    // yields null for the demo state — so demo data can never move the orb.
    // (This also clears any stale Garmin contribution from the score.)
    setProviderBiometrics('garmin', garminScoreSnapshot(next, demo));
  };

  const offerGarminDemo = () => {
    const title = 'Garmin Connect isn’t available yet';
    const body =
      'Live Garmin sync ships in a later build. Preview the experience with clearly-labeled demo data? It will not be presented as your real Garmin account.';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) {
        seedGarminDemo();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Preview demo data', onPress: seedGarminDemo },
    ]);
  };

  const handleGarminToggle = async () => {
    if (Platform.OS !== 'web') hapticSelection();

    // ─── Disconnect / leave-demo path ────────────────────────────────
    if (garminState === 'connected' || garminState === 'demo') {
      const wasDemo = garminState === 'demo';
      const performGarminDisconnect = async () => {
        if (wasDemo) {
          // Demo is display-only and never touched the score; just drop
          // the preview card.
          setGarminDemoSnapshot(null);
        } else {
          // A real connection has server-side tokens to clear, plus any
          // locally-cached measured biometrics in the score.
          try { await disconnectGarmin(); } catch { /* best-effort */ }
          setProviderBiometrics('garmin', null);
        }
        setGarminState(wasDemo ? 'credentials_missing' : 'not_connected');
      };
      const msg = wasDemo
        ? 'This clears the Garmin demo preview.'
        : 'AForce will stop pulling biometrics from your Garmin account.';
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(`Disconnect Garmin? ${msg}`)) {
          void performGarminDisconnect();
        }
        return;
      }
      Alert.alert('Disconnect Garmin?', msg, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => void performGarminDisconnect(),
        },
      ]);
      return;
    }

    // ─── Connect path — consult the REAL server status ───────────────
    const status = await getGarminStatus().catch(() => null);
    if (!status) {
      Alert.alert(
        'Garmin unavailable',
        'Could not reach the Garmin service. Please try again later.',
      );
      return;
    }

    if (status.state === 'connected') {
      setGarminState('connected');
      setGarminDemoSnapshot(null);
      try { await syncGarminSnapshot(); } catch { /* best-effort */ }
      return;
    }

    if (status.state === 'not_connected') {
      // Real OAuth — open Garmin's authorize page; the server handles the
      // callback. Re-check status when the user returns.
      const start = await startGarminConnect();
      if (start.status === 'ok') {
        try {
          await WebBrowser.openBrowserAsync(start.authorizeUrl);
        } catch { /* user closed / unsupported */ }
        await refreshGarminState();
        return;
      }
      // Creds vanished between status and start — fall through to demo offer.
    }

    // 'credentials_missing' (dormant build) — offer the labeled demo.
    offerGarminDemo();
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
          {/*
           * Quick jump back to Home. Profile is a tab, so the OS tab
           * bar already lets you switch — but on tall scroll surfaces
           * users repeatedly asked for an in-content way back to the
           * command center without hunting for the tab bar.
           */}
          <Pressable
            onPress={() => {
              // Profile is often reached via the iOS "More" overflow
              // (7 tabs → 5 visible + More), which puts this screen
              // inside the More navigation stack. `router.replace('/(tabs)')`
              // on a group route won't pop that stack, so we pop first
              // when we can and fall back to a root replace otherwise.
              // Same pattern as goHome() in app/(tabs)/social.tsx.
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            style={styles.backHomeBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            testID="profile-back-home"
          >
            <Icon name="chevron-left" size={14} color={Colors.text.secondary} />
            <Text style={styles.backHomeText}>HOME</Text>
          </Pressable>
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.title}>Commander</Text>

          {(() => {
            // ─── Reusable section fragments ──────────────────────
            // Same single-source-of-truth pattern as Home: define
            // the cards once, arrange them as one column on phones
            // or two columns on Fold-open / tablet so neither code
            // path drifts.

            // ── Premium identity card ──
            // Avatar + name + optional handle on the top row, location
            // underneath, then a chip strip below a divider with tier,
            // streak, team/circle, territory badge, and aura. All
            // identity fields after the tier come from the persisted
            // ProfileIdentity slice (edited via the modal); only
            // streakDays remains on mockUserProfile because it's
            // engine-computed from compliance history, not a vanity
            // field. Each chip is gated so the card degrades cleanly
            // when a field is empty.
            const handle = profileIdentity.nickname
              ? `@${profileIdentity.nickname}`
              : null;
            const locationLine = [profileIdentity.city, profileIdentity.country]
              .filter((s) => s.length > 0)
              .join(' · ');
            const auraColor = AURA_COLOR[profileIdentity.auraState];
            // Body-model metric strip (height / weight / recovery goal).
            // Each cell falls back to an em-dash when the field is unset
            // so the row stays visually balanced rather than collapsing.
            const heightLabel = profileIdentity.heightCm != null
              ? `${profileIdentity.heightCm} cm`
              : '—';
            const weightLabel = profileIdentity.bodyWeightLbs != null
              ? `${profileIdentity.bodyWeightLbs} lb`
              : '—';
            const recoveryGoalLabel = profileIdentity.recoveryGoal;
            const hasAvatarImage = profileIdentity.avatarUri.length > 0;
            const profileCard = (
              <View style={[styles.profileCard, { borderColor: `${tier.color}33` }]}>
                <View style={styles.profileCardTop}>
                  {hasAvatarImage ? (
                    <Image
                      source={{ uri: profileIdentity.avatarUri }}
                      style={[styles.avatar, { borderColor: `${tier.color}55` }]}
                      accessibilityIgnoresInvertColors
                      accessibilityLabel="Profile avatar"
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: `${tier.color}20`, borderColor: `${tier.color}55` }]}>
                      <Text style={[styles.avatarText, { color: tier.color }]}>
                        {avatarInitial}
                      </Text>
                    </View>
                  )}
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {handle ? (
                      <Text style={styles.profileHandle} numberOfLines={1}>
                        {handle}
                      </Text>
                    ) : null}
                    {locationLine ? (
                      <View style={styles.profileLocation}>
                        <Icon name="map-pin" size={11} color={Colors.text.muted} />
                        <Text style={styles.profileLocationText} numberOfLines={1}>
                          {locationLine}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => setIsEditingProfile(true)}
                    style={styles.profileEditBtn}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Edit profile identity"
                  >
                    <Icon name="edit-2" size={14} color={Colors.text.secondary} />
                  </Pressable>
                </View>
                <View style={styles.profileChipDivider} />
                <View style={styles.profileChipStrip}>
                  <IdentityChip
                    icon="award"
                    label={tier.label.toUpperCase()}
                    color={tier.color}
                  />
                  {typeof mockUserProfile.streakDays === 'number' && mockUserProfile.streakDays > 0 ? (
                    <IdentityChip
                      icon="zap"
                      label={`${mockUserProfile.streakDays}-DAY STREAK`}
                      color={Colors.states.RECOVERING.primary}
                    />
                  ) : null}
                  {profileIdentity.teamCircle ? (
                    <IdentityChip
                      icon="users"
                      label={profileIdentity.teamCircle.toUpperCase()}
                      color={Colors.accent.secondary}
                    />
                  ) : null}
                  {profileIdentity.territoryBadge ? (
                    <IdentityChip
                      icon="map"
                      label={profileIdentity.territoryBadge}
                      color={Colors.states.BALANCED.primary}
                    />
                  ) : null}
                  <IdentityChip
                    icon="activity"
                    label={`${profileIdentity.auraState} AURA`}
                    color={auraColor}
                  />
                </View>
                <View style={styles.profileMetricStrip}>
                  <View style={styles.profileMetricCell}>
                    <Text style={styles.profileMetricLabel}>HEIGHT</Text>
                    <Text style={styles.profileMetricValue}>{heightLabel}</Text>
                  </View>
                  <View style={styles.profileMetricDivider} />
                  <View style={styles.profileMetricCell}>
                    <Text style={styles.profileMetricLabel}>WEIGHT</Text>
                    <Text style={styles.profileMetricValue}>{weightLabel}</Text>
                  </View>
                  <View style={styles.profileMetricDivider} />
                  <View style={styles.profileMetricCell}>
                    <Text style={styles.profileMetricLabel}>RECOVERY GOAL</Text>
                    <Text
                      style={[styles.profileMetricValue, { color: auraColor }]}
                      numberOfLines={1}
                    >
                      {recoveryGoalLabel}
                    </Text>
                  </View>
                </View>
              </View>
            );

            const inviteCode = referralQ.data?.code ?? null;
            const inviteClaims = referralQ.data?.totalClaims ?? 0;
            const inviteTier = referralQ.data?.tier ?? null;
            const inviteNextTier = referralQ.data?.nextTier ?? null;
            const inviteClaimsToNext = referralQ.data?.claimsToNextTier ?? 0;
            const inviteSubtitle = inviteCode == null
              ? 'Issuing your code…'
              : inviteClaims === 0
                ? 'No one on board yet. Be the first to recruit.'
                : `${inviteClaims} ${inviteClaims === 1 ? 'operator' : 'operators'} on board.`;
            const inviteProgressLine = inviteNextTier
              ? `${inviteClaimsToNext} more to ${inviteNextTier.label}`
              : 'Top of the boards — General rank.';
            const handleShareInvite = async () => {
              if (!inviteCode) return;
              hapticSelection();
              await openShareSheet({
                format: 'text',
                message: `Run AForce OS with me. Use code ${inviteCode}.`,
                url: 'https://aforce.app',
              });
            };
            const handleViewLeaderboard = () => {
              hapticSelection();
              router.push('/leaderboard');
            };
            const inviteCard = (
              <>
                <SectionHeader label="INVITE" hint="Recruit operators to AForce OS" />
                <View style={[styles.card, styles.inviteCard]}>
                  {inviteTier ? (
                    <View style={styles.inviteTierBadge} testID="profile-invite-tier">
                      <Text style={styles.inviteTierLabel}>{inviteTier.label.toUpperCase()}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.inviteEyebrow}>YOUR CODE</Text>
                  <Text
                    style={styles.inviteCodeText}
                    accessibilityLabel={
                      inviteCode ? `Your referral code is ${inviteCode}` : 'Loading referral code'
                    }
                    selectable
                  >
                    {inviteCode ?? '— — — —'}
                  </Text>
                  <Text style={styles.inviteSubtitle}>{inviteSubtitle}</Text>
                  <Text style={styles.inviteProgress} testID="profile-invite-progress">
                    {inviteProgressLine}
                  </Text>
                  <Pressable
                    onPress={handleShareInvite}
                    disabled={!inviteCode}
                    style={({ pressed }) => [
                      styles.inviteShareBtn,
                      !inviteCode && styles.inviteShareBtnDisabled,
                      pressed && styles.inviteShareBtnPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Share invite code"
                    testID="profile-invite-share"
                  >
                    <Icon name="send" size={14} color="#0A0A0F" />
                    <Text style={styles.inviteShareLabel}>SHARE INVITE</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleViewLeaderboard}
                    style={({ pressed }) => [
                      styles.inviteLeaderboardBtn,
                      pressed && styles.inviteLeaderboardBtnPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="View recruiters leaderboard"
                    testID="profile-invite-leaderboard"
                  >
                    <Text style={styles.inviteLeaderboardLabel}>VIEW LEADERBOARD</Text>
                    <Icon name="chevron-right" size={14} color={Colors.text.primary} />
                  </Pressable>
                </View>
              </>
            );

            const goalsCard = (
              <>
                <SectionHeader label="GOALS" />
                <View style={styles.card}>
                  <SettingRow icon="target" label="Daily Target" value={`${mockUserProfile.dailyTarget} units`} />
                  <Divider />
                  <SettingRow icon="droplet" label="Daily Ounces Target" value={`${mockUserProfile.dailyTarget * 12} ounces`} />
                  <Divider />
                  <SettingRow
                    icon="user"
                    label="Body Weight"
                    value={
                      profileIdentity.bodyWeightLbs != null
                        ? `${profileIdentity.bodyWeightLbs} lb`
                        : `${mockUserProfile.bodyWeightLbs} lb`
                    }
                  />
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

            const modulesCard = (
              <>
                <SectionHeader label="MODULES" hint="Every engine module · internal evaluation" />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => router.push('/modules')}
                    testID="profile-modules-link"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="grid" size={16} color="#C1281B" />
                      <View>
                        <Text style={styles.settingLabel}>All Modules</Text>
                        <Text style={styles.settingSubLabel}>
                          Social · Sleep · Cruise · Guardian · Clutch · Phantom · Recovery · Science · Providers · Protocol · Timeline · HydroScan
                        </Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                </View>
              </>
            );

            // Flag-gated public entry to the Weekly Performance Report™.
            // Hidden until `spec_weekly_report` is on (Build 100% · Show 10%);
            // the Modules launcher always lists it for internal evaluation.
            const weeklyReportCard = state.featureFlags.spec_weekly_report ? (
              <>
                <SectionHeader label="WEEKLY REPORT" hint="Your week in review · screenshot & share" />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => router.push('/weekly-report')}
                    testID="profile-weekly-report-link"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="trending-up" size={16} color="#1E5BFF" />
                      <View>
                        <Text style={styles.settingLabel}>Weekly Performance Report</Text>
                        <Text style={styles.settingSubLabel}>
                          What improved · needs attention · habit velocity · next week focus
                        </Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                </View>
              </>
            ) : null;

            const protocolToolsCard = (
              <>
                <SectionHeader label="PROTOCOL TOOLS" />
                <View style={styles.card}>
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
                    onPress={() => router.push('/social-v2')}
                    testID="profile-social-v2-link"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="users" size={16} color="#C1281B" />
                      <View>
                        <Text style={styles.settingLabel}>Social Mode v2 · Preview</Text>
                        <Text style={styles.settingSubLabel}>5-block spec · tap PLAY DEMO inside</Text>
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
                  {[...HEALTH_PROVIDERS].sort((a, b) => a.name.localeCompare(b.name)).map((p, i) => {
                    // Garmin is backed by a REAL OAuth flow: its connection
                    // is driven by `garminState`, not the mocked
                    // `linkedProviders` set. It shows a row whenever it's a
                    // live connection OR an explicit demo session.
                    const isGarmin = p.id === 'garmin';
                    const garminLive = isGarmin && isLiveGarminState(garminState);
                    const garminDemo = isGarmin && garminState === 'demo';
                    const linked = isGarmin
                      ? garminLive || garminDemo
                      : linkedProviders.has(p.id);
                    return (
                      <React.Fragment key={p.id}>
                        <Pressable
                          onPress={() =>
                            isGarmin ? handleGarminToggle() : toggleProvider(p.id, p.name)
                          }
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
                            <Icon name={p.icon} size={16} color={p.brand} />
                          </View>
                          <View style={styles.providerBody}>
                            <Text style={styles.deviceName}>{p.name}</Text>
                            <Text style={styles.providerSub}>{p.pulls}</Text>
                          </View>
                          {garminDemo ? (
                            // Demo is its own labeled pill — neutral info blue,
                            // never the green LIVE treatment.
                            <View
                              style={[
                                styles.connectPill,
                                { borderColor: `${Colors.info}88` },
                              ]}
                            >
                              <Text
                                style={[styles.connectPillText, { color: Colors.info }]}
                              >
                                DEMO
                              </Text>
                            </View>
                          ) : linked ? (
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
                        {garminDemo && garminDemoSnapshot && (
                          <View style={styles.garminDemoBlock}>
                            <Text style={styles.garminDemoLabel}>
                              DEMO DATA — NOT FROM YOUR GARMIN ACCOUNT
                            </Text>
                            <View style={styles.snapshotGrid}>
                              <SnapshotCell
                                label="HRV"
                                value={
                                  garminDemoSnapshot.hrvSdnn != null
                                    ? `${Math.round(garminDemoSnapshot.hrvSdnn)} ms`
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label="Stress"
                                value={
                                  garminDemoSnapshot.stressScore != null
                                    ? `${Math.round(garminDemoSnapshot.stressScore)}`
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label="Workout"
                                value={
                                  garminDemoSnapshot.workoutMinutesToday != null
                                    ? `${Math.round(garminDemoSnapshot.workoutMinutesToday)} min`
                                    : '—'
                                }
                              />
                            </View>
                            <Text style={styles.garminDemoFootnote}>
                              Preview only · does not affect your score
                            </Text>
                          </View>
                        )}
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
                                <Icon
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
                                  Coach {v.label}
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
                        Premium AForce voices, streamed from our server.
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

                      {/* Investor Demo launcher (Phase 10) — kicks off the
                          60-second cinematic flow (six acts × 10s). Gated on
                          `demo_mode_enabled` so it is absent from production
                          navigation; self-contained overlay; never mutates
                          user state (Score-Protection). */}
                      {state.featureFlags.demo_mode_enabled ? (
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
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </>
            );

            // Phase 9 — Feature locks. CLUTCH (`clutch_access_enabled`) and
            // GUARDIAN (`guardian_intelligence_enabled`) are hidden from
            // production navigation until released. Both default to OFF in
            // `featureFlags/flags.ts`; the demo profile flips them ON so
            // investors / coaches can still preview the full stack via the
            // admin toggle. Destination screens additionally wrap their body
            // in <FeatureGate>, so this is defense in depth — first hide the
            // entry, then gate the surface.
            const showClutchEntry = state.featureFlags.clutch_access_enabled;
            const showGuardianEntry = state.featureFlags.guardian_intelligence_enabled;
            const phaseEntryRow = !showClutchEntry && !showGuardianEntry ? null : (
              <View style={styles.phaseRow}>
                {showClutchEntry ? (
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
                ) : null}
                {showGuardianEntry ? (
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
                ) : null}
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
                  <Divider />
                  <UnitPreferenceRow<CoachMode>
                    label="Coach"
                    options={COACH_MODES.map((m) => ({
                      value: m,
                      label: m.charAt(0).toUpperCase() + m.slice(1),
                    }))}
                    selected={coachMode}
                    onSelect={(v) => {
                      void setCoachMode(v);
                    }}
                  />
                  <Divider />
                  <AnalyticsConsentRow />
                </View>
              </>
            );

            // Preferences card — display units for the whole app.
            // Three segmented controls; each writes through to
            // setUnitPreference, which persists to AsyncStorage.
            const preferencesBlock = (
              <>
                <SectionHeader label="PREFERENCES" hint="How values are displayed" />
                <View style={styles.card}>
                  <UnitPreferenceRow
                    label="Weight"
                    options={[
                      { value: 'lbs', label: 'lbs' },
                      { value: 'kg', label: 'kg' },
                    ]}
                    selected={unitPreferences.weight}
                    onSelect={(v) => setUnitPreference('weight', v)}
                  />
                  <Divider />
                  <UnitPreferenceRow
                    label="Height"
                    options={[
                      { value: 'ft', label: 'ft' },
                      { value: 'cm', label: 'cm' },
                    ]}
                    selected={unitPreferences.height}
                    onSelect={(v) => setUnitPreference('height', v)}
                  />
                  <Divider />
                  <UnitPreferenceRow
                    label="Temperature"
                    options={[
                      { value: 'F', label: '°F' },
                      { value: 'C', label: '°C' },
                    ]}
                    selected={unitPreferences.temperature}
                    onSelect={(v) => setUnitPreference('temperature', v)}
                  />
                  <Divider />
                  <UnitPreferenceRow
                    label="Volume"
                    options={[
                      { value: 'oz', label: 'oz' },
                      { value: 'mL', label: 'mL' },
                    ]}
                    selected={unitPreferences.volume}
                    onSelect={(v) => setUnitPreference('volume', v)}
                  />
                </View>
              </>
            );

            const encPct =
              encStatus && encStatus.total > 0
                ? Math.round((encStatus.encrypted / encStatus.total) * 1000) / 10
                : 0;
            const developerBlock = (
              <>
                <SectionHeader label="DEVELOPER" hint="Internal tools · not for production users" />
                <View style={styles.card}>
                  <View style={styles.settingRow} testID="profile-dev-mode">
                    <View style={styles.settingLeft}>
                      <Icon name="settings" size={16} color={Colors.text.secondary} />
                      <View>
                        <Text style={styles.settingLabel}>Developer Mode</Text>
                        <Text style={styles.settingSubLabel}>
                          Adds the legacy Recovery/Cruise tab next to Social
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={devMode}
                      onValueChange={(v) => { void setDevMode(v); }}
                      trackColor={{ false: 'rgba(255,255,255,0.12)', true: '#C1281B' }}
                      thumbColor={Platform.OS === 'android' ? '#0a0014' : undefined}
                      accessibilityLabel="Toggle Developer Mode"
                    />
                  </View>
                </View>

                {devMode && (
                  <View style={styles.card} testID="profile-whoop-encryption-status">
                    <View style={styles.encHeaderRow}>
                      <View style={styles.settingLeft}>
                        <Icon name="shield" size={16} color="#C1281B" />
                        <View>
                          <Text style={styles.settingLabel}>WHOOP token encryption</Text>
                          <Text style={styles.settingSubLabel}>
                            Phase B backfill progress · admin only
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => { void refreshEncStatus(); }}
                        style={styles.encRefreshBtn}
                        accessibilityLabel="Refresh encryption status"
                        testID="profile-whoop-encryption-refresh"
                      >
                        <Text style={styles.encRefreshLabel}>
                          {encLoading ? '…' : 'Refresh'}
                        </Text>
                      </Pressable>
                    </View>

                    {encError ? (
                      <Text style={styles.encError} testID="profile-whoop-encryption-error">
                        {encError}
                      </Text>
                    ) : encStatus ? (
                      <>
                        <View style={styles.encHeroRow}>
                          <Text style={styles.encHeroPct} testID="profile-whoop-encryption-pct">
                            {encPct.toFixed(1)}%
                          </Text>
                          <Text style={styles.encHeroLabel}>
                            {encStatus.encrypted.toLocaleString()} /{' '}
                            {encStatus.total.toLocaleString()} rows encrypted
                          </Text>
                        </View>
                        <View style={styles.encBarTrack}>
                          <View
                            style={[
                              styles.encBarFill,
                              { width: `${Math.min(100, encPct)}%` },
                            ]}
                          />
                        </View>
                        <View style={styles.encStatGrid}>
                          <View style={styles.encStatCell}>
                            <Text style={styles.encStatNum}>
                              {encStatus.plaintextOnly.toLocaleString()}
                            </Text>
                            <Text style={styles.encStatLabel}>plaintext only</Text>
                          </View>
                          <View style={styles.encStatCell}>
                            <Text
                              style={[
                                styles.encStatNum,
                                encStatus.halfEncrypted > 0 && { color: '#FFB800' },
                              ]}
                            >
                              {encStatus.halfEncrypted.toLocaleString()}
                            </Text>
                            <Text style={styles.encStatLabel}>partial</Text>
                          </View>
                          <View style={styles.encStatCell}>
                            <Text style={styles.encStatNum}>
                              {encStatus.encrypted.toLocaleString()}
                            </Text>
                            <Text style={styles.encStatLabel}>encrypted</Text>
                          </View>
                        </View>
                        <View style={styles.encFlagRow}>
                          <Text
                            style={[
                              styles.encFlag,
                              encStatus.encryptionKeyConfigured
                                ? styles.encFlagOn
                                : styles.encFlagOff,
                            ]}
                          >
                            KEY {encStatus.encryptionKeyConfigured ? 'ON' : 'OFF'}
                          </Text>
                          <Text
                            style={[
                              styles.encFlag,
                              encStatus.backfillCronEnabled
                                ? styles.encFlagOn
                                : styles.encFlagOff,
                            ]}
                          >
                            CRON {encStatus.backfillCronEnabled ? 'ON' : 'OFF'}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.settingSubLabel}>
                        {encLoading ? 'Loading…' : 'Tap Refresh to load.'}
                      </Text>
                    )}
                  </View>
                )}
              </>
            );

            const legalBlock = (
              <>
                <SectionHeader label="LEGAL" hint="Terms · privacy · disclaimers" />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => router.push('/legal/terms')}
                    testID="profile-legal-terms"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="file-text" size={16} color={Colors.text.secondary} />
                      <View>
                        <Text style={styles.settingLabel}>Terms of Service</Text>
                        <Text style={styles.settingSubLabel}>How the app works · your account · subscriptions</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/legal/privacy')}
                    testID="profile-legal-privacy"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="shield" size={16} color={Colors.text.secondary} />
                      <View>
                        <Text style={styles.settingLabel}>Privacy Policy</Text>
                        <Text style={styles.settingSubLabel}>What we collect · where it lives · your controls</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/legal/health-disclaimer')}
                    testID="profile-legal-health"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="activity" size={16} color={Colors.text.secondary} />
                      <View>
                        <Text style={styles.settingLabel}>Health Disclaimer</Text>
                        <Text style={styles.settingSubLabel}>Performance tool · not medical advice</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => {
                      Linking.openURL('mailto:support@aforce.com?subject=AForce%20OS%20Support').catch(() => {});
                    }}
                    testID="profile-legal-support"
                    style={styles.settingRow}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="mail" size={16} color={Colors.text.secondary} />
                      <View>
                        <Text style={styles.settingLabel}>Contact Support</Text>
                        <Text style={styles.settingSubLabel}>support@aforce.com · response within 24h</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={Colors.text.muted} />
                  </Pressable>
                </View>
              </>
            );

            // Group sections by tab. Identity (`profileCard`) always renders
            // above the tab bar — it's the user's avatar/tier card, not a
            // group of settings. PhaseEntryRow ships under ACCOUNT so the
            // CLUTCH / GUARDIAN entries live next to subscription tier.
            const tabSections: Record<ProfileTabId, React.ReactNode[]> = {
              performance: [modulesCard, weeklyReportCard, goalsCard, protocolToolsCard, voiceCard, demoModesCard],
              devices: [hardwareCard, connectedDevicesCard],
              account: [inviteCard, subscriptionBlock, phaseEntryRow, settingsBlock, preferencesBlock],
              developer: [demoAccessCard, developerBlock, legalBlock],
            };
            const activeSections = tabSections[profileTab];
            const tabBar = (
              <ProfileTabBar active={profileTab} onChange={setProfileTab} />
            );

            if (layout.isWide) {
              // Two-column wide layout: identity card + tab bar on the
              // left, active tab's sections fill the right column. Keeps
              // the avatar visible while swapping groups.
              return (
                <View style={styles.twoCol} testID="profile-two-col">
                  <View style={[styles.col, styles.colLeft]}>
                    {profileCard}
                    {tabBar}
                  </View>
                  <View style={[styles.col, styles.colRight]} testID="profile-right-col">
                    {activeSections.map((node, i) => (
                      <React.Fragment key={`wide-${profileTab}-${i}`}>{node}</React.Fragment>
                    ))}
                  </View>
                </View>
              );
            }

            return (
              <>
                {profileCard}
                {tabBar}
                {activeSections.map((node, i) => (
                  <React.Fragment key={`narrow-${profileTab}-${i}`}>{node}</React.Fragment>
                ))}
              </>
            );
          })()}

          <SignOutRow />

          <Text style={styles.version}>AForce OS v1.0.0 · Phase 1 Core</Text>
          <Text style={styles.patent}>PATENT PENDING</Text>
          <Text style={styles.patentSub}>
            U.S. Provisional Patent Application No. 64/057,695{'\n'}
            Filed May 5, 2026 · Docket AFG-101-US-P{'\n'}
            Closed-Loop Real-Time Physiological Performance Operating System{'\n'}
            and Methods of Use
          </Text>
        </ScrollView>
      </GradientBackground>
      <EditProfileModal
        visible={isEditingProfile}
        initialValue={profileIdentity}
        onClose={() => setIsEditingProfile(false)}
        onSave={(next) => {
          // Full-payload save: the modal already trims + validates;
          // dispatching the whole record (vs only the diff) keeps the
          // reducer contract simple and makes the persist effect
          // store exactly what the user saw.
          setProfileIdentity(next);
          setIsEditingProfile(false);
        }}
      />
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
        <Icon name="log-out" size={14} color={Colors.text.primary} />
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

// Premium pill tab bar for the Profile screen. Horizontal-scrollable so
// every group label fits on small phones without truncation. Active pill
// uses WHOOP lime fill on black text with a soft glow; inactive pills are
// hairline outlines on the cinematic black canvas.
type ProfileTabId = 'performance' | 'devices' | 'account' | 'developer';
const PROFILE_TABS: ReadonlyArray<{ id: ProfileTabId; label: string }> = [
  { id: 'performance', label: 'PERFORMANCE' },
  { id: 'devices', label: 'DEVICES' },
  { id: 'account', label: 'ACCOUNT' },
  { id: 'developer', label: 'DEVELOPER' },
];

function ProfileTabBar({
  active,
  onChange,
}: {
  active: ProfileTabId;
  onChange: (id: ProfileTabId) => void;
}) {
  return (
    <View style={styles.tabBarWrap} testID="profile-tab-bar">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarRow}
      >
        {PROFILE_TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              onPress={() => onChange(tab.id)}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              testID={`profile-tab-${tab.id}`}
              hitSlop={8}
            >
              <Text
                style={[styles.tabPillLabel, isActive && styles.tabPillLabelActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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

function SettingRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
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

/**
 * Per-aura accent colour used by the identity card chip strip. Kept
 * here (not in theme/colors) because aura semantics are profile-scoped
 * and the palette deliberately reuses the existing state colours so
 * the card never introduces a foreign hue.
 */
const AURA_COLOR: Record<AuraState, string> = {
  IGNITE: Colors.states.DEPLETED.primary,
  FLOW: Colors.states.BALANCED.primary,
  STORM: Colors.accent.secondary,
  CALM: Colors.text.secondary,
  APEX: Colors.states.PEAK.primary,
};

/**
 * Compact identity chip used on the premium profile card. Tinted at
 * 15% fill / 44% border off the supplied colour so a row of mixed
 * chips reads as one consistent surface, never a rainbow.
 */
function IdentityChip({
  icon,
  label,
  color,
}: {
  icon: IconName;
  label: string;
  color: string;
}) {
  return (
    <View
      style={[
        styles.identityChip,
        { backgroundColor: `${color}15`, borderColor: `${color}44` },
      ]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={11} color={color} />
      <Text style={[styles.identityChipLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Two-option segmented control used by the Preferences card. Generic
 * over the value type so the key↔value binding stays sound (the same
 * generic flows through to the parent's `setUnitPreference` call).
 */
function UnitPreferenceRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.unitPrefRow}>
      <Text style={styles.unitPrefLabel}>{label}</Text>
      <View style={styles.unitPrefSegment}>
        {options.map((opt) => {
          const active = opt.value === selected;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => {
                if (!active) onSelect(opt.value);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} ${opt.label}`}
              style={[styles.unitPrefPill, active && styles.unitPrefPillActive]}
            >
              <Text
                style={[
                  styles.unitPrefPillText,
                  active && styles.unitPrefPillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
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
          <Icon name="settings" size={14} color={accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.upgradeBtn, { borderColor: `${accent}44`, flex: 1, backgroundColor: `${accent}10` }]}
          activeOpacity={0.85}
          onPress={() => router.push('/subscription')}
        >
          <Text style={[styles.upgradeBtnText, { color: accent }]}>Upgrade</Text>
          <Icon name="arrow-up-right" size={14} color={accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  content: { paddingHorizontal: 20 },
  backHomeBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 4,
    marginBottom: 12,
  },
  backHomeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.secondary,
    letterSpacing: 1.4,
  },
  eyebrow: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: Colors.text.muted,
    letterSpacing: 3, marginBottom: 4, marginTop: 8,
  },
  title: {
    fontSize: 28, fontFamily: 'Inter_700Bold', color: Colors.text.primary,
    letterSpacing: -0.5, marginBottom: 24,
  },
  profileCard: {
    backgroundColor: Colors.background.card, borderRadius: 20, borderWidth: 1,
    padding: 20, marginBottom: 28, gap: 16,
  },
  profileCardTop: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  profileInfo: { flex: 1, gap: 4 },
  profileName: {
    fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: -0.3,
  },
  profileHandle: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: Colors.accent.primary,
    letterSpacing: 0.2,
  },
  profileLocation: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
  },
  profileLocationText: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.text.muted,
    letterSpacing: 0.3,
  },
  profileEditBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    borderColor: Colors.border.subtle, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background.primary,
  },
  profileChipDivider: {
    height: 1, backgroundColor: Colors.border.subtle,
  },
  profileChipStrip: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  profileMetricStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.background.primary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  profileMetricCell: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  profileMetricDivider: {
    width: 1, backgroundColor: Colors.border.subtle, alignSelf: 'stretch', marginVertical: 4,
  },
  profileMetricLabel: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: Colors.text.muted, letterSpacing: 1.5,
  },
  profileMetricValue: {
    fontSize: 14, fontFamily: 'Inter_700Bold', color: Colors.text.primary, letterSpacing: 0.3,
  },
  identityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
    maxWidth: '100%',
  },
  identityChipLabel: {
    fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, marginTop: 6,
  },
  tabBarWrap: {
    marginTop: 4,
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.subtle,
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    backgroundColor: 'transparent',
  },
  tabPillActive: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
    shadowColor: Colors.accent.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  tabPillLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: Colors.text.muted,
  },
  tabPillLabelActive: {
    color: '#000000',
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
  encHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10,
  },
  encRefreshBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(193,40,27,0.32)',
    backgroundColor: 'rgba(193,40,27,0.08)',
  },
  encRefreshLabel: {
    fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5,
    color: '#C1281B', textTransform: 'uppercase',
  },
  encError: {
    paddingHorizontal: 18, paddingBottom: 16, color: '#FF6B6B',
    fontFamily: 'Inter_400Regular', fontSize: 12,
  },
  encHeroRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 10,
    paddingHorizontal: 18, paddingTop: 4,
  },
  encHeroPct: {
    fontFamily: 'Inter_700Bold', fontSize: 36, color: '#C1281B',
    letterSpacing: -1,
  },
  encHeroLabel: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.text.muted,
    flexShrink: 1,
  },
  encBarTrack: {
    marginHorizontal: 18, marginTop: 10, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  encBarFill: {
    height: '100%', backgroundColor: '#C1281B', borderRadius: 3,
  },
  encStatGrid: {
    flexDirection: 'row', marginTop: 14, paddingHorizontal: 18, gap: 12,
  },
  encStatCell: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  encStatNum: {
    fontFamily: 'Inter_700Bold', fontSize: 18, color: Colors.text.primary,
  },
  encStatLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.2,
    color: Colors.text.muted, textTransform: 'uppercase', marginTop: 2,
  },
  encFlagRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 18,
    paddingTop: 12, paddingBottom: 16,
  },
  encFlag: {
    fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4,
    borderWidth: 1,
  },
  encFlagOn: {
    color: '#C1281B', borderColor: 'rgba(193,40,27,0.4)',
    backgroundColor: 'rgba(193,40,27,0.08)',
  },
  encFlagOff: {
    color: Colors.text.muted, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  inviteCard: {
    paddingHorizontal: 20, paddingVertical: 22, alignItems: 'center', gap: 6,
  },
  inviteEyebrow: {
    fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2.5,
    color: Colors.text.muted, textTransform: 'uppercase',
  },
  inviteCodeText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 30, letterSpacing: 6, color: Colors.text.primary, marginTop: 4,
  },
  inviteSubtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.text.muted,
    marginTop: 4, textAlign: 'center',
  },
  inviteShareBtn: {
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999,
    backgroundColor: Colors.accent.primary, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  inviteShareBtnDisabled: { opacity: 0.4 },
  inviteShareBtnPressed: { opacity: 0.85 },
  inviteShareLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 12, color: '#0A0A0F', letterSpacing: 1.5,
  },
  inviteTierBadge: {
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.accent.primary,
    backgroundColor: 'rgba(193,40,27,0.08)', marginBottom: 4,
  },
  inviteTierLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 2,
    color: Colors.accent.primary,
  },
  inviteProgress: {
    fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.2,
    color: Colors.text.muted, marginTop: 2, textTransform: 'uppercase',
  },
  inviteLeaderboardBtn: {
    marginTop: 12, paddingVertical: 8, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  inviteLeaderboardBtnPressed: { opacity: 0.6 },
  inviteLeaderboardLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.8,
    color: Colors.text.primary,
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
  unitPrefRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  unitPrefLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text.primary },
  unitPrefSegment: {
    flexDirection: 'row',
    backgroundColor: Colors.fill.medium,
    borderRadius: 999,
    padding: 3,
  },
  unitPrefPill: {
    minWidth: 48,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitPrefPillActive: {
    backgroundColor: Colors.accent.primary,
  },
  unitPrefPillText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text.secondary,
    letterSpacing: 0.3,
  },
  unitPrefPillTextActive: {
    color: Colors.text.inverse,
  },
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
  garminDemoBlock: {
    marginHorizontal: 16, marginBottom: 12,
    padding: 12, borderRadius: 12,
    backgroundColor: `${Colors.info}0F`,
    borderWidth: 1, borderColor: `${Colors.info}33`,
    gap: 10,
  },
  garminDemoLabel: {
    fontSize: 10, color: Colors.info, fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  garminDemoFootnote: {
    fontSize: 11, color: Colors.text.muted, fontFamily: 'Inter_400Regular',
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
