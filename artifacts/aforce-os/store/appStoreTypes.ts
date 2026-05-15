/**
 * Shared types for the AForce app store.
 * Extracted from useAppStore.tsx so consumers can import action / state
 * shapes without pulling the full provider into their bundle.
 */

import type {
  UserState,
  AppleHealthInputs,
  ScoreEngineOutput,
  CycleResult,
  HistoryEntry,
  FeatureFlags,
  ProviderSnapshot,
  NotificationSettings,
  NotificationSettingKey,
} from '../types';
import type { UserSubscription } from '../types/subscription';
import type { SweatAutopilot } from '../types/sweat';
import type { HealthProviderId } from '../data/healthProviders';

export interface AppState {
  userState: UserState;
  engineOutput: ScoreEngineOutput;
  history: HistoryEntry[];
  lastCycleResult: CycleResult | null;
  isCompletingCycle: boolean;
  showCycleSuccess: boolean;
  timerSeconds: number;
  /** True when the recheck timer hit zero and we're awaiting the user's "Did you follow it?" answer. */
  pendingConfirmation: boolean;
  featureFlags: FeatureFlags;
  subscription: UserSubscription;
  lastIntakeBurstAt: number;
  hasSeenOnboarding: boolean;
  /**
   * Active autopilot snapshot from the most recent sweat session.
   * When set, useHeatGuard exposes its interval/urgency so screens can
   * drive recheck cadence from the sweat-driven recovery window.
   */
  sweatAutopilot?: SweatAutopilot | null;
  /** Epoch ms when sweatAutopilot was set — drives the recovery window. */
  sweatAutopilotSetAt?: number | null;
  /** User-facing notification preferences (persisted to AsyncStorage). */
  notificationSettings: NotificationSettings;
}

export type Action =
  | {
      type: 'SET_SWEAT_AUTOPILOT';
      payload: { autopilot: SweatAutopilot | null; setAt: number | null };
    }
  | { type: 'CYCLE_START' }
  | {
      type: 'CYCLE_SUCCESS';
      payload: {
        result: CycleResult;
        newUserState: UserState;
        engineOutput: ScoreEngineOutput;
        historyEntry: HistoryEntry;
        silent?: boolean;
      };
    }
  | { type: 'DISMISS_SUCCESS' }
  | { type: 'CYCLE_FAILURE' }
  | { type: 'SNOOZE' }
  | { type: 'TICK_TIMER' }
  | {
      type: 'SET_USER_STATE';
      payload: { newUserState: UserState; engineOutput: ScoreEngineOutput };
    }
  | { type: 'REFRESH_ENGINE'; payload: { engineOutput: ScoreEngineOutput } }
  | { type: 'SET_FLAGS'; payload: FeatureFlags }
  | { type: 'SET_SUBSCRIPTION'; payload: UserSubscription }
  | { type: 'COMPLETE_ONBOARDING' }
  | {
      type: 'SET_APPLE_HEALTH';
      payload: { snapshot: AppleHealthInputs | null; engineOutput: ScoreEngineOutput };
    }
  | {
      type: 'SET_PROVIDER_BIOMETRICS';
      payload: {
        providerId: HealthProviderId;
        snapshot: ProviderSnapshot | null;
        engineOutput: ScoreEngineOutput;
      };
    }
  | {
      type: 'CONFIRM_COMMAND';
      payload: { newUserState: UserState; engineOutput: ScoreEngineOutput };
    }
  | { type: 'SET_NOTIFICATION_SETTING'; payload: { key: NotificationSettingKey; value: boolean } }
  | { type: 'SET_NOTIFICATION_SETTINGS'; payload: NotificationSettings }
  | { type: 'ADD_HISTORY_ENTRY'; payload: HistoryEntry };
