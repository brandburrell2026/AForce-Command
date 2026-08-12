import type {
  UserState,
  AppleHealthInputs,
  FluidType,
  FeatureFlags,
  ProviderSnapshot,
  NotificationSettings,
  NotificationSettingKey,
} from '../../types';
import type { UserSubscription } from '../../types/subscription';
import type { SweatAutopilot } from '../../types/sweat';
import type { HealthProviderId } from '../../data/healthProviders';
import type { UnitPreferences } from '../../utils/units';
import type { ProfileIdentity } from '../../utils/profileIdentity';
import type { SupportedLanguage } from '../../services/i18nService';
import type { VoiceIntensity, VoiceScope } from '../../services/voice/commandVoice';
import type { FacadeState } from './facadeState';

export interface AppContextValue {
  /**
   * Everything in `AppState` EXCEPT `timerSeconds` (Wave-4 Part 6) — see
   * `facadeState.ts`. Per-second countdown readers use `useTimerSlice()`;
   * the exclusion is compile-enforced so a reader cannot regress onto the
   * facade and silently reintroduce the 1Hz whole-app re-render.
   */
  state: FacadeState;
  /**
   * RC-1 Wave-2B — true once the mount-time `/v1/home` fetch has settled
   * (success or failure). False only during the brief pre-hydration window
   * where `state` still reflects the local, synchronous initial guess.
   * Monotonic — never goes back to false. See `store/useAppStore.tsx`'s
   * `AppProvider` for where it flips.
   */
  isHydrated: boolean;
  logIntake: (
    fluidType: FluidType,
    opts?: {
      silent?: boolean;
      ozOverride?: number;
      flavorLabel?: string;
      /**
       * When set, completely replaces the auto-built history action label
       * ("Logged Stick — Berry Blast (12 ounces)") with a caller-supplied
       * display name. Used by the AddDrinkModal so non-AForce drinks log
       * as e.g. "Logged Coffee · Starbucks Pike Place (16 ounces)" rather
       * than the misleading "Logged Water — Coffee...".
       */
      displayNameOverride?: string;
      /**
       * Optional drink-catalog category (e.g. 'coffee', 'soda', 'juice').
       * When set, the just-logged IntakeEvent is tagged client-side so
       * the Acidic Load / Stimulant Load helper can attribute it
       * correctly. Backward-compatible: omitting it means the event
       * simply contributes zero to those loads.
       */
      categoryId?: string;
    },
  ) => Promise<void>;
  completeCycle: () => Promise<void>;
  snooze: () => void;
  dismissSuccess: () => void;
  updateSymptoms: (symptoms: string[]) => Promise<void>;
  updateUrineSignal: (signal: number) => Promise<void>;
  updateEnergyState: (energy: UserState['energyState']) => Promise<void>;
  confirmStatus: () => Promise<void>;
  setFeatureFlags: (flags: FeatureFlags) => void;
  setSubscription: (sub: UserSubscription) => void;
  completeOnboarding: () => void;
  setAppleHealthSnapshot: (snapshot: AppleHealthInputs | null) => void;
  /**
   * Push a snapshot from any non-Apple-Health provider (Oura / WHOOP /
   * Garmin / Strava / Samsung / Google Health Connect) into UserState
   * .biometrics. The score engine immediately re-aggregates across all
   * connected providers. Pass null to disconnect that provider.
   */
  setProviderBiometrics: (providerId: HealthProviderId, snapshot: ProviderSnapshot | null) => void;
  /**
   * Resolve the post-recheck "Did you follow the command?" prompt (T2).
   * Yes → +3 score. No → -3 score and (in Clutch mode, T3) a 10-min
   * +0.5 pts/min decay boost.
   */
  confirmCommand: (followed: boolean) => Promise<void>;
  /**
   * Persist the user's chosen UI language. Updates i18next immediately,
   * mirrors the choice into UserState so the orb / breakdown re-render,
   * and POSTs to the server so it survives reload.
   */
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  /** Social Mode (alcohol mitigation) — start a fresh drinking session. */
  activateSocialMode: (preset?: 'travel' | 'heat' | 'hard_block' | null) => Promise<void>;
  /** Log a single drink of the given alcohol type. */
  logSocialDrink: (
    type: 'beer' | 'wine' | 'cocktail' | 'liquor' | 'hard_seltzer' | 'custom',
    opts?: { abv?: number; oz?: number },
  ) => Promise<void>;
  /** Resolve the post-drink hydration prompt (true = drank water/RTD). */
  confirmSocialHydration: (confirmed: boolean) => Promise<void>;
  /** End the drinking session — flips into the 8h Recovery Mode window. */
  deactivateSocialMode: () => Promise<void>;
  /**
   * Chunk #5: engage Cruise Mode — extends the post-session recovery
   * window from 8h to 24h for multi-day travel / vacation / recovery
   * blocks. Re-engagement extends the timer.
   */
  activateCruiseMode: () => Promise<void>;
  /**
   * Chunk #5: engage Voyage Shield — floors the Recovery Capacity
   * Score at 60 (top of Stable band) for 12h. Premium-gated; the
   * server stays permissive so the gate lives client-side only.
   */
  activateVoyageShield: () => Promise<void>;
  /** Persist optional BAC context (sex, ate recently) for sharper estimates. */
  setSocialContext: (
    ctx: { sex?: 'male' | 'female' | 'unspecified'; ateRecently?: boolean },
  ) => Promise<void>;
  /**
   * Snapshot the autopilot derived from a fresh sweat session into
   * the store. Pass null to clear (e.g. when the recovery window
   * expires). useHeatGuard reads this and surfaces interval/urgency
   * for any consumer that drives recheck cadence.
   */
  setSweatAutopilot: (autopilot: SweatAutopilot | null) => void;
  /**
   * Voice Coach (T3): when true, the AForce voice persona reads each
   * new AI command aloud (debounced inside textToSpeech.speak). The
   * preference is mirrored into AsyncStorage + the textToSpeech
   * playback flag so refreshes / non-React callers see the same value.
   */
  voiceCoachEnabled: boolean;
  setVoiceCoachEnabled: (next: boolean) => void;
  /**
   * Selected ElevenLabs voice id, or null when the user prefers the
   * device synthesizer. Persisted to AsyncStorage and mirrored into
   * `textToSpeech.setSelectedVoiceId` so any non-React caller sees the
   * same value.
   */
  selectedVoiceId: string | null;
  setSelectedVoiceId: (next: string | null) => void;
  /**
   * AForce Command Voice Engine — intensity setting. Drives Pressure
   * Mode behaviour: 'calm' speaks every line in full, 'standard' is
   * the default (spec phrases verbatim, auto-engages Pressure Mode
   * when DEPLETED), 'pressure' forces Pressure Mode for every system
   * command regardless of band.
   */
  voiceIntensity: VoiceIntensity;
  setVoiceIntensity: (next: VoiceIntensity) => void;
  /**
   * AForce Command Voice Engine — scope setting. Controls which
   * categories of voice events are allowed to fire:
   *   'all'       — every category (default)
   *   'risk'      — score-band + risk-timer alerts only
   *   'commands'  — system commands + completion rewards only
   *   'muted'     — nothing speaks (separate from voiceCoachEnabled,
   *                 which is the master toggle)
   */
  voiceScope: VoiceScope;
  setVoiceScope: (next: VoiceScope) => void;
  /** Persisted notification preferences + setter. */
  notificationSettings: NotificationSettings;
  setNotificationSetting: (key: NotificationSettingKey, value: boolean) => void;
  /**
   * Persisted unit-display preferences (lbs/kg, °F/°C, oz/mL) + setter.
   * The setter is generic so passing a mismatched value (e.g. 'lbs'
   * for the 'temperature' key) is a compile-time error.
   */
  unitPreferences: UnitPreferences;
  setUnitPreference: <K extends keyof UnitPreferences>(
    key: K,
    value: UnitPreferences[K],
  ) => void;
  /**
   * Persisted profile identity (nickname / city / country / circle /
   * territory badge / aura) + partial-merge setter. Driven by the
   * Edit Profile modal on the Profile tab. Empty strings are valid
   * (clear a chip); the setter merges so unspecified keys keep their
   * current value.
   */
  profileIdentity: ProfileIdentity;
  setProfileIdentity: (patch: Partial<ProfileIdentity>) => void;
  /**
   * Investor Demo overlay flag. Cinematic 60-second scripted flow that
   * walks through every Voice Engine state in sequence. Lives entirely
   * above the regular store — toggling this never mutates user data.
   */
  isInvestorDemoActive: boolean;
  setInvestorDemoActive: (next: boolean) => void;
}
