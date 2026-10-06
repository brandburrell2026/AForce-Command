// @vitest-environment happy-dom
/**
 * ConciergeMessageBubble + ConciergeActionCard — render coverage against the
 * shipped en.json (react-native-web → react-dom, happy-dom), following
 * HomeBaselineHero.render.test.tsx.
 *
 *  - an ok turn renders answer, next step, "Why this?" toggle and sources;
 *  - an action card shows the EXACT details before confirmation, runs once on
 *    confirm, and a second tap cannot double-execute;
 *  - a failed action is reported honestly and keeps a Retry;
 *  - a gated / unavailable turn renders the honest notice, never empty text;
 *  - a local offline item renders with Retry.
 */
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import i18nCore from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

vi.mock('react-native-reanimated', async () => {
  const RN = await import('react-native');
  const identity = (v: unknown) => v;
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (C: unknown) => C },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => {
      try { return fn(); } catch { return {}; }
    },
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withSequence: identity,
    withDelay: (_d: unknown, v: unknown) => v,
    cancelAnimation: () => {},
    runOnJS: (fn: unknown) => fn,
    Easing: new Proxy({}, { get: () => (e: unknown) => e }),
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    FadeOut: { duration: () => ({}) },
  };
});
// The ui barrel pulls in chart/svg/image primitives that do not load in node;
// the repo's render tests import primitives directly, so the barrel is mocked
// here with the REAL button primitives the concierge components use.
vi.mock('@/components/ui', async () => {
  const buttons = await import('@/components/ui/AFButton');
  return {
    AFPrimaryButton: buttons.AFPrimaryButton,
    AFSecondaryButton: buttons.AFSecondaryButton,
    AFTextButton: buttons.AFTextButton,
  };
});
vi.mock('@/components/Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));
vi.mock('@/services/haptics', () => ({ fireMoment: vi.fn() }));
vi.mock('@/store/useAppStore', () => ({ useFeatureFlags: () => ({ elite_motion_enabled: false }) }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
vi.mock('@/services/concierge/conciergeReminders', () => ({
  scheduleConciergeReminder: vi.fn(),
  cancelConciergeReminder: vi.fn(),
}));

import { ConciergeMessageBubble } from '../ConciergeMessageBubble';
import { ActionLedger } from '@/services/concierge/conciergeActions';
import type { ConciergeAssistantTurn, ConciergeChatItem } from '@/services/concierge/conciergeTypes';

const EN = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'locales', 'en.json'), 'utf8'));
const testI18n = i18nCore.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: EN } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

let host: HTMLElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const turn = (over: Partial<ConciergeAssistantTurn> = {}): ConciergeAssistantTurn => ({
  status: 'ok',
  kind: 'answer',
  answer: 'You are behind pace for the day.',
  nextStep: 'Drink 16 oz water now.',
  why: 'Your last log was 145 minutes ago.',
  action: { type: 'log_hydration', fluidType: 'water', oz: 16, label: 'Log 16 oz water' },
  remember: null,
  sources: [{ id: 'intake', label: 'Logged intake today', provenance: 'logged', freshness: 'fresh' }],
  audit: { model: 'gpt-5.4', gatePolicy: 'concierge-gate-v1.0', attempts: 1 },
  ...over,
});

function render(item: ConciergeChatItem, opts: { logIntake?: () => Promise<unknown>; onRetry?: (id: string) => void } = {}) {
  const ledger = new ActionLedger();
  const logIntake = vi.fn(opts.logIntake ?? (async () => ({})));
  const router = { push: vi.fn() };
  act(() => {
    root.render(
      <I18nextProvider i18n={testI18n}>
        <ConciergeMessageBubble
          item={item}
          ledger={ledger}
          actionDeps={{ logIntake, router }}
          onRetry={opts.onRetry}
          canSpeak={false}
        />
      </I18nextProvider>,
    );
  });
  return { ledger, logIntake, router };
}

