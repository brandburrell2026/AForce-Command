/**
 * ProfilePaneCtx — S2-10b(2): the typed contract between the Profile shell
 * and its four tab panes.
 *
 * The 52 fields were enumerated by the compiler (tsc TS2304 over the
 * freshly-moved pane bodies), then typed by DERIVATION wherever a canonical
 * source exists — slice hooks via ReturnType, provider states via their
 * exported types — so the contract tracks its sources instead of
 * hand-transcribed copies that drift. Handlers are typed structurally from
 * their call shapes; tsc fails the build if either side moves.
 */
import type * as React from 'react';
import type { FeatureFlags, UserState } from '@/types';
import type { HealthProviderId } from '@/data/healthProviders';
import type { ProviderSnapshot } from '@/types/biometrics';
import type { GarminUiState } from '@/utils/garminProviderState';
import type { AppleHealthSnapshot } from '@/services/appleHealth';
import type { AppleHealthDiagnosticsSnapshot } from '@/services/appleHealthDiagnostics';
import {
  useProfileIdentitySlice,
  useUnitPreferencesSlice,
  useVoiceSettingsSlice,
} from '@/store/slices';
import { useCoachModeSetting } from '@/services/coachMode';
import { HEALTH_PROVIDERS } from '@/data/healthProviders';

import { useRouter } from 'expo-router';
import type { ReferralInfo } from '@workspace/api-client-react';
import type { AppContextValue } from '@/store/app/types';
type Router = ReturnType<typeof useRouter>;
type T = (key: string, opts?: Record<string, unknown>) => string;
type VoiceSettings = ReturnType<typeof useVoiceSettingsSlice>;

export type EncryptionStatus = {
  total: number;
  encrypted: number;
  plaintextOnly: number;
  halfEncrypted: number;
  encryptionKeyConfigured: boolean;
  backfillCronEnabled: boolean;
};

export interface ProfilePaneCtx {
  // ── shared ──────────────────────────────────────────────────────────
  t: T;
  router: Router;
  flags: FeatureFlags;
  userState: UserState;
  // ── performance ─────────────────────────────────────────────────────
  profileIdentity: ReturnType<typeof useProfileIdentitySlice>;
  // ── devices ─────────────────────────────────────────────────────────
  sortedHealthProviders: typeof HEALTH_PROVIDERS;
  linkedProviders: Set<HealthProviderId>;
  toggleProvider: (id: HealthProviderId, name: string) => Promise<void> | void;
  handleWhoopToggle: () => void;
  handleGarminToggle: () => void;
  whoopStatusChecked: boolean;
  whoopStatusError: string | null;
  refreshWhoopState: () => void;
  whoopState: import('@/services/whoopConnect').WhoopConnectionState;
  whoopExpiresAt: number | null;
  garminState: GarminUiState;
  garminStatusChecked: boolean;
  garminDemoSnapshot: ProviderSnapshot | null;
  isLiveGarminState: (s: GarminUiState) => boolean;
  appleSnapshot: AppleHealthSnapshot | null;
  appleDiagnostics: AppleHealthDiagnosticsSnapshot | null;
  appleFetchError: string | null;
  isRefreshingApple: boolean;
  appleUpdatedConfirmationVisible: boolean;
  refreshAppleSnapshot: () => void;
  // ── account ─────────────────────────────────────────────────────────
  referralQ: { data?: ReferralInfo | null };
  coachMode: ReturnType<typeof useCoachModeSetting>;
  setLanguage: AppContextValue['setLanguage'];
  setUnitPreference: AppContextValue['setUnitPreference'];
  unitPreferences: ReturnType<typeof useUnitPreferencesSlice>;
  selectedVoiceId: VoiceSettings['selectedVoiceId'];
  setSelectedVoiceId: AppContextValue['setSelectedVoiceId'];
  voiceCoachEnabled: boolean;
  setVoiceCoachEnabled: AppContextValue['setVoiceCoachEnabled'];
  voiceIntensity: VoiceSettings['voiceIntensity'];
  setVoiceIntensity: AppContextValue['setVoiceIntensity'];
  voiceScope: VoiceSettings['voiceScope'];
  setVoiceScope: AppContextValue['setVoiceScope'];
  setInvestorDemoActive: AppContextValue['setInvestorDemoActive'];
  // ── developer ───────────────────────────────────────────────────────
  devMode: boolean;
  demoBusy: null | 'social' | 'recovery' | 'reset';
  demoUnlockPayload: FeatureFlags;
  allOn: boolean;
  toggleFlag: (key: keyof FeatureFlags) => void;
  setFeatureFlags: AppContextValue['setFeatureFlags'];
  encStatus: EncryptionStatus | null;
  encError: string | null;
  encLoading: boolean;
  refreshEncStatus: () => void;
  endDemo: () => void;
  runSocialDemo: () => void;
  runRecoveryDemo: () => void;
  socialActive: boolean;
  inRecovery: boolean;
  __jsx?: React.ReactNode; // keeps the React type import earning its place
}
