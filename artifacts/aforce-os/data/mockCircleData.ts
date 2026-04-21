/**
 * Mock circle data for AForce Circles. Replace with real API once the
 * api-server `share.created` / `circle.*` endpoints ship.
 */

import type {
  CircleUser, SharedStatus, ReactionDef, CircleChallenge, CircleNotification,
  PrivacySettings,
} from '@/types/circle';

export const REACTIONS: ReactionDef[] = [
  { id: 'stay_on_cadence',  label: 'Stay on cadence' },
  { id: 'strong_recovery',  label: 'Strong recovery',   appropriateFor: ['Recovering', 'Balanced'] },
  { id: 'back_in_control',  label: 'Back in control',   appropriateFor: ['Recovering', 'Balanced', 'Peak'] },
  { id: 'catch_up_now',     label: 'Catch up now',      appropriateFor: ['Depleted', 'Recovering'] },
  { id: 'trending_down',    label: "You're trending down", appropriateFor: ['Recovering', 'Depleted'] },
  { id: 'finish_the_cycle', label: 'Finish the cycle' },
  { id: 'elite_today',      label: 'Elite today',       appropriateFor: ['Peak'] },
  { id: 'hold_the_line',    label: 'Hold the line' },
];

export const MOCK_CIRCLE_USERS: CircleUser[] = [
  { userId: 'u_kai',     name: 'Kai Reeves',      initials: 'KR', city: 'Miami',     group: 'friends', status: 'active', joinedAt: '2026-03-12T10:00:00Z' },
  { userId: 'u_sasha',   name: 'Sasha Lin',       initials: 'SL', city: 'Brooklyn',  group: 'friends', status: 'active', joinedAt: '2026-03-14T10:00:00Z' },
  { userId: 'u_marcus',  name: 'Marcus Webb',     initials: 'MW', city: 'Austin',    group: 'team',    status: 'active', joinedAt: '2026-02-04T10:00:00Z' },
  { userId: 'u_devon',   name: 'Devon Reyes',     initials: 'DR', city: 'San Diego', group: 'team',    status: 'active', joinedAt: '2026-02-04T10:00:00Z' },
  { userId: 'u_riley',   name: 'Riley Park',      initials: 'RP', city: 'Seattle',   group: 'team',    status: 'active', joinedAt: '2026-02-09T10:00:00Z' },
  { userId: 'u_coach_j', name: 'Coach Jordan',    initials: 'CJ', city: 'Tampa',     group: 'coach',   status: 'active', joinedAt: '2026-01-22T10:00:00Z' },
  { userId: 'u_mom',     name: 'Mom',             initials: 'M',  city: 'Phoenix',   group: 'family',  status: 'active', joinedAt: '2026-01-04T10:00:00Z' },
  { userId: 'u_ari',     name: 'Ari Cohen',       initials: 'AC', city: 'Denver',    group: 'friends', status: 'pending', joinedAt: '2026-04-15T10:00:00Z' },
];

export const MOCK_SHARED_STATUSES: Record<string, SharedStatus> = {
  u_kai:     { userId: 'u_kai',     score: 92, state: 'Peak',       streakDays: 18, protocolComplete: true,  trend: 'up',   updatedAt: '2026-04-21T14:02:00Z' },
  u_sasha:   { userId: 'u_sasha',   score: 84, state: 'Balanced',   streakDays: 11, protocolComplete: true,  trend: 'flat', updatedAt: '2026-04-21T14:01:00Z' },
  u_marcus:  { userId: 'u_marcus',  score: 78, state: 'Balanced',   streakDays:  7, protocolComplete: false, trend: 'up',   updatedAt: '2026-04-21T13:55:00Z' },
  u_devon:   { userId: 'u_devon',   score: 61, state: 'Recovering', streakDays:  3, protocolComplete: false, trend: 'down', updatedAt: '2026-04-21T13:48:00Z' },
  u_riley:   { userId: 'u_riley',   score: 88, state: 'Peak',       streakDays: 22, protocolComplete: true,  trend: 'up',   updatedAt: '2026-04-21T13:59:00Z' },
  u_coach_j: { userId: 'u_coach_j', score: 81, state: 'Balanced',   streakDays: 31, protocolComplete: true,  trend: 'flat', updatedAt: '2026-04-21T13:30:00Z' },
  u_mom:     { userId: 'u_mom',     score: 72, state: 'Balanced',   streakDays: 14, protocolComplete: true,  trend: 'up',   updatedAt: '2026-04-21T12:50:00Z' },
};

export const MOCK_CHALLENGES: CircleChallenge[] = [
  {
    id: 'ch_1',
    fromUserId: 'u_kai',
    kind: 'match_my_score',
    targetScore: 92,
    expiresAt: '2026-04-22T00:00:00Z',
    status: 'open',
    createdAt: '2026-04-21T13:00:00Z',
  },
  {
    id: 'ch_2',
    fromUserId: 'u_coach_j',
    kind: 'weekly_consistency',
    expiresAt: '2026-04-27T00:00:00Z',
    status: 'open',
    createdAt: '2026-04-21T08:00:00Z',
  },
];

export const MOCK_NOTIFICATIONS: CircleNotification[] = [
  { id: 'n1', kind: 'protocol_complete', fromUserId: 'u_kai',     message: 'Kai finished today\'s protocol.',                createdAt: '2026-04-21T13:45:00Z', read: false },
  { id: 'n2', kind: 'streak_milestone',  fromUserId: 'u_riley',   message: 'Riley hit a 21 day streak.',                     createdAt: '2026-04-21T11:10:00Z', read: false },
  { id: 'n3', kind: 'reaction_received', fromUserId: 'u_coach_j', message: 'Coach Jordan reacted: Hold the line.',           createdAt: '2026-04-21T10:32:00Z', read: true  },
  { id: 'n4', kind: 'friend_trending_down', fromUserId: 'u_devon', message: 'Devon is trending down. A check-in helps.',     createdAt: '2026-04-21T09:14:00Z', read: false },
];

export const DEFAULT_PRIVACY: PrivacySettings = {
  scope: 'circle',
  fields: { score: true, state: true, streak: true, protocol: true, trend: true },
};
