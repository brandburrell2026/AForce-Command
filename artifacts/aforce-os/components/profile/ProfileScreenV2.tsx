/**
 * Profile & Settings — goals, weight, activity type, hardware pairing,
 * subscription tier, and the demo Feature Flag panel that previews
 * Phase 2 (Clutch) and Phase 3 (Guardian).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { hapticSelection } from '@/services/haptics';
import {
  View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform, Pressable, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useRouter } from 'expo-router';

import { GradientBackground } from '@/components/GradientBackground';
import { WhoopSnapshotCard } from '@/components/WhoopSnapshotCard';
import { af } from '@/theme';
import {
  SignOutRow,
  SectionHeader,
  ProfileTabBar,
  SnapshotCell,
  SettingRow,
  HardwareRow,
  FlagRow,
  Divider,
  IdentityChip,
  UnitPreferenceRow,
  SubscriptionPanel,
  TIER_LABELS,
  PROFILE_TABS,
  VISIBLE_PROFILE_TABS,
  styles,
  AURA_COLOR,
  voicePickerStyles,
  type ProfileTabId,
} from './profileKit';
import { AFInlineErrorRow, AFStatPair } from '@/components/ui';
import { ProviderSectionSkeleton } from './ProviderSectionSkeleton';
import { AppleHealthRefreshControl } from './AppleHealthRefreshControl';
import { AppleHealthDiagnosticsSection } from './AppleHealthDiagnosticsSection';
import { createAppleRefreshGuard } from './appleRefreshGuard';
import { INTERNAL_TESTFLIGHT_OVERLAY_ENABLED } from '@/featureFlags/internalTestflightOverlay';
import {
  getLastAppleHealthDiagnostics,
  type AppleHealthDiagnosticsSnapshot,
} from '@/services/appleHealthDiagnostics';
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
import { DEFAULT_FLAGS, demoUnlockAllFlags, developerControlsAvailable } from '@/featureFlags/flags';
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

// RC-2 — how long the "Checked just now" Apple Health confirmation stays
// visible after a successful refresh before fading back out. (Ruling E,
// item 1: Home's own freshness copy was unified onto THIS verb — see
// components/home/homeFreshness.ts's header for why "Checked," not
// "Updated," is the honest choice for both surfaces.)
const APPLE_REFRESH_CONFIRMATION_MS = 2500;

// Per-tier accent colours only. Human-readable label/desc live in the
// `profile.v2.tier_*` locale namespace and are resolved at the render
// sites (this const is declared outside any component, so it can't call
// `t()`). The keys here double as the i18n key suffixes (`tier_<key>_label`).

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

  // Real Clerk identity for the profile header. S2-2 (production truth):
  // every former `mockUserProfile` read on this screen now resolves real
  // canonical state or an honest not-set label — never an invented value.
  // `useUser()` is safe here — ClerkProvider always wraps the tab group
  // via the root _layout.
  const { user: clerkUser } = useUser();
  // "Real name OR alias" — the user-editable displayName wins over the
  // Clerk-provided name when set. Empty string falls through to Clerk
  // (the auth source of truth) and finally to a neutral localized label —
  // never a fabricated personal name — so the card never renders blank.
  const clerkName = clerkUser?.fullName ?? clerkUser?.firstName ?? t('profile.v2.member_fallback');
  // `profileIdentity` (ProfileIdentitySlice, already sourced above) — this
  // used to re-read the same data off the `state` facade as a separate
  // `profileIdentityForName` binding.
  const displayName =
    (profileIdentity.displayName && profileIdentity.displayName.trim()) ||
    clerkName;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  // Wave-5: the `remindersEnabled` useState that lived here is gone. It was
  // seeded from `mockUserProfile.remindersEnabled` and written only back into
  // itself — no dispatch, no persistence — so the switch it drove reset on
  // every remount and changed nothing in between. The real control is the
  // Notification Preferences screen, one row away in the NOTIFICATIONS group.
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
  // RC-2 P0 device-validation audit — TEMPORARY, internal-TestFlight-only.
  // `fetchAppleHealthSnapshot()` captures raw-sample diagnostics into a
  // module-level store (services/appleHealthDiagnostics.ts) ONLY
  // when `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED`; this local state is just a
  // render trigger so the panel updates after each refresh — the gate
  // itself lives in that module, not here, so this `useState` existing is
  // harmless even in builds where it always stays `null`.
  const [appleDiagnostics, setAppleDiagnostics] = useState<AppleHealthDiagnosticsSnapshot | null>(null);
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
      // RC-2 P0 device-validation audit — reads back whatever
      // `fetchAppleHealthSnapshot()` just captured into the module-level
      // diagnostics store (null outside internal TestFlight, since
      // `getLastAppleHealthDiagnostics()` is itself gated on
      // `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED` — see that module's header).
      // This only triggers a re-render of this small piece of state; it
      // never reads or writes anything beyond what the fetch already did.
      setAppleDiagnostics(getLastAppleHealthDiagnostics());
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
  // S2-2: the identity chip now reads the SAME server-authoritative
  // entitlement the subscription panel below always has (state.subscription,
  // Stripe-webhook-fed via useEntitlement) — the mock hardcoded 'core', so a
  // paying Athlete saw "CORE" on their own identity card.
  const entitlement = useSubscriptionSlice();
  const tierKey = entitlement.planId ?? null;
  const tier = (tierKey && TIER_LABELS[tierKey]) || null;
  // Neutral presentational accent while entitlement is unknown — a color is
  // chrome, not a tier claim; the tier CHIP below renders only from a real
  // server-fed planId.
  const tierColor = tier?.color ?? af.textTertiary;

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
            // ProfileIdentity slice (edited via the modal); the streak
            // is the ENGINE's own complianceStreak — the mock's constant
            // "12" shipped as if computed. Each chip is gated so the
            // card degrades cleanly when a field is empty.
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
              <View
                style={[styles.profileCard, { borderColor: `${tierColor}33` }]}
                testID="profile-identity-section"
              >
                <View style={styles.profileCardTop}>
                  {hasAvatarImage ? (
                    <Image
                      source={{ uri: profileIdentity.avatarUri }}
                      style={[styles.avatar, { borderColor: `${tierColor}55` }]}
                      accessibilityIgnoresInvertColors
                      accessibilityLabel={t('profile.v2.avatar_a11y')}
                    />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: `${tierColor}20`, borderColor: `${tierColor}55` }]}>
                      <Text style={[styles.avatarText, { color: tierColor }]}>
                        {avatarInitial}
                      </Text>
                    </View>
                  )}
                  <View style={styles.profileInfo}>
                    {/* Two lines, not one: this column is only ~116pt wide on a
                        320pt phone (avatar + edit button take the rest), so a
                        one-line clamp cut ordinary names at 20pt — and worse
                        under Dynamic Type. Still bounded so a pathological name
                        can't shove the chip strip off the card. */}
                    <Text style={styles.profileName} numberOfLines={2}>
                      {displayName}
                    </Text>
                    {handle ? (
                      // Stays one line: a handle is a single unbreakable token,
                      // so wrapping it would break mid-word rather than help.
                      <Text style={styles.profileHandle} numberOfLines={1}>
                        {handle}
                      </Text>
                    ) : null}
                    {locationLine ? (
                      <View style={styles.profileLocation}>
                        <Icon name="map-pin" size={11} color={af.textTertiary} />
                        <Text style={styles.profileLocationText} numberOfLines={2}>
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
                  {tierKey && tier ? (
                    <IdentityChip
                      icon="award"
                      label={t(`profile.v2.tier_${tierKey}_label`).toUpperCase()}
                      color={tier.color}
                    />
                  ) : null}
                  {userState.complianceStreak > 0 ? (
                    <IdentityChip
                      icon="zap"
                      label={t('profile.v2.day_streak', { days: userState.complianceStreak })}
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
                {/* Build-60 device QA: the goal read "Recovery O…". The strip
                    was a hard three-across row, so the goal — the only prose
                    value here — got a third of the card (~91pt at 375, ~73pt
                    at 320) with a one-line clamp, while "Recovery
                    Optimization" needs ~190pt. Height and weight are short
                    numerics and still pair fine side by side; the goal now
                    takes the full card width on its own row and wraps, so it
                    survives a small phone and large Dynamic Type without
                    shrinking type or dropping characters. */}
                <View style={styles.profileMetricStrip} testID="profile-metric-strip">
                  <View style={styles.profileMetricRow}>
                    <View style={styles.profileMetricCell}>
                      <Text style={styles.profileMetricLabel}>{t('profile.v2.metric_height')}</Text>
                      <Text style={styles.profileMetricValue}>{heightLabel}</Text>
                    </View>
                    <View style={styles.profileMetricDivider} />
                    <View style={styles.profileMetricCell}>
                      <Text style={styles.profileMetricLabel}>{t('profile.v2.metric_weight')}</Text>
                      <Text style={styles.profileMetricValue}>{weightLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.profileMetricRowDivider} />
                  <View
                    style={[styles.profileMetricCell, styles.profileMetricGoalCell]}
                    testID="profile-metric-goal-cell"
                  >
                    <Text style={styles.profileMetricLabel}>{t('profile.v2.metric_recovery_goal')}</Text>
                    {/* No numberOfLines on purpose: the goal must wrap, never
                        ellipsize. A member cannot reconstruct it from a stub
                        the way they can a height or a weight. */}
                    <Text style={[styles.profileMetricValue, { color: auraColor }]}>
                      {recoveryGoalLabel}
                    </Text>
                  </View>
                </View>
                {/* §55/Show-10 Profile Strength. It used to be its own headed
                    card wrapping a single row, one card down the page from
                    the fields it measures — it reads the completeness of THIS
                    card, so it belongs on it. Same flag gate, same chip. */}
                {flags.spec_profileStrengthSection ? (
                  <View style={styles.profileStrengthRow} testID="profile-strength-row">
                    <Text style={[styles.profileMetricLabel, styles.profileStrengthLabel]}>
                      {t('profile.v2.profile_completeness')}
                    </Text>
                    <ConfidenceChip
                      {...profileStrength(profileIdentity).chip}
                      a11yContext={t('profile.v2.completeness_a11y_context')}
                    />
                  </View>
                ) : null}
              </View>
            );

            // Founder Profile brief, section 1 of 8 — IDENTITY. Every other
            // group on this screen carries a SectionHeader; the identity card
            // was the one unlabelled block, which is part of why the screen
            // read as an unsorted pile rather than a set of named sections.
            const identityBlock = (
              <>
                <SectionHeader label={t('profile.v2.identity_label')} />
                {profileCard}
              </>
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
                    <Icon name="send" size={14} color={af.onRed} />
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

            // Founder Profile brief, section 2 of 8 — PERFORMANCE PROFILE:
            // what AForce assumes about this body. Formerly "GOALS". Two rows
            // left: the ounces row restated the target row directly above it
            // (target × 12) and is now that row's sub-label; the "Reminders"
            // switch was a local `useState` that persisted nothing and was
            // superseded by the real Notification Preferences screen — see
            // the NOTIFICATIONS group, which now owns every interruption
            // control on this screen.
            const performanceProfileBlock = (
              <>
                <SectionHeader
                  label={t('profile.v2.performance_profile_label')}
                  hint={t('profile.v2.performance_profile_hint')}
                />
                <View style={styles.card} testID="profile-performance-profile-card">
                  <SettingRow
                    icon="target"
                    label={t('profile.v2.daily_target')}
                    value={t('profile.v2.unit_units', { value: userState.dailyTarget })}
                    sub={t('profile.v2.daily_target_oz_sub', { value: userState.ozTarget })}
                  />
                  <Divider />
                  <SettingRow
                    icon="user"
                    label={t('profile.v2.body_weight')}
                    value={
                      profileIdentity.bodyWeightLbs != null
                        ? t('profile.v2.unit_lb', { value: profileIdentity.bodyWeightLbs })
                        : t('profile.v2.not_set')
                    }
                  />
                  <Divider />
                  {/* No canonical activity-type store exists yet — honest
                      not-set beats the mock's permanent "Field Athlete". */}
                  <SettingRow icon="activity" label={t('profile.v2.activity_type')} value={t('profile.v2.not_set')} />
                  <Divider />
                  <SettingRow
                    icon="sunrise"
                    label={t('profile.v2.wake_time')}
                    value={
                      userState.wakeTime
                        ? new Date(userState.wakeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : t('profile.v2.not_set')
                    }
                  />
                  {/* Read-only "what your body taught us" surfaces. They were
                      nested in the SETTINGS card, which is where a member
                      looks for controls, not readouts. All still flag-gated
                      and display-only. */}
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

            // One tools group, not three. MODULES, WEEKLY REPORT and PROTOCOL
            // TOOLS were three separate headed cards — two of them holding a
            // single row — for the same job: "take me somewhere else". Merged
            // into one card, ordered by how often a member actually needs it.
            // Row icons are uniformly af.textSecondary: a five-hue icon column
            // implied five different kinds of thing when they are all links.
            const protocolToolsCard = (
              <>
                <SectionHeader label={t('profile.v2.protocol_tools_label')} />
                <View style={styles.card} testID="profile-protocol-tools-card">
                  {/* Flag-gated public entry to the Weekly Performance Report™
                      (Build 100% · Show 10%); the Modules launcher below always
                      lists it for internal evaluation. */}
                  {flags.spec_weekly_report ? (
                    <>
                      <Pressable
                        onPress={() => router.push('/weekly-report')}
                        testID="profile-weekly-report-link"
                        style={styles.settingRow}
                        accessibilityRole="button"
                        accessibilityLabel={t('profile.v2.weekly_report')}
                      >
                        <View style={styles.settingLeft}>
                          <Icon name="trending-up" size={16} color={af.textSecondary} />
                          <View>
                            <Text style={styles.settingLabel}>{t('profile.v2.weekly_report')}</Text>
                            <Text style={styles.settingSubLabel}>
                              {t('profile.v2.weekly_report_sub')}
                            </Text>
                          </View>
                        </View>
                        <Icon name="chevron-right" size={16} color={af.textTertiary} />
                      </Pressable>
                      <Divider />
                    </>
                  ) : null}
                  <Pressable
                    onPress={() => router.push('/sensors')}
                    testID="profile-sensors-link"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.sensor_import')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="upload" size={16} color={af.textSecondary} />
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
                      <Icon name="anchor" size={16} color={af.textSecondary} />
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
                      <Icon name="award" size={16} color={af.textSecondary} />
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
                  {/* Build-61 correction (device QA, P1): the All Modules
                      launcher is an INTERNAL evaluation surface — it lists
                      Guardian, Clutch and Phantom, and its Social card resolved
                      through Night Out's gate onto the Protocol tab. It carries
                      the same clamp as the DEVELOPER tab below, so an ordinary
                      member never sees the entry point; `app/modules.tsx`
                      repeats the clamp so the route is dead too. */}
                  {developerControlsAvailable() ? (
                    <>
                      <Divider />
                      <Pressable
                        onPress={() => router.push('/modules')}
                        testID="profile-modules-link"
                        style={styles.settingRow}
                        accessibilityRole="button"
                        accessibilityLabel={t('profile.v2.all_modules')}
                      >
                        <View style={styles.settingLeft}>
                          <Icon name="grid" size={16} color={af.textSecondary} />
                          <View>
                            <Text style={styles.settingLabel}>{t('profile.v2.all_modules')}</Text>
                            <Text style={styles.settingSubLabel}>
                              {t('profile.v2.all_modules_sub')}
                            </Text>
                          </View>
                        </View>
                        <Icon name="chevron-right" size={16} color={af.textTertiary} />
                      </Pressable>
                    </>
                  ) : null}
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

            // Founder Profile brief, section 3 of 8 — CONNECTED DATA.
            //
            // The "CONNECTED DEVICES" card that used to head this group was
            // deleted, not restyled: it rendered `mockUserProfile.connectedDevices`
            // (a fixture: Apple Watch Ultra + Oura Ring) with a green LIVE pill
            // for every member, paired or not — the screen asserting a live
            // connection the data cannot support, immediately above the
            // provider list that reports the per-provider truth honestly.
            const connectedDataBlock = (
              <>
                <SectionHeader label={t('profile.v2.connected_data_label')} hint={t('profile.v2.connected_data_hint')} />
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
                            {/* RC-2 P0 device-validation audit — TEMPORARY,
                                internal-TestFlight-only. Renders nothing at
                                all (not even an empty View) unless
                                INTERNAL_TESTFLIGHT_OVERLAY_ENABLED, both
                                inside AppleHealthDiagnosticsSection's own
                                gate and here, so a production build never
                                pays for the mount. */}
                            {INTERNAL_TESTFLIGHT_OVERLAY_ENABLED && (
                              <AppleHealthDiagnosticsSection
                                diagnostics={appleDiagnostics}
                                biometricsEntry={userState.biometrics?.apple_health}
                                biometrics={userState.biometrics}
                              />
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

            // Founder Profile brief, section 5 of 8 — NOTIFICATIONS: every
            // channel AForce can use to interrupt a member, under one label.
            // "When will this app talk to me?" previously had no single
            // answer — push preferences sat at the bottom of the GOALS card
            // and the Voice Coach was its own top-level group two cards away.
            //
            // Voice Coach (T3) — each new AI command is read aloud via the
            // selected coach voice (ElevenLabs when picked, else the device
            // synthesizer). Both the on/off toggle AND the picked voice
            // survive a refresh via AsyncStorage in the store.
            const notificationsBlock = (
              <>
                <SectionHeader
                  label={t('profile.v2.notifications_label')}
                  hint={t('profile.v2.notifications_hint')}
                />
                <View style={styles.card} testID="profile-notifications-card">
                  <Pressable
                    onPress={() => router.push('/notifications')}
                    testID="profile-notifications-link"
                    style={styles.settingRow}
                    accessibilityRole="button"
                    accessibilityLabel={t('profile.v2.notif_prefs')}
                  >
                    <View style={styles.settingLeft}>
                      <Icon name="sliders" size={16} color={af.textSecondary} />
                      <View>
                        <Text style={styles.settingLabel}>{t('profile.v2.notif_prefs')}</Text>
                        <Text style={styles.settingSubLabel}>{t('profile.v2.notif_prefs_sub')}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={16} color={af.textTertiary} />
                  </Pressable>
                  <Divider />
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

            // Founder Profile brief, section 4 of 8 — PRIVACY. Analytics
            // consent was a single row buried mid-card in SETTINGS, between
            // the language picker and a stack of flag-gated panels: "what does
            // AForce collect, and how do I erase it?" was answerable only by
            // reading every row on the tab. It is now the whole point of its
            // own labelled group.
            const privacyBlock = (
              <>
                <SectionHeader label={t('profile.v2.privacy_label')} hint={t('profile.v2.privacy_hint')} />
                <View style={styles.card} testID="profile-privacy-card">
                  <AnalyticsConsentRow />
                  {/* Performance Memory™ governance — what the app has
                      observed about this member, plus the delete action.
                      Same question, same group. Flag gate unchanged. */}
                  {flags.performance_memory_governance_enabled ? (
                    <>
                      <Divider />
                      <PerformanceMemoryGovernanceCard />
                    </>
                  ) : null}
                </View>
              </>
            );

            // Founder Profile brief, section 7 of 8 — ACCOUNT: how this
            // account is configured, and how to leave it. Absorbs the former
            // PREFERENCES card (four display-unit segmented rows a member sets
            // once did not need a headed card of their own) and SignOutRow,
            // which floated below every tab rather than belonging to one.
            const settingsBlock = (
              <>
                <SectionHeader label={t('profile.v2.account_label')} hint={t('profile.v2.account_hint')} />
                <View style={styles.card} testID="profile-account-card">
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
                <SignOutRow />
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

                {/* PerformanceIdentityCard describes itself as an INTERNAL
                    raw-signal verification surface, not a product feature
                    ("Classification — not assigned (inert)"), yet it mounted
                    inside the member-facing SETTINGS card. Its flag is OFF in
                    the production binary, so this relocates an internal
                    readout to the internal tab — it takes nothing away that an
                    ordinary member could reach. */}
                {flags.performance_identity_enabled ? (
                  <View style={styles.card}>
                    <PerformanceIdentityCard />
                  </View>
                ) : null}

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

            // Terms, Privacy, Health Disclaimer and Contact Support are
            // required to be reachable by every signed-in member — App Store
            // review and `docs/COMPLIANCE_FRAMEWORK.md` both assume it. This
            // block therefore belongs to a tab ordinary users can open; it
            // must NEVER live under `developer`, which production builds strip
            // (see VISIBLE_PROFILE_TABS). Guarded by
            // `profileScreenV2LegalReachability.test.ts`.
            const legalBlock = (
              <>
                <SectionHeader label={t('profile.v2.legal_label')} hint={t('profile.v2.legal_hint')} />
                <View style={styles.card} testID="profile-legal-support-card">
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
                {/* Build + patent footer. It used to trail EVERY tab, so four
                    lines of legal fine print were the last thing a member read
                    after their goals and after their devices. It belongs with
                    the legal group — and support asks for the build string
                    anyway, which is now one row above it. */}
                <Text style={styles.version}>{t('profile.v2.version')}</Text>
                <Text style={styles.patent}>{t('profile.v2.patent_pending')}</Text>
                <Text style={styles.patentSub}>
                  {t('profile.v2.patent_sub_1')}{'\n'}
                  {t('profile.v2.patent_sub_2')}{'\n'}
                  {t('profile.v2.patent_sub_3')}{'\n'}
                  {t('profile.v2.patent_sub_4')}
                </Text>
              </>
            );

            // Group sections by tab, in the founder's Profile order:
            // IDENTITY · PERFORMANCE PROFILE · CONNECTED DATA · PRIVACY ·
            // NOTIFICATIONS · SUBSCRIPTION · ACCOUNT · SUPPORT.
            //
            // IDENTITY (`identityBlock`) always renders above the tab bar — it
            // is who the member is, not a group of settings, and it is the one
            // block every tab needs in view. Everything else has exactly one
            // home, so no group appears twice and none is homeless:
            //   PERFORMANCE → what AForce assumes about you + where to go next
            //   DEVICES     → where the biometrics come from
            //   ACCOUNT     → subscription, interruptions, data, setup, support
            //   DEVELOPER   → internal-only, stripped by VISIBLE_PROFILE_TABS
            //
            // ACCOUNT runs in the founder's SUBSCRIPTION · ACCOUNT · SUPPORT
            // order, so sign-out and then the legal footer close the tab.
            // `inviteCard` is a growth surface, not a setting: it opened the
            // tab before this change, which meant the first thing a member saw
            // on ACCOUNT was a referral code rather than their plan.
            //
            // Two placements are load-bearing, not cosmetic:
            //   - `legalBlock` must sit on a tab that survives the developer
            //     strip (App Review + docs/COMPLIANCE_FRAMEWORK.md); ACCOUNT
            //     does. Guarded by profileScreenV2LegalReachability.test.ts.
            //   - `demoModesCard` moved to DEVELOPER: it activates Night Out
            //     and logs drinks against the REAL server session, so a
            //     production member could put their own account into a
            //     drinking-night state from a card labelled "DEMO MODES" —
            //     the same class of defect PR #767 fixed on Scan.
            const tabSections: Record<ProfileTabId, React.ReactNode[]> = {
              performance: [performanceProfileBlock, protocolToolsCard],
              devices: [connectedDataBlock, hardwareCard],
              account: [subscriptionBlock, phaseEntryRow, notificationsBlock, privacyBlock, inviteCard, settingsBlock, legalBlock],
              developer: [demoAccessCard, demoModesCard, developerBlock],
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
                    {identityBlock}
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
                {identityBlock}
                {tabBar}
                {activeSections.map((node, i) => (
                  <React.Fragment key={`narrow-${profileTab}-${i}`}>{node}</React.Fragment>
                ))}
              </>
            );
          })()}
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