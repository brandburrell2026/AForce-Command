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
import { renderPerformanceSections } from './panes/PerformancePane';
import { renderDevicesSections } from './panes/DevicesPane';
import { renderAccountSections } from './panes/AccountPane';
import { renderDeveloperSections } from './panes/DeveloperPane';

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

            //     the same class of defect PR #767 fixed on Scan.
            const paneCtx = {
              allOn,
              appleDiagnostics,
              appleFetchError,
              appleSnapshot,
              appleUpdatedConfirmationVisible,
              coachMode,
              demoBusy,
              demoUnlockPayload,
              devMode,
              encError,
              encLoading,
              encStatus,
              endDemo,
              flags,
              garminDemoSnapshot,
              garminState,
              garminStatusChecked,
              handleGarminToggle,
              handleWhoopToggle,
              inRecovery,
              isLiveGarminState,
              isRefreshingApple,
              linkedProviders,
              profileIdentity,
              referralQ,
              refreshAppleSnapshot,
              refreshEncStatus,
              refreshWhoopState,
              router,
              runRecoveryDemo,
              runSocialDemo,
              selectedVoiceId,
              setFeatureFlags,
              setInvestorDemoActive,
              setLanguage,
              setSelectedVoiceId,
              setUnitPreference,
              setVoiceCoachEnabled,
              setVoiceIntensity,
              setVoiceScope,
              socialActive,
              sortedHealthProviders,
              t,
              toggleFlag,
              toggleProvider,
              unitPreferences,
              userState,
              voiceCoachEnabled,
              voiceIntensity,
              voiceScope,
              whoopState,
              whoopExpiresAt,
              whoopStatusChecked,
              whoopStatusError,
            };
            const tabSections: Record<ProfileTabId, React.ReactNode[]> = {
              performance: renderPerformanceSections(paneCtx),
              devices: renderDevicesSections(paneCtx),
              account: renderAccountSections(paneCtx),
              developer: renderDeveloperSections(paneCtx),
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