/**
 * PerformancePane — S2-10b(2): the PERFORMANCE tab sections, moved verbatim
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

export function renderPerformanceSections(ctx: ProfilePaneCtx): React.ReactNode[] {
  const {
    flags,
    profileIdentity,
    router,
    t,
    userState,
  } = ctx;

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
        {/* Founder ruling 2026-08-27 (Build-70 validation finding): the Sweat
            Calculator's only member entry died with the legacy Home's tile
            row — this row is now its canonical member-facing path. */}
        <Pressable
          onPress={() => router.push('/sweat')}
          testID="profile-sweat-link"
          style={styles.settingRow}
          accessibilityRole="button"
          accessibilityLabel={t('profile.v2.sweat_calculator')}
        >
          <View style={styles.settingLeft}>
            <Icon name="cloud-drizzle" size={16} color={af.textSecondary} />
            <View>
              <Text style={styles.settingLabel}>{t('profile.v2.sweat_calculator')}</Text>
              <Text style={styles.settingSubLabel}>{t('profile.v2.sweat_calculator_sub')}</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={16} color={af.textTertiary} />
        </Pressable>
        <Divider />
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


  return [performanceProfileBlock, protocolToolsCard];
}
