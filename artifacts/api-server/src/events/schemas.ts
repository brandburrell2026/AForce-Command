/**
 * Canonical event envelope + payload schemas. Every state-changing action in
 * AForce OS emits exactly one event matching this shape. Consumers MUST be
 * idempotent on `eventId`.
 *
 * Schema versioning: bump `schemaVersion` on any non-additive change. Old
 * consumers continue running until migrated. Never remove a field; add new
 * ones as optional.
 */

export interface EventEnvelope<T = unknown> {
  /** UUIDv7 — sortable, unique. */
  eventId: string;
  /** Dotted topic name, see EVENT_TOPICS below. */
  eventType: string;
  /** Source-of-truth user. Used as Kafka partition key for per-user ordering. */
  userId: string;
  /** ISO-8601 UTC timestamp from the producer. */
  occurredAt: string;
  /** Bumped on any non-additive payload change. */
  schemaVersion: number;
  /** Optional correlation id linking events from one user action. */
  correlationId?: string;
  /** Service that emitted the event — for observability. */
  source: string;
  /** Payload — domain-specific. */
  payload: T;
}

export const EVENT_TOPICS = {
  intake_logged:        'intake.logged',
  symptom_updated:      'symptom.updated',
  urine_signal_updated: 'urine.signal.updated',
  energy_updated:       'energy.updated',
  protocol_completed:   'protocol.completed',
  score_recomputed:     'score.recomputed',
  ai_command_generated: 'ai.command.generated',
  heat_risk_changed:    'heat.risk.changed',
  rank_changed:         'rank.changed',
  hardware_signal:      'hardware.signal',
  subscription_changed: 'subscription.changed',
  share_created:        'share.created',
} as const;

export type EventTopic = typeof EVENT_TOPICS[keyof typeof EVENT_TOPICS];

// ─── Per-event payload contracts ────────────────────────────────────────────
export interface IntakeLoggedPayload {
  intakeId: string;
  fluidType: string;
  ozAmount: number;
  scoreBefore: number;
  scoreAfter: number;
}

export interface ScoreRecomputedPayload {
  scoreBefore: number;
  scoreAfter: number;
  level: 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';
  reasons: string[];
}

export interface HeatRiskChangedPayload {
  bandBefore: 'STABLE' | 'ELEVATED' | 'WARNING' | 'HIGH_RISK' | 'CRITICAL';
  bandAfter:  'STABLE' | 'ELEVATED' | 'WARNING' | 'HIGH_RISK' | 'CRITICAL';
  score: number;
}

export interface SubscriptionChangedPayload {
  planIdBefore: string | null;
  planIdAfter: string;
  status: 'active' | 'paused' | 'cancelled';
}

export interface ShareCreatedPayload {
  shareId: string;
  type: 'score' | 'state' | 'streak' | 'protocol' | 'rank' | 'heat_save' | 'reset';
  format: 'card' | 'story' | 'text';
  message: string;
}
