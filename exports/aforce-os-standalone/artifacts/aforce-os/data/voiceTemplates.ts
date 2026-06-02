/**
 * AForce Voice Engine — response templates.
 *
 * One template per (category, mode). Every template follows:
 *     STATE/CONTEXT + ACTION + TIMING + OUTCOME
 * and respects the per-mode ToneRule (max sentences, banned phrases).
 *
 * Tokens (filled by voiceTemplateEngine):
 *   {score}, {state}, {recheck}, {action}, {fluid}, {symptoms},
 *   {oz}, {team_player}, {competitor}
 */

import type {
  ToneRule,
  VoiceResponseTemplate,
  VoiceTemplateCategory,
  VoiceUrgencyMode,
} from '../types/voicePersona';

/* ------------------------------------------------------------------ *
 * Tone rules — one per urgency mode.
 * ------------------------------------------------------------------ */

const SHARED_FORBIDDEN = Object.freeze([
  'you may want to',
  'consider',
  'try',
  'awesome',
  'great job',
  'how can i help',
  'i think',
  'maybe',
  'please',
  'sorry',
  'recommendation',
  'wellness',
  'self-care',
] as const);

export const TONE_RULES: Readonly<Record<VoiceUrgencyMode, ToneRule>> = Object.freeze({
  peak: {
    mode: 'peak',
    tone: 'steady_affirming',
    max_sentences: 2,
    max_words: 14,
    forbidden_phrases: SHARED_FORBIDDEN,
    response_pattern: ['state', 'action', 'outcome'],
  },
  balanced: {
    mode: 'balanced',
    tone: 'controlled_guiding',
    max_sentences: 2,
    max_words: 16,
    forbidden_phrases: SHARED_FORBIDDEN,
    response_pattern: ['state', 'action', 'timing'],
  },
  recovering: {
    mode: 'recovering',
    tone: 'firm_calm',
    max_sentences: 2,
    max_words: 16,
    forbidden_phrases: SHARED_FORBIDDEN,
    response_pattern: ['state', 'action', 'timing'],
  },
  depleted: {
    mode: 'depleted',
    tone: 'urgent_calm',
    max_sentences: 2,
    max_words: 14,
    forbidden_phrases: SHARED_FORBIDDEN,
    response_pattern: ['state', 'action', 'timing'],
  },
});

/* ------------------------------------------------------------------ *
 * Templates — keyed by (category, mode).
 * Each spoken line is a single decisive sentence pair.
 * ------------------------------------------------------------------ */

type TemplateMap = Record<VoiceTemplateCategory, Record<VoiceUrgencyMode, VoiceResponseTemplate>>;

function t(
  category: VoiceTemplateCategory,
  mode: VoiceUrgencyMode,
  spoken: string,
  detail?: string,
): VoiceResponseTemplate {
  return { category, mode, spoken, detail };
}

