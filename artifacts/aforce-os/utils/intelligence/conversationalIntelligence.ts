/**
 * Section 64 — Conversational Intelligence Architecture™ (policy, STEP 1, headless).
 *
 * The AI Coach is NOT a reactive chatbot. This pure policy layer encodes the two
 * behaviors that make it conversational-intelligent, for a later step to wire
 * into the voice layer:
 *
 *  1. Full-context assembly — `assembleCoachContext` composes the signals the
 *     coach already holds (HydroState, the current command, Recovery Window, a
 *     ready §61 daily lesson) so the coach never starts from zero.
 *  2. Silent Intelligence — `decideProactiveSpeech` speaks first ONLY when it
 *     adds value (Water-First priority) and stays silent otherwise (Constitution
 *     Principle 6). It never speaks to fill silence or maximize engagement.
 *
 * It builds NO new data architecture (spec §64) — it reads already-derived
 * signals, injected as inputs. Any rendered line is observation-only, governed
 * by conversationalLanguage.ts.
 *
 * HARD LOCKS: pure + RN-free (type-only imports); Score-Protection (reads no
 * score-mutating path, dispatches nothing, never awards/mutates score); no
 * fabrication (absent signals → silence, never an invented reason to speak).
 */
import type { PerformanceLevel } from '../../types';
import { levelToMode, type VoiceUrgencyMode } from '../../types/voicePersona';
import type { CommandUrgency } from './commandCategory';

/** A high-value moment the coach may speak to, in Water-First priority order. */
export type CoachTrigger = 'urgent_command' | 'recovery_window' | 'daily_lesson';

/** The already-derived signals the coach loads. Injected — nothing is fetched here. */
export interface CoachSignals {
  level: PerformanceLevel;
  score: number;
  /** Urgency of the current Today's Command. */
  urgency: CommandUrgency;
  /** The current command's spoken action (Water-First). */
  commandAction: string;
  /** Whether the user has already acted on today's command (no nagging). */
  commandFollowedToday: boolean;
  /** Recovery Window is open right now. */
  recoveryWindowActive: boolean;
  /** A ready, notable §61 daily lesson exists (kind === 'lesson'). */
  hasDailyLesson: boolean;
}

/** The assembled context — the coach's "loaded" state, never zero. */
export interface CoachContext extends CoachSignals {
  /** Persona/tone mode derived from the band (peak/balanced/recovering/depleted). */
  mode: VoiceUrgencyMode;
}

export interface ProactiveDecision {
  /** Whether the coach should speak first, unprompted. */
  speak: boolean;
  /** The value moment being spoken to, or null when silent. */
  trigger: CoachTrigger | null;
  /** Human-readable rationale (for logs/tests; never shown to the user). */
  reason: string;
}

export interface ProactiveLine {
  /** i18n key for the observation-only proactive line. */
  lineKey: string;
  /** Interpolation params for the line. */
  params: Record<string, string | number>;
  /** Persona/tone mode to render it in. */
  mode: VoiceUrgencyMode;
}

/**
 * Compose the coach's full context from already-derived signals. Pure — it only
 * adds the derived persona mode; it never fetches or fabricates a signal.
 */
export function assembleCoachContext(signals: CoachSignals): CoachContext {
  return { ...signals, mode: levelToMode(signals.level) };
}

/**
 * Decide whether to speak first, and to which value moment. Water-First
 * priority: an unacted high-urgency command wins, then an open Recovery Window,
 * then a notable daily lesson. When nothing adds value, stay SILENT — that is a
 * form of trust, not a gap (Constitution Principle 6).
 */
export function decideProactiveSpeech(ctx: CoachContext): ProactiveDecision {
  if ((ctx.urgency === 'high' || ctx.urgency === 'critical') && !ctx.commandFollowedToday) {
    return { speak: true, trigger: 'urgent_command', reason: 'Unacted high-urgency command — speak Water-First.' };
  }
  if (ctx.recoveryWindowActive) {
    return { speak: true, trigger: 'recovery_window', reason: 'Recovery Window is open.' };
  }
  if (ctx.hasDailyLesson) {
    return { speak: true, trigger: 'daily_lesson', reason: 'A notable daily lesson is ready.' };
  }
  return { speak: false, trigger: null, reason: 'Nothing adds value right now — stay silent.' };
}

/**
 * The proactive line to speak, or `null` when the policy says stay silent. The
 * key resolves to observation-only copy (`coachIntelligence.*`, guard-tested);
 * `mode` carries the persona/tone for the voice layer to render.
 */
export function proactiveLine(ctx: CoachContext): ProactiveLine | null {
  const decision = decideProactiveSpeech(ctx);
  if (!decision.speak || decision.trigger === null) return null;
  return {
    lineKey: `coachIntelligence.${decision.trigger}`,
    params: { action: ctx.commandAction, score: ctx.score },
    mode: ctx.mode,
  };
}

/** One step of the proactive loop: the dedupe key to carry forward, and the
 *  line to speak now (null = stay silent). */
export interface ProactiveStep {
  /** Dedupe key for the current utterance; null when there's no active trigger. */
  key: string | null;
  /** The line to speak this tick, or null to stay silent. */
  utterance: ProactiveLine | null;
}

/**
 * The silence gate + de-duplication, as a pure step. Given the previously-spoken
 * key and the current context:
 *  - No active trigger → silent, and key resets to null so a future trigger can
 *    re-speak.
 *  - Same utterance as last time → silent (never repeat a still-active trigger).
 *  - A genuinely new value moment → speak it.
 *
 * The key encodes the trigger AND the specific command for `urgent_command`, so a
 * NEW command re-speaks while the same one never nags. Pure — the caller holds
 * `prevKey` across ticks.
 */
export function nextProactiveUtterance(prevKey: string | null, ctx: CoachContext): ProactiveStep {
  const decision = decideProactiveSpeech(ctx);
  if (!decision.speak || decision.trigger === null) {
    return { key: null, utterance: null };
  }
  const key =
    decision.trigger === 'urgent_command'
      ? `urgent_command:${ctx.commandAction}`
      : decision.trigger;
  if (key === prevKey) return { key, utterance: null };
  return { key, utterance: proactiveLine(ctx) };
}
