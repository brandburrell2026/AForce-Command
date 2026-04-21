/**
 * Reaction service — performance-first reactions, no generic comments.
 * In-memory store today; will publish a `circle.reaction` event upstream
 * when the api-server route is wired.
 */

import { REACTIONS } from '@/data/mockCircleData';
import type {
  Reaction, ReactionDef, ReactionId, SharedStateLabel,
} from '@/types/circle';

const sent: Reaction[] = [];

export function listReactionsFor(toUserId: string): Reaction[] {
  return sent.filter(r => r.toUserId === toUserId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Reactions visible for a given target state — keeps options situational. */
export function reactionsForState(state: SharedStateLabel): ReactionDef[] {
  return REACTIONS.filter(r => !r.appropriateFor || r.appropriateFor.includes(state));
}

export interface SendReactionInput {
  fromUserId: string;
  toUserId: string;
  reaction: ReactionId;
  comment?: string;
}

export function sendReaction(input: SendReactionInput): Reaction {
  const cleanedComment = sanitizeComment(input.comment);
  const r: Reaction = {
    id: `r_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    reaction: input.reaction,
    comment: cleanedComment,
    createdAt: new Date().toISOString(),
  };
  sent.push(r);
  return r;
}

const BANNED_TOKENS = [
  'lol', 'lmao', 'crushing', 'goat', 'beast', 'fire', 'awesome', 'sick',
  'killing it', 'destroyed', 'wow', 'omg',
];

function sanitizeComment(input?: string): string | undefined {
  if (!input) return undefined;
  let out = input.trim();
  if (out.length === 0) return undefined;
  // Cap at a tight ceiling so it can't become a comment thread.
  if (out.length > 80) out = out.slice(0, 80);
  for (const token of BANNED_TOKENS) {
    const re = new RegExp(`\\b${token}\\b`, 'gi');
    out = out.replace(re, '').replace(/\s{2,}/g, ' ').trim();
  }
  // No exclamation marks, no hashtags — same tone rules as Voice/Share.
  out = out.replace(/!+/g, '.').replace(/#\S+/g, '').replace(/\s{2,}/g, ' ').trim();
  return out.length > 0 ? out : undefined;
}
