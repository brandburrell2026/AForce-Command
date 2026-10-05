/**
 * Presentation helpers — notice copy mapping, source description, action
 * detail shown BEFORE confirmation, speakable text, seeds. Uses the shipped
 * en.json so copy regressions are caught.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import {
  actionDetail,
  actionTitle,
  describeSource,
  localNoticeCopy,
  noticeCopyFor,
  seedText,
  speakableText,
  unavailableBodyFor,
  unavailableRetryable,
} from '../conciergePresentation';
import type { ConciergeAssistantTurn } from '@/services/concierge/conciergeTypes';

const EN = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8'));
const i18n = i18nCore.createInstance();
i18n.init({ lng: 'en', resources: { en: { translation: EN } }, interpolation: { escapeValue: false } });
const t = i18n.t.bind(i18n);

const turn = (over: Partial<ConciergeAssistantTurn> = {}): ConciergeAssistantTurn => ({
  status: 'ok',
  kind: 'answer',
  answer: 'You are behind pace.',
  nextStep: 'Drink 16 oz water now.',
  why: 'Last log 145 minutes ago.',
  action: null,
  remember: null,
  sources: [],
  audit: { model: 'gpt-5.4', gatePolicy: 'concierge-gate-v1.0', attempts: 1 },
  ...over,
});

describe('noticeCopyFor', () => {
  it('returns null for ok and urgent (they render as content)', () => {
    expect(noticeCopyFor(turn(), t)).toBeNull();
    expect(noticeCopyFor(turn({ status: 'urgent', kind: 'notice' }), t)).toBeNull();
  });
  it('maps gated → language-rule copy (retryable), ai_not_configured → not-configured copy (not retryable)', () => {
    expect(noticeCopyFor(turn({ status: 'gated', kind: 'notice', answer: '' }), t)).toEqual({
      title: EN.concierge.state.gated_title,
      body: EN.concierge.state.gated_body,
      retryable: true,
    });
    expect(noticeCopyFor(turn({ status: 'unavailable', kind: 'notice', answer: '', code: 'ai_not_configured' }), t)).toEqual({
      title: EN.concierge.state.unavailable_title,
      body: EN.concierge.state.not_configured_body,
      retryable: false,
    });
  });
});

describe('unavailable reasons (turn codes and status reasons share one map)', () => {
  it('quota → capacity copy, not retryable; key → not-configured copy; unknown → generic, retryable', () => {
    expect(noticeCopyFor(turn({ status: 'unavailable', kind: 'notice', answer: '', code: 'upstream_quota' }), t)).toEqual({
      title: EN.concierge.state.unavailable_title,
      body: EN.concierge.state.quota_body,
      retryable: false,
    });
    expect(unavailableBodyFor('ai_key_invalid', t)).toBe(EN.concierge.state.not_configured_body);
    expect(unavailableBodyFor('ai_rate_limited', t)).toBe(EN.concierge.state.rate_limited);
    expect(unavailableBodyFor('upstream_error', t)).toBe(EN.concierge.state.unavailable_body);
    expect(unavailableRetryable('upstream_error')).toBe(true);
    expect(unavailableRetryable('ai_quota_exhausted')).toBe(false);
  });
});

describe('localNoticeCopy', () => {
  it('offline is retryable, daily limit is not', () => {
    expect(localNoticeCopy('offline', t).retryable).toBe(true);
    expect(localNoticeCopy('daily_limit', t).retryable).toBe(false);
    expect(localNoticeCopy('daily_limit', t).body).toBe(EN.concierge.state.daily_limit);
  });
});

describe('describeSource', () => {
  it('states provenance and freshness in plain words', () => {
    expect(describeSource({ id: 'signal:whoop.sleep', label: 'Sleep last night (whoop)', provenance: 'measured', freshness: 'aging' }, t)).toBe(
      'Sleep last night (whoop) · measured · a little old',
    );
    expect(describeSource({ id: 'intake', label: 'Logged intake today', provenance: 'demo', freshness: 'fresh' }, t)).toBe(
      'Logged intake today · sample data · current',
    );
  });
});

describe('action copy shown before confirmation', () => {
  it('hydration shows the exact amount', () => {
    const a = { type: 'log_hydration' as const, fluidType: 'water' as const, oz: 16, label: 'Log' };
    expect(actionTitle(a, t)).toBe('Log water');
    expect(actionDetail(a, t)).toBe('16 oz water, logged now');
  });
  it('reminder shows local time, date and recurrence', () => {
    const a = { type: 'set_reminder' as const, title: 'Water before the gym', timeLocal: '18:30', dateLocal: '2026-10-05', recurrence: 'daily' as const, label: 'Set' };
    expect(actionDetail(a, t)).toBe('Water before the gym · 2026-10-05 at 18:30 · daily');
  });
  it('open-screen names the destination', () => {
    expect(actionTitle({ type: 'open_screen', screen: 'weekly_report', label: 'Open' }, t)).toBe('Open Weekly report');
  });
});

describe('speakableText / seedText', () => {
  it('reads the answer and next step only', () => {
    expect(speakableText(turn())).toBe('You are behind pace. Drink 16 oz water now.');
    expect(speakableText(turn({ nextStep: null }))).toBe('You are behind pace.');
  });
  it('resolves known seeds and ignores unknown ones', () => {
    expect(seedText('hydration', t)).toBe(EN.concierge.seed.hydration);
    expect(seedText('nope', t)).toBe('');
    expect(seedText(undefined, t)).toBe('');
  });
});
