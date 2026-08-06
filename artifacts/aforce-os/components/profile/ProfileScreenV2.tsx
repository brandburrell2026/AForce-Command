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
import { Icon, type IconName } from '@/components/Icon';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { WhoopSnapshotCard } from '@/components/WhoopSnapshotCard';
import { af } from '@/theme';
import { AFInlineErrorRow, AFStatPair } from '@/components/ui';
import { ProviderSectionSkeleton } from './ProviderSectionSkeleton';
import { AppleHealthRefreshControl } from './AppleHealthRefreshControl';
import { createAppleRefreshGuard } from './appleRefreshGuard';
import { mockUserProfile } from '@/data/mockData';
import { HEALTH_PROVIDERS, type HealthProviderId } from '@/data/healthProviders';
import { buildDemoSnapshot } from '@/data/providerDemoSnapshots';
import {
  deriveProviderRowStatus,
  healthFlagsFromFeatureFlags,
  providerRowA11yKind,
  PROVIDER_ROW_A11Y_I18N_KEY,
} from '@/utils/health/providerRowStatus';
import {
  isAppleHealthSupported,
  requestAppleHealthPermissions,
  fetchAppleHealthSnapshot,
  type AppleHealthSnapshot,
} from '@/services/appleHealth';
import {
  useUnitPreferencesSlice,
  useProfileIdentitySlice,
  useUserSlice,
  useFlagsSlice,
  useVoiceSettingsSlice,
  useActionsSlice,
  useSubscriptionSlice,
} from '@/store/slices';
import type { AppContextValue } from '@/store/app/types';
import { EditProfileModal } from '@/components/EditProfileModal';
import { ConfidenceChip } from '@/components/ConfidenceChip';
import { profileStrength } from '@/utils/profile/profileStrength';
import type { UnitPreferences } from '@/utils/units';
import { DEFAULT_FLAGS, demoUnlockAllFlags } from '@/featureFlags/flags';
import { resolveInitialFeatureFlags } from '@/featureFlags/internalTestflightOverlay';
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
import { saveProfileVersion } from '@/services/profileSyncService';
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
import { PerformanceMemoryGovernanceCard } from '@/components/settings/PerformanceMemoryGovernanceCard';
import { PersonalResponseLibraryCard } from '@/components/settings/PersonalResponseLibraryCard';
import { DailyLessonCard } from '@/components/settings/DailyLessonCard';
import { ResponseTimelineCard } from '@/components/settings/ResponseTimelineCard';
import { PerformanceIdentityCard } from '@/components/settings/PerformanceIdentityCard';
import { getJsonAforceApi } from '@/services/aforceApiClient';
import {
  getGarminStatus,
  startGarminConnect,
  disconnectGarmin,
  syncGarminSnapshot,
} from '@/services/garmin';
import {
  getWhoopStatus,
  startWhoopConnect,
  disconnectWhoop,
  syncWhoopSnapshot,
  type WhoopConnectionState,
} from '@/services/whoopConnect';
import { fetchServerBiometrics } from '@/services/realApi';
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

// RC-2 — how long the "Checked just now" Apple Health confirmation stays
// visible after a successful refresh before fading back out.
const APPLE_REFRESH_CONFIRMATION_MS = 2500;

// Per-tier accent colours only. Human-readable label/desc live in the
// `profile.v2.tier_*` locale namespace and are resolved at the render
// sites (this const is declared outside any component, so it can't call
// `t()`). The keys here double as the i18n key suffixes (`tier_<key>_label`).
const TIER_LABELS: Record<string, { color: string }> = {
  core:           { color: af.cyan },
  athlete:        { color: af.green },
  system:         { color: af.green },
  team_starter:   { color: af.cyan },
  team_growth:    { color: af.cyan },
  team_pro:       { color: af.cyan },
  clutch_starter: { color: af.cyan },
  clutch_pro:     { color: af.cyan },
  clutch_elite:   { color: af.cyan },
  guardian_core:  { color: af.guardian },
  guardian_elite: { color: af.guardian },
  all_access:     { color: af.green },
};

