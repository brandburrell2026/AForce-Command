/**
 * AForce Circles — premium private performance accountability network.
 * No public feed, no comments, no badges. Selective by design.
 */

export type CircleGroup = 'friends' | 'team' | 'coach' | 'family';
export type TrendDirection = 'up' | 'flat' | 'down';
export type SharedStateLabel = 'Peak' | 'Balanced' | 'Recovering' | 'Depleted';
export type RelationshipStatus = 'pending' | 'active' | 'muted';

export interface CircleUser {
  userId: string;
  name: string;
  initials: string;          // avatar placeholder fallback
  city?: string;
  group: CircleGroup;
  status: RelationshipStatus;
  joinedAt: string;
}

export interface SharedStatus {
  userId: string;
  score: number;
  state: SharedStateLabel;
  streakDays: number;
  protocolComplete: boolean;
  trend: TrendDirection;
  /** Last time this status snapshot was published. */
  updatedAt: string;
}

export interface CircleFeedItem extends SharedStatus {
  user: CircleUser;
}

/** Performance-first reactions — never generic comments. */
export type ReactionId =
  | 'stay_on_cadence'
  | 'strong_recovery'
  | 'back_in_control'
  | 'catch_up_now'
  | 'trending_down'
  | 'finish_the_cycle'
  | 'elite_today'
  | 'hold_the_line';

export interface ReactionDef {
  id: ReactionId;
  label: string;
  /** Which states the reaction is appropriate for; empty = always. */
  appropriateFor?: SharedStateLabel[];
}

export interface Reaction {
  id: string;             // unique reaction record id
  fromUserId: string;
  toUserId: string;
  reaction: ReactionId;
  /** Optional short clean comment (constrained, no spam). */
  comment?: string;
  createdAt: string;
}

export type ChallengeKind =
  | 'match_my_score'
  | 'complete_your_cycle'
  | 'weekly_consistency'
  | 'circle_ranking';

export interface CircleChallenge {
  id: string;
  fromUserId: string;
  toUserId?: string;        // undefined = challenge to whole circle
  kind: ChallengeKind;
  targetScore?: number;     // for match_my_score
  expiresAt: string;
  status: 'open' | 'accepted' | 'completed' | 'expired';
  createdAt: string;
}

export type ShareScope = 'private' | 'circle' | 'team_coach' | 'public_card';

export interface PrivacySettings {
  scope: ShareScope;
  fields: {
    score: boolean;
    state: boolean;
    streak: boolean;
    protocol: boolean;
    trend: boolean;
  };
}

export interface CircleNotification {
  id: string;
  kind:
    | 'protocol_complete'
    | 'streak_milestone'
    | 'reaction_received'
    | 'challenge_received'
    | 'friend_trending_down';
  fromUserId: string;
  message: string;
  createdAt: string;
  read: boolean;
}
