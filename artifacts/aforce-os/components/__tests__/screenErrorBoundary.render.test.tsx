// @vitest-environment happy-dom
/**
 * Stop-ship SS-18: a render crash on Profile, Leaderboard or Circle is
 * contained to that screen, can be retried in place, and is logged locally.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/components/ErrorFallback', () => ({ ErrorFallback: () => null }));

import {
  ScreenErrorBoundary,
  SCREEN_ERROR_TITLE,
  SCREEN_ERROR_RETRY,
} from '../ScreenErrorBoundary';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = { crash: true };
function Flaky() {
  if (h.crash) throw new Error('boom');
  return <div data-screen />;
}

async function render() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <div>
        <div data-tab-bar />
        <ScreenErrorBoundary screen="profile">
          <Flaky />
        </ScreenErrorBoundary>
      </div>,
    ),
  );
  return {
    host,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

afterEach(() => {
  h.crash = true;
  vi.restoreAllMocks();
});

describe('ScreenErrorBoundary', () => {
  it('contains the crash: fallback shown, siblings outside the boundary survive', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const v = await render();
    try {
      expect(v.host.querySelector('[data-testid="screen-error-fallback"]')).toBeTruthy();
      expect(v.host.textContent).toContain(SCREEN_ERROR_TITLE);
      expect(v.host.querySelector('[data-tab-bar]')).toBeTruthy();
      expect(v.host.querySelector('[data-screen]')).toBeNull();
      expect(log.mock.calls.some((c) => String(c[0]).includes('render crash on profile'))).toBe(true);
    } finally {
      v.cleanup();
    }
  });

  it('never shows the error message or stack to the member', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const v = await render();
    try {
      expect(v.host.textContent).not.toContain('boom');
    } finally {
      v.cleanup();
    }
  });

  it('"Try again" re-renders the screen in place once the cause is gone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const v = await render();
    try {
      h.crash = false;
      const retry = v.host.querySelector('[data-testid="screen-error-retry"]') as HTMLElement;
      expect(retry.textContent).toContain(SCREEN_ERROR_RETRY);
      await act(async () => retry.click());
      expect(v.host.querySelector('[data-screen]')).toBeTruthy();
      expect(v.host.querySelector('[data-testid="screen-error-fallback"]')).toBeNull();
    } finally {
      v.cleanup();
    }
  });
});

describe('the three SS-18 routes are wrapped', () => {
  const APP = resolve(__dirname, '..', '..', 'app');
  it.each([
    ['(tabs)/profile.tsx', 'ProfileScreenV2'],
    ['leaderboard.tsx', 'LeaderboardScreenV2'],
    ['(tabs)/competition.tsx', 'CircleScreenV4'],
  ])('%s renders %s inside a ScreenErrorBoundary', (file, screen) => {
    const src = readFileSync(resolve(APP, file), 'utf8');
    expect(src).toMatch(new RegExp(`<ScreenErrorBoundary screen="[a-z]+">\\s*<${screen} />\\s*</ScreenErrorBoundary>`));
  });
});