export const VOICE_TEMPLATES: Readonly<TemplateMap> = Object.freeze({
  score_update: {
    peak:       t('score_update', 'peak',       'Peak at {score}. Hold cadence.',           'Maintain protocol.'),
    balanced:   t('score_update', 'balanced',   'Balanced at {score}. Stay on cadence.',    'Recheck {recheck} min.'),
    recovering: t('score_update', 'recovering', 'Recovering at {score}. Start hydration now.', 'Recheck {recheck} min.'),
    depleted:   t('score_update', 'depleted',   'Depleted at {score}. Stop and hydrate now.',  'Recheck {recheck} min.'),
  },
  next_action: {
    peak:       t('next_action', 'peak',       'Peak. Maintain current cadence.',                    'Score {score}.'),
    balanced:   t('next_action', 'balanced',   '{action}',                                           'Score {score}. Recheck {recheck} min.'),
    recovering: t('next_action', 'recovering', 'Take 1 stick now. Recheck in {recheck} min.', 'Score {score}.'),
    depleted:   t('next_action', 'depleted',   'Stop activity. Take 2 sticks now.',                  'Score {score}. Recheck {recheck} min.'),
  },
  recovery_command: {
    peak:       t('recovery_command', 'peak',       'No recovery needed. Hold cadence.',                    'Score {score}.'),
    balanced:   t('recovery_command', 'balanced',   'Drink {oz} ounces now. Recheck in {recheck} min.',          'Score {score}.'),
    recovering: t('recovery_command', 'recovering', 'Recovery state. Drink {oz} ounces now. Recheck {recheck} min.', 'Score {score}.'),
    depleted:   t('recovery_command', 'depleted',   'Depleted. Drink {oz} ounces and take 2 sticks now.',        'Recheck {recheck} min.'),
  },
  intake_confirmation: {
    peak:       t('intake_confirmation', 'peak',       'Logged {fluid}. Score {score}. Hold cadence.',      'Maintain protocol.'),
    balanced:   t('intake_confirmation', 'balanced',   'Logged {fluid}. Score {score}. Stay on cadence.',   'Recheck {recheck} min.'),
    recovering: t('intake_confirmation', 'recovering', 'Logged {fluid}. Score {score}. Continue recovery.', 'Recheck {recheck} min.'),
    depleted:   t('intake_confirmation', 'depleted',   'Logged {fluid}. Score {score}. Take 1 more stick.', 'Recheck {recheck} min.'),
  },
  heat_warning: {
    peak:       t('heat_warning', 'peak',       'Heat load rising. Maintain cooling.',                'Recheck {recheck} min.'),
    balanced:   t('heat_warning', 'balanced',   'Heat stress climbing. Drink {oz} ounces now.',           'Recheck {recheck} min.'),
    recovering: t('heat_warning', 'recovering', 'Heat risk. Stop and hydrate now. Recheck 10 min.',   'Score {score}.'),
    depleted:   t('heat_warning', 'depleted',   'Critical heat. Stop now. Begin cooling immediately.','Score {score}.'),
  },
  competition_update: {
    peak:       t('competition_update', 'peak',       '{competitor} is closing. Hold cadence.',            'Score {score}.'),
    balanced:   t('competition_update', 'balanced',   '{competitor} moved ahead. Your score matters today.','Score {score}.'),
    recovering: t('competition_update', 'recovering', '{competitor} ahead. Recover now to retake position.', 'Score {score}.'),
    depleted:   t('competition_update', 'depleted',   '{competitor} pulling away. Hydrate now.',           'Score {score}.'),
  },
  morning_reset: {
    peak:       t('morning_reset', 'peak',       'Morning reset clean. Begin protocol.',                   'Score {score}.'),
    balanced:   t('morning_reset', 'balanced',   'Light overnight deficit. Drink {oz} ounces before protocol.','Score {score}.'),
    recovering: t('morning_reset', 'recovering', 'Overnight deficit detected. Drink {oz} ounces now.',         'Recheck {recheck} min.'),
    depleted:   t('morning_reset', 'depleted',   'Severe overnight deficit. Drink {oz} ounces and take 1 stick now.', 'Recheck {recheck} min.'),
  },
  product_comparison: {
    peak:       t('product_comparison', 'peak',       'A stick is the strongest fit. Hold cadence.', 'Score {score}.'),
    balanced:   t('product_comparison', 'balanced',   'A stick is the strongest fit for your state.','Drink 1 now.'),
    recovering: t('product_comparison', 'recovering', 'An RTD is the strongest fit. Drink 1 now.',    'Recheck {recheck} min.'),
    depleted:   t('product_comparison', 'depleted',   'An RTD plus 1 stick is the strongest fit now.','Recheck {recheck} min.'),
  },
  subscription_locked: {
    peak:       t('subscription_locked', 'peak',       'Locked feature. Upgrade to unlock.',     'Score {score}.'),
    balanced:   t('subscription_locked', 'balanced',   'Locked feature. Upgrade to unlock.',     'Score {score}.'),
    recovering: t('subscription_locked', 'recovering', 'Locked feature. Upgrade to unlock.',     'Score {score}.'),
    depleted:   t('subscription_locked', 'depleted',   'Locked feature. Upgrade to unlock.',     'Score {score}.'),
  },
  team_alert: {
    peak:       t('team_alert', 'peak',       '{team_player} steady at peak. Hold rotation.',           'Score {score}.'),
    balanced:   t('team_alert', 'balanced',   '{team_player} balanced. Maintain rotation.',             'Score {score}.'),
    recovering: t('team_alert', 'recovering', '{team_player} recovering. Pull at next stoppage.',       'Score {score}.'),
    depleted:   t('team_alert', 'depleted',   '{team_player} depleted. Pull now.',                      'Score {score}.'),
  },
});
