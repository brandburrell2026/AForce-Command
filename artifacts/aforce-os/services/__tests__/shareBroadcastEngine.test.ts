import { describe, it, expect } from 'vitest';
import {
  generateBroadcasts,
  defaultVoice,
  broadcastToMessage,
} from '../shareBroadcastEngine';
import type { ShareContext } from '../../types/share';

describe('generateBroadcasts', () => {
  it('STATUS produces 3 entries headlined by SYSTEM CONTROLLED for Balanced', () => {
    const ctx: ShareContext = { type: 'score', score: 88, state: 'Balanced' };
    const v = generateBroadcasts('status', ctx);
    expect(v.length).toBe(3);
    for (const b of v) {
      expect(b.voice).toBe('status');
      expect(b.headline).toBe('SYSTEM CONTROLLED');
    }
    expect(v[0].subtext).toContain('88');
  });

  it('STATUS maps Depleted to SYSTEM UNSTABLE', () => {
    const v = generateBroadcasts('status', { type: 'state', state: 'Depleted' });
    expect(v[0].headline).toBe('SYSTEM UNSTABLE');
  });

  it('STATUS maps Recovering to RECOVERING', () => {
    const v = generateBroadcasts('status', { type: 'state', state: 'Recovering' });
    expect(v[0].headline).toBe('RECOVERING');
  });

  it('ACTION returns proof-of-action lines (no score required)', () => {
    const v = generateBroadcasts('action', { type: 'protocol' });
    expect(v.length).toBe(3);
    for (const b of v) {
      expect(b.voice).toBe('action');
      expect(b.headline.length).toBeGreaterThan(0);
      // No exclamations, no hype, no emojis
      expect(b.headline).not.toMatch(/!/);
      expect(b.subtext).not.toMatch(/!/);
    }
  });

  it('IDENTITY returns manifesto lines without numbers', () => {
    const v = generateBroadcasts('identity', { type: 'score', score: 88 });
    expect(v.length).toBe(3);
    for (const b of v) {
      expect(b.voice).toBe('identity');
      // Identity is pure — never carries the live score in the headline.
      expect(b.headline).not.toMatch(/\d/);
    }
  });

  it('all voices produce short headlines (no long sentences)', () => {
    const ctx: ShareContext = { type: 'score', score: 80, state: 'Peak' };
    for (const voice of ['status', 'action', 'identity'] as const) {
      const v = generateBroadcasts(voice, ctx);
      for (const b of v) {
        // Headline never exceeds 36 characters — keeps the luxe big-type look.
        expect(b.headline.length).toBeLessThanOrEqual(36);
      }
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
    expect(v[0].headline).toBe('SYSTEM CONTROLLED');
  });

  it('falls back to Balanced when ctx.state is invalid', () => {
    // @ts-expect-error — simulate query-derived garbage state
    const v = generateBroadcasts('status', { type: 'score', state: 'foo' });
    expect(v[0].headline).toBe('SYSTEM CONTROLLED');
    expect(v[1].subtext).toBe('Balanced.');
  });

  it('renders status with no context fields at all', () => {
    const v = generateBroadcasts('status', { type: 'score' });
    expect(v.length).toBe(3);
    expect(v[0].subtext).toBe('Operating.');
  });

  it('action / identity ignore context entirely', () => {
    // @ts-expect-error — even garbage state cannot poison action/identity output
    const a = generateBroadcasts('action', { type: 'score', state: 'foo' });
    const i = generateBroadcasts('identity', { type: 'score' });
    expect(a.length).toBe(3);
    expect(i.length).toBe(3);
    for (const b of [...a, ...i]) {
      expect(b.headline.length).toBeGreaterThan(0);
    }
  });
});

describe('broadcastToMessage', () => {
  it('joins headline + subtext with a single space', () => {
    expect(broadcastToMessage({
      id: 'x', voice: 'status', headline: 'SYSTEM CONTROLLED', subtext: 'Score 88.',
    })).toBe('SYSTEM CONTROLLED Score 88.');
  });

  it('omits the trailing space when subtext is empty', () => {
    expect(broadcastToMessage({
      id: 'x', voice: 'status', headline: 'SYSTEM CONTROLLED', subtext: '',
    })).toBe('SYSTEM CONTROLLED');
  });
});
