// @vitest-environment happy-dom
/**
 * AFTimeline — "a step says which step it is" (Wave-5 Phase-1 a11y pass).
 *
 * Two defects, both in the primitive rather than on Protocol:
 *
 *  1. STATE BY APPEARANCE ALONE. completed / current / upcoming / locked / hold
 *     were carried entirely by the node's fill colour plus a 10pt decorative
 *     glyph. Nothing in the accessibility tree said which was which, so the
 *     ordering that IS a timeline was invisible to a screen reader — and for
 *     everyone else it rested on hue.
 *  2. LOOSE FRAGMENTS. title / meta / subtitle were three unlinked Texts, read
 *     as three separate swipes — the defect already fixed for AFCard's composed
 *     labels and for Circle's leader rows.
 *
 * Both are now one composed announcement per step. Rendered through
 * react-native-web (the repo-wide vitest alias): `accessible` +
 * `accessibilityLabel` become a real element carrying aria-label, so the
 * composition is provable at render rather than only in source.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Native vector fonts are irrelevant to structure/a11y here — mocked per the
// AFListRow / connectedHealthView harness convention.
vi.mock('../../Icon', () => ({
  Icon: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }),
}));

import { AFTimeline, timelineStepA11yLabel, type AFTimelineStep } from '../AFTimeline';

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  flushSync(() => root.unmount());
  host.remove();
});

function render(node: React.ReactElement): void {
  flushSync(() => root.render(node));
}

const STEPS: AFTimelineStep[] = [
  { title: 'Electrolyte load', subtitle: '2:00 PM – 3:00 PM', state: 'upcoming' },
  { title: 'Recheck', subtitle: 'After training', state: 'locked', meta: '+2h' },
];

function labels(): string[] {
  return Array.from(host.querySelectorAll('[aria-label]')).map(
    (el) => el.getAttribute('aria-label') ?? '',
  );
}

describe('AFTimeline — each step is one announcement', () => {
  it('composes title, subtitle and meta into a single label per step', () => {
    render(<AFTimeline steps={STEPS} />);
    const spoken = labels();
    expect(spoken).toHaveLength(2);
    expect(spoken[0]).toContain('Electrolyte load');
    expect(spoken[0]).toContain('2:00 PM – 3:00 PM');
    expect(spoken[1]).toContain('+2h');
  });

  it('emits one element per step — not one per Text inside it', () => {
    render(<AFTimeline steps={STEPS} />);
    expect(labels()).toHaveLength(STEPS.length);
  });
});

describe('AFTimeline — the step state is spoken, never left to the node colour', () => {
  it('speaks the state even when the caller supplies no words for it', () => {
    // The fallback is the state key itself: a caller who passes nothing still
    // gets "locked", never silence.
    render(<AFTimeline steps={STEPS} />);
    expect(labels()[0]).toContain('upcoming');
    expect(labels()[1]).toContain('locked');
  });

  it('prefers the caller\'s translated state word when one is given', () => {
    render(<AFTimeline steps={STEPS} stateLabels={{ upcoming: 'à venir' }} />);
    expect(labels()[0]).toContain('à venir');
    // Unsupplied states still fall back rather than going unspoken.
    expect(labels()[1]).toContain('locked');
  });

  it('distinguishes two steps whose ONLY difference is state', () => {
    // The exact thing colour alone was carrying: same words, different place
    // in the plan.
    const same: AFTimelineStep[] = [
      { title: 'Hydrate 16 oz', state: 'completed' },
      { title: 'Hydrate 16 oz', state: 'current' },
    ];
    render(<AFTimeline steps={same} />);
    const spoken = labels();
    expect(spoken[0]).not.toBe(spoken[1]);
  });
});

describe('timelineStepA11yLabel — the composition rule itself', () => {
  it('orders title first and state last, skipping absent parts', () => {
    expect(
      timelineStepA11yLabel({ title: 'Recheck', state: 'hold' }),
    ).toBe('Recheck, hold');
    expect(
      timelineStepA11yLabel(
        { title: 'Recheck', subtitle: 'After training', meta: '+2h', state: 'hold' },
        { hold: 'on hold' },
      ),
    ).toBe('Recheck, After training, +2h, on hold');
  });
});
