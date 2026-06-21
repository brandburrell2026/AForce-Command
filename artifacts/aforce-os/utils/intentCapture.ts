/**
 * Intent Capture™ — pure model + coaching-posture derivation.
 *
 * After the Voice Check-In (or, later, a Performance Statement) the user picks
 * one of three intents — Ready / Recovering / Not Today. The selection adjusts
 * the coach's TONE and INTENSITY, never the score: this module is strictly
 * READ-ONLY / pure (it imports nothing from services, stores, React, or I/O)
 * and nothing here awards or mutates a hydration point, performance band, or
 * recovery score (Score-Protection). Downstream surfaces read the captured
 * intent only to vary display-only / spoken coaching copy.
 */

// ─── Intent model ─────────────────────────────────────────────────────

/** The three selectable intents. */
export type IntentId = 'ready' | 'recovering' | 'notToday';

export const INTENT_IDS: readonly IntentId[] = [
  'ready',
  'recovering',
  'notToday',
] as const;

/** Where an intent selection originated (future Performance Statement reuse). */
export type IntentSource = 'voiceCheckIn' | 'performanceStatement';

export const INTENT_SOURCES: readonly IntentSource[] = [
  'voiceCheckIn',
  'performanceStatement',
] as const;

/** One persisted intent selection for a local day. */
export interface IntentRecord {
  /** Local calendar day, 'YYYY-MM-DD'. */
  dayKey: string;
  /** Local day number (integer) — ordering. */
  dayIndex: number;
  /** Epoch ms the intent was selected. */
  recordedAtMs: number;
  /** The selected intent. */
  intent: IntentId;
  /** What surface captured it. */
  source: IntentSource;
}

// ─── Coaching posture ─────────────────────────────────────────────────

/** How hard the coach should push, given today's declared intent. */
export type CoachingIntensity = 'push' | 'steady' | 'protect';

/** Copy key for tone-aware lines; 'neutral' when no intent is captured. */
export type CoachingToneKey = IntentId | 'neutral';

export interface CoachingPosture {
  /** How hard the coach should push today. */
  intensity: CoachingIntensity;
  /** Copy key for tone-aware spoken / display lines. */
  toneKey: CoachingToneKey;
}

// ─── Guards (pure) ────────────────────────────────────────────────────

/** Type guard for a known intent id. */
export function isIntentId(value: unknown): value is IntentId {
  return (
    typeof value === 'string' &&
    (INTENT_IDS as readonly string[]).includes(value)
  );
}

/** Type guard for a known intent source. */
export function isIntentSource(value: unknown): value is IntentSource {
  return (
    typeof value === 'string' &&
    (INTENT_SOURCES as readonly string[]).includes(value)
  );
}

// ─── Derivation (pure, total) ─────────────────────────────────────────

/**
 * Map an intent — or null/undefined when none has been captured — to a
 * coaching posture. Pure and total. An absent intent yields a NEUTRAL posture
 * (steady / 'neutral'), never a fabricated "ready": the coach simply stays at
 * its default tone until the user actually declares one (Score-Protection /
 * no-fabrication).
 */
export function coachingPostureForIntent(
  intent: IntentId | null | undefined,
): CoachingPosture {
  switch (intent) {
    case 'ready':
      return { intensity: 'push', toneKey: 'ready' };
    case 'recovering':
      return { intensity: 'steady', toneKey: 'recovering' };
    case 'notToday':
      return { intensity: 'protect', toneKey: 'notToday' };
    default:
      return { intensity: 'steady', toneKey: 'neutral' };
  }
}
