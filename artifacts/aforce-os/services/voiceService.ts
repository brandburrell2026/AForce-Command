/**
 * Voice orchestrator.
 *
 * Pure function: takes a transcript + the current engine snapshot and returns
 * a VoiceCommandResponse describing what AForce will SAY and what side-effect
 * the overlay should perform.
 *
 * For the "AForce-style" intents (existing LOG_INTAKE, GET_STATUS, GET_COMMAND,
 * UPDATE_SYMPTOMS, START_PROTOCOL, COMPARE_PRODUCTS) we route through the
 * voiceTemplateEngine + voicePersonaService so the response respects the
 * mode-aware brand contract (banned phrases, sentence cap, tone shift by band).
 *
 * For the new launch-day command intents (COMPLETE_CYCLE, OPEN_SCREEN, REORDER,
 * SET_AUTOPILOT, ACTIVATE_SOCIAL, DEACTIVATE_SOCIAL) we use short, decisive
 * AForce phrases inline — keeps the spoken line under 12 words and matches
 * the brand examples ("Autopilot activated.", "Performance Mode is now on.").
 */

import type { ScoreEngineOutput } from '../types';
import type {
  VoiceCommandResponse, VoiceClassification, VoiceSymptomId,
  VoiceScreenTarget,
} from '../types/voice';
import type {
  VoiceContext as PersonaContext,
} from '../types/voicePersona';
import { classifyTranscript } from './intentClassifier';
import { resolvePersona } from './voicePersonaService';
import { renderTemplate } from './voiceTemplateEngine';
import { setActiveMode } from './ttsConfigService';
import i18n from './i18nService';
import { proactiveLine, type CoachContext } from '../utils/intelligence/conversationalIntelligence';

export interface VoiceContext {
  engineOutput: ScoreEngineOutput;
  /**
   * Section 64 — optional full coach context. When provided (flag ON), the
   * on-ask GET_STATUS / GET_COMMAND replies lead with the loaded, observation-only
   * line instead of a from-zero template. Absent ⇒ byte-identical to today.
   */
  coachContext?: CoachContext;
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
  aforce_stick:    'stick',
  aforce_rtd:      'RTD',
  aforce_canister: 'canister',
  aforce_bulk_bag: 'bulk mix',
};

/**
 * Friendly screen handle → router path. Centralised here so the classifier
 * can stay vocabulary-only and the dispatch layer stays route-aware.
 */
const SCREEN_ROUTE: Record<VoiceScreenTarget, string> = {
  home:         '/',
  profile:      '/profile',
  journal:      '/journal',
  store:        '/store',
  protocol:     '/protocol',
  scan:         '/scan',
  cart:         '/cart',
  rewards:      '/achievements',
  circles:      '/circles',
  share:        '/share',
  ring:         '/ring',
  competition:  '/competition',
  territory:    '/territory',
  science:      '/science',
  sweat:        '/sweat',
  heat:         '/heat',
  cruise:       '/cruise',
  subscription: '/subscription',
};

