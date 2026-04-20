/**
 * AForce OS Mock Data
 * Realistic mocked sensor, behavioral, and user data.
 * No real sensor or API integration in V1.
 */

import type { UserState, UserProfile, HistoryEntry } from '../types';

// ─── Mock User State (starting realistic scenario) ────────────────────────────
export const defaultUserState: UserState = {
  unitsConsumedToday: 4,
  lastIntakeTime: new Date(Date.now() - 38 * 60 * 1000), // 38 min ago
  symptomState: 'none',
  heatLoad: 4,      // moderate heat
  sweatRate: 3,     // moderate sweat
  activityLevel: 5, // active day
  complianceStreak: 4,
  dailyTarget: 8,
  isSnoozed: false,
  snoozeUntil: null,
};

// ─── Mock User Profile ────────────────────────────────────────────────────────
export const mockUserProfile: UserProfile = {
  name: 'Alex',
  subscriptionTier: 'pro',
  dailyTarget: 8,
  remindersEnabled: true,
  connectedDevices: ['Apple Watch Ultra', 'Oura Ring'],
};

// ─── Mock History Entries (last 5 actions) ────────────────────────────────────
export const mockHistory: HistoryEntry[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 52 * 60 * 1000),
    score: 78,
    state: 'BALANCED',
    action: 'Take 1 AForce stick now.',
    unitsTaken: 1,
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 115 * 60 * 1000),
    score: 65,
    state: 'RECOVERING',
    action: 'Take 1 unit now. Recheck in 15 minutes.',
    unitsTaken: 1,
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 180 * 60 * 1000),
    score: 91,
    state: 'PEAK',
    action: 'Take 1 unit now. You are on pace.',
    unitsTaken: 1,
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 240 * 60 * 1000),
    score: 55,
    state: 'DEPLETED',
    action: 'Take 2 units now. Critical.',
    unitsTaken: 2,
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 300 * 60 * 1000),
    score: 84,
    state: 'BALANCED',
    action: 'Take 1 AForce stick now.',
    unitsTaken: 1,
  },
];

// ─── Mock Phantom Signal / Contextual Data ─────────────────────────────────────
export const phantomSignalData = {
  estimatedCoreTemp: 98.6 + (Math.random() * 0.8),
  ambientTempF: 82,
  activityLabel: 'Light Training',
  heartRateBPM: 74,
  hrv: 52,
  vo2Estimate: 44,
  lastSyncLabel: 'Just now',
};

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
