// @vitest-environment happy-dom
/**
 * Home's confidence affordance — RENDER coverage (Wave 5 residual A).
 *
 * `homeConfidence.test.ts` proves the rating is proportional to the evidence;
 * this proves the member can actually SEE that — the shipped `ConfidenceChip`
 * renders the resolved model, and the two members the founder named do not read
 * the same on screen. Without this, a resolver could grade perfectly into a
 * chip nothing ever draws.
 *
 * Renders the real component to a DOM (react-native-web → react-dom,
 * happy-dom), the convention this directory already uses for store-free
 * subcomponents (`HomeBaselineHero.render.test.tsx`); the connected
 * `HomeScreenV2` container stays source-guard-tested, per
 * `homeScreenV2Wiring.test.ts`'s header.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ConfidenceChip } from '@/components/ConfidenceChip';
import { resolveHomeConfidence, type HomeConfidenceInput } from '../homeConfidence';
import type { ProviderBiometrics } from '@/types';

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const ONE_DRINK: HomeConfidenceInput = {
  intakeEvents: [{ loggedAt: new Date(NOW - 20 * 60 * 1000) }],
  history: [],
  biometrics: null,
  now: NOW,
};

const WEEK_PLUS_WEARABLE: HomeConfidenceInput = {
  intakeEvents: [{ loggedAt: new Date(NOW - 30 * 60 * 1000) }],
  history: Array.from({ length: 7 }, (_, i) => ({ timestamp: new Date(NOW - i * DAY) })),
  biometrics: {
    whoop: {
      providerId: 'whoop',
      sleepHoursLastNight: 7.4,
      restingHeartRate: 52,
      stepsToday: 6400,
      fetchedAt: NOW - 60 * 60 * 1000,
    },
  } as ProviderBiometrics,
  now: NOW,
};

let host: HTMLElement;
let root: Root;

/** Renders the chip exactly as HomeScreenV2 does: label + opacity from the resolver. */
function renderFor(input: HomeConfidenceInput): string {
  const { chip } = resolveHomeConfidence(input);
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(ConfidenceChip, {
        label: chip.label,
        opacity: chip.opacity,
        a11yContext: 'signal quality',
      }),
    ),
  );
  return host.textContent ?? '';
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('Home confidence chip — the affordance actually reaches the screen', () => {
  it('renders the thin-evidence member a visible LIMITED token', () => {
    expect(renderFor(ONE_DRINK)).toContain('LIMITED');
  });

  it('renders the fully-evidenced member a different token', () => {
    expect(renderFor(WEEK_PLUS_WEARABLE)).toContain('GOOD');
  });

  it('never renders a score, a band word or a percentage — it qualifies the number, it is not one', () => {
    const thin = renderFor(ONE_DRINK);
    // Unmount between the two renders so the second is measured alone; the
    // last root is left for afterEach, which owns the teardown.
    flushSync(() => root.unmount());
    host.innerHTML = '';
    const rich = renderFor(WEEK_PLUS_WEARABLE);

    for (const text of [thin, rich]) {
      expect(text).not.toMatch(/\d/);
      for (const band of ['PEAK', 'BALANCED', 'RECOVERING', 'DEPLETED']) {
        expect(text).not.toContain(band);
      }
    }
  });
});
