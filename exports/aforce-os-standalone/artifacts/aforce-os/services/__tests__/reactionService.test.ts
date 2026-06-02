/**
 * Unit tests for reactionService — the comment sanitizer is the most
 * security/tone-relevant pure function in the Circles feature. Validates:
 *  - banned hype tokens are stripped at word boundaries
 *  - exclamation marks are converted to periods (no shouting)
 *  - hashtags are removed entirely
 *  - 80-char ceiling is enforced
 *  - whitespace-only output collapses to undefined
 *  - state-appropriate reactions filter correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  sendReaction, listReactionsFor, reactionsForState,
} from '../reactionService';

// `sanitizeComment` is intentionally not exported — exercise it through
// `sendReaction`, which is the only consumer.
function clean(input: string | undefined): string | undefined {
  const r = sendReaction({ fromUserId: 'a', toUserId: 'z', reaction: 'hold_the_line', comment: input });
  return r.comment;
}

describe('reactionService — sanitizeComment (tone enforcement)', () => {
  it('returns undefined for empty / whitespace-only input', () => {
    expect(clean(undefined)).toBeUndefined();
    expect(clean('')).toBeUndefined();
    expect(clean('   ')).toBeUndefined();
  });

  it('strips every banned hype token (case-insensitive)', () => {
    const tokens = ['lol', 'LMAO', 'crushing', 'GOAT', 'beast', 'fire',
      'awesome', 'sick', 'killing it', 'destroyed', 'wow', 'OMG'];
    for (const t of tokens) {
      const out = clean(`great work ${t} keep going`);
      // Token (any casing) is removed.
      expect(out?.toLowerCase()).not.toContain(t.toLowerCase());
      // Surrounding text survives.
      expect(out).toContain('great work');
      expect(out).toContain('keep going');
    }
  });

  it('only strips at word boundaries — does not corrupt unrelated words', () => {
    // `solid` contains "lol" only as a substring, not a word — must remain.
    const out = clean('that was a solid set');
    expect(out).toContain('solid');
  });

  it('converts ! to . (period) — no shouting allowed', () => {
    expect(clean('nice work!')).toBe('nice work.');
    expect(clean('elite!!!')).toBe('elite.');
  });

  it('strips hashtags entirely (no social signaling)', () => {
    expect(clean('back on track #grindset #goals')).toBe('back on track');
  });

  it('caps comment length at 80 chars', () => {
    const long = 'a'.repeat(200);
    const out = clean(long);
    expect(out?.length).toBeLessThanOrEqual(80);
  });

  it('returns undefined when banned-token removal leaves the string empty', () => {
    expect(clean('lol')).toBeUndefined();
    expect(clean('!!!!')).toBe('.');
    expect(clean('#tag #only')).toBeUndefined();
  });

  it('handles a real-world mixed comment cleanly', () => {
    const out = clean('Crushing it today! GOAT performance #fire');
    expect(out).not.toMatch(/!/);
    expect(out).not.toMatch(/#/);
    expect(out?.toLowerCase()).not.toContain('crushing');
    expect(out?.toLowerCase()).not.toContain('goat');
    expect(out).toContain('today.');
    expect(out).toContain('performance');
  });
});

describe('reactionService — sendReaction + listReactionsFor', () => {
  beforeEach(() => {
    // No reset needed; each test sends to a unique recipient id.
  });

  it('persists sent reactions and lists them newest-first for the recipient', async () => {
    const recipient = `u_${Date.now()}_${Math.random()}`;
    sendReaction({ fromUserId: 'me', toUserId: recipient, reaction: 'stay_on_cadence' });
    // Force a different timestamp so ordering is well-defined.
    await new Promise(r => setTimeout(r, 5));
    sendReaction({ fromUserId: 'me', toUserId: recipient, reaction: 'finish_the_cycle' });
    const list = listReactionsFor(recipient);
    expect(list.length).toBe(2);
    expect(list[0].reaction).toBe('finish_the_cycle');
    expect(list[1].reaction).toBe('stay_on_cadence');
  });

  it('does not return reactions for unrelated recipients', () => {
    const a = `a_${Date.now()}`, b = `b_${Date.now()}`;
    sendReaction({ fromUserId: 'me', toUserId: a, reaction: 'hold_the_line' });
    expect(listReactionsFor(b)).toEqual([]);
  });
});

describe('reactionService — reactionsForState (situational appropriateness)', () => {
  it("never offers 'Elite today' to a Depleted athlete", () => {
    const opts = reactionsForState('Depleted');
    expect(opts.find(r => r.id === 'elite_today')).toBeUndefined();
  });

  it("never offers 'Catch up now' to a Peak athlete", () => {
    const opts = reactionsForState('Peak');
    expect(opts.find(r => r.id === 'catch_up_now')).toBeUndefined();
  });

  it("offers 'Stay on cadence' and 'Hold the line' in every state", () => {
    for (const s of ['Peak', 'Balanced', 'Recovering', 'Depleted'] as const) {
      const opts = reactionsForState(s);
      expect(opts.find(r => r.id === 'stay_on_cadence')).toBeDefined();
      expect(opts.find(r => r.id === 'hold_the_line')).toBeDefined();
    }
  });
});
