/**
 * AForce Voice Engine — persona, tone, and template types.
 *
 * The voice is NOT a chatbot or assistant. It is a calm, decisive performance
 * coach. Every spoken line follows the formula:
 *     STATE/CONTEXT + ACTION + TIMING + OUTCOME
 *
 * These types describe the rules that enforce that contract end-to-end so the
 * orchestrator (voiceService) and the TTS layer (textToSpeech) stay aligned.
 */

import type { PerformanceLevel } from './index';

/** Maps 1:1 to PerformanceLevel but lower-cased for tone-rule lookup keys. */
export type VoiceUrgencyMode = 'peak' | 'balanced' | 'recovering' | 'depleted';

/** Categories of spoken content the engine can produce. */
export type VoiceTemplateCategory =
  | 'score_update'
  | 'next_action'
  | 'recovery_command'
  | 'intake_confirmation'
  | 'heat_warning'
  | 'competition_update'
  | 'morning_reset'
  | 'product_comparison'
  | 'subscription_locked'
  | 'team_alert';

/** Tone label — used for analytics and TTS selection only, not user-facing. */
export type VoiceToneLabel =
  | 'steady_affirming'   // PEAK
  | 'controlled_guiding' // BALANCED
  | 'firm_calm'          // RECOVERING
  | 'urgent_calm';       // DEPLETED

/** Where each segment of the response formula goes. */
export type ResponseSegment = 'state' | 'action' | 'timing' | 'outcome';

/**
 * A tone rule is the per-mode contract: how many sentences, what's banned,
 * and which segments must appear in the spoken line.
 */
export interface ToneRule {
  mode: VoiceUrgencyMode;
  tone: VoiceToneLabel;
  /** Hard ceiling — spoken lines beyond this are clipped. */
  max_sentences: 1 | 2;
  /** Hard ceiling on word count for the spoken line. */
  max_words: number;
  /** Forbidden phrases (case-insensitive substring match). */
  forbidden_phrases: readonly string[];
  /**
   * Documented ordering of segments in the spoken line.
   * Templates in voiceTemplates.ts are authored to satisfy this pattern; the
   * runtime engine does not parse spoken lines back into segments (too fragile)
   * — this field is the design contract reviewers and template authors check
   * against. Update templates AND this pattern together when extending.
   */
  response_pattern: readonly ResponseSegment[];
}

/**
 * VoiceProfile — TTS playback parameters for one mode.
 * Urgency is expressed through phrasing AND a small rate/pitch nudge,
 * never through volume or dramatic inflection.
 */
export interface VoiceProfile {
  mode: VoiceUrgencyMode;
  /** SpeechSynthesis rate. Defaults around 0.95 — measured pace. */
  speech_rate: number;
  /** SpeechSynthesis pitch. Stay tight to 1.0 to avoid sounding robotic. */
  pitch: number;
  /** SpeechSynthesis volume (0–1). Always 1.0 — urgency is phrasing, not volume. */
  volume: number;
}

/**
 * A response template owned by a (mode, category) pair.
 * Tokens use {curly} placeholders that voiceTemplateEngine fills in.
 *   {score}        → integer
 *   {action}       → imperative phrase from engine
 *   {recheck}      → minutes until recheck (integer)
 *   {state}        → mode label, capitalized ("Peak", "Recovering")
 *   {fluid}        → "water" / "AForce stick" / etc.
 *   {symptoms}     → comma-joined symptom labels
 *   {oz}           → ounces to drink
 *   {team_player}  → e.g. "Player 12"
 *   {competitor}   → e.g. "Miami"
 */
export interface VoiceResponseTemplate {
  category: VoiceTemplateCategory;
  mode: VoiceUrgencyMode;
  /** Spoken line (TTS reads this). 1–2 short sentences. */
  spoken: string;
  /** Optional secondary line for the response card. */
  detail?: string;
}

/** Runtime context passed to the template engine when filling tokens. */
export interface VoiceContext {
  mode: VoiceUrgencyMode;
  score: number;
  /** Default 20 min when not provided. */
  recheck_minutes?: number;
  /** Default '' (most templates do not use {action}). */
  command_action?: string;
  fluid?: string;
  symptoms?: string[];
  oz?: number;
  team_player?: string;
  competitor?: string;
  /** Heat Guard band — passed through for analytics, not currently tokenized. */
  heat_band?: string;
}

/** Convert engine PerformanceLevel → mode key. */
export function levelToMode(level: PerformanceLevel): VoiceUrgencyMode {
  return level.toLowerCase() as VoiceUrgencyMode;
}
