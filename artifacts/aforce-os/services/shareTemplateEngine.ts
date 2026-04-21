/**
 * Share template engine — generates 2–3 voice-correct variations for a
 * share moment. Pure functions, no side effects, no I/O. Mirrors the
 * pattern of `voiceTemplateEngine.ts`.
 */

import { SHARE_TEMPLATES, BRAND_TAG } from '../data/shareTemplates';
import type { ShareContext, ShareMessageVariation } from '../types/share';

// ─── Tone enforcement ───────────────────────────────────────────────────────
// Strip anything that violates AForce voice. Cheap final-pass guard so a
// stray hype word in a future template still gets sanitized at runtime.
const BANNED_WORDS = [
  'awesome', 'crushing', "let's go", 'lets go', 'feeling great',
  'amazing', 'epic', 'lit', 'fire', 'goat', 'beast',
];

function enforceTone(text: string): string {
  let out = text;
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`\\b${w.replace(/'/g, "\\'?")}\\b`, 'gi');
    out = out.replace(re, '').replace(/\s{2,}/g, ' ').trim();
  }
  // No emojis: our templates never produce them. If a future caller passes
  // free-form input through `composeTextShare`, strip common pictograph
  // ranges defensively. Built with `RegExp` to avoid source-level escape
  // issues with literal Unicode property escapes.
  out = out.replace(new RegExp('[\\u{1F300}-\\u{1FAFF}]|[\\u2600-\\u27BF]', 'gu'), '');
  // No exclamation marks — AForce never shouts.
  out = out.replace(/!+/g, '.');
  // No hashtags — sharing is not a feed post.
  out = out.replace(/#\S+/g, '').replace(/\s{2,}/g, ' ').trim();
  return out;
}

function fillTokens(template: string, ctx: ShareContext): string {
  const deltaStr =
    typeof ctx.delta === 'number'
      ? (ctx.delta >= 0 ? `+${ctx.delta}` : `${ctx.delta}`)
      : '';
  return template
    .replace(/\{score\}/g,    ctx.score != null ? String(ctx.score) : '')
    .replace(/\{state\}/g,    ctx.state ?? 'Balanced')
    .replace(/\{delta\}/g,    deltaStr)
    .replace(/\{streak\}/g,   ctx.streakDays != null ? String(ctx.streakDays) : '')
    .replace(/\{rank\}/g,     ctx.rankLabel ?? '')
    .replace(/\{protocol\}/g, ctx.protocolLabel ?? 'Protocol')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Returns 2–3 variations for the given context. The engine never throws —
 * unknown types fall back to a single neutral line so a UI render never
 * fails on a malformed input.
 */
export function generateShareVariations(ctx: ShareContext): ShareMessageVariation[] {
  const templates = SHARE_TEMPLATES[ctx.type];
  if (!templates || templates.length === 0) {
    return [{ id: `${ctx.type}-fallback`, text: 'System in control.' }];
  }
  return templates.map((t, i) => ({
    id: `${ctx.type}-${i}`,
    text: enforceTone(fillTokens(t, ctx)),
  }));
}

/** Compose a text-format payload (X / Threads / iMessage). */
export function composeTextShare(message: string): string {
  // Single line + branding tag, separated by a line break.
  return `${enforceTone(message)}\n— ${BRAND_TAG}`;
}
