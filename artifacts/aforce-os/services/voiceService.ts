/**
 * Voice orchestrator.
 *
 * Pure function: takes a transcript + the current engine snapshot and returns
 * a VoiceCommandResponse describing what AForce will SAY and what side-effect
 * the overlay should perform.
 *
 * The overlay owns the side-effect (logIntake / navigate / updateSymptoms /
 * confirmStatus) — the orchestrator never touches the store directly so it
 * stays trivially testable.
 *
 * Response style rules (enforced here, NOT in callers):
 *   - max 1–2 short sentences
 *   - imperative voice ("Drink…", "Log…", "Recheck…")
 *   - no "you may want to", no "how can I help", no chatbot tone
 */

import type { ScoreEngineOutput } from '../types';
import type {
  VoiceCommandResponse, VoiceClassification, VoiceAction, VoiceSymptomId,
} from '../types/voice';
import { classifyTranscript } from './intentClassifier';

export interface VoiceContext {
  engineOutput: ScoreEngineOutput;
}

const SYMPTOM_LABEL: Record<VoiceSymptomId, string> = {
  dizziness: 'Dizziness',
  headache:  'Headache',
  nausea:    'Nausea',
  cramping:  'Cramping',
  chills:    'Chills',
  confusion: 'Confusion',
  fatigue:   'Fatigue',
};

const FLUID_LABEL: Record<string, string> = {
  water:           'water',
  aforce_stick:    'AForce stick',
  aforce_rtd:      'AForce RTD',
  aforce_canister: 'AForce canister',
  aforce_bulk_bag: 'AForce bulk',
};

/** First sentence is what TTS speaks. */
function buildResponse(
  classification: VoiceClassification,
  ctx: VoiceContext,
  transcript: string,
): VoiceCommandResponse {
  const { intent, entities } = classification;
  const { engineOutput } = ctx;
  const score = engineOutput.score;
  const stateLevel = engineOutput.performanceState.level;
  const commandAction = engineOutput.command.action;
  const recheck = engineOutput.riskTimer.minutes;

  const at = Date.now();
  const base = { intent, transcript, at };

  switch (intent) {
    case 'LOG_INTAKE': {
      const fluid = entities.fluidType ?? 'aforce_stick';
      return {
        ...base,
        spoken: `Logging ${FLUID_LABEL[fluid] ?? 'intake'}.`,
        detail: `Score ${score} · recheck ${recheck} min.`,
        action: { type: 'LOG_INTAKE', fluidType: fluid },
      };
    }

    case 'GET_STATUS': {
      return {
        ...base,
        spoken: `Score ${score}. ${stateLevel}.`,
        detail: `${commandAction} Recheck ${recheck} min.`,
        action: { type: 'CONFIRM_STATUS' },
      };
    }

    case 'GET_COMMAND': {
      // Command may already be a full sentence; truncate hard at ~12 words.
      const tight = clip(commandAction, 12);
      return {
        ...base,
        spoken: tight,
        detail: `Score ${score} · ${stateLevel}.`,
        action: { type: 'NONE' },
      };
    }

    case 'UPDATE_SYMPTOMS': {
      const symptoms = entities.symptoms ?? [];
      if (symptoms.length === 0) {
        return {
          ...base,
          spoken: 'Symptom not recognized.',
          detail: 'Tap your profile to log it manually.',
          action: { type: 'NAVIGATE', route: '/profile' },
        };
      }
      const labels = symptoms.map((s) => SYMPTOM_LABEL[s]).join(', ');
      return {
        ...base,
        spoken: `${labels} logged.`,
        detail: 'Take 1 AForce stick now.',
        action: { type: 'UPDATE_SYMPTOMS', symptoms },
      };
    }

    case 'START_PROTOCOL': {
      return {
        ...base,
        spoken: 'Recovery protocol activated.',
        detail: `Recheck in ${recheck} min.`,
        action: { type: 'NAVIGATE', route: '/protocol' },
      };
    }

    case 'COMPARE_PRODUCTS': {
      return {
        ...base,
        spoken: 'Opening comparison.',
        detail: 'AForce stick is the recommended option.',
        action: { type: 'NAVIGATE', route: '/compare' },
      };
    }

    case 'UNKNOWN':
    default: {
      return {
        ...base,
        spoken: 'Command not recognized.',
        detail: 'Try "log a stick" or "what should I do".',
        action: { type: 'NONE' },
      };
    }
  }
}

/** Hard 12-word ceiling so spoken lines never become chatbot prose. */
function clip(s: string, maxWords: number): string {
  const words = s.trim().split(/\s+/);
  if (words.length <= maxWords) return s.trim();
  return words.slice(0, maxWords).join(' ').replace(/[,.;:]+$/, '') + '.';
}

/** Public entry: classify + build response in one call. */
export function processTranscript(transcript: string, ctx: VoiceContext): VoiceCommandResponse {
  const classification = classifyTranscript(transcript);
  return buildResponse(classification, ctx, transcript.trim());
}
