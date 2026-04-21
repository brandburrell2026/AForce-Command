/**
 * Voice Command System types.
 *
 * AForce OS Voice is NOT a chatbot. It is a command interface:
 *   user speaks → intent is classified → a single decisive action is executed
 *   → AForce returns ONE structured response (max 1–2 sentences).
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
  | 'GET_STATUS'
  | 'GET_COMMAND'
  | 'UPDATE_SYMPTOMS'
  | 'START_PROTOCOL'
  | 'COMPARE_PRODUCTS'
  | 'UNKNOWN';

/** Symptom ids the engine recognises (kept aligned with heatRiskEngine). */
export type VoiceSymptomId =
  | 'dizziness' | 'headache' | 'nausea'
  | 'cramping' | 'chills' | 'confusion' | 'fatigue';

export interface VoiceEntities {
  fluidType?: FluidType;
  symptoms?: VoiceSymptomId[];
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
  | { type: 'LOG_INTAKE'; fluidType: FluidType }
  | { type: 'NAVIGATE'; route: string }
  | { type: 'UPDATE_SYMPTOMS'; symptoms: VoiceSymptomId[] }
  | { type: 'START_PROTOCOL' }
  | { type: 'CONFIRM_STATUS' }
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
