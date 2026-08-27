/**
 * DeveloperPane — S2-10b(2): the DEVELOPER tab sections, moved verbatim
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

export function renderDeveloperSections(ctx: ProfilePaneCtx): React.ReactNode[] {
  const {
    allOn,
    demoBusy,
    demoUnlockPayload,
    devMode,
    encError,
    encLoading,
    encStatus,
    endDemo,
    flags,
    inRecovery,
    refreshEncStatus,
    router,
    runRecoveryDemo,
    runSocialDemo,
    setFeatureFlags,
    socialActive,
    t,
    toggleFlag,
  } = ctx;

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

  return [demoAccessCard, demoModesCard, developerBlock];
}
