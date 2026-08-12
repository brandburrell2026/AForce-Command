// @vitest-environment happy-dom
/**
 * Wave-4 Part 6 — the 1-second tick must not re-render the whole app.
 *
 * `AppProvider` runs a plain `setInterval(… 'TICK_TIMER' …, 1000)` that is
 * deliberately NOT AppState-gated (PR #544 blocker 2 — the reducer has no
 * clock, so gating froze the countdown). That interval is correct and is
 * left alone. What was wrong is what each tick COST:
 *
 *   - the facade's `value` memo depended on the whole `state` object, so
 *     every tick changed its identity and all ~90 `useAppStore()` call
 *     sites re-rendered — including all six tab-route wrappers, whose
 *     children are not `React.memo`-wrapped, cascading through entire
 *     screen subtrees;
 *   - `CycleSlice` bundled `timerSeconds` with non-ticking fields, so
 *     consumers reading only `isCompletingCycle` re-rendered too;
 *   - once expired, the reducer kept returning a value-identical NEW state
 *     object every second forever, defeating React's bail-out.
 *
 * This file measures all three against the REAL reducer and REAL
 * `SliceProvider`, using the same harness convention as the other
 * render-count proofs (see `_renderCountHarness.tsx`'s header for why
 * `AppProvider` itself is not mounted).
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  FacadeAndSliceHarness,
  useFacadeState,
  useStableFacadeState,
  useCountRenders,
  type HarnessControls,
} from './_renderCountHarness';
import { useCycleSlice, useTimerSlice } from '../slices';
import { reducer } from '../appStoreReducer';
import { makeState } from './_fixtures';

const TICKS = 60; // one minute of wall-clock ticks

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
});

const counts = {
  oldFacade: { current: 0 },
  newFacade: { current: 0 },
  cycleOnly: { current: 0 },
  timer: { current: 0 },
};

/** Reads the pre-Wave-4 facade (whole-state memo) — the "before" control. */
function OldFacadeProbe(): React.ReactElement {
  useFacadeState();
  useCountRenders(counts.oldFacade);
  return <div />;
}

/** Reads today's facade (`pickFacadeState`, 16 non-timer deps). */
function NewFacadeProbe(): React.ReactElement {
  useStableFacadeState();
  useCountRenders(counts.newFacade);
  return <div />;
}

/** Reads CycleSlice only — e.g. PrimaryCTA, SmartQuickActions. */
function CycleOnlyProbe(): React.ReactElement {
  useCycleSlice();
  useCountRenders(counts.cycleOnly);
  return <div />;
}

/** Genuinely displays the countdown — SHOULD re-render every tick. */
function TimerProbe(): React.ReactElement {
  const { timerSeconds } = useTimerSlice();
  useCountRenders(counts.timer);
  return <div>{timerSeconds}</div>;
}

function mountAndTick(initialTimerSeconds: number): void {
  for (const c of Object.values(counts)) c.current = 0;
  let controls: HarnessControls | null = null;
  flushSync(() => {
    root.render(
      <FacadeAndSliceHarness
        initialState={makeState({ timerSeconds: initialTimerSeconds })}
        onControls={(c) => { controls = c; }}
      >
        <OldFacadeProbe />
        <NewFacadeProbe />
        <CycleOnlyProbe />
        <TimerProbe />
      </FacadeAndSliceHarness>,
    );
  });
  // Discard the mount render; count only tick-driven re-renders.
  for (const c of Object.values(counts)) c.current = 0;
  for (let i = 0; i < TICKS; i += 1) {
    flushSync(() => (controls as unknown as HarnessControls).dispatchTick());
  }
}

describe('TICK_TIMER render blast — a running countdown', () => {
  it('re-renders ONLY the countdown display, not the facade or the cycle slice', () => {
    mountAndTick(600); // 10 minutes remaining: every tick is a real change

    // BEFORE: the whole-state facade re-rendered on every single tick.
    expect(counts.oldFacade.current).toBe(TICKS);

    // AFTER: the facade holds identity across all 60 ticks. This is the
    // number that used to multiply across ~90 call sites and six
    // un-memoized route subtrees.
    expect(counts.newFacade.current).toBe(0);

    // Consumers reading cycle state but not the countdown are now quiet.
    expect(counts.cycleOnly.current).toBe(0);

    // The component that actually shows the countdown still updates — the
    // fix must not be achieved by breaking the display.
    expect(counts.timer.current).toBe(TICKS);
  });
});

describe('TICK_TIMER render blast — an expired, unanswered countdown', () => {
  it('costs ZERO renders anywhere once expired, in every probe', () => {
    // The expiry tick itself is a genuine state change (timerSeconds hits
    // 0 and pendingConfirmation flips true), so it legitimately renders
    // the countdown and any pendingConfirmation reader — the facade
    // included. What must cost nothing is the steady state AFTER it:
    // until the user answers, nothing can change.
    mountAndTick(1); // 1 expiry tick + 59 steady-state ticks

    // Expiry transition: exactly one render each, never 60.
    expect(counts.timer.current).toBe(1);
    expect(counts.newFacade.current).toBe(1); // pendingConfirmation: false → true
    expect(counts.cycleOnly.current).toBe(0); // CycleSlice holds no timer/confirmation field

    // The old whole-state facade also settles at 1 — the reducer bail-out
    // fixes the expired steady state for every consumer shape. Before it,
    // this probe counted all 60.
    expect(counts.oldFacade.current).toBe(1);
  });
});

describe('reducer: TICK_TIMER identity contract', () => {
  it('returns the SAME state reference once expired and awaiting confirmation', () => {
    const expired = reducer(makeState({ timerSeconds: 1 }), { type: 'TICK_TIMER' });
    expect(expired.timerSeconds).toBe(0);
    expect(expired.pendingConfirmation).toBe(true);

    const again = reducer(expired, { type: 'TICK_TIMER' });
    expect(again).toBe(expired); // reference-equal: React bails the dispatch
  });

  it('still counts down normally while time remains', () => {
    const s = makeState({ timerSeconds: 5 });
    const next = reducer(s, { type: 'TICK_TIMER' });
    expect(next.timerSeconds).toBe(4);
    expect(next).not.toBe(s);
  });

  it('still fires pendingConfirmation exactly when the timer reaches zero', () => {
    const next = reducer(makeState({ timerSeconds: 1, pendingConfirmation: false }), {
      type: 'TICK_TIMER',
    });
    expect(next.timerSeconds).toBe(0);
    expect(next.pendingConfirmation).toBe(true);
  });

  it('does NOT bail when the timer sits at zero but confirmation was already answered', () => {
    // pendingConfirmation false at zero means a new cycle is being seeded;
    // the bail-out must not swallow that transition.
    const s = makeState({ timerSeconds: 0, pendingConfirmation: false });
    const next = reducer(s, { type: 'TICK_TIMER' });
    expect(next).not.toBe(s);
    expect(next.pendingConfirmation).toBe(true);
  });
});
