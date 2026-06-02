/**
 * AForce OS Mock Data
 * Realistic mocked sensor, behavioral, and user data.
 * No real sensor or API integration in V1.
 */

import type { UserState, UserProfile, HistoryEntry, RosterPlayer } from '../types';

// ─── Mock User State ──────────────────────────────────────────────────────────
export const defaultUserState: UserState = {
  // Demo seed: tuned so the scoring engine yields a BALANCED score
  // (76) on first home view after the lobby splash, matching the
  // teal "Performance stable" reference design.
  unitsConsumedToday: 5,
  aforceUnitsToday: 3,
  language: 'en',
  ozConsumedToday: 45,
  lastIntakeTime: new Date(Date.now() - 12 * 60 * 1000),
  lastIntakeType: 'aforce_stick',
  symptomState: 'none',
  symptoms: [],
  urineSignal: 2, // 1 clear → 8 dark
  energyState: 'steady',
  heatLoad: 3,
  sweatRate: 3,
  activityLevel: 4,
  complianceStreak: 5,
  dailyTarget: 8,
  ozTarget: 96,
  isSnoozed: false,
  snoozeUntil: null,
  bodyWeightLbs: 180,
  isAwake: true,
  wakeTime: new Date(new Date().setHours(6, 30, 0, 0)),
  overnightLossOz: 6,
  hasSeenMorningCommand: true,
  // Sensible dev defaults so the inventory-gated Recovery Protocol card
  // shows the full range of options out of the box. Real builds will
  // sync this from the inventory service / store.
  inventory: { sticks: 6, rtd: 2, canister: 12 },
};

// ─── Mock Profile ─────────────────────────────────────────────────────────────
export const mockUserProfile: UserProfile = {
  name: 'Brandon',
  nickname: 'MiamiPulse',
  city: 'Miami',
  country: 'USA',
  teamCircle: 'South Beach Run Club',
  streakDays: 12,
  territoryBadge: 'MIAMI HEAT ZONE',
  auraState: 'FLOW',
  subscriptionTier: 'core',
  dailyTarget: 8,
  bodyWeightLbs: 180,
  remindersEnabled: true,
  connectedDevices: ['Apple Watch Ultra', 'Oura Ring'],
  wakeTimeHHMM: '06:30',
  activityType: 'Field Athlete',
};

// ─── Mock History ─────────────────────────────────────────────────────────────
export const mockHistory: HistoryEntry[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 52 * 60 * 1000),
    score: 78,
    state: 'BALANCED',
    action: 'Drink 16 ounces now. Recheck in 20 minutes.',
    unitsTaken: 1,
    fluidType: 'aforce_stick',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 115 * 60 * 1000),
    score: 65,
    state: 'RECOVERING',
    action: 'Recommended next action. Recheck in 15 mins.',
    unitsTaken: 1,
    fluidType: 'aforce_stick',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 180 * 60 * 1000),
    score: 91,
    state: 'PEAK',
    action: 'Drink 8 ounces before next session. You are on pace.',
    unitsTaken: 1,
    fluidType: 'water',
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 240 * 60 * 1000),
    score: 55,
    state: 'DEPLETED',
    action: 'Recovery mode recommended. Drink 20 oz with electrolytes.',
    unitsTaken: 2,
    fluidType: 'aforce_stick',
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 300 * 60 * 1000),
    score: 84,
    state: 'BALANCED',
    action: 'Drink 12 ounces now. Maintain rhythm.',
    unitsTaken: 1,
    fluidType: 'aforce_rtd',
  },
];

// ─── Phantom signal data (mocked sensor stream) ───────────────────────────────
export const phantomSignalData = {
  estimatedCoreTemp: 98.6 + (Math.random() * 0.8),
  ambientTempF: 82,
  activityLabel: 'Light Training',
  heartRateBPM: 74,
  hrv: 52,
  vo2Estimate: 44,
  lastSyncLabel: 'Just now',
};

// ─── Mock symptoms catalog ────────────────────────────────────────────────────
export const SYMPTOM_CATALOG = [
  { id: 'headache', label: 'Headache' },
  { id: 'cramp', label: 'Muscle Cramp' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'dizzy', label: 'Lightheaded' },
  { id: 'dry_mouth', label: 'Dry Mouth' },
  { id: 'low_focus', label: 'Low Focus' },
];

// ─── Hydration Signal Check (urine color scale) ───────────────────────────────
export const HYDRATION_SIGNAL_SCALE = [
  { value: 1, label: 'Clear', color: '#E6F7FF', tier: 'OPTIMAL' },
  { value: 2, label: 'Pale Straw', color: '#FFF8B5', tier: 'OPTIMAL' },
  { value: 3, label: 'Light Yellow', color: '#FFE978', tier: 'OPTIMAL' },
  { value: 4, label: 'Yellow', color: '#FFD83D', tier: 'WATCH' },
  { value: 5, label: 'Dark Yellow', color: '#FFA01E', tier: 'WATCH' },
  { value: 6, label: 'Amber', color: '#E07A00', tier: 'RECOVERY' },
  { value: 7, label: 'Brown-Amber', color: '#A85100', tier: 'CRITICAL' },
  { value: 8, label: 'Brown', color: '#5A2C00', tier: 'CRITICAL' },
];

