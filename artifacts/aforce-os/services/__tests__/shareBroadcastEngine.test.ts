import { describe, it, expect } from 'vitest';
import {
  generateBroadcasts,
  defaultVoice,
  broadcastToMessage,
} from '../shareBroadcastEngine';
import {
  STATUS_HEADLINES,
  STATUS_SUBTEXTS,
  ACTION_BROADCASTS,
  IDENTITY_BROADCASTS,
} from '../../data/shareBroadcasts';
import type { ShareContext } from '../../types/share';

// Brand voice rule: max 5 words per line. Words = whitespace-separated
// non-empty tokens. Punctuation does not split a word ("Took 1 AForce."
// is 3 words; "Two brothers. One promise." is 4 words).
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

describe('generateBroadcasts — STATUS voice maps state to brand headline', () => {
  it('Peak headline = AFORCE INSIDE', () => {
    const v = generateBroadcasts('status', { type: 'state', state: 'Peak' });
    expect(v[0].headline).toBe('AFORCE INSIDE');
  });

  it('Balanced headline = SYSTEM ON', () => {
    const v = generateBroadcasts('status', { type: 'state', state: 'Balanced' });
    expect(v[0].headline).toBe('SYSTEM ON');
  });

  it('Recovering headline = RESTORING NOW', () => {
    const v = generateBroadcasts('status', { type: 'state', state: 'Recovering' });
    expect(v[0].headline).toBe('RESTORING NOW');
  });

  it('Depleted headline = RESET INCOMING', () => {
    const v = generateBroadcasts('status', { type: 'state', state: 'Depleted' });
    expect(v[0].headline).toBe('RESET INCOMING');
  });

  it('returns 3 brand-flavored subtexts (no data, no score)', () => {
    const ctx: ShareContext = { type: 'score', score: 88, state: 'Balanced' };
    const v = generateBroadcasts('status', ctx);
    expect(v.length).toBe(3);
    // Score must NOT leak into the subtext — identity, not metrics.
    for (const b of v) {
      expect(b.subtext).not.toMatch(/\d/);
      expect(b.subtext).not.toMatch(/score/i);
    }
    // Subtexts come straight from the brand pool.
    const subs = v.map(b => b.subtext);
    expect(subs).toEqual([...STATUS_SUBTEXTS]);
  });
});

describe('generateBroadcasts — ACTION voice', () => {
  it('returns 3 proof-of-action lines', () => {
    const v = generateBroadcasts('action', { type: 'protocol' });
    expect(v.length).toBe(3);
    for (const b of v) {
      expect(b.voice).toBe('action');
      expect(b.headline.length).toBeGreaterThan(0);
    }
  });

  it('uses brand language (Took 1 AForce. / Restoring now. / Cycle in motion.)', () => {
    const v = generateBroadcasts('action', { type: 'protocol' });
    expect(v[0].headline).toBe('Took 1 AForce.');
    expect(v[1].headline).toBe('Restoring now.');
    expect(v[2].headline).toBe('Cycle in motion.');
  });
});

describe('generateBroadcasts — IDENTITY voice', () => {
  it('returns 4 manifesto lines, no numbers', () => {
    const v = generateBroadcasts('identity', { type: 'score', score: 88 });
    expect(v.length).toBe(4);
    for (const b of v) {
      expect(b.voice).toBe('identity');
      expect(b.headline).not.toMatch(/\d/);
    }
  });

  it('leads with "Become AForce." then the rest of the website brand themes', () => {
    const v = generateBroadcasts('identity', { type: 'score' });
    expect(v[0].headline).toBe('Become AForce.');
    expect(v[0].subtext).toBe('From the inside.');
    expect(v[1].headline).toBe('AForce inside me.');
    expect(v[1].subtext).toBe('Two brothers. One promise.');
    expect(v[2].headline).toBe('Not a drink.');
    expect(v[2].subtext).toBe('A system.');
    expect(v[3].headline).toBe('Clean AF.');
    expect(v[3].subtext).toBe('Effective AF.');
  });
});

describe('brand voice rules — every line ≤ 5 words, no weak words', () => {
  // Pull the entire union of broadcasts the engine can produce.
  const everyEntry = [
    ...Object.values(STATUS_HEADLINES).flatMap(h =>
      STATUS_SUBTEXTS.map(s => ({ headline: h, subtext: s })),
    ),
    ...ACTION_BROADCASTS,
    ...IDENTITY_BROADCASTS,
  ];

  it('headline word count is always ≤ 5', () => {
    for (const e of everyEntry) {
      expect(
        wordCount(e.headline),
        `headline > 5 words: "${e.headline}"`,
      ).toBeLessThanOrEqual(5);
    }
  });

  it('subtext word count is always ≤ 5', () => {
    for (const e of everyEntry) {
      expect(
        wordCount(e.subtext),
        `subtext > 5 words: "${e.subtext}"`,
      ).toBeLessThanOrEqual(5);
    }
  });

  it('no weak / hype / explanation words anywhere', () => {
    const banned = /\b(awesome|amazing|crushing|epic|just|maybe|literally|kind of|sort of)\b/i;
    for (const e of everyEntry) {
      expect(banned.test(e.headline)).toBe(false);
      expect(banned.test(e.subtext)).toBe(false);
    }
  });

  it('no exclamation marks (AForce never shouts)', () => {
    for (const e of everyEntry) {
      expect(e.headline).not.toMatch(/!/);
      expect(e.subtext).not.toMatch(/!/);
    }
  });
});

describe('defaultVoice', () => {
  it('defaults to status for score / state / streak / gain', () => {
    expect(defaultVoice({ type: 'score' })).toBe('status');
    expect(defaultVoice({ type: 'state' })).toBe('status');
    expect(defaultVoice({ type: 'streak' })).toBe('status');
    expect(defaultVoice({ type: 'gain' })).toBe('status');
  });

  it('defaults to action for protocol / command / reset / heat_save', () => {
    expect(defaultVoice({ type: 'protocol' })).toBe('action');
    expect(defaultVoice({ type: 'command' })).toBe('action');
    expect(defaultVoice({ type: 'reset' })).toBe('action');
    expect(defaultVoice({ type: 'heat_save' })).toBe('action');
  });
});

describe('generateBroadcasts — malformed input fallbacks', () => {
  it('returns a safe non-empty status broadcast for an unknown voice', () => {
    // @ts-expect-error — simulate a value that crossed the TS boundary
    const v = generateBroadcasts('foo', { type: 'score' });
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].voice).toBe('status');
    expect(v[0].headline).toBe('SYSTEM ON');
  });

  it('falls back to Balanced when ctx.state is invalid', () => {
    // @ts-expect-error — simulate query-derived garbage state
    const v = generateBroadcasts('status', { type: 'score', state: 'foo' });
    expect(v[0].headline).toBe('SYSTEM ON');
  });

  it('renders status with no context fields at all', () => {
    const v = generateBroadcasts('status', { type: 'score' });
    expect(v.length).toBe(3);
    expect(v[0].headline).toBe('SYSTEM ON');
  });
});

describe('broadcastToMessage', () => {
  it('joins headline + subtext with a single space', () => {
    expect(broadcastToMessage({
      id: 'x', voice: 'identity', headline: 'Clean AF.', subtext: 'Effective AF.',
    })).toBe('Clean AF. Effective AF.');
  });

  it('omits the trailing space when subtext is empty', () => {
    expect(broadcastToMessage({
      id: 'x', voice: 'status', headline: 'AFORCE INSIDE', subtext: '',
    })).toBe('AFORCE INSIDE');
  });
});