const SCREEN_LABEL: Record<VoiceScreenTarget, string> = {
  home: 'Home', profile: 'Profile', journal: 'Journal', store: 'Store',
  protocol: 'Protocol', scan: 'HydroScan',
  cart: 'Cart', rewards: 'Rewards', circles: 'Circles', share: 'Share',
  ring: 'Ring', competition: 'Competition', territory: 'Territory',
  science: 'Science', sweat: 'Sweat', heat: 'Heat Risk', cruise: 'Cruise',
  subscription: 'Membership',
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

/**
 * Section 64 — the context-loaded line the coach leads with when full context is
 * present AND a high-value moment is live, rendered via i18n. Null when there's
 * no context or nothing notable, so callers fall back to the template (flag-off /
 * context-absent behavior is byte-identical). Pure — reads no store, no score.
 */
function coachLoadedLine(ctx: VoiceContext): string | null {
  if (!ctx.coachContext) return null;
  const line = proactiveLine(ctx.coachContext);
  return line ? i18n.t(line.lineKey, line.params) : null;
}

function buildResponse(
  classification: VoiceClassification,
  ctx: VoiceContext,
  transcript: string,
): VoiceCommandResponse {
  const { intent, entities } = classification;
  const at = Date.now();
  const base = { intent, transcript, at };
  const score = ctx.engineOutput.score;

  switch (intent) {
    case 'LOG_INTAKE': {
      const fluid = entities.fluidType ?? 'aforce_stick';
      const oz = entities.ozOverride;
      const repeat = entities.repeat ?? 1;
      const personaCtx = buildPersonaContext(ctx, { fluid: FLUID_LABEL[fluid] ?? 'intake' });
      const rendered = renderTemplate('intake_confirmation', personaCtx);
      // If the user said an oz/quantity, surface it in the detail line so
      // the confirmation card mirrors their command verbatim.
      const detailParts: string[] = [];
      if (oz) detailParts.push(`${oz} ounces`);
      if (repeat > 1) detailParts.push(`× ${repeat}`);
      if (rendered.detail) detailParts.push(rendered.detail);
      const action = {
        type: 'LOG_INTAKE' as const,
        fluidType: fluid,
        ...(oz !== undefined ? { ozOverride: oz } : {}),
        ...(repeat > 1 ? { repeat } : {}),
      };
      return {
        ...base,
        spoken: rendered.spoken,
        ...(detailParts.length ? { detail: detailParts.join(' · ') } : {}),
        action,
      };
    }

    case 'COMPLETE_CYCLE': {
      return {
        ...base,
        spoken: 'Cycle complete. One stick logged.',
        detail: `Hydration score moves to ${score + 4}.`,
        action: { type: 'COMPLETE_CYCLE' },
      };
    }

    case 'GET_STATUS': {
      const rendered = renderTemplate('score_update', buildPersonaContext(ctx));
      const loaded = coachLoadedLine(ctx);
      return {
        ...base,
        spoken: loaded ?? rendered.spoken,
        ...(rendered.detail ? { detail: rendered.detail } : {}),
        action: { type: 'CONFIRM_STATUS' },
      };
    }

    case 'GET_COMMAND': {
      const rendered = renderTemplate('next_action', buildPersonaContext(ctx));
      const loaded = coachLoadedLine(ctx);
      return {
        ...base,
        spoken: loaded ?? rendered.spoken,
        ...(rendered.detail ? { detail: rendered.detail } : {}),
        action: { type: 'NONE' },
      };
    }

    case 'UPDATE_SYMPTOMS': {
      const symptoms = entities.symptoms ?? [];
      if (symptoms.length === 0) {
        return {
          ...base,
          spoken: 'Symptom not recognized.',
          detail: 'Open your profile to log it manually.',
          action: { type: 'NONE' },
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
        ...(rendered.detail ? { detail: rendered.detail } : {}),
        action: { type: 'NAVIGATE', route: '/protocol' },
      };
    }

    case 'COMPARE_PRODUCTS': {
      const rendered = renderTemplate('product_comparison', buildPersonaContext(ctx));
      return {
        ...base,
        spoken: rendered.spoken,
        ...(rendered.detail ? { detail: rendered.detail } : {}),
        action: { type: 'NONE' },
      };
    }

    case 'OPEN_SCREEN': {
      const screen = entities.screen ?? 'home';
      const route = SCREEN_ROUTE[screen];
      const label = SCREEN_LABEL[screen];
      return {
        ...base,
        spoken: `Opening ${label}.`,
        detail: `Route ${route}`,
        action: { type: 'NAVIGATE', route },
      };
    }

    case 'REORDER': {
      return {
        ...base,
        spoken: 'Reorder ready. Opening the AForce store.',
        detail: 'Pick up where your last delivery left off.',
        action: { type: 'NAVIGATE', route: '/store' },
      };
    }

    case 'SET_AUTOPILOT': {
      const on = entities.toggle !== 'off';
      const phrasing = entities.modePhrasing ?? 'autopilot';
      const spoken =
        phrasing === 'performance'
          ? on ? 'Performance Mode is now on.' : 'Performance Mode is off.'
          : on ? 'Autopilot activated.' : 'Autopilot deactivated.';
      return {
        ...base,
        spoken,
        detail: on
          ? 'AForce will pace your sweat and intake automatically.'
          : 'You are back in manual control.',
        action: { type: 'SET_AUTOPILOT', on },
      };
    }

    case 'ACTIVATE_SOCIAL': {
      return {
        ...base,
        spoken: 'Social Mode activated.',
        detail: 'AForce will track alcohol load and pre-load recovery.',
        action: { type: 'ACTIVATE_SOCIAL' },
      };
    }

    case 'DEACTIVATE_SOCIAL': {
      return {
        ...base,
        spoken: 'Social Mode off.',
        detail: 'Recovery protocol cued for tomorrow morning.',
        action: { type: 'DEACTIVATE_SOCIAL' },
      };
    }

    case 'UNKNOWN':
    default: {
      return {
        ...base,
        spoken: 'Command not recognized.',
        detail: 'Try "log a stick", "performance mode on", or "open rewards".',
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
