/**
 * Circle definitions for AForce Circles.
 *
 * REACTIONS and DEFAULT_PRIVACY are real product decisions — the reaction
 * vocabulary and the default share scope. They stay.
 *
 * The member / status / challenge / notification seeds below are EMPTY by
 * founder ruling (Wave-4). `circleService` used to boot from them AND fall
 * back to them whenever `/api/circle/*` failed, so a user with no friends —
 * or no network — was shown seven invented people with invented scores,
 * rendered identically to real ones. Under the Constitution ("observation
 * never diagnosis", "trust over attention") the only honest options are real
 * data or an honest empty. The exports are kept so the shapes stay declared
 * (and so refilling one cannot silently reach the service, which no longer
 * imports them) until the endpoints are the only source.
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

export const MOCK_CIRCLE_USERS: CircleUser[] = [];

export const MOCK_SHARED_STATUSES: Record<string, SharedStatus> = {};

export const MOCK_CHALLENGES: CircleChallenge[] = [];

export const MOCK_NOTIFICATIONS: CircleNotification[] = [];

export const DEFAULT_PRIVACY: PrivacySettings = {
  // Founder ruling 2026-08-27 (community-sharing relocation): PRIVATE by
  // default — supersedes the previously recorded 'circle' default. Nothing
  // is shared until the member explicitly widens the scope.
  scope: 'private',
  fields: { score: true, state: true, streak: true, protocol: true, trend: true },
};