const byTestId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const click = (el: HTMLElement | null) => {
  expect(el, 'element missing').not.toBeNull();
  act(() => {
    el!.click();
  });
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('ok turn', () => {
  it('renders answer, next step, Why toggle and sources', () => {
    render({ id: 'm1', role: 'assistant', turn: turn(), createdAt: '2026-10-05T14:00:00Z' });
    expect(host.textContent).toContain('You are behind pace for the day.');
    expect(host.textContent).toContain('Drink 16 oz water now.');
    expect(byTestId('concierge-why-body-m1')).toBeNull();
    click(byTestId('concierge-why-m1'));
    expect(byTestId('concierge-why-body-m1')?.textContent).toContain('Your last log was 145 minutes ago.');
    expect(byTestId('concierge-why-body-m1')?.textContent).toContain('Logged intake today · logged · current');
  });
});

describe('action card', () => {
  it('shows the exact details before confirmation and runs the intake path once', async () => {
    const { logIntake } = render({ id: 'm1', role: 'assistant', turn: turn(), createdAt: '2026-10-05T14:00:00Z' });
    expect(byTestId('concierge-action-m1-detail')?.textContent).toBe('16 oz water, logged now');
    click(byTestId('concierge-action-m1-confirm'));
    await flush();
    expect(logIntake).toHaveBeenCalledTimes(1);
    expect(logIntake).toHaveBeenCalledWith('water', { ozOverride: 16, source: 'concierge' });
    expect(byTestId('concierge-action-m1-note')?.textContent).toMatch(/^Logged 16 oz · /);
    // The confirm control is gone once done; nothing left to double-tap.
    expect(byTestId('concierge-action-m1-confirm')).toBeNull();
  });

  it('blocks a double tap while the first run is in flight', async () => {
    let release: () => void = () => {};
    const { logIntake } = render(
      { id: 'm1', role: 'assistant', turn: turn(), createdAt: '2026-10-05T14:00:00Z' },
      { logIntake: () => new Promise((r) => { release = () => r({}); }) },
    );
    click(byTestId('concierge-action-m1-confirm'));
    await flush();
    // Button is in its loading/inert state; a second click must not re-run.
    const btn = byTestId('concierge-action-m1-confirm');
    if (btn) click(btn);
    await flush();
    release();
    await flush();
    expect(logIntake).toHaveBeenCalledTimes(1);
  });

  it('reports a failed action and offers Retry', async () => {
    render(
      { id: 'm1', role: 'assistant', turn: turn(), createdAt: '2026-10-05T14:00:00Z' },
      { logIntake: async () => { throw new Error('offline'); } },
    );
    click(byTestId('concierge-action-m1-confirm'));
    await flush();
    expect(byTestId('concierge-action-m1-note')?.textContent).toBe(EN.concierge.action.failed);
    expect(byTestId('concierge-action-m1-confirm')?.textContent).toContain(EN.common.retry);
  });

  it('lets the member edit the amount before confirming', async () => {
    const { logIntake } = render({ id: 'm1', role: 'assistant', turn: turn(), createdAt: '2026-10-05T14:00:00Z' });
    click(byTestId('concierge-action-m1-edit'));
    const input = byTestId('concierge-action-m1-oz') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '24');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    click(byTestId('concierge-action-m1-apply-edit'));
    expect(byTestId('concierge-action-m1-detail')?.textContent).toBe('24 oz water, logged now');
    click(byTestId('concierge-action-m1-confirm'));
    await flush();
    expect(logIntake).toHaveBeenCalledWith('water', { ozOverride: 24, source: 'concierge' });
  });
});

describe('honest states', () => {
  it('a gated turn renders the language-rule notice, never empty text', () => {
    render({ id: 'm2', role: 'assistant', turn: turn({ status: 'gated', kind: 'notice', answer: '', action: null, nextStep: null }), createdAt: 'x' });
    expect(byTestId('concierge-notice-m2')?.textContent).toContain(EN.concierge.state.gated_title);
    expect(byTestId('concierge-notice-m2')?.textContent).toContain(EN.concierge.state.gated_body);
  });
  it('an unavailable AI renders the not-configured copy', () => {
    render({ id: 'm3', role: 'assistant', turn: turn({ status: 'unavailable', kind: 'notice', answer: '', action: null, code: 'ai_not_configured' }), createdAt: 'x' });
    expect(byTestId('concierge-notice-m3')?.textContent).toContain(EN.concierge.state.not_configured_body);
  });
  it('an urgent turn renders the urgent label and no action card', () => {
    render({ id: 'm4', role: 'assistant', turn: turn({ status: 'urgent', kind: 'notice', answer: 'Contact a clinician now.', action: null, why: null }), createdAt: 'x' });
    expect(host.textContent).toContain(EN.concierge.state.urgent_label);
    expect(byTestId('concierge-action-m4')).toBeNull();
  });
  it('a local offline item renders with Retry wired to the item id', () => {
    const onRetry = vi.fn();
    render({ id: 'l1', role: 'local', kind: 'offline', retryOf: 'u1', createdAt: 'x' }, { onRetry });
    expect(host.textContent).toContain(EN.concierge.state.offline_title);
    click(byTestId('concierge-retry-l1'));
    expect(onRetry).toHaveBeenCalledWith('l1');
  });
});
