/**
 * AForce OS achievements catalog.
 *
 * Pure data — both the client (AchievementsScreen) and the server
 * (`/api/aforce/achievements` compute path) read this list.
 *
 * Codes are stable identifiers persisted in `aforce_achievements.code`,
 * never user-facing. `title` / `description` are for the badge UI;
 * `criterion` is the human-readable unlock requirement; `progress`
 * (when present) returns 0–1 so the UI can render a partial bar.
 */

export type AchievementCode =
  | 'first_sip'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'sodium_master'
  | 'heat_survivor'
  | 'recovery_rookie'
  | 'social_sentinel'
  | 'aforce_convert'
  | 'hydration_engineer'
  | 'pdf_pioneer'
  | 'sensor_sync';

export interface AchievementDefinition {
  code: AchievementCode;
  title: string;
  description: string;
  criterion: string;
  /** Feather icon name for the badge tile. */
  icon: string;
  /** Visual sort order on the grid (lower = earlier). */
  order: number;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    code: 'first_sip',
    title: 'First Sip',
    description: 'You logged your first intake.',
    criterion: 'Log any drink (manual, auto, or sensor).',
    icon: 'droplet',
    order: 1,
  },
  {
    code: 'streak_3',
    title: 'Three in a Row',
    description: 'Three consecutive days of intake activity.',
    criterion: 'Three consecutive days with at least one logged intake.',
    icon: 'check-circle',
    order: 2,
  },
  {
    code: 'streak_7',
    title: 'One-Week Wave',
    description: 'A full week of consistent hydration.',
    criterion: 'Seven consecutive days with logged intake.',
    icon: 'calendar',
    order: 3,
  },
  {
    code: 'streak_30',
    title: 'Thirty-Day Force',
    description: 'A full month, every day.',
    criterion: 'Thirty consecutive days with logged intake.',
    icon: 'award',
    order: 4,
  },
  {
    code: 'sodium_master',
    title: 'Sodium Master',
    description: 'Four end-of-day deficits ≤ 5 %.',
    criterion: '4 days where final score snapshot has deficit_pct ≤ 5.',
    icon: 'target',
    order: 5,
  },
  {
    code: 'heat_survivor',
    title: 'Heat Survivor',
    description: 'PEAK while Heat Guard was active.',
    criterion: 'Hit PEAK band on any day with a Heat Guard snapshot.',
    icon: 'sun',
    order: 6,
  },
  {
    code: 'recovery_rookie',
    title: 'Recovery Rookie',
    description: 'First successful Recovery window.',
    criterion: 'Snapshot recorded with autopilotActive=true.',
    icon: 'shield',
    order: 7,
  },
  {
    code: 'social_sentinel',
    title: 'Social Sentinel',
    description: 'Stayed hydrated through a Social Mode session.',
    criterion: 'Snapshot recorded with socialActive=true.',
    icon: 'users',
    order: 8,
  },
  {
    code: 'aforce_convert',
    title: 'AForce Convert',
    description: '10 AForce units in a single day.',
    criterion: 'Any snapshot with aforceUnitsToday ≥ 10.',
    icon: 'zap',
    order: 9,
  },
  {
    code: 'hydration_engineer',
    title: 'Hydration Engineer',
    description: '30 score snapshots written.',
    criterion: '30 rows in aforce_score_snapshots for this user.',
    icon: 'activity',
    order: 10,
  },
  {
    code: 'pdf_pioneer',
    title: 'PDF Pioneer',
    description: 'First Science methodology PDF exported.',
    criterion: 'First /achievements/unlock POST with code=pdf_pioneer.',
    icon: 'file-text',
    order: 11,
  },
  {
    code: 'sensor_sync',
    title: 'Sensor Sync',
    description: 'First sweat-sensor file imported.',
    criterion: 'First successful /sensors/import call.',
    icon: 'upload-cloud',
    order: 12,
  },
] as const;

export const ACHIEVEMENT_BY_CODE: Record<AchievementCode, AchievementDefinition> =
  Object.freeze(
    ACHIEVEMENTS.reduce((acc, a) => {
      acc[a.code] = a;
      return acc;
    }, {} as Record<AchievementCode, AchievementDefinition>),
  );

export interface AchievementUnlockState {
  code: AchievementCode;
  unlocked: boolean;
  /** ISO timestamp when unlocked, if known. */
  unlockedAt?: string;
  /** 0–1 progress hint for badges with countable criteria. */
  progress?: number;
}