export function ProfileScreenV2() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // RC-1 W3P2: narrow slice subscriptions replace the single `useAppStore()`
  // facade call this screen used to make — the facade memoizes on the raw
  // reducer state object, so every 1s TICK_TIMER re-rendered this entire
  // 3000+ line screen regardless of which of its many sections (voice
  // settings / health providers / subscription / user profile / feature
  // flags) actually changed. Each slice below only changes identity when its
  // own concern changes.
  const userState = useUserSlice();
  const flags = useFlagsSlice();
  const unitPreferences = useUnitPreferencesSlice();
  const coachMode = useCoachModeSetting();
  const profileIdentity = useProfileIdentitySlice();
  const devMode = useDevMode();
  const { selectedVoiceId, voiceCoachEnabled, voiceIntensity, voiceScope } = useVoiceSettingsSlice();
  const {
    setFeatureFlags, setAppleHealthSnapshot, setProviderBiometrics, setLanguage,
    activateSocialMode, logSocialDrink, deactivateSocialMode,
    setVoiceCoachEnabled, setSelectedVoiceId, setVoiceIntensity, setVoiceScope,
    setInvestorDemoActive,
    setUnitPreference,
    setProfileIdentity,
  } = useActionsSlice<
    Pick<
      AppContextValue,
      | 'setFeatureFlags'
      | 'setAppleHealthSnapshot'
      | 'setProviderBiometrics'
      | 'setLanguage'
      | 'activateSocialMode'
      | 'logSocialDrink'
      | 'deactivateSocialMode'
      | 'setVoiceCoachEnabled'
      | 'setSelectedVoiceId'
      | 'setVoiceIntensity'
      | 'setVoiceScope'
      | 'setInvestorDemoActive'
      | 'setUnitPreference'
      | 'setProfileIdentity'
    >
  >();

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
      setEncError(err instanceof Error ? err.message : t('profile.v2.request_failed'));
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

  const socialActive = !!userState.socialMode?.active;
  const inRecovery = !!userState.socialMode && !userState.socialMode.active && !!userState.socialMode.endedAt;
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
  // `profileIdentity` (ProfileIdentitySlice, already sourced above) — this
  // used to re-read the same data off the `state` facade as a separate
  // `profileIdentityForName` binding.
  const displayName =
    (profileIdentity.displayName && profileIdentity.displayName.trim()) ||
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
  // WHOOP also has a REAL backend OAuth flow — driven by SERVER truth
  // (`/whoop/status`), not the mocked `linkedProviders` set. Starts
  // 'not_connected'; a mount-time status check corrects it ('credentials_missing'
  // when the integration is dormant, 'connected' when this user has a stored
  // token). WHOOP has no demo state — real data only.
  const [whoopState, setWhoopState] = useState<WhoopConnectionState>('not_connected');
  // Token expiry (epoch ms) from /whoop/status — drives the §26 honesty rule
  // that an expired token renders "Needs Attention", never LIVE.
  const [whoopExpiresAt, setWhoopExpiresAt] = useState<number | null>(null);
  // Latest Apple Health snapshot — null until the user grants
  // permission AND the bridge actually returns data. Rendered in a
  // small "Live from Apple Health" panel so the user can see the
  // numbers AForce is pulling.
  const [appleSnapshot, setAppleSnapshot] = useState<AppleHealthSnapshot | null>(null);
  // RC-1 Wave-2B (item 4, audit P1-7) — `fetchAppleHealthSnapshot()` had NO
  // catch at all: a failure here silently left the panel showing nothing
  // (or stale data) with zero feedback, and — since `connectAppleHealth`
  // `await`s this — could surface as an unhandled rejection up the call
  // chain. Caught here now; the existing refresh icon (below, in the JSX)
  // IS the retry affordance this reuses.
  const [appleFetchError, setAppleFetchError] = useState<string | null>(null);
  // RC-2 (TestFlight build 45, founder-reported) — the refresh icon was
  // correctly wired (44pt hit target, RC-1 fix) but gave NO visible
  // feedback: the HealthKit read completes in well under a second and
  // usually returns byte-identical values, so a tap looked like nothing
  // happened. `isRefreshingApple` drives the visible in-flight state (icon
  // → spinner, Pressable disabled+dimmed) in `AppleHealthRefreshControl`.
  const [isRefreshingApple, setIsRefreshingApple] = useState(false);
  // Transient completion feedback — fires on EVERY successful re-read,
  // even when the returned values are byte-identical to what's already on
  // screen. It states that a re-read succeeded, never that new data
  // arrived (truthfulness rule).
  const [appleUpdatedConfirmationVisible, setAppleUpdatedConfirmationVisible] = useState(false);
  // Synchronous duplicate-tap guard (see appleRefreshGuard.ts's header for
  // why a `useState` boolean alone can't do this: two rapid taps can both
  // read the same stale `false` before React commits the first update).
  // Held in a ref so it survives re-renders without itself being reactive.
  const appleRefreshGuardRef = React.useRef(createAppleRefreshGuard());
  const appleConfirmationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (appleConfirmationTimeoutRef.current) clearTimeout(appleConfirmationTimeoutRef.current);
    };
  }, []);

  const refreshAppleSnapshot = React.useCallback(async () => {
    if (!isAppleHealthSupported()) return;
    // Exactly ONE fetch may be in flight at a time — a second tap while
    // one is already running is a no-op, not a queued second fetch.
    if (!appleRefreshGuardRef.current.acquire()) return;
    setIsRefreshingApple(true);
    try {
      const snap = await fetchAppleHealthSnapshot();
      setAppleFetchError(null);
      setAppleSnapshot(snap);
      // Push into the global score so HRV / sleep actually move the orb
      // and show up in the score breakdown. We tag it with fetchedAt so
      // downstream consumers can decide whether to trust it.
      setAppleHealthSnapshot({ ...snap, fetchedAt: Date.now() });
      // Completion feedback — unconditional on success, so it still fires
      // when `snap` is identical to the previous read (the core defect:
      // without this, a no-op-looking successful refresh was
      // indistinguishable from a dead button).
      setAppleUpdatedConfirmationVisible(true);
      if (appleConfirmationTimeoutRef.current) clearTimeout(appleConfirmationTimeoutRef.current);
      appleConfirmationTimeoutRef.current = setTimeout(() => {
        setAppleUpdatedConfirmationVisible(false);
      }, APPLE_REFRESH_CONFIRMATION_MS);
    } catch (err) {
      setAppleFetchError(err instanceof Error ? err.message : t('profile.v2.apple_fetch_failed'));
    } finally {
      // Always releases — on success AND on failure — so the loading state
      // clears and retry can fire a fresh fetch either way.
      appleRefreshGuardRef.current.release();
      setIsRefreshingApple(false);
    }
  }, [setAppleHealthSnapshot, t]);

  const connectAppleHealth = async (): Promise<boolean> => {
    if (!isAppleHealthSupported()) {
      Alert.alert(
        t('profile.v2.apple_native_title'),
        t('profile.v2.apple_native_body'),
      );
      return false;
    }
    const granted = await requestAppleHealthPermissions();
    if (!granted) {
      Alert.alert(
        t('profile.v2.apple_denied_title'),
        t('profile.v2.apple_denied_body'),
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
          ? t('profile.v2.disconnect_apple_msg')
          : t('profile.v2.disconnect_generic_msg');

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
        if (typeof window !== 'undefined' && window.confirm(t('profile.v2.disconnect_confirm', { name, message: disconnectMessage }))) {
          performDisconnect();
        }
        return;
      }

      Alert.alert(t('profile.v2.disconnect_title', { name }), disconnectMessage, [
        { text: t('profile.v2.cancel'), style: 'cancel' },
        { text: t('profile.v2.disconnect'), style: 'destructive', onPress: performDisconnect },
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
      // §26/§9 (RC-L13): this generic path has NO real integration behind it —
      // it is a labeled DEMO opt-in only. It must never seed biometrics into
      // score inputs and never render as a live connection. (WHOOP and Garmin
      // have real OAuth flows handled by their own toggles.)
    };

    const authorizeMessage = t('profile.v2.authorize_message', { name });

    // RN Web: skip the broken multi-button Alert and use window.confirm.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('profile.v2.connect_confirm', { name, message: authorizeMessage }))) {
        performAuthorize();
      }
      return;
    }

    Alert.alert(t('profile.v2.connect_title', { name }), authorizeMessage, [
      { text: t('profile.v2.cancel'), style: 'cancel' },
      { text: t('profile.v2.authorize'), onPress: performAuthorize },
    ]);
  };

  // RC-1 Wave-2B (item 2b) — see `whoopStatusChecked` above; the two
  // together gate the provider-section mount skeleton.
  const [garminStatusChecked, setGarminStatusChecked] = useState(false);

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
    } finally {
      setGarminStatusChecked(true);
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
    const title = t('profile.v2.garmin_soon_title');
    const body = t('profile.v2.garmin_soon_body');
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) {
        seedGarminDemo();
      }
      return;
    }
    Alert.alert(title, body, [
      { text: t('profile.v2.not_now'), style: 'cancel' },
      { text: t('profile.v2.preview_demo_data'), onPress: seedGarminDemo },
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
        ? t('profile.v2.disconnect_garmin_demo_msg')
        : t('profile.v2.disconnect_garmin_msg');
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(t('profile.v2.disconnect_garmin_confirm', { msg }))) {
          void performGarminDisconnect();
        }
        return;
      }
      Alert.alert(t('profile.v2.disconnect_garmin_title'), msg, [
        { text: t('profile.v2.cancel'), style: 'cancel' },
        {
          text: t('profile.v2.disconnect'),
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
        t('profile.v2.garmin_unavailable_title'),
        t('profile.v2.garmin_unavailable_body'),
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

  // RC-1 Wave-2B (item 4, audit P1-7) — this check's `catch` was fully
  // silent ("leave the current state untouched") with zero UI feedback: a
  // network failure here left the row showing a stale/default state
  // forever, with no way for the user to know a retry might help.
  const [whoopStatusError, setWhoopStatusError] = useState<string | null>(null);
  // RC-1 Wave-2B (item 2b) — true until the mount-time WHOOP + Garmin status
  // checks have both settled at least once (success or failure). Gates the
  // provider-section skeleton below. Monotonic — never reset to false.
  const [whoopStatusChecked, setWhoopStatusChecked] = useState(false);

  // ─── WHOOP: real backend OAuth flow ───────────────────────────────────
  // Sync WHOOP connection state from SERVER truth (`/whoop/status`). When
  // connected, pull immediately so the card/score reflect real data.
  const refreshWhoopState = useCallback(async () => {
    try {
      const status = await getWhoopStatus();
      setWhoopStatusError(null);
      setWhoopState(status.state);
      setWhoopExpiresAt(status.expiresAt ?? null);
      if (status.state === 'connected') {
        try { await syncWhoopSnapshot(); } catch { /* best-effort */ }
        // Pull the server's real WHOOP biometrics DIRECTLY and set it. This
        // bypasses the client-keys merge (which drops a server-only key) and the
        // periodic-sync timing, so the card shows real recovery/strain/sleep
        // immediately after connect/refresh instead of staying on "syncing".
        const whoop = (await fetchServerBiometrics())?.whoop;
        if (whoop) setProviderBiometrics('whoop', whoop);
      }
    } catch (err) {
      // Network/unknown — leave the current CONNECTION state untouched
      // (unchanged behavior), but now surface the failure so a retry is
      // possible instead of a silent stale row.
      setWhoopStatusError(err instanceof Error ? err.message : t('profile.v2.whoop_status_failed'));
    } finally {
      setWhoopStatusChecked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshWhoopState();
  }, [refreshWhoopState]);

  // Keep the client-owned WHOOP biometrics key in sync with the connection.
  useEffect(() => {
    if (whoopState === 'connected') {
      // Establish the WHOOP key so the backend-fetched biometrics.whoop
      // (delivered on GET /aforce/state) can flow in. mergeBiometrics is
      // client-keys-authoritative — WITHOUT a client key here it drops the
      // server's real WHOOP snapshot entirely (the card stays "syncing" forever
      // even though the data exists server-side). An EMPTY placeholder
      // (fetchedAt:0, all-null) marks the key; the real server snapshot
      // (positive fetchedAt) supersedes it on the next state sync via
      // freshest-wins. Only seed when absent, so a real snapshot is never
      // clobbered back to the placeholder.
      if (!userState.biometrics?.whoop) {
        setProviderBiometrics('whoop', {
          providerId: 'whoop',
          fetchedAt: 0,
          recoveryPct: null,
          strain: null,
          sleepHoursLastNight: null,
          hrvSdnn: null,
          restingHeartRate: null,
        });
      }
    } else if (userState.biometrics?.whoop) {
      // Not connected → drop any stale WHOOP snapshot so a disconnected (or
      // prior-session/other-user) snapshot can't keep feeding the score or
      // render the panel as connected.
      setProviderBiometrics('whoop', null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whoopState]);

  const handleWhoopToggle = async () => {
    if (Platform.OS !== 'web') hapticSelection();

    // ─── Disconnect ──────────────────────────────────────────────────
    if (whoopState === 'connected') {
      const performWhoopDisconnect = async () => {
        try { await disconnectWhoop(); } catch { /* best-effort */ }
        setProviderBiometrics('whoop', null);
        setWhoopState('not_connected');
        setWhoopExpiresAt(null);
      };
      const msg = t('profile.v2.disconnect_whoop_msg');
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(t('profile.v2.disconnect_whoop_confirm', { msg }))) {
          void performWhoopDisconnect();
        }
        return;
      }
      Alert.alert(t('profile.v2.disconnect_whoop_title'), msg, [
        { text: t('profile.v2.cancel'), style: 'cancel' },
        { text: t('profile.v2.disconnect'), style: 'destructive', onPress: () => void performWhoopDisconnect() },
      ]);
      return;
    }

    // ─── Connect — consult the REAL server status ────────────────────
    const status = await getWhoopStatus().catch(() => null);
    if (!status) {
      Alert.alert(t('profile.v2.whoop_unavailable_title'), t('profile.v2.whoop_unavailable_body'));
      return;
    }
    if (status.state === 'connected') {
      setWhoopState('connected');
      setWhoopExpiresAt(status.expiresAt ?? null);
      try { await syncWhoopSnapshot(); } catch { /* best-effort */ }
      return;
    }
    if (status.state === 'not_connected') {
      // Real OAuth — open WHOOP's authorize page; the server handles the
      // callback (code exchange + token store + initial fetch). Re-check
      // status when the user returns from the browser.
      const start = await startWhoopConnect();
      if (start.status === 'ok') {
        try { await WebBrowser.openBrowserAsync(start.authorizeUrl); } catch { /* closed/unsupported */ }
        await refreshWhoopState();
        return;
      }
    }
    // credentials_missing — WHOOP has no demo path; surface it plainly.
    Alert.alert(t('profile.v2.whoop_unavailable_title'), t('profile.v2.whoop_unconfigured_body'));
  };

  const layout = useResponsiveLayout();

  // RC-1 W3P2 (audit item 7): `HEALTH_PROVIDERS` is a static, module-level
  // constant — re-spreading + re-sorting it on every render (including every
  // stray re-render from an unrelated section of this large screen) was pure
  // waste. Memoized with an empty dep array since the source array never
  // changes at runtime.
  const sortedHealthProviders = React.useMemo(
    () => [...HEALTH_PROVIDERS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 + 84 : insets.bottom + 84;
  const tierKey = mockUserProfile.subscriptionTier;
  const tier = TIER_LABELS[tierKey] ?? TIER_LABELS.core;

  const toggleFlag = (key: keyof FeatureFlags) => {
    setFeatureFlags({ ...flags, [key]: !flags[key] });
  };

  // Compare against the clamped unlock payload so restricted internal-preview
  // flags (Night Out) never make "unlock all" read as incomplete.
  const demoUnlockPayload = demoUnlockAllFlags();
  const allOn = Object.keys(demoUnlockPayload).every((k) => flags[k as keyof FeatureFlags] === demoUnlockPayload[k as keyof FeatureFlags]);

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
            accessibilityLabel={t('profile.v2.back_a11y')}
            testID="profile-back-home"
          >
            <Icon name="chevron-left" size={14} color={af.textSecondary} />
            <Text style={styles.backHomeText}>{t('profile.v2.home')}</Text>
          </Pressable>
          <Text style={styles.eyebrow}>{t('profile.v2.eyebrow')}</Text>
          <Text style={styles.title}>{t('profile.v2.title')}</Text>

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
              ? t('profile.v2.unit_cm', { value: profileIdentity.heightCm })
              : '—';
            const weightLabel = profileIdentity.bodyWeightLbs != null
              ? t('profile.v2.unit_lb', { value: profileIdentity.bodyWeightLbs })
              : '—';
            // §19 (B′): show the Primary Goal; fall back to the legacy
            // recoveryGoal (default 'BALANCE', never null) so a returning
            // user's card never blanks before they set a Primary Goal.
            const recoveryGoalLabel = profileIdentity.primaryGoal ?? profileIdentity.recoveryGoal;
            const hasAvatarImage = profileIdentity.avatarUri.length > 0;
            const profileCard = (
              <View style={[styles.profileCard, { borderColor: `${tier.color}33` }]}>
                <View style={styles.profileCardTop}>
                  {hasAvatarImage ? (
                    <Image
                      source={{ uri: profileIdentity.avatarUri }}
                      style={[styles.avatar, { borderColor: `${tier.color}55` }]}
                      accessibilityIgnoresInvertColors
                      accessibilityLabel={t('profile.v2.avatar_a11y')}
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
                        <Icon name="map-pin" size={11} color={af.textTertiary} />
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
                    accessibilityLabel={t('profile.v2.edit_a11y')}
                  >
                    <Icon name="edit-2" size={14} color={af.textSecondary} />
                  </Pressable>
                </View>
                <View style={styles.profileChipDivider} />
                <View style={styles.profileChipStrip}>
                  <IdentityChip
                    icon="award"
                    label={t(`profile.v2.tier_${tierKey}_label`).toUpperCase()}
                    color={tier.color}
                  />
                  {typeof mockUserProfile.streakDays === 'number' && mockUserProfile.streakDays > 0 ? (
                    <IdentityChip
                      icon="zap"
                      label={t('profile.v2.day_streak', { days: mockUserProfile.streakDays })}
                      color={af.amber}
                    />
                  ) : null}
                  {profileIdentity.teamCircle ? (
                    <IdentityChip
                      icon="users"
                      label={profileIdentity.teamCircle.toUpperCase()}
                      color={af.cyan}
                    />
                  ) : null}
                  {profileIdentity.territoryBadge ? (
                    <IdentityChip
                      icon="map"
                      label={profileIdentity.territoryBadge}
                      color={af.cyan}
                    />
                  ) : null}
                  <IdentityChip
                    icon="activity"
                    label={t('profile.v2.aura', { aura: profileIdentity.auraState })}
                    color={auraColor}
                  />
                </View>
                <View style={styles.profileMetricStrip}>
                  <View style={styles.profileMetricCell}>
                    <Text style={styles.profileMetricLabel}>{t('profile.v2.metric_height')}</Text>
                    <Text style={styles.profileMetricValue}>{heightLabel}</Text>
                  </View>
                  <View style={styles.profileMetricDivider} />
                  <View style={styles.profileMetricCell}>
                    <Text style={styles.profileMetricLabel}>{t('profile.v2.metric_weight')}</Text>
                    <Text style={styles.profileMetricValue}>{weightLabel}</Text>
                  </View>
                  <View style={styles.profileMetricDivider} />
                  <View style={styles.profileMetricCell}>
                    <Text style={styles.profileMetricLabel}>{t('profile.v2.metric_recovery_goal')}</Text>
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
              ? t('profile.v2.invite_issuing')
              : inviteClaims === 0
                ? t('profile.v2.invite_none')
                : t(inviteClaims === 1 ? 'profile.v2.invite_onboard_one' : 'profile.v2.invite_onboard_other', { count: inviteClaims });
            const inviteProgressLine = inviteNextTier
              ? t('profile.v2.invite_more', { count: inviteClaimsToNext, tier: inviteNextTier.label })
              : t('profile.v2.invite_top');
            const handleShareInvite = async () => {
              if (!inviteCode) return;
              hapticSelection();
              await openShareSheet({
                format: 'text',
                message: t('profile.v2.invite_share_msg', { code: inviteCode }),
                url: 'https://aforce.app',
              });
            };
            const handleViewLeaderboard = () => {
              hapticSelection();
              router.push('/leaderboard');
            };
            const inviteCard = (
              <>
                <SectionHeader label={t('profile.v2.invite_label')} hint={t('profile.v2.invite_hint')} />
                <View style={[styles.card, styles.inviteCard]}>
                  {inviteTier ? (
                    <View style={styles.inviteTierBadge} testID="profile-invite-tier">
                      <Text style={styles.inviteTierLabel}>{inviteTier.label.toUpperCase()}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.inviteEyebrow}>{t('profile.v2.your_code')}</Text>
                  <Text
                    style={styles.inviteCodeText}
                    accessibilityLabel={
                      inviteCode ? t('profile.v2.code_a11y', { code: inviteCode }) : t('profile.v2.code_loading_a11y')
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
                    accessibilityLabel={t('profile.v2.share_invite_a11y')}
                    testID="profile-invite-share"
                  >
                    <Icon name="send" size={14} color="#0A0A0F" />
                    <Text style={styles.inviteShareLabel}>{t('profile.v2.share_invite')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleViewLeaderboard}
                    style={({ pressed }) => [
                      styles.inviteLeaderboardBtn,
                      pressed && styles.inviteLeaderboardBtnPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.view_leaderboard_a11y')}
                    testID="profile-invite-leaderboard"
                  >
                    <Text style={styles.inviteLeaderboardLabel}>{t('profile.v2.view_leaderboard')}</Text>
                    <Icon name="chevron-right" size={14} color={af.textPrimary} />
                  </Pressable>
                </View>
              </>
            );

            // §55/Show-10 — Profile Strength (completeness chip). Flag-gated,
            // additive, presentational. Chip is copy-independent (label+opacity).
            const profileStrengthCard = flags.spec_profileStrengthSection ? (
              <>
                <SectionHeader label={t('profile.v2.strength_label')} />
                <View style={styles.card}>
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Icon name="user" size={16} color={af.textSecondary} />
                      <Text style={styles.settingLabel}>{t('profile.v2.profile_completeness')}</Text>
                    </View>
                    <ConfidenceChip {...profileStrength(profileIdentity).chip} a11yContext={t('profile.v2.completeness_a11y_context')} />
                  </View>
                </View>
              </>
            ) : null;

            const goalsCard = (
              <>
                <SectionHeader label={t('profile.v2.goals_label')} />
                <View style={styles.card}>
                  <SettingRow icon="target" label={t('profile.v2.daily_target')} value={t('profile.v2.unit_units', { value: mockUserProfile.dailyTarget })} />
                  <Divider />
                  <SettingRow icon="droplet" label={t('profile.v2.daily_ounces_target')} value={t('profile.v2.unit_ounces', { value: mockUserProfile.dailyTarget * 12 })} />
                  <Divider />
                  <SettingRow
                    icon="user"
                    label={t('profile.v2.body_weight')}
                    value={
                      profileIdentity.bodyWeightLbs != null
                        ? t('profile.v2.unit_lb', { value: profileIdentity.bodyWeightLbs })
                        : t('profile.v2.unit_lb', { value: mockUserProfile.bodyWeightLbs })
                    }
                  />
                  <Divider />
                  <SettingRow icon="activity" label={t('profile.v2.activity_type')} value={mockUserProfile.activityType} />
                  <Divider />
                  <SettingRow icon="sunrise" label={t('profile.v2.wake_time')} value={mockUserProfile.wakeTimeHHMM} />
                  <Divider />
                  <View style={styles.settingRow}>
                    <View style={styles.settingLeft}>
                      <Icon name="bell" size={16} color={af.cyan} />
                      <Text style={styles.settingLabel}>{t('profile.v2.reminders')}</Text>
                    </View>
                    <Switch
                      value={remindersEnabled}
                      onValueChange={setRemindersEnabled}
                      trackColor={{ false: af.surface, true: af.green }}
                      thumbColor={af.textPrimary}
                      ios_backgroundColor={af.surface}
                      accessibilityLabel={t('profile.v2.reminders')}
                    />
                  </View>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/notifications')}
                    testID="profile-notifications-link"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.notif_prefs')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="sliders" size={16} color={af.cyan} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.notif_prefs')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.notif_prefs_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                </View>
              </>
            );

            const modulesCard = (
              <>
                <SectionHeader label={t('profile.v2.modules_label')} hint={t('profile.v2.modules_hint')} />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => router.push('/modules')}
                    testID="profile-modules-link"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.all_modules')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="grid" size={16} color="#C1281B" />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.all_modules')}</Text>
                        <Text style={styles.settingSubLabel}>
                          {t('profile.v2.all_modules_sub')}
                        </Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                </View>
              </>
            );

            // Flag-gated public entry to the Weekly Performance Report™.
            // Hidden until `spec_weekly_report` is on (Build 100% · Show 10%);
            // the Modules launcher always lists it for internal evaluation.
            const weeklyReportCard = flags.spec_weekly_report ? (
              <>
                <SectionHeader label={t('profile.v2.weekly_label')} hint={t('profile.v2.weekly_hint')} />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => router.push('/weekly-report')}
                    testID="profile-weekly-report-link"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.weekly_report')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="trending-up" size={16} color="#1E5BFF" />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.weekly_report')}</Text>
                        <Text style={styles.settingSubLabel}>
                          {t('profile.v2.weekly_report_sub')}
                        </Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                </View>
              </>
            ) : null;

            const protocolToolsCard = (
              <>
                <SectionHeader label={t('profile.v2.protocol_tools_label')} />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => router.push('/sensors')}
                    testID="profile-sensors-link"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.sensor_import')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="upload" size={16} color={af.cyan} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.sensor_import')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.sensor_import_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/cruise')}
                    testID="profile-cruise-link"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.cruise_mode')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="anchor" size={16} color="#00E5FF" />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.cruise_mode')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.cruise_mode_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                  {/* NO-b: the "Social V2" discoverability link was removed —
                      Night Out is reached only through its authorized Protocol
                      entry (restricted flag + internal-preview context). */}
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/achievements')}
                    testID="profile-achievements-link"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.achievements')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="award" size={16} color={af.green} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.achievements')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.achievements_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/science')}
                    testID="profile-science-link"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.science')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="book-open" size={16} color={af.textSecondary} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.science')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.science_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                </View>
              </>
            );

            const hardwareCard = (
              <>
                <SectionHeader label={t('profile.v2.hardware_label')} />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => router.push('/phantom')}
                    testID="profile-phantom-link"
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.hw_phantom_name')}
                  >
                    <HardwareRow
                      name={t('profile.v2.hw_phantom_name')}
                      kind={t('profile.v2.hw_phantom_kind')}
                      ledColor={af.cyan}
                      status={t('profile.v2.hw_manage')}
                    />
                  </Pressable>
                  <Divider />
                  <HardwareRow
                    name={t('profile.v2.hw_clutch_name')}
                    kind={t('profile.v2.hw_clutch_kind')}
                    ledColor={af.cyan}
                    status={t('profile.v2.hw_unpaired')}
                  />
                </View>
              </>
            );

            const connectedDevicesCard = (
              <>
                <SectionHeader label={t('profile.v2.connected_devices_label')} />
                <View style={styles.card}>
                  {mockUserProfile.connectedDevices.map((device, i) => (
                    <React.Fragment key={device}>
                      <View style={styles.deviceRow}>
                        <View style={styles.deviceLeft}>
                          <View style={[styles.deviceDot, { backgroundColor: af.green }]} />
                          <Text style={styles.deviceName}>{device}</Text>
                        </View>
                        <Text style={[styles.deviceStatus, { color: af.green }]}>{t('profile.v2.device_live')}</Text>
                      </View>
                      {i < mockUserProfile.connectedDevices.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </View>
                <SectionHeader label={t('profile.v2.health_platforms_label')} hint={t('profile.v2.health_platforms_hint')} />
                <View style={styles.card}>
                  {/* RC-1 Wave-2B (item 2b) — while the mount-time WHOOP +
                      Garmin status checks are in flight, skeleton the rows
                      instead of rendering them against the 'not_connected'
                      defaults (which could briefly show the wrong status
                      before the real check corrects it). */}
                  {(!whoopStatusChecked || !garminStatusChecked) ? (
                    <ProviderSectionSkeleton count={HEALTH_PROVIDERS.length} />
                  ) : sortedHealthProviders.map((p, i) => {
                    // §26 (RC-L13): the row status comes from the honest
                    // resolver — token presence alone is never "LIVE", an
                    // expired token demotes to Needs Attention, and providers
                    // with no real client wiring (Oura/Strava/Google) can only
                    // ever show a labeled DEMO, never a live connection.
                    const isGarmin = p.id === 'garmin';
                    const isWhoop = p.id === 'whoop';
                    const garminDemo = isGarmin && garminState === 'demo';
                    const row = deriveProviderRowStatus({
                      provider: p.id,
                      platform:
                        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
                      whoopState,
                      whoopExpiresAt,
                      garminLive: isGarmin ? isLiveGarminState(garminState) : undefined,
                      garminDemo,
                      garminCredentialsMissing: isGarmin ? garminState === 'credentials_missing' : undefined,
                      locallyLinked: linkedProviders.has(p.id),
                      appleNativeReady: p.id === 'apple_health' ? isAppleHealthSupported() : undefined,
                      // Foundation 1A — health_* flags govern connectability
                      // (all default OFF; WHOOP keeps its server-credential
                      // gating until the provider-kit cutover in PR 1B).
                      //
                      // RC-1 verdict-pass disclosure (Wave-1 r2, item 8): what
                      // this actually does — `healthFlagsFromFeatureFlags`
                      // projects the current `health_apple_enabled` /
                      // `health_google_connect_enabled` / `health_oura_enabled`
                      // / `health_strava_enabled` / `health_garmin_enabled` /
                      // `health_samsung_direct_enabled` flags into a per-
                      // provider connectability map that `deriveProviderRowStatus`
                      // gates every non-WHOOP provider's row on (see
                      // `utils/health/providerRowStatus.ts`'s `enabled =
                      // f.provider === 'whoop' ? true : f.healthFlags?.[f.provider]
                      // === true`). It is INERT TODAY: every `health_*` flag
                      // defaults OFF (enforced by
                      // `featureFlags/__tests__/healthFlagsDefaultOff.test.ts`),
                      // so `enabled` resolves `false` for every provider this
                      // wiring governs and each row renders exactly as it did
                      // before this was added — no behavior change under
                      // `DEFAULT_FLAGS`. It ENGAGES the moment any one of those
                      // flags flips to `true`: that provider's row immediately
                      // becomes eligible to show a real "Connected" state
                      // instead of being permanently capped at DEMO/Coming
                      // Soon/Approval Pending. This is intentional forward
                      // wiring — cohort/beta rollout work will flip these
                      // flags per-provider without needing a follow-up code
                      // change here; do not revert this wiring as "unused."
                      healthFlags: healthFlagsFromFeatureFlags(flags),
                    });
                    const demoLinked = garminDemo || (!isGarmin && !isWhoop && linkedProviders.has(p.id));
                    const linked = row.live || demoLinked;
                    // A11y fix (Squad-F HIGH #3): the announced label used to be
                    // a blind Connect/Disconnect off `linked` alone, so states
                    // like Approval Pending / Coming Soon / Unsupported / Needs
                    // Attention were inaudible and a screen reader could hear
                    // "Connect WHOOP" on a row where connecting was impossible.
                    // `providerRowA11yKind` mirrors the pill branches below
                    // exactly, so the announced state can never drift from the
                    // rendered one.
                    const rowA11yKind = providerRowA11yKind({ demoLinked, live: row.live, status: row.status });
                    const rowA11yLabel = t(PROVIDER_ROW_A11Y_I18N_KEY[rowA11yKind], { name: p.name });
                    return (
                      <React.Fragment key={p.id}>
                        <Pressable
                          onPress={() =>
                            isGarmin
                              ? handleGarminToggle()
                              : isWhoop
                                ? handleWhoopToggle()
                                : toggleProvider(p.id, p.name)
                          }
                          style={({ pressed }) => [
                            styles.providerRow,
                            pressed && { backgroundColor: `${p.brand}10` },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={rowA11yLabel}
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
                          {demoLinked && !row.live ? (
                            // Demo is its own labeled pill — neutral info blue,
                            // never the green LIVE treatment (§26/§9).
                            <View
                              style={[
                                styles.connectPill,
                                { borderColor: `${af.cyan}88` },
                              ]}
                            >
                              <Text
                                style={[styles.connectPillText, { color: af.cyan }]}
                              >
                                {t('profile.v2.demo_pill')}
                              </Text>
                            </View>
                          ) : row.live ? (
                            <Text
                              style={[styles.deviceStatus, { color: af.green }]}
                            >
                              {t('profile.v2.device_live')}
                            </Text>
                          ) : row.status === 'needs_attention' ? (
                            // Verified link, but the token expired / errored —
                            // honest reconnect prompt, never LIVE (§26).
                            <Text style={[styles.deviceStatus, { color: af.redText }]}>
                              {t('profile.v2.needs_attention')}
                            </Text>
                          ) : row.status === 'approval_pending' ? (
                            // Contrast fix (Squad-F HIGH #6): `${p.brand}AA` text on
                            // the dark surface computed as low as ~1.6:1 for brands
                            // like Samsung blue. Brand color stays on the border
                            // (a non-text, decorative affordance); the label itself
                            // renders in af.textSecondary, which is ~7.4:1 on
                            // af.surface for every provider regardless of brand hue.
                            <View style={[styles.connectPill, { borderColor: `${p.brand}55` }]}>
                              <Text style={[styles.connectPillText, { color: af.textSecondary }]}>
                                {t('profile.v2.approval_pending')}
                              </Text>
                            </View>
                          ) : row.status === 'coming_soon' ? (
                            <View style={[styles.connectPill, { borderColor: `${p.brand}55` }]}>
                              <Text style={[styles.connectPillText, { color: af.textSecondary }]}>
                                {t('profile.v2.coming_soon')}
                              </Text>
                            </View>
                          ) : row.status === 'available_through_health_connect' ? (
                            <View style={[styles.connectPill, { borderColor: `${p.brand}55` }]}>
                              <Text style={[styles.connectPillText, { color: af.textSecondary }]}>
                                {t('profile.v2.via_health_connect')}
                              </Text>
                            </View>
                          ) : row.status === 'unsupported' ? (
                            <Text style={[styles.providerSub]}>
                              {t('profile.v2.unsupported')}
                            </Text>
                          ) : (
                            <View
                              style={[
                                styles.connectPill,
                                { borderColor: `${p.brand}88` },
                              ]}
                            >
                              <Text style={[styles.connectPillText, { color: af.textSecondary }]}>
                                {t('profile.v2.connect_pill')}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                        {garminDemo && garminDemoSnapshot && (
                          <View style={styles.garminDemoBlock}>
                            <Text style={styles.garminDemoLabel}>
                              {t('profile.v2.garmin_demo_label')}
                            </Text>
                            <View style={styles.snapshotGrid}>
                              <SnapshotCell
                                label={t('profile.v2.snap_hrv')}
                                value={
                                  garminDemoSnapshot.hrvSdnn != null
                                    ? t('profile.v2.unit_ms', { value: Math.round(garminDemoSnapshot.hrvSdnn) })
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label={t('profile.v2.snap_stress')}
                                value={
                                  garminDemoSnapshot.stressScore != null
                                    ? `${Math.round(garminDemoSnapshot.stressScore)}`
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label={t('profile.v2.snap_workout')}
                                value={
                                  garminDemoSnapshot.workoutMinutesToday != null
                                    ? t('profile.v2.unit_min', { value: Math.round(garminDemoSnapshot.workoutMinutesToday) })
                                    : '—'
                                }
                              />
                            </View>
                            <Text style={styles.garminDemoFootnote}>
                              {t('profile.v2.garmin_demo_footnote')}
                            </Text>
                          </View>
                        )}
                        {p.id === 'whoop' && linked && (() => {
                          // Real WHOOP snapshot the backend fetched and persisted
                          // (biometrics.whoop, synced via GET /state) — the SAME
                          // payload the score engine consumes, so the panel matches
                          // the orb. No mock: until the first pull lands we show an
                          // honest "syncing" state rather than fabricated numbers.
                          const snap = userState.biometrics?.whoop;
                          const hasData =
                            !!snap &&
                            (snap.recoveryPct != null ||
                              snap.strain != null ||
                              snap.sleepHoursLastNight != null);
                          return (
                            <WhoopSnapshotCard
                              recoveryPct={snap?.recoveryPct ?? null}
                              strain={snap?.strain ?? null}
                              sleepHoursLastNight={snap?.sleepHoursLastNight ?? null}
                              syncing={!hasData}
                            />
                          );
                        })()}
                        {/* RC-1 Wave-2B (item 4, audit P1-7) — the WHOOP
                            status check's catch used to be fully silent.
                            Surfaced here, independent of `linked`, since a
                            failed CHECK (not a failed connection) can happen
                            either way. Retry re-invokes the same
                            refreshWhoopState the mount effect calls. */}
                        {p.id === 'whoop' && whoopStatusError && (
                          <View style={styles.snapshotBlock}>
                            <AFInlineErrorRow
                              message={whoopStatusError}
                              onRetry={() => { void refreshWhoopState(); }}
                              retryLabel={t('common.retry')}
                              testID="profile-whoop-status-error"
                            />
                          </View>
                        )}
                        {p.id === 'apple_health' && linked && appleSnapshot && (
                          <View style={styles.snapshotBlock}>
                            <View style={styles.snapshotHeader}>
                              <Text style={styles.snapshotLabel}>{t('profile.v2.live_apple')}</Text>
                              {/* RC-2 (TestFlight build 45) — the icon was
                                  correctly wired (44pt hit target via
                                  hitSlop, the RC-1 fix above) but gave no
                                  visible feedback. AppleHealthRefreshControl
                                  adds the in-flight spinner, duplicate-tap
                                  guard reflection, completion confirmation,
                                  and press-state feedback; the guard itself
                                  lives in refreshAppleSnapshot. */}
                              <AppleHealthRefreshControl
                                isRefreshing={isRefreshingApple}
                                showUpdatedConfirmation={appleUpdatedConfirmationVisible}
                                onPress={() => { void refreshAppleSnapshot(); }}
                                accessibilityLabel={t('profile.v2.refresh_apple_a11y')}
                                updatedLabel={t('profile.v2.apple_updated_confirmation')}
                                motionEnabled={flags.elite_motion_enabled}
                                testID="profile-apple-refresh"
                              />
                            </View>
                            <View style={styles.snapshotGrid}>
                              <SnapshotCell
                                label={t('profile.v2.snap_resting_hr')}
                                value={
                                  appleSnapshot.restingHeartRate != null
                                    ? t('profile.v2.unit_bpm', { value: Math.round(appleSnapshot.restingHeartRate) })
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label={t('profile.v2.snap_hrv')}
                                value={
                                  appleSnapshot.hrvSdnn != null
                                    ? t('profile.v2.unit_ms', { value: Math.round(appleSnapshot.hrvSdnn) })
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label={t('profile.v2.snap_steps')}
                                value={
                                  appleSnapshot.stepsToday != null
                                    ? Math.round(appleSnapshot.stepsToday).toLocaleString()
                                    : '—'
                                }
                              />
                              <SnapshotCell
                                label={t('profile.v2.snap_sleep')}
                                value={
                                  appleSnapshot.sleepHoursLastNight != null
                                    ? t('profile.v2.unit_h', { value: appleSnapshot.sleepHoursLastNight.toFixed(1) })
                                    : '—'
                                }
                              />
                            </View>
                            {appleFetchError && (
                              <View style={styles.snapshotErrorWrap}>
                                <AFInlineErrorRow
                                  message={appleFetchError}
                                  onRetry={() => { void refreshAppleSnapshot(); }}
                                  retryLabel={t('common.retry')}
                                  testID="profile-apple-fetch-error"
                                />
                              </View>
                            )}
                          </View>
                        )}
                        {/* RC-1 Wave-2B (item 4) — the fetch failed on the VERY
                            first attempt (permission granted, no data ever
                            landed): the block above never mounts because it
                            requires `appleSnapshot`, so this is the only
                            surface for that failure. Same retry affordance
                            (refreshAppleSnapshot), no new logic. */}
                        {p.id === 'apple_health' && linked && !appleSnapshot && appleFetchError && (
                          <View style={styles.snapshotBlock}>
                            <AFInlineErrorRow
                              message={appleFetchError}
                              onRetry={() => { void refreshAppleSnapshot(); }}
                              retryLabel={t('common.retry')}
                              testID="profile-apple-fetch-error-no-snapshot"
                            />
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
                <SectionHeader label={t('profile.v2.demo_access_label')} hint={t('profile.v2.demo_access_hint')} />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => setFeatureFlags(allOn ? resolveInitialFeatureFlags(DEFAULT_FLAGS) : demoUnlockPayload)}
                    style={[styles.demoMaster, { borderColor: allOn ? af.green : af.border }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: allOn }}
                    accessibilityLabel={allOn ? t('profile.v2.lock_all') : t('profile.v2.unlock_all')}
                  >
                    <Icon name={allOn ? 'eye-off' : 'eye'} size={14} color={allOn ? af.green : af.textSecondary} />
                    <Text style={[styles.demoMasterText, { color: allOn ? af.green : af.textPrimary }]}>
                      {allOn ? t('profile.v2.lock_all') : t('profile.v2.unlock_all')}
                    </Text>
                  </Pressable>

                  {/* Dev-only preview entry for the dormant Recovery Coach mode
                      (no home entry is wired yet). __DEV__ is false in release
                      builds, so this never ships. Flips the flag + opens it. */}
                  {__DEV__ ? (
                    <Pressable
                      onPress={() => {
                        setFeatureFlags({ ...flags, spec_recoveryCoach: true });
                        router.push('/recovery-coach');
                      }}
                      style={[styles.demoMaster, { borderColor: af.red, marginTop: 10 }]}
                    >
                      <Icon name="activity" size={14} color={af.red} />
                      <Text style={[styles.demoMasterText, { color: af.redText }]}>
                        {t('profile.v2.preview_recovery_coach')}
                      </Text>
                    </Pressable>
                  ) : null}

                  <FlagRow flag="clutch_access_enabled" label={t('profile.v2.flag_clutch_label')} desc={t('profile.v2.flag_clutch_desc')} color={af.cyan} flags={flags} onToggle={toggleFlag} />
                  <FlagRow flag="clutch_heat_mode_enabled" label={t('profile.v2.flag_heat_label')} desc={t('profile.v2.flag_heat_desc')} color={af.cyan} flags={flags} onToggle={toggleFlag} />
                  <FlagRow flag="clutch_inventory_enabled" label={t('profile.v2.flag_replenish_label')} desc={t('profile.v2.flag_replenish_desc')} color={af.cyan} flags={flags} onToggle={toggleFlag} />
                  <FlagRow flag="clutch_clip_enabled" label={t('profile.v2.flag_clip_label')} desc={t('profile.v2.flag_clip_desc')} color={af.cyan} flags={flags} onToggle={toggleFlag} />

                  <FlagRow flag="guardian_intelligence_enabled" label={t('profile.v2.flag_guardian_label')} desc={t('profile.v2.flag_guardian_desc')} color={af.guardian} flags={flags} onToggle={toggleFlag} />
                  <FlagRow flag="guardian_body_map_enabled" label={t('profile.v2.flag_riskmap_label')} desc={t('profile.v2.flag_riskmap_desc')} color={af.guardian} flags={flags} onToggle={toggleFlag} />
                  <FlagRow flag="guardian_alerts_enabled" label={t('profile.v2.flag_alerts_label')} desc={t('profile.v2.flag_alerts_desc')} color={af.guardian} flags={flags} onToggle={toggleFlag} />

                  <FlagRow flag="phantom_wearable_enabled" label={t('profile.v2.flag_phantom_label')} desc={t('profile.v2.flag_phantom_desc')} color={af.cyan} flags={flags} onToggle={toggleFlag} />
                </View>
              </>
            );

            const demoModesCard = (
              <>
                <SectionHeader label={t('profile.demo_modes.label')} hint={t('profile.demo_modes.hint')} />
                <View style={styles.card}>
                  <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 }}>
                    <Text style={{ color: af.textSecondary, fontSize: 12, lineHeight: 17 }}>
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
                        borderColor: socialActive ? '#9D7CFB' : af.border,
                        opacity: demoBusy && demoBusy !== 'social' ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Icon name="moon" size={14} color={socialActive ? '#9D7CFB' : af.textSecondary} />
                    <Text style={[styles.demoMasterText, { color: socialActive ? '#9D7CFB' : af.textPrimary }]}>
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
                        borderColor: inRecovery ? af.amber : af.border,
                        opacity: demoBusy && demoBusy !== 'recovery' ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Icon name="sun" size={14} color={inRecovery ? af.amber : af.textSecondary} />
                    <Text style={[styles.demoMasterText, { color: inRecovery ? af.amber : af.textPrimary }]}>
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
                        { borderColor: af.border, opacity: demoBusy ? 0.5 : 1 },
                      ]}
                    >
                      <Icon name="x" size={14} color={af.textSecondary} />
                      <Text style={[styles.demoMasterText, { color: af.textPrimary }]}>
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
                        color={voiceCoachEnabled ? af.green : af.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingLabel}>{t('profile.voice_section.row_label')}</Text>
                        <Text style={[styles.flagDesc, { marginTop: 2 }]}>
                          {voiceCoachEnabled
                            ? t('profile.v2.voice_on_desc')
                            : t('profile.v2.voice_off_desc')}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={voiceCoachEnabled}
                      onValueChange={setVoiceCoachEnabled}
                      testID="profile-voice-coach-toggle"
                      accessibilityLabel={t('profile.voice_section.row_label')}
                    />
                  </View>

                  {voiceCoachEnabled ? (
                    <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 12 }}>
                      <Text style={[styles.flagDesc, { marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }]}>
                        {t('profile.v2.coach_voice')}
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
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              accessibilityLabel={t('profile.v2.coach_prefix', { name: v.label })}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={voicePickerStyles.rowLabel}>
                                  {t('profile.v2.coach_prefix', { name: v.label })}
                                  <Text style={voicePickerStyles.rowGender}>
                                    {'  '}· {v.gender === 'male' ? t('profile.v2.voice_m') : t('profile.v2.voice_f')}
                                  </Text>
                                </Text>
                                <Text style={voicePickerStyles.rowDesc}>{v.description}</Text>
                              </View>
                              {selected ? (
                                <Icon name="check" size={16} color={af.green} />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={[styles.flagDesc, { marginTop: 10, fontSize: 11 }]}>
                        {t('profile.v2.voice_premium_desc')}
                      </Text>

                      {/* AForce Command Voice Engine — intensity picker.
                          Calm = full sentences, Standard = spec phrases
                          (auto-Pressure when DEPLETED), Pressure = forced
                          short sharp lines for every command. */}
                      <Text style={[styles.flagDesc, { marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }]}>
                        {t('profile.v2.voice_intensity')}
                      </Text>
                      <View style={voicePickerStyles.segmentRow}>
                        {(['calm', 'standard', 'pressure'] as const).map((opt) => {
                          const selected = voiceIntensity === opt;
                          const accent = opt === 'pressure'
                            ? af.red
                            : opt === 'calm'
                              ? af.cyan
                              : af.green;
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
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              accessibilityLabel={t(`profile.v2.vintensity_${opt}`)}
                            >
                              <Text
                                style={[
                                  voicePickerStyles.segmentLabel,
                                  selected && { color: accent },
                                ]}
                              >
                                {t(`profile.v2.vintensity_${opt}`)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text style={[styles.flagDesc, { marginTop: 6, fontSize: 11 }]}>
                        {voiceIntensity === 'calm'
                          ? t('profile.v2.vintensity_desc_calm')
                          : voiceIntensity === 'pressure'
                            ? t('profile.v2.vintensity_desc_pressure', { mode: BRAND_LANGUAGE.pressureMode })
                            : t('profile.v2.vintensity_desc_standard')}
                      </Text>

                      {/* AForce Command Voice Engine — scope picker.
                          Controls which categories of voice events are
                          allowed to fire. 'muted' is silent at the
                          category gate even if the master toggle is on. */}
                      <Text style={[styles.flagDesc, { marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }]}>
                        {t('profile.v2.when_voice_plays')}
                      </Text>
                      <View style={voicePickerStyles.segmentRow}>
                        {(['all', 'risk', 'commands', 'muted'] as const).map((opt) => {
                          const selected = voiceScope === opt;
                          const label = t(`profile.v2.scope_${opt}`);
                          const accent = opt === 'muted'
                            ? af.textTertiary
                            : af.green;
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
                              accessibilityRole="button"
                              accessibilityState={{ selected }}
                              accessibilityLabel={label}
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
                        {voiceScope === 'all' && t('profile.v2.scope_desc_all')}
                        {voiceScope === 'risk' && t('profile.v2.scope_desc_risk')}
                        {voiceScope === 'commands' && t('profile.v2.scope_desc_commands')}
                        {voiceScope === 'muted' && t('profile.v2.scope_desc_muted')}
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
                              ? `${af.green}55`
                              : af.divider,
                            backgroundColor: getLastCommand()
                              ? pressed
                                ? `${af.green}1A`
                                : `${af.green}10`
                              : 'transparent',
                          },
                        ]}
                        testID="profile-voice-replay"
                      >
                        <Text
                          style={[
                            voicePickerStyles.replayLabel,
                            { color: getLastCommand() ? af.green : af.textTertiary },
                          ]}
                        >
                          {getLastCommand() ? t('profile.v2.replay_last') : t('profile.v2.nothing_to_replay')}
                        </Text>
                      </Pressable>

                      {/* Investor Demo launcher (Phase 10) — kicks off the
                          60-second cinematic flow (six acts × 10s). Gated on
                          `demo_mode_enabled` so it is absent from production
                          navigation; self-contained overlay; never mutates
                          user state (Score-Protection). */}
                      {flags.demo_mode_enabled ? (
                        <Pressable
                          onPress={() => { setInvestorDemoActive(true); }}
                          style={({ pressed }) => [
                            voicePickerStyles.replayBtn,
                            {
                              marginTop: 10,
                              borderColor: `${af.green}66`,
                              backgroundColor: pressed
                                ? `${af.green}1F`
                                : `${af.green}12`,
                            },
                          ]}
                          testID="profile-investor-demo-launch"
                          accessibilityRole="button"
                          accessibilityLabel={t('profile.v2.investor_demo_a11y')}
                        >
                          <Text
                            style={[
                              voicePickerStyles.replayLabel,
                              { color: af.green },
                            ]}
                          >
                            {t('profile.v2.investor_demo_label')}
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
            const showClutchEntry = flags.clutch_access_enabled;
            const showGuardianEntry = flags.guardian_intelligence_enabled;
            const phaseEntryRow = !showClutchEntry && !showGuardianEntry ? null : (
              <View style={styles.phaseRow}>
                {showClutchEntry ? (
                  <Pressable
                    onPress={() => router.push('/clutch')}
                    style={[styles.phaseCard, { borderColor: `${af.cyan}55` }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.phase_clutch_title')}
                  >
                    <View style={[styles.phaseIcon, { backgroundColor: `${af.cyan}1A` }]}>
                      <Icon name="users" size={20} color={af.cyan} />
                    </View>
                    <Text style={[styles.phaseTitle, { color: af.cyan }]}>{t('profile.v2.phase_clutch_title')}</Text>
                    <Text style={styles.phaseDesc}>{t('profile.v2.phase_clutch_desc')}</Text>
                  </Pressable>
                ) : null}
                {showGuardianEntry ? (
                  <Pressable
                    onPress={() => router.push('/guardian')}
                    style={[styles.phaseCard, { borderColor: af.guardianHairline }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.phase_guardian_title')}
                  >
                    <View style={[styles.phaseIcon, { backgroundColor: af.guardianDim }]}>
                      <Icon name="shield" size={20} color={af.guardian} />
                    </View>
                    <Text style={[styles.phaseTitle, { color: af.guardian }]}>{t('profile.v2.phase_guardian_title')}</Text>
                    <Text style={styles.phaseDesc}>{t('profile.v2.phase_guardian_desc')}</Text>
                  </Pressable>
                ) : null}
              </View>
            );

            const subscriptionBlock = (
              <>
                <SectionHeader label={t('profile.v2.subscription_label')} />
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
                    label={t('profile.v2.coach_label')}
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
                  {flags.performance_memory_governance_enabled ? (
                    <>
                      <Divider />
                      <PerformanceMemoryGovernanceCard />
                    </>
                  ) : null}
                  {flags.performance_identity_enabled ? (
                    <>
                      <Divider />
                      <PerformanceIdentityCard />
                    </>
                  ) : null}
                  {flags.adaptive_response_enabled ? (
                    <>
                      <Divider />
                      <PersonalResponseLibraryCard />
                    </>
                  ) : null}
                  {flags.living_performance_enabled ? (
                    <>
                      <Divider />
                      <DailyLessonCard />
                    </>
                  ) : null}
                  {flags.response_timeline_enabled ? (
                    <>
                      <Divider />
                      <ResponseTimelineCard />
                    </>
                  ) : null}
                </View>
              </>
            );

            // Preferences card — display units for the whole app.
            // Three segmented controls; each writes through to
            // setUnitPreference, which persists to AsyncStorage.
            const preferencesBlock = (
              <>
                <SectionHeader label={t('profile.v2.preferences_label')} hint={t('profile.v2.preferences_hint')} />
                <View style={styles.card}>
                  <UnitPreferenceRow
                    label={t('profile.v2.pref_weight')}
                    options={[
                      { value: 'lbs', label: t('profile.v2.pref_lbs') },
                      { value: 'kg', label: t('profile.v2.pref_kg') },
                    ]}
                    selected={unitPreferences.weight}
                    onSelect={(v) => setUnitPreference('weight', v)}
                  />
                  <Divider />
                  <UnitPreferenceRow
                    label={t('profile.v2.pref_height')}
                    options={[
                      { value: 'ft', label: t('profile.v2.pref_ft') },
                      { value: 'cm', label: t('profile.v2.pref_cm') },
                    ]}
                    selected={unitPreferences.height}
                    onSelect={(v) => setUnitPreference('height', v)}
                  />
                  <Divider />
                  <UnitPreferenceRow
                    label={t('profile.v2.pref_temperature')}
                    options={[
                      { value: 'F', label: t('profile.v2.pref_f') },
                      { value: 'C', label: t('profile.v2.pref_c') },
                    ]}
                    selected={unitPreferences.temperature}
                    onSelect={(v) => setUnitPreference('temperature', v)}
                  />
                  <Divider />
                  <UnitPreferenceRow
                    label={t('profile.v2.pref_volume')}
                    options={[
                      { value: 'oz', label: t('profile.v2.pref_oz') },
                      { value: 'mL', label: t('profile.v2.pref_ml') },
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
                <SectionHeader label={t('profile.v2.developer_label')} hint={t('profile.v2.developer_hint')} />
                <View style={styles.card}>
                  <View style={styles.settingRow} testID="profile-dev-mode">
                    <View style={styles.settingLeft}>
                      <Icon name="settings" size={16} color={af.textSecondary} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.developer_mode')}</Text>
                        <Text style={styles.settingSubLabel}>
                          {t('profile.v2.developer_mode_sub')}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={devMode}
                      onValueChange={(v) => { void setDevMode(v); }}
                      trackColor={{ false: 'rgba(255,255,255,0.12)', true: '#C1281B' }}
                      thumbColor={Platform.OS === 'android' ? '#0a0014' : undefined}
                      accessibilityLabel={t('profile.v2.developer_mode_a11y')}
                    />
                  </View>
                </View>

                {devMode && (
                  <View style={styles.card} testID="profile-whoop-encryption-status">
                    <View style={styles.encHeaderRow}>
                      <View style={styles.settingLeft}>
                        <Icon name="shield" size={16} color="#C1281B" />
                        <View>
                          <Text style={styles.settingLabel}>{t('profile.v2.whoop_enc')}</Text>
                          <Text style={styles.settingSubLabel}>
                            {t('profile.v2.whoop_enc_sub')}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => { void refreshEncStatus(); }}
                        style={styles.encRefreshBtn}
                        // RC-1 fix: paddingVertical 6 + a 10pt label was a
                        // ~24pt-tall pill — under the 44pt minimum. hitSlop
                        // 10 brings the effective target to ~44pt without
                        // resizing the visible pill.
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('profile.v2.refresh_enc_a11y')}
                        testID="profile-whoop-encryption-refresh"
                      >
                        <Text style={styles.encRefreshLabel}>
                          {encLoading ? '…' : t('profile.v2.refresh')}
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
                            {t('profile.v2.enc_rows', {
                              encrypted: encStatus.encrypted.toLocaleString(),
                              total: encStatus.total.toLocaleString(),
                            })}
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
                            <Text style={styles.encStatLabel}>{t('profile.v2.enc_plaintext')}</Text>
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
                            <Text style={styles.encStatLabel}>{t('profile.v2.enc_partial')}</Text>
                          </View>
                          <View style={styles.encStatCell}>
                            <Text style={styles.encStatNum}>
                              {encStatus.encrypted.toLocaleString()}
                            </Text>
                            <Text style={styles.encStatLabel}>{t('profile.v2.enc_encrypted')}</Text>
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
                            {t('profile.v2.enc_key', { state: encStatus.encryptionKeyConfigured ? t('profile.v2.on') : t('profile.v2.off') })}
                          </Text>
                          <Text
                            style={[
                              styles.encFlag,
                              encStatus.backfillCronEnabled
                                ? styles.encFlagOn
                                : styles.encFlagOff,
                            ]}
                          >
                            {t('profile.v2.enc_cron', { state: encStatus.backfillCronEnabled ? t('profile.v2.on') : t('profile.v2.off') })}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.settingSubLabel}>
                        {encLoading ? t('profile.v2.enc_loading') : t('profile.v2.enc_tap_refresh')}
                      </Text>
                    )}
                  </View>
                )}
              </>
            );

            const legalBlock = (
              <>
                <SectionHeader label={t('profile.v2.legal_label')} hint={t('profile.v2.legal_hint')} />
                <View style={styles.card}>
                  <Pressable
                    onPress={() => router.push('/legal/terms')}
                    testID="profile-legal-terms"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.terms')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="file-text" size={16} color={af.textSecondary} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.terms')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.terms_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/legal/privacy')}
                    testID="profile-legal-privacy"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.privacy')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="shield" size={16} color={af.textSecondary} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.privacy')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.privacy_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => router.push('/legal/health-disclaimer')}
                    testID="profile-legal-health"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.health_disclaimer')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="activity" size={16} color={af.textSecondary} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.health_disclaimer')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.health_disclaimer_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => {
                      Linking.openURL('mailto:support@aforce.com?subject=AForce%20OS%20Support').catch(() => {});
                    }}
                    testID="profile-legal-support"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.contact_support')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="mail" size={16} color={af.textSecondary} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.contact_support')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.contact_support_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                </View>
              </>
            );

            // Group sections by tab. Identity (`profileCard`) always renders
            // above the tab bar — it's the user's avatar/tier card, not a
            // group of settings. PhaseEntryRow ships under ACCOUNT so the
            // CLUTCH / GUARDIAN entries live next to subscription tier.
            const tabSections: Record<ProfileTabId, React.ReactNode[]> = {
              performance: [profileStrengthCard, modulesCard, weeklyReportCard, goalsCard, protocolToolsCard, voiceCard, demoModesCard],
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

          <Text style={styles.version}>{t('profile.v2.version')}</Text>
          <Text style={styles.patent}>{t('profile.v2.patent_pending')}</Text>
          <Text style={styles.patentSub}>
            {t('profile.v2.patent_sub_1')}{'\n'}
            {t('profile.v2.patent_sub_2')}{'\n'}
            {t('profile.v2.patent_sub_3')}{'\n'}
            {t('profile.v2.patent_sub_4')}
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
          // Adaptive Profile Engine™ (Section 18): a MAJOR body-model change
          // mints a server-side Profile Version™ and recalibrates future
          // recommendations. Local-first / optimistic — the version mint runs
          // async; a failed POST keeps the edit and retries idempotently.
          void saveProfileVersion(next)
            .then((result) => {
              if (result.changeType === 'major') {
                Alert.alert(
                  t('profile.v2.profile_updated_title'),
                  result.synced
                    ? result.explanation || result.confirmation
                    : result.confirmation,
                );
              }
            })
            .catch(() => {
              // saveProfileVersion already swallows network errors into a
              // not-synced result; this guards against unexpected throws.
            });
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
  const { t } = useTranslation();
  const auth = useAuth();
  const userHook = useUser();
  if (!auth.isSignedIn) return null;
  const email = userHook.user?.primaryEmailAddress?.emailAddress;
  return (
    <View style={signOutStyles.row}>
      {email && <Text style={signOutStyles.email}>{email}</Text>}
      <Pressable
        onPress={() => {
          Alert.alert(t('profile.v2.sign_out_title'), t('profile.v2.sign_out_message'), [
            { text: t('profile.v2.cancel'), style: 'cancel' },
            { text: t('profile.v2.sign_out'), style: 'destructive', onPress: () => auth.signOut() },
          ]);
        }}
        style={({ pressed }) => [signOutStyles.btn, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={t('profile.v2.sign_out_a11y')}
      >
        <Icon name="log-out" size={14} color={af.textPrimary} />
        <Text style={signOutStyles.btnText}>{t('profile.v2.sign_out')}</Text>
      </Pressable>
    </View>
  );
}

const signOutStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 12, borderWidth: 1, borderColor: af.divider,
    backgroundColor: af.surface,
  },
  email: {
    fontFamily: 'Inter_500Medium', fontSize: 13, color: af.textSecondary, flex: 1,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: af.divider,
  },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: af.textPrimary },
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
// uses Signal Red fill on black text with a soft glow; inactive pills are
// hairline outlines on the cinematic near-black canvas.
type ProfileTabId = 'performance' | 'devices' | 'account' | 'developer';
// Tab labels live in the `profile.v2.tab_<id>` locale namespace and are
// resolved at the render site (this const is declared outside any
// component, so it can't call `t()`).
const PROFILE_TABS: ReadonlyArray<{ id: ProfileTabId }> = [
  { id: 'performance' },
  { id: 'devices' },
  { id: 'account' },
  { id: 'developer' },
];

function ProfileTabBar({
  active,
  onChange,
}: {
  active: ProfileTabId;
  onChange: (id: ProfileTabId) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.tabBarWrap} testID="profile-tab-bar">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarRow}
      >
        {PROFILE_TABS.map((tab) => {
          const isActive = tab.id === active;
          const tabLabel = t(`profile.v2.tab_${tab.id}`);
          return (
            <Pressable
              key={tab.id}
              onPress={() => onChange(tab.id)}
              style={[styles.tabPill, isActive && styles.tabPillActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tabLabel}
              testID={`profile-tab-${tab.id}`}
              hitSlop={8}
            >
              <Text
                style={[styles.tabPillLabel, isActive && styles.tabPillLabelActive]}
                numberOfLines={1}
              >
                {tabLabel}
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
    <AFStatPair
      label={label}
      value={value}
      direction="column"
      style={styles.snapshotCell}
      labelStyle={styles.snapshotCellLabel}
      valueStyle={styles.snapshotCellValue}
    />
  );
}

function SettingRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={16} color={af.cyan} />
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
  flag, label, desc, color, flags, onToggle,
}: {
  flag: keyof FeatureFlags;
  label: string;
  desc: string;
  color: string;
  flags: FeatureFlags;
  onToggle: (k: keyof FeatureFlags) => void;
}) {
  const value = flags[flag];
  return (
    <View style={styles.flagRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.flagLabel, value && { color }]}>{label}</Text>
        <Text style={styles.flagDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={() => onToggle(flag)}
        trackColor={{ false: af.surface, true: color }}
        thumbColor={af.textPrimary}
        ios_backgroundColor={af.surface}
        accessibilityLabel={label}
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
  IGNITE: af.red,
  FLOW: af.cyan,
  STORM: af.cyan,
  CALM: af.textSecondary,
  APEX: af.green,
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
  const { t } = useTranslation();
  const router = useRouter();
  const sub = useSubscriptionSlice();
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

  const planName = TIER_LABELS[sub.planId] ? t(`profile.v2.tier_${sub.planId}_label`) : t('profile.v2.tier_fallback');
  const accent =
    sub.planId.startsWith('guardian') ? af.guardian :
    sub.planId.startsWith('clutch')   ? af.cyan :
    sub.planId === 'system' || sub.planId === 'athlete' ? af.green :
    af.cyan;
  const statusLabel =
    sub.status === 'active'   ? t('profile.v2.status_active') :
    sub.status === 'trialing' ? t('profile.v2.status_trial') :
    sub.status === 'paused'   ? t('profile.v2.status_paused') :
    sub.status === 'past_due' ? t('profile.v2.status_past_due') : t('profile.v2.status_canceled');

  return (
    <View style={[styles.subscriptionCard, { borderColor: `${accent}33` }]}>
      <View style={styles.subscriptionTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tierName, { color: accent }]}>{planName}</Text>
          <Text style={styles.tierDesc}>
            {sub.product
              ? t('profile.v2.tier_desc_product')
              : t('profile.v2.tier_desc_sub')}
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
          accessibilityLabel={t('profile.v2.manage_a11y')}
          accessibilityState={{ busy: portalBusy, disabled: portalBusy }}
        >
          <Text style={[styles.upgradeBtnText, { color: accent }]}>{t('profile.v2.manage')}</Text>
          <Icon name="settings" size={14} color={accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.upgradeBtn, { borderColor: `${accent}44`, flex: 1, backgroundColor: `${accent}10` }]}
          activeOpacity={0.85}
          onPress={() => router.push('/subscription')}
          accessibilityRole="button"
          accessibilityLabel={t('profile.v2.upgrade')}
        >
          <Text style={[styles.upgradeBtnText, { color: accent }]}>{t('profile.v2.upgrade')}</Text>
          <Icon name="arrow-up-right" size={14} color={accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
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
    color: af.textSecondary,
    letterSpacing: 1.4,
  },
  eyebrow: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: af.textTertiary,
    letterSpacing: 3, marginBottom: 4, marginTop: 8,
  },
  title: {
    fontSize: 28, fontFamily: 'Inter_700Bold', color: af.textPrimary,
    letterSpacing: -0.5, marginBottom: 24,
  },
  profileCard: {
    backgroundColor: af.surface, borderRadius: 20, borderWidth: 1,
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
    fontSize: 20, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: -0.3,
  },
  profileHandle: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: af.redText,
    letterSpacing: 0.2,
  },
  profileLocation: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
  },
  profileLocationText: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: af.textTertiary,
    letterSpacing: 0.3,
  },
  profileEditBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    borderColor: af.divider, alignItems: 'center', justifyContent: 'center',
    backgroundColor: af.canvas,
  },
  profileChipDivider: {
    height: 1, backgroundColor: af.divider,
  },
  profileChipStrip: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  profileMetricStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: af.canvas,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: af.divider,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  profileMetricCell: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  profileMetricDivider: {
    width: 1, backgroundColor: af.divider, alignSelf: 'stretch', marginVertical: 4,
  },
  profileMetricLabel: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 1.5,
  },
  profileMetricValue: {
    fontSize: 14, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: 0.3,
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
    borderBottomColor: af.divider,
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
    borderColor: af.divider,
    backgroundColor: 'transparent',
  },
  tabPillActive: {
    backgroundColor: af.red,
    borderColor: af.red,
    shadowColor: af.red,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  tabPillLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: af.textTertiary,
  },
  tabPillLabelActive: {
    color: '#000000',
  },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 2.5,
  },
  sectionHint: {
    fontSize: 10, fontFamily: 'Inter_500Medium', color: af.textSecondary, letterSpacing: 0.5,
  },
  card: {
    backgroundColor: af.surface, borderRadius: 16, borderWidth: 1,
    borderColor: af.divider, marginBottom: 22, overflow: 'hidden',
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
    // af.red (#C1281B) as TEXT measures ~3.3:1 on dark surfaces — under AA.
    // af.redText is the AA-verified red for text/icon color (RC-1 fix).
    color: af.redText, textTransform: 'uppercase',
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
    // af.red as TEXT fails AA (~3.3:1); af.redText is the AA-verified swap.
    fontFamily: 'Inter_700Bold', fontSize: 36, color: af.redText,
    letterSpacing: -1,
  },
  encHeroLabel: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: af.textTertiary,
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
    borderWidth: 1, borderColor: af.divider,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  encStatNum: {
    fontFamily: 'Inter_700Bold', fontSize: 18, color: af.textPrimary,
  },
  encStatLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 1.2,
    color: af.textTertiary, textTransform: 'uppercase', marginTop: 2,
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
    // Text color only — af.red as TEXT fails AA (~3.3:1); border/background
    // fills stay the brand red, unaffected by this fix.
    color: af.redText, borderColor: 'rgba(193,40,27,0.4)',
    backgroundColor: 'rgba(193,40,27,0.08)',
  },
  encFlagOff: {
    color: af.textTertiary, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  inviteCard: {
    paddingHorizontal: 20, paddingVertical: 22, alignItems: 'center', gap: 6,
  },
  inviteEyebrow: {
    fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2.5,
    color: af.textTertiary, textTransform: 'uppercase',
  },
  inviteCodeText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 30, letterSpacing: 6, color: af.textPrimary, marginTop: 4,
  },
  inviteSubtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: af.textTertiary,
    marginTop: 4, textAlign: 'center',
  },
  inviteShareBtn: {
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 999,
    backgroundColor: af.red, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  inviteShareBtnDisabled: { opacity: 0.4 },
  inviteShareBtnPressed: { opacity: 0.85 },
  inviteShareLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 12, color: '#0A0A0F', letterSpacing: 1.5,
  },
  inviteTierBadge: {
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
    borderWidth: 1, borderColor: af.red,
    backgroundColor: 'rgba(193,40,27,0.08)', marginBottom: 4,
  },
  inviteTierLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 2,
    color: af.redText,
  },
  inviteProgress: {
    fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 1.2,
    color: af.textTertiary, marginTop: 2, textTransform: 'uppercase',
  },
  inviteLeaderboardBtn: {
    marginTop: 12, paddingVertical: 8, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  inviteLeaderboardBtnPressed: { opacity: 0.6 },
  inviteLeaderboardLabel: {
    fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.8,
    color: af.textPrimary,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: af.textPrimary },
  settingSubLabel: { fontSize: 11, color: af.textTertiary, marginTop: 2 },
  settingValue: { fontSize: 14, fontFamily: 'Inter_500Medium', color: af.textSecondary },
  divider: { height: 1, backgroundColor: af.divider, marginHorizontal: 16 },
  unitPrefRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  unitPrefLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', color: af.textPrimary },
  unitPrefSegment: {
    flexDirection: 'row',
    backgroundColor: af.surface,
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
    backgroundColor: af.red,
  },
  unitPrefPillText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: af.textSecondary,
    letterSpacing: 0.3,
  },
  unitPrefPillTextActive: {
    color: af.onRed,
  },
  hardwareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  led: { width: 10, height: 10, borderRadius: 5 },
  hardwareName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: af.textPrimary },
  hardwareKind: { fontSize: 11, fontFamily: 'Inter_400Regular', color: af.textTertiary, marginTop: 2 },
  hardwareStatus: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 1.5,
  },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deviceDot: { width: 7, height: 7, borderRadius: 4 },
  deviceName: { fontSize: 15, fontFamily: 'Inter_500Medium', color: af.textPrimary },
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
    fontSize: 12, color: af.textSecondary, fontFamily: 'Inter_400Regular',
  },
  garminDemoBlock: {
    marginHorizontal: 16, marginBottom: 12,
    padding: 12, borderRadius: 12,
    backgroundColor: `${af.cyan}0F`,
    borderWidth: 1, borderColor: `${af.cyan}33`,
    gap: 10,
  },
  garminDemoLabel: {
    fontSize: 10, color: af.cyan, fontFamily: 'Inter_700Bold',
    letterSpacing: 1.2,
  },
  garminDemoFootnote: {
    fontSize: 11, color: af.textTertiary, fontFamily: 'Inter_400Regular',
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
    letterSpacing: 1.4, color: af.textSecondary,
  },
  snapshotGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
  },
  snapshotCell: {
    width: '50%', paddingVertical: 4, gap: 2,
  },
  snapshotCellLabel: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: af.textTertiary,
  },
  snapshotCellValue: {
    fontSize: 16, fontFamily: 'Inter_700Bold', color: af.textPrimary,
  },
  snapshotErrorWrap: { marginTop: 2 },
  flagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: af.divider,
  },
  flagLabel: {
    fontSize: 14, fontFamily: 'Inter_600SemiBold', color: af.textPrimary,
  },
  flagDesc: {
    fontSize: 11, fontFamily: 'Inter_400Regular', color: af.textTertiary, marginTop: 2,
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
    flex: 1, backgroundColor: af.surface, borderRadius: 16,
    borderWidth: 1, padding: 16, alignItems: 'center', gap: 8,
  },
  phaseIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  phaseTitle: {
    fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2.5,
  },
  phaseDesc: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: af.textSecondary,
  },
  subscriptionCard: {
    backgroundColor: af.surface, borderRadius: 16, borderWidth: 1,
    padding: 20, gap: 16, marginBottom: 22,
  },
  subscriptionTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  tierName: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3, marginBottom: 4 },
  tierDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: af.textSecondary, lineHeight: 18 },
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
    fontSize: 11, fontFamily: 'Inter_400Regular', color: af.textTertiary,
    textAlign: 'center', marginTop: 12, marginBottom: 8,
  },
  patent: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold', color: af.textTertiary,
    letterSpacing: 2.5, textAlign: 'center', marginTop: 4,
  },
  patentSub: {
    fontSize: 10, fontFamily: 'Inter_400Regular', color: af.textTertiary,
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
    borderColor: af.divider,
    backgroundColor: af.canvasElevated,
  },
  rowSelected: {
    borderColor: af.green,
    backgroundColor: `${af.green}14`,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: af.textPrimary,
  },
  rowGender: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: af.textTertiary,
  },
  rowDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: af.textTertiary,
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
    borderColor: af.divider,
    backgroundColor: af.canvasElevated,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    color: af.textSecondary,
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
