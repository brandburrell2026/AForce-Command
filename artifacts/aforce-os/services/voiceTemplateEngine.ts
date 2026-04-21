/**
 * AForce Voice Engine — template renderer + tone enforcer.
 *
 * Pure function: takes a (category, context) pair, looks up the right
 * template for the current mode, fills tokens, and runs the result through
 * the per-mode ToneRule (banned-phrase scrub, sentence + word ceiling).
 *
 * Callers (voiceService) get back a guaranteed on-brand spoken line.
 */

import type {
  VoiceContext,
  VoiceTemplateCategory,
  VoiceUrgencyMode,
} from '../types/voicePersona';
import { VOICE_TEMPLATES } from '../data/voiceTemplates';
import { getRule } from './voicePersonaService';

interface RenderedLine {
  spoken: string;
  detail?: string;
  category: VoiceTemplateCategory;
  mode: VoiceUrgencyMode;
}

/* ------------------------------------------------------------------ *
 * Token replacement
 * ------------------------------------------------------------------ */

const STATE_LABEL: Record<VoiceUrgencyMode, string> = {
  peak:       'Peak',
  balanced:   'Balanced',
  recovering: 'Recovering',
  depleted:   'Depleted',
};

function fillTokens(template: string, ctx: VoiceContext): string {
  return template
    .replace(/\{score\}/g,        String(ctx.score))
    .replace(/\{state\}/g,        STATE_LABEL[ctx.mode])
    .replace(/\{recheck\}/g,      String(ctx.recheck_minutes ?? 20))
    .replace(/\{action\}/g,       ctx.command_action ?? '')
    .replace(/\{fluid\}/g,        ctx.fluid ?? 'intake')
    .replace(/\{symptoms\}/g,     (ctx.symptoms ?? []).join(', '))
    .replace(/\{oz\}/g,           String(ctx.oz ?? 16))
    .replace(/\{team_player\}/g,  ctx.team_player ?? 'Player')
    .replace(/\{competitor\}/g,   ctx.competitor ?? 'Opponent');
}

/* ------------------------------------------------------------------ *
 * Tone enforcement
 * ------------------------------------------------------------------ */

/**
 * Scrub banned phrases. Single-word bans use word boundaries so we never
 * accidentally strip "try" out of "strategy" or "consider" out of a longer
 * legitimate token. Multi-word phrases (e.g. "you may want to") match raw.
 */
function stripBanned(text: string, banned: readonly string[]): string {
  let out = text;
  for (const phrase of banned) {
    const isSingleWord = !/\s/.test(phrase);
    const escaped = escapeRegex(phrase);
    const pattern = isSingleWord ? `\\b${escaped}\\b` : escaped;
    const re = new RegExp(pattern, 'gi');
    out = out.replace(re, '');
  }
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([.!?,;:])/g, '$1').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Clip to N sentences, hard. Splits on . ! ? terminators. */
function clipSentences(text: string, maxSentences: number): string {
  const parts = text.match(/[^.!?]+[.!?]?/g) ?? [text];
  const taken = parts.slice(0, maxSentences).map((s) => s.trim()).filter(Boolean);
  let joined = taken.join(' ');
  if (!/[.!?]$/.test(joined)) joined += '.';
  return joined;
}

/** Hard word ceiling — final guard against runaway templates. */
function clipWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(' ').replace(/[,.;:]+$/, '') + '.';
}

/* ------------------------------------------------------------------ *
 * Public renderer
 * ------------------------------------------------------------------ */

export function renderTemplate(
  category: VoiceTemplateCategory,
  ctx: VoiceContext,
): RenderedLine {
  const template = VOICE_TEMPLATES[category][ctx.mode];
  const rule = getRule(ctx.mode);

  let spoken = fillTokens(template.spoken, ctx);
  spoken = stripBanned(spoken, rule.forbidden_phrases);
  spoken = clipSentences(spoken, rule.max_sentences);
  spoken = clipWords(spoken, rule.max_words);

  let detail: string | undefined;
  if (template.detail) {
    detail = fillTokens(template.detail, ctx);
    detail = stripBanned(detail, rule.forbidden_phrases);
    // Detail line is one sentence, slightly higher ceiling.
    detail = clipWords(detail, 18);
  }

  return { spoken, detail, category, mode: ctx.mode };
}
