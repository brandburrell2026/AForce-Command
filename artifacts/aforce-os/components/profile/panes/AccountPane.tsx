/**
 * AccountPane — S2-10b(2): the ACCOUNT tab sections, moved verbatim
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
import { AFInlineErrorRow, AFStatPair , AFListRow } from '@/components/ui';
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

export function renderAccountSections(ctx: ProfilePaneCtx): React.ReactNode[] {
  const {
    coachMode,
    flags,
    referralQ,
    router,
    selectedVoiceId,
    setInvestorDemoActive,
    setLanguage,
    setSelectedVoiceId,
    setUnitPreference,
    setVoiceCoachEnabled,
    setVoiceIntensity,
    setVoiceScope,
    t,
    unitPreferences,
    voiceCoachEnabled,
    voiceIntensity,
    voiceScope,
  } = ctx;

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
        <Divider />
        {/* Community Sharing — the circle visibility control relocated from
            the stranded /circles island (founder ruling 2026-08-27). */}
        <AFListRow
          icon="shield"
          title={t('communitySharing.entry_title')}
          subtitle={t('communitySharing.entry_sub')}
          disclosure
          onPress={() => router.push('/privacy/community-sharing')}
          testID="profile-community-sharing-row"
        />
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

  return [subscriptionBlock, phaseEntryRow, notificationsBlock, privacyBlock, inviteCard, settingsBlock, legalBlock];
}
