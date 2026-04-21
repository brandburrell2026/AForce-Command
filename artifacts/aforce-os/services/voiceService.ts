/**
 * Voice orchestrator.
 *
 * Pure function: takes a transcript + the current engine snapshot and returns
 * a VoiceCommandResponse describing what AForce will SAY and what side-effect
 * the overlay should perform.
 *
 * The orchestrator does NOT compose spoken lines itself anymore — it picks
 * the right template category for the intent and hands the engine snapshot to
 * the AForce Voice Engine (voiceTemplateEngine + voicePersonaService) which
 * enforces the brand contract (mode-aware tone, banned phrases, sentence cap).
 */

import type { ScoreEngineOutput } from '../types';
import type {
  VoiceCommandResponse, VoiceClassification, VoiceSymptomId,
} from '../types/voice';
import type {
  VoiceContext as PersonaContext,
  VoiceTemplateCategory,
} from '../types/voicePersona';
import { classifyTranscript } from './intentClassifier';
import { resolvePersona } from './voicePersonaService';
import { renderTemplate } from './voiceTemplateEngine';
import { setActiveMode } from './ttsConfigService';

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

/** Build the persona context the template engine needs. */
function buildPersonaContext(ctx: VoiceContext, extras: Partial<PersonaContext> = {}): PersonaContext {
  const { engineOutput } = ctx;
  const { mode } = resolvePersona(engineOutput.performanceState.level);
  return {
    mode,
    score: engineOutput.score,
    recheck_minutes: engineOutput.riskTimer.minutes,
    command_action: engineOutput.command.action,
    ...extras,
  };
}

function buildResponse(
  classification: VoiceClassification,
  ctx: VoiceContext,
  transcript: string,
): VoiceCommandResponse {
  const { intent, entities } = classification;
  const at = Date.now();
  const base = { intent, transcript, at };

  switch (intent) {
    case 'LOG_INTAKE': {
      const fluid = entities.fluidType ?? 'aforce_stick';
      const personaCtx = buildPersonaContext(ctx, { fluid: FLUID_LABEL[fluid] ?? 'intake' });
      const rendered = renderTemplate('intake_confirmation', personaCtx);
      return {
        ...base,
        spoken: rendered.spoken,
        detail: rendered.detail,
        action: { type: 'LOG_INTAKE', fluidType: fluid },
      };
    }

    case 'GET_STATUS': {
      const rendered = renderTemplate('score_update', buildPersonaContext(ctx));
      return {
        ...base,
        spoken: rendered.spoken,
        detail: rendered.detail,
        action: { type: 'CONFIRM_STATUS' },
      };
    }

    case 'GET_COMMAND': {
      const rendered = renderTemplate('next_action', buildPersonaContext(ctx));
      return {
        ...base,
        spoken: rendered.spoken,
        detail: rendered.detail,
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
      const labels = symptoms.map((s) => SYMPTOM_LABEL[s]);
      const rendered = renderTemplate('recovery_command', buildPersonaContext(ctx, {
        symptoms: labels,
        oz: 16,
      }));
      return {
        ...base,
        spoken: rendered.spoken,
        detail: `${labels.join(', ')} logged.`,
        action: { type: 'UPDATE_SYMPTOMS', symptoms },
      };
    }

    case 'START_PROTOCOL': {
      const rendered = renderTemplate('recovery_command', buildPersonaContext(ctx, { oz: 16 }));
      return {
        ...base,
        spoken: rendered.spoken,
        detail: rendered.detail,
        action: { type: 'NAVIGATE', route: '/protocol' },
      };
    }

    case 'COMPARE_PRODUCTS': {
      const rendered = renderTemplate('product_comparison', buildPersonaContext(ctx));
      return {
        ...base,
        spoken: rendered.spoken,
        detail: rendered.detail,
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

/**
 * Public entry: classify + build response in one call.
 *
 * Side effect: syncs the TTS layer's active mode from the engine snapshot
 * BEFORE intent dispatch so even hard-coded branches (UNKNOWN, no-symptom)
 * play back at the right rate/pitch for the user's current performance state.
 */
export function processTranscript(transcript: string, ctx: VoiceContext): VoiceCommandResponse {
  const { mode } = resolvePersona(ctx.engineOutput.performanceState.level);
  setActiveMode(mode);
  const classification = classifyTranscript(transcript);
  return buildResponse(classification, ctx, transcript.trim());
}
