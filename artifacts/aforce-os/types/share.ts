/**
 * Share types — shape of what AForce OS shares to the world.
 *
 * Sharing in AForce is NOT social media. There is no feed, no likes, no
 * comments. A share is a system-generated proof point: a scoreboard
 * snapshot, a state change, a streak. It exits the app via the OS share
 * sheet and disappears.
 */

export type ShareFormat = 'card' | 'story' | 'text';

export type ShareType =
  | 'score'        // "Balanced at 88"
  | 'state'        // current pulse state (Peak/Balanced/Recovering/Depleted)
  | 'gain'         // "+12 today"
  | 'streak'       // "7 day consistency streak"
  | 'protocol'    // "Recovery cycle completed"
  | 'rank'         // "Top 5 in Miami" / "#1 in my team"
  | 'heat_save'    // "Heat risk detected and corrected"
  | 'command'      // "System executed"
  | 'reset';       // "Daily system reset complete"

export type StateLabel = 'Peak' | 'Balanced' | 'Recovering' | 'Depleted';

/**
 * Domain context for the template engine. Only the fields relevant to a
 * given ShareType are required by the engine; others are optional.
 */
export interface ShareContext {
  type: ShareType;
  score?: number;
  state?: StateLabel;
  /** signed delta — `+12` or `-5` */
  delta?: number;
  /** consecutive days for streak */
  streakDays?: number;
  /** "Top 5 in Miami", "#1 on my team", etc. */
  rankLabel?: string;
  /** label for protocol completion ("Recovery", "Pre-game", etc.) */
  protocolLabel?: string;
}

/** Output of the template engine — one variation. */
export interface ShareMessageVariation {
  id: string;
  text: string;
}

/** Final, ready-to-share object. */
export interface ShareItem {
  shareId: string;
  type: ShareType;
  format: ShareFormat;
  message: string;
  context: ShareContext;
  createdAt: string;
}
