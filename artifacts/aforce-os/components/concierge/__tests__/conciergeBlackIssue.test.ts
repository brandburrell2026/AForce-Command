/**
 * Black Issue restyle (PR 4) — the pure helpers behind the new presentation.
 * The pill, headline, Ask next row and time stamps may draw ONLY data the
 * screen / turn already holds; these tests pin that nothing is defaulted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { askNextKeys, contextSegments, formatTurnTime, splitAnswer } from '../conciergePresentation';
import { SUGGESTED_KEYS } from '../openingLogic';
import type { ConciergeClientContext } from '@/services/concierge/conciergeTypes';

const EN = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8'));
const i18n = i18nCore.createInstance();
i18n.init({ lng: 'en', resources: { en: { translation: EN } }, interpolation: { escapeValue: false } });
const t = i18n.t.bind(i18n);

type PillCtx = Pick<ConciergeClientContext, 'hydroState' | 'intake'>;
const intake = (over: Partial<ConciergeClientContext['intake']> = {}): ConciergeClientContext['intake'] => ({
  ozToday: 0,
  ozTarget: 0,
  unitsToday: 0,
  unitsTarget: 0,
  lastIntakeMinutesAgo: null,
  provenance: 'logged',
  loggedToday: false,
  ...over,
});
const state = (over: Partial<NonNullable<ConciergeClientContext['hydroState']>> = {}): NonNullable<ConciergeClientContext['hydroState']> => ({
  score: 69,
  level: 'RECOVERING',
  urgency: 'moderate',
  evidence: 'ready',
  ...over,
});

describe('contextSegments — only what the context carries', () => {
  it('draws nothing when there is no state and nothing logged (no pill)', () => {
    const ctx: PillCtx = { hydroState: null, intake: intake() };
    expect(contextSegments(ctx, t)).toEqual([]);
  });
  it('draws the HydroState reading only once its evidence is ready', () => {
    expect(contextSegments({ hydroState: state({ evidence: 'building' }), intake: intake() }, t)).toEqual([]);
    expect(contextSegments({ hydroState: state(), intake: intake() }, t)).toEqual(['HydroState 69 · Recovering']);
  });
  it('never states "nothing logged"; draws intake only when something was logged', () => {
    expect(contextSegments({ hydroState: null, intake: intake({ ozToday: 0, ozTarget: 96, loggedToday: false }) }, t)).toEqual([]);
    expect(contextSegments({ hydroState: null, intake: intake({ ozToday: 44, ozTarget: 96, loggedToday: true }) }, t)).toEqual(['44 of 96 oz today']);
    expect(contextSegments({ hydroState: null, intake: intake({ ozToday: 44, ozTarget: 0, loggedToday: true }) }, t)).toEqual(['44 oz today']);
  });
});

describe('splitAnswer — the string is never rewritten', () => {
  it('headline + rest reassemble to the original', () => {
    const a = 'Heat load is high. Here is the plan. Sip steadily.';
    const { headline, rest } = splitAnswer(a);
    expect(headline).toBe('Heat load is high.');
    expect(`${headline} ${rest}`).toBe(a);
  });
  it('a decimal point is not a sentence end', () => {
    expect(splitAnswer('You are at 3.5 liters so far.').headline).toBe('You are at 3.5 liters so far.');
  });
  it('a long first sentence stays body text instead of shouting', () => {
    const long = `${'word '.repeat(40).trim()}.`;
    expect(splitAnswer(long)).toEqual({ headline: null, rest: long });
  });
});

describe('askNextKeys / formatTurnTime', () => {
  it('puts the picked question first and never repeats it', () => {
    const keys = askNextKeys('target', SUGGESTED_KEYS);
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe('target');
    expect(new Set(keys).size).toBe(3);
  });
  it('a stamp that is not a time draws nothing', () => {
    expect(formatTurnTime('x', 'en')).toBeNull();
    expect(formatTurnTime(undefined, 'en')).toBeNull();
    expect(formatTurnTime('2026-10-05T14:00:00Z', 'en')).toMatch(/\d/);
  });
});

describe('composer — no microphone is drawn (speech recognition is a stub; law lock)', () => {
  it('the composer source offers no mic control', () => {
    const src = readFileSync(join(__dirname, '..', 'ConciergeComposer.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/name="mic"|microphone|startListening/i);
  });
});
