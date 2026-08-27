/**
 * DevicesPane — S2-10b(2): the DEVICES tab sections, moved verbatim
 * from the ProfileScreenV2 render closure. Render FUNCTIONS, not
 * components: the returned nodes reconcile exactly as the in-closure
 * consts did (no new component boundaries, no remount changes).
 * Every closure dependency arrives via the typed ProfilePaneCtx.
 */
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
} from '../profileKit';
import { AFInlineErrorRow, AFStatPair } from '@/components/ui';
import { ProviderSectionSkeleton } from '../ProviderSectionSkeleton';
import { AppleHealthRefreshControl } from '../AppleHealthRefreshControl';
import { AppleHealthDiagnosticsSection } from '../AppleHealthDiagnosticsSection';
import { createAppleRefreshGuard } from '../appleRefreshGuard';
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
import type { ProfilePaneCtx } from './types';

export function renderDevicesSections(ctx: ProfilePaneCtx): React.ReactNode[] {
  const {
    appleDiagnostics,
    appleFetchError,
    appleSnapshot,
    appleUpdatedConfirmationVisible,
    flags,
    garminDemoSnapshot,
    garminState,
    garminStatusChecked,
    handleGarminToggle,
    handleWhoopToggle,
    isLiveGarminState,
    isRefreshingApple,
    linkedProviders,
    refreshAppleSnapshot,
    refreshWhoopState,
    router,
    sortedHealthProviders,
    t,
    toggleProvider,
    userState,
    whoopState,
    whoopExpiresAt,
    whoopStatusChecked,
    whoopStatusError,
  } = ctx;

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


  return [connectedDataBlock, hardwareCard];
}