// ─── Energy state options ─────────────────────────────────────────────────────
export const ENERGY_STATE_OPTIONS = [
  { value: 'peak', label: 'OPTIMAL', desc: 'Locked in. Elite output.', color: '#B6FF00' },
  { value: 'steady', label: 'STEADY', desc: 'On rhythm. Sustainable.', color: '#00E5C8' },
  { value: 'low', label: 'LOW', desc: 'Output is dropping.', color: '#FFA01E' },
  { value: 'crashed', label: 'CRASHED', desc: 'Performance compromised.', color: '#FF2800' },
] as const;

// ─── Mock rosters — Phase 2 / 3 demo dashboards ───────────────────────────────
// Two distinct demo rosters so the Clutch (coach) and Guardian
// (athletic trainer / medical) screens visibly target different
// audiences. Real player names + positions for pitch credibility;
// hydration / risk values are fabricated to span every band so coaches
// and ATs see the full UI in one screen.
//
// CLUTCH  → Duke Men's Basketball  (NCAA, in-game command surface)
// GUARDIAN → Los Angeles Lakers    (NBA, roster protection / medical)
export const CLUTCH_TEAM_NAME = 'DUKE BASKETBALL';
export const CLUTCH_TEAM_ABBR = 'DUKE';
export const GUARDIAN_TEAM_NAME = 'LOS ANGELES LAKERS';
export const GUARDIAN_TEAM_ABBR = 'LAL';

// Duke Men's Basketball — used by Clutch (Phase 2).
export const mockRosterClutch: RosterPlayer[] = [
  { id: 'duke-12', name: 'C. Boozer',    position: 'PF', hydrationScore: 92, state: 'PEAK',       guardianRisk: 13 },
  { id: 'duke-2',  name: 'C. Boozer Jr', position: 'PG', hydrationScore: 81, state: 'BALANCED',   guardianRisk: 27 },
  { id: 'duke-21', name: 'I. Evans',     position: 'SF', hydrationScore: 74, state: 'RECOVERING', guardianRisk: 41 },
  { id: 'duke-1',  name: 'C. Foster',    position: 'SG', hydrationScore: 86, state: 'BALANCED',   guardianRisk: 24 },
  { id: 'duke-34', name: 'P. Ngongba',   position: 'C',  hydrationScore: 49, state: 'DEPLETED',   guardianRisk: 79 },
  { id: 'duke-7',  name: 'M. Brown',     position: 'PF', hydrationScore: 71, state: 'RECOVERING', guardianRisk: 47 },
  { id: 'duke-3',  name: 'S. James',     position: 'SG', hydrationScore: 88, state: 'BALANCED',   guardianRisk: 21 },
  { id: 'duke-13', name: 'N. Khamenia',  position: 'SF', hydrationScore: 65, state: 'RECOVERING', guardianRisk: 55 },
];

// Los Angeles Lakers — used by Guardian (Phase 3).
export const mockRosterGuardian: RosterPlayer[] = [
  { id: 'lal-23', name: 'L. James',      position: 'SF', hydrationScore: 91, state: 'PEAK',       guardianRisk: 14 },
  { id: 'lal-77', name: 'L. Dončić',     position: 'PG', hydrationScore: 68, state: 'RECOVERING', guardianRisk: 52 },
  { id: 'lal-15', name: 'A. Reaves',     position: 'SG', hydrationScore: 84, state: 'BALANCED',   guardianRisk: 26 },
  { id: 'lal-28', name: 'R. Hachimura',  position: 'PF', hydrationScore: 78, state: 'BALANCED',   guardianRisk: 31 },
  { id: 'lal-5',  name: 'D. Ayton',      position: 'C',  hydrationScore: 47, state: 'DEPLETED',   guardianRisk: 83 },
  { id: 'lal-1',  name: 'D. Russell',    position: 'PG', hydrationScore: 73, state: 'RECOVERING', guardianRisk: 44 },
  { id: 'lal-7',  name: 'J. Vanderbilt', position: 'PF', hydrationScore: 88, state: 'BALANCED',   guardianRisk: 19 },
  { id: 'lal-10', name: 'J. Hayes',      position: 'C',  hydrationScore: 62, state: 'RECOVERING', guardianRisk: 58 },
];

// Back-compat alias — older imports still pull `mockRoster`. Points at
// the Guardian roster so any unmigrated reference keeps rendering
// real-looking data instead of crashing.
export const mockRoster = mockRosterGuardian;
export const TEAM_NAME = GUARDIAN_TEAM_NAME;
export const TEAM_ABBR = GUARDIAN_TEAM_ABBR;

// ─── Format helpers ───────────────────────────────────────────────────────────
export function formatTimeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
