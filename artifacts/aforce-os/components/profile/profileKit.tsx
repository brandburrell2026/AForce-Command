/**
 * profileKit — S2-10b(1): the shared primitives of the Profile surface,
 * extracted from the 3,586-line ProfileScreenV2 monolith so the tab panes
 * can move to their own files WITHOUT importing back into the shell
 * (kit ← shell stays one-way). Pure mechanical move: every component,
 * const and style below is byte-identical to its previous in-file form.
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

export const TIER_LABELS: Record<string, { color: string }> = {
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

export function SignOutRow() {
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

export function SectionHeader({ label, hint }: { label: string; hint?: string }) {
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
export type ProfileTabId = 'performance' | 'devices' | 'account' | 'developer';
// Tab labels live in the `profile.v2.tab_<id>` locale namespace and are
// resolved at the render site (this const is declared outside any
// component, so it can't call `t()`).
export const PROFILE_TABS: ReadonlyArray<{ id: ProfileTabId }> = [
  { id: 'performance' },
  { id: 'devices' },
  { id: 'account' },
  { id: 'developer' },
];

/**
 * Wave-1 P0 hardening (SS-01): the DEVELOPER tab — and every flag toggle
 * inside it, including "Unlock all" — is NOT for ordinary production users.
 * Visible only in local dev, env-gated demo builds, and internal TestFlight
 * (developerControlsAvailable). Ordinary users see three tabs.
 */
export const VISIBLE_PROFILE_TABS: ReadonlyArray<{ id: ProfileTabId }> =
  developerControlsAvailable()
    ? PROFILE_TABS
    : PROFILE_TABS.filter((tab) => tab.id !== 'developer');

export function ProfileTabBar({
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
        {VISIBLE_PROFILE_TABS.map((tab) => {
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

export function SnapshotCell({ label, value }: { label: string; value: string }) {
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

// `sub` exists so a derived restatement can hang off the row it restates
// instead of claiming a row of its own — the daily ounces target is the daily
// target × 12, and read as a second equal-weight fact until it was folded in.
export function SettingRow({ icon, label, value, sub }: { icon: IconName; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={16} color={af.cyan} />
        <View>
          <Text style={styles.settingLabel}>{label}</Text>
          {sub ? <Text style={styles.settingSubLabel}>{sub}</Text> : null}
        </View>
      </View>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

export function HardwareRow({ name, kind, ledColor, status }: { name: string; kind: string; ledColor: string; status: string }) {
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

export function FlagRow({
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

export function Divider() {
  return <View style={styles.divider} />;
}

/**
 * Per-aura accent colour used by the identity card chip strip. Kept
 * here (not in theme/colors) because aura semantics are profile-scoped
 * and the palette deliberately reuses the existing state colours so
 * the card never introduces a foreign hue.
 */
export const AURA_COLOR: Record<AuraState, string> = {
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
export function IdentityChip({
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
      {/* No line clamp: a chip carries a member-authored team name or a
          territory badge, and the strip already wraps. A long chip should
          become a taller chip, not "NORTHSIDE STRENGT…". */}
      <Text style={[styles.identityChipLabel, { color }]}>
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
export function UnitPreferenceRow<T extends string>({
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

export function SubscriptionPanel() {
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

export const styles = StyleSheet.create({
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
    // Sits in a row beside the pin icon; RN defaults flexShrink to 0, so
    // without this "San Francisco · United States" pushes past the card.
    flexShrink: 1,
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
  // Column, not a row: the numeric pair shares one line, the prose goal
  // gets its own full-width line beneath them (see the metric-strip
  // comment at the call site for the Build-60 truncation this fixes).
  profileMetricStrip: {
    flexDirection: 'column',
    backgroundColor: af.canvas,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: af.divider,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 4,
    gap: 10,
  },
  profileMetricRow: {
    flexDirection: 'row', alignItems: 'stretch',
  },
  // `flexShrink` + `minWidth: 0` so a cell yields at 320pt / large Dynamic
  // Type instead of forcing its text to ellipsize inside a rigid box.
  profileMetricCell: {
    flex: 1, flexShrink: 1, minWidth: 0,
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  // The goal cell is a child of the COLUMN strip rather than of the two-up
  // row, where `flex: 1`'s grow + zero main-basis would apply VERTICALLY.
  // Reset both: this cell is content-height and full-width.
  profileMetricGoalCell: {
    flexGrow: 0, flexBasis: 'auto', alignSelf: 'stretch',
  },
  profileMetricDivider: {
    width: 1, backgroundColor: af.divider, alignSelf: 'stretch', marginVertical: 4,
  },
  profileMetricRowDivider: {
    height: 1, backgroundColor: af.divider,
  },
  // textAlign keeps a wrapped label/value centered under its cell rather
  // than ragged-left once Dynamic Type pushes it onto a second line.
  profileMetricLabel: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: af.textTertiary, letterSpacing: 1.5,
    textAlign: 'center', flexShrink: 1,
  },
  profileMetricValue: {
    fontSize: 14, fontFamily: 'Inter_700Bold', color: af.textPrimary, letterSpacing: 0.3,
    textAlign: 'center', flexShrink: 1,
  },
  profileStrengthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, marginTop: 4,
  },
  // Same label token, but this one sits in a space-between row next to the
  // confidence chip: it must shrink and wrap (RN defaults flexShrink to 0,
  // which pushed the chip past the card edge at large Dynamic Type) and it
  // reads left-to-right/RTL with the row, not centered like a cell.
  profileStrengthLabel: {
    flexShrink: 1, textAlign: 'auto',
  },
  identityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
    maxWidth: '100%',
  },
  identityChipLabel: {
    fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5,
    // The chip is capped at maxWidth 100%; without flexShrink the label
    // would overflow that cap instead of wrapping inside it.
    flexShrink: 1,
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
    minHeight: 44,
    justifyContent: 'center',
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
    // S2-10: '#000000' on the af.red active fill measured ~3.59:1 — the
    // screen's PRIMARY navigation failed AA. af.onRed is the AA-verified
    // on-red token (same fix SignIn documented; Profile never received it).
    color: af.onRed,
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
    fontFamily: 'Inter_700Bold', fontSize: 12, color: af.onRed, letterSpacing: 1.5,
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
  // deviceRow / deviceLeft / deviceDot went with the fixture CONNECTED DEVICES
  // list. deviceName + deviceStatus stay — the provider rows use both.
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

export const voicePickerStyles = StyleSheet.create({
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

