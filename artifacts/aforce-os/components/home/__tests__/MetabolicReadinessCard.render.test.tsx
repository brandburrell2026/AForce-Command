// @vitest-environment happy-dom
/**
 * MetabolicReadinessCard — NON-SHIPPING render harness (VS 3.0 P2 migration).
 *
 * The card was ported off legacy Colors.* / hardcoded Inter_* strings / magic
 * sizes / raw rgba(255,255,255,·) surfaces onto the af.* system. This harness
 * pins what a token-only migration must NOT change: the always-on medical
 * disclaimer, the entitled live rows (incl. the honest "Needs more data" row),
 * and the locked teaser + CTA. Icon is stubbed to avoid the suite's documented
 * expo-modules-core `__DEV__` load failure.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/components/Icon', () => ({ Icon: () => null }));

import { MetabolicReadinessCard } from '../MetabolicReadinessCard';
import type { MetabolicReadiness } from '@/utils/metabolicScore';

const LIVE: MetabolicReadiness = { hasEnoughData: true, score: 82, band: 'PEAK' };
const NODATA: MetabolicReadiness = { hasEnoughData: false, score: null, band: null };

let host: HTMLElement;
let root: Root;

function render(props: Partial<React.ComponentProps<typeof MetabolicReadinessCard>> = {}) {
  root = createRoot(host);
  flushSync(() =>
    root.render(
      React.createElement(MetabolicReadinessCard, {
        entitled: true,
        muscle: LIVE,
        cognitive: NODATA,
        onUpgrade: () => {},
        ...props,
      }),
    ),
  );
}
const text = () => host.textContent ?? '';

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

describe('MetabolicReadinessCard — VS 3.0 P2 token migration', () => {
  it('entitled: renders the eyebrow, live muscle score, and the honest "Needs more data" row', () => {
    render();
    const t = text();
    expect(t).toContain('METABOLIC READINESS');
    expect(t).toContain('MUSCLE');
    expect(t).toContain('82'); // live score
    expect(t).toContain('PEAK'); // band
    expect(t).toContain('COGNITIVE');
    expect(t).toContain('Needs more data'); // no-data branch preserved
  });

  it('always shows the medical disclaimer, entitled or not', () => {
    render();
    expect(text()).toContain('Wellness estimate — not a medical measurement.');
    render({ entitled: false });
    expect(text()).toContain('Wellness estimate — not a medical measurement.');
  });

  it('locked: shows the unlock CTA + teaser and no live scores', () => {
    render({ entitled: false });
    const t = text();
    expect(t).toContain('UNLOCK WITH ATHLETE');
    expect(t).toContain('Muscle + cognitive readiness');
    expect(t).not.toContain('Needs more data');
    expect(t).not.toContain('82');
  });
});
