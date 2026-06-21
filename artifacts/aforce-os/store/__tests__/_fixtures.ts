/**
 * Shared fixtures for the per-slice reducer test suites.
 *
 * Inline (no scoringEngine / i18nService imports) so the test runtime
 * never transitively pulls in react-native or expo-localization.
 */

import type { AppState } from '../appStoreTypes';
import type {
  CycleResult,
  HistoryEntry,
  ScoreEngineOutput,
  UserState,
  FeatureFlags,
} from '../../types';
import type { UserSubscription } from '../../types/subscription';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../types';
import { DEFAULT_PROFILE_IDENTITY } from '../../utils/profileIdentity';

export const FIXED_NOW = new Date('2026-04-22T12:00:00Z').getTime();

export function makeUserState(overrides: Partial<UserState> = {}): UserState {
  return {
    unitsConsumedToday: 4,
    aforceUnitsToday: 3,
    language: 'en',
    ozConsumedToday: 60,
    lastIntakeTime: new Date(FIXED_NOW - 38 * 60 * 1000),
    lastIntakeType: 'aforce_stick',
    symptomState: 'none',
    symptoms: [],
    urineSignal: 3,
    energyState: 'steady',
    heatLoad: 4,
    sweatRate: 3,
    activityLevel: 5,
    complianceStreak: 4,
    dailyTarget: 8,
    ozTarget: 96,
    isSnoozed: false,
    snoozeUntil: null,
    bodyWeightLbs: 180,
    isAwake: true,
    wakeTime: new Date(FIXED_NOW - 5 * 3600 * 1000),
    overnightLossOz: 14,
    hasSeenMorningCommand: false,
    ...overrides,
  };
}

export function makeEngine(overrides: Partial<ScoreEngineOutput> = {}): ScoreEngineOutput {
  return {
    score: 72,
    performanceState: {
      level: 'BALANCED',
      score: 72,
      color: '#00E5C8',
      glowColor: '#00E5C880',
      urgency: 'moderate',
      pulseSpeed: 'medium',
      animationStyle: 'pulse',
    },
    pulseConfig: {
      pulseState: 'BALANCED',
      pulseIntensity: 0.6,
      pulseSpeed: 0.5,
      glowStrength: 0.5,
      waveBehavior: 'steady_outward',
      colorMode: 'teal',
      deltaMode: 'steady',
      animations: { burstOnIntake: true, flareOnPeak: false, collapseOnDepletion: false },
    },
    reasons: [],
    riskTimer: { minutes: 20, seconds: 0, urgency: 'medium' },
    command: {
      id: 'cmd-1',
      action: 'Drink 12oz water',
      explanation: 'Stay ahead of the curve',
      urgencyLevel: 'medium',
      estimatedImpact: '+8 score',
    },
    breakdown: [],
    prediction: { decayPerMinute: 0.4, minutesToDepleted: 80, label: 'Stable' },
    social: null,
    ...overrides,
  };
}

export const baseEngine = makeEngine();
export const baseUser = makeUserState();

export const baseFlags: FeatureFlags = {
  clutch_access_enabled: false,
  clutch_heat_mode_enabled: false,
  clutch_inventory_enabled: false,
  guardian_intelligence_enabled: false,
  guardian_body_map_enabled: false,
  guardian_alerts_enabled: false,
  phantom_wearable_enabled: false,
  ring_enabled: false,
  clutch_clip_enabled: false,
  kids_world_enabled: false,
  city_competition_enabled: false,
  state_competition_enabled: false,
  team_competition_enabled: false,
  global_leaderboard_enabled: false,
  metabolic_readiness_enabled: false,
  performance_age_enabled: false,
  metabolic_glucose_enabled: false,
  voice_checkin_enabled: false,
  cruise_mode_enabled: false,
  cruise_journey_pulse_enabled: false,
  cruise_commerce_enabled: false,
  cruise_inventory_enabled: false,
  cruise_stateroom_delivery_enabled: false,
  cruise_pre_port_enabled: false,
  cruise_excursion_readiness_enabled: false,
  voice_status_module_visible: false,
  sleep_mode_enabled: false,
  spec_activation: true,
  spec_social: false,
  spec_sleep: false,
  spec_cruise: false,
  spec_coachV2: false,
  spec_premium: false,
  spec_inventory: false,
  spec_phantom: false,
  spec_enterprise: false,
  spec_language_ar: false,
  spec_language_zh: false,
  spec_language_ja: false,
  spec_language_ko: false,
  spec_language_hi: false,
  spec_recoveryCircle: false,
  spec_notifications: false,
  spec_orb: true,
  spec_timelineLock: true,
  spec_hydroJournal: true,
  spec_hydroScan: true,
  spec_profileSource: true,
  spec_sharedContextLayer: true,
  spec_uiFreeze: true,
  spec_recovery: false,
  spec_demand_engine: false,
  hydro_scan_2_enabled: false,
  location_intelligence_enabled: false,
  signal_hierarchy_enabled: false,
  spec_weekly_report: false,
  scoreFromLedgerHybrid: false,
};

export const baseSubscription: UserSubscription = {
  planId: 'core',
  status: 'active',
  cadence: 'monthly',
  startedAt: new Date(FIXED_NOW).toISOString(),
  unlockedFlags: [],
  billing: {
    provider: 'mock',
    customerId: 'cus_test',
  } as UserSubscription['billing'],
};

export function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    userState: baseUser,
    engineOutput: baseEngine,
    history: [],
    lastCycleResult: null,
    isCompletingCycle: false,
    showCycleSuccess: false,
    timerSeconds: baseEngine.riskTimer.minutes * 60,
    pendingConfirmation: false,
    featureFlags: baseFlags,
    subscription: baseSubscription,
    lastIntakeBurstAt: 0,
    hasSeenOnboarding: false,
    notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    unitPreferences: { weight: 'lbs', temperature: 'F', volume: 'oz', height: 'ft' },
    profileIdentity: { ...DEFAULT_PROFILE_IDENTITY },
    ...overrides,
  };
}

export function makeCycleResult(scoreAfter = 80): CycleResult {
  return {
    id: 'cyc-1',
    timestamp: new Date(FIXED_NOW),
    scoreBefore: 70,
    scoreAfter,
    gainDisplay: scoreAfter >= 70 ? `+${scoreAfter - 70}` : `${scoreAfter - 70}`,
    identityMessage: 'You are AForce.',
    nextCycleHint: 'Stay sharp.',
    state: 'PEAK',
  };
}

export function makeHistoryEntry(id = 'h-1'): HistoryEntry {
  return {
    id,
    timestamp: new Date(FIXED_NOW),
    score: 80,
    state: 'PEAK',
    action: 'Logged AForce Stick (12 ounces)',
    unitsTaken: 1,
    fluidType: 'aforce_stick',
  };
}
