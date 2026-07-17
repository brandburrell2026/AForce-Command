/**
 * Voice Command System types.
 *
 * AForce OS Voice is NOT a chatbot. It is a command interface:
 *   user speaks → intent is classified → a single decisive action is executed
 *   → AForce returns ONE structured response (max 1–2 sentences).
 *
 * Seven command categories supported:
 *   1. Hydration Stick (LOG_INTAKE aforce_stick + COMPLETE_CYCLE)
 *   2. Drink (LOG_INTAKE water/rtd/canister, with optional ozOverride)
 *   3. AForce OS (OPEN_SCREEN → NAVIGATE)
 *   4. Smart Coaching (GET_COMMAND, GET_STATUS, START_PROTOCOL, COMPARE_PRODUCTS)
 *   5. Product Reorder (REORDER → NAVIGATE /store)
 *   6. Rewards / Social (OPEN_SCREEN → /achievements, /circles, /share, /competition)
 *   7. Performance Mode (SET_AUTOPILOT, ACTIVATE_SOCIAL, DEACTIVATE_SOCIAL)
 */

import type { FluidType } from './index';

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'responding'
  | 'error';

export type VoiceIntent =
  | 'LOG_INTAKE'
  | 'COMPLETE_CYCLE'
  | 'GET_STATUS'
  | 'GET_COMMAND'
  | 'UPDATE_SYMPTOMS'
  | 'START_PROTOCOL'
  | 'COMPARE_PRODUCTS'
  | 'OPEN_SCREEN'
  | 'REORDER'
  | 'SET_AUTOPILOT'
  | 'ACTIVATE_SOCIAL'
  | 'DEACTIVATE_SOCIAL'
  // Section 64 — a coach-initiated proactive line (no user transcript). Never
  // produced by `classifyTranscript`; emitted only by `buildProactiveCoachLine`.
  | 'PROACTIVE_COACH'
  | 'UNKNOWN';

/** Symptom ids the engine recognises (kept aligned with heatRiskEngine). */
export type VoiceSymptomId =
  | 'dizziness' | 'headache' | 'nausea'
  | 'cramping' | 'chills' | 'confusion' | 'fatigue';

/** Friendly screen handle the classifier uses; voiceService maps to a route. */
export type VoiceScreenTarget =
  | 'home' | 'profile' | 'journal' | 'store' | 'protocol'
  | 'scan' | 'cart' | 'rewards' | 'circles' | 'share' | 'ring'
  | 'competition' | 'territory' | 'science' | 'sweat' | 'heat'
  | 'cruise' | 'subscription';

export interface VoiceEntities {
  fluidType?: FluidType;
  symptoms?: VoiceSymptomId[];
  /** For LOG_INTAKE — overrides the default oz-per-serving. */
  ozOverride?: number;
  /** Number of sticks/units the user said ("log two sticks"). */
  repeat?: number;
  /** Target screen for OPEN_SCREEN. */
  screen?: VoiceScreenTarget;
  /** "on" / "off" toggle for SET_AUTOPILOT-style intents. */
  toggle?: 'on' | 'off';
  /** Which keyword triggered SET_AUTOPILOT — affects the spoken phrasing. */
  modePhrasing?: 'autopilot' | 'performance';
}

export interface VoiceClassification {
  intent: VoiceIntent;
  entities: VoiceEntities;
  confidence: number; // 0–1
}

/**
 * A descriptor of the side-effect the overlay should perform.
 * The orchestrator never touches the store directly — it returns one of
 * these descriptors and lets the overlay dispatch via useAppStore + router.
 */
export type VoiceAction =
  | { type: 'LOG_INTAKE'; fluidType: FluidType; ozOverride?: number; repeat?: number }
  | { type: 'COMPLETE_CYCLE' }
  | { type: 'NAVIGATE'; route: string }
  | { type: 'UPDATE_SYMPTOMS'; symptoms: VoiceSymptomId[] }
  | { type: 'START_PROTOCOL' }
  | { type: 'CONFIRM_STATUS' }
  | { type: 'SET_AUTOPILOT'; on: boolean }
  | { type: 'ACTIVATE_SOCIAL' }
  | { type: 'DEACTIVATE_SOCIAL' }
  | { type: 'NONE' };

export interface VoiceCommandResponse {
  intent: VoiceIntent;
  transcript: string;
  /** Headline — also what TTS speaks. Max ~12 words. */
  spoken: string;
  /** Optional short secondary line. */
  detail?: string;
  action: VoiceAction;
  /** Timestamp for de-duplication / list keys. */
  at: number;
}
