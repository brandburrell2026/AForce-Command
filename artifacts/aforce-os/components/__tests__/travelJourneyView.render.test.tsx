// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { TravelTrip } from '@workspace/api-zod';

import { TravelJourneyView, type TravelJourneyActions } from '../travel/TravelJourneyView';
import { journeyView } from '@/utils/travel/journeyPresentation';

const trip: TravelTrip = {
  id: 'mia',
  title: 'Miami',
  completedAt: null,
  createdAt: '2026-11-01T12:00:00Z',
  legs: [{
    id: 'l1',
    flight: { flightNumber: 'AA123', departureDate: '2026-11-12', origin: 'JFK', destination: 'MIA' },
    departureAt: '2026-11-12T12:05:00Z', arrivalAt: '2026-11-12T15:12:00Z',
    originTimeZone: 'America/New_York', destinationTimeZone: 'America/New_York',
  }],
};
const viewAt = (nowIso: string, confirmed?: string) =>
  journeyView({
    trips: [trip],
    snapshots: {},
    confirmations: () => (confirmed ? { arrivalConfirmedAtIso: confirmed } : {}),
    nowMs: Date.parse(nowIso),
  })!;

let host: HTMLDivElement;
let root: Root;
let actions: TravelJourneyActions;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  actions = { busy: false, onConfirmArrival: vi.fn(), onUndoArrival: vi.fn(), onReady: vi.fn(), onOpenPlan: vi.fn() };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const render = async (el: React.ReactElement) => {
  await act(async () => root.render(el));
};
const button = (label: string) =>
  Array.from(host.querySelectorAll('[role="button"]')).find((b) => b.textContent === label) as HTMLElement | undefined;

it('in transit shows LOCK-IN, planned-only progress and one action', async () => {
  await render(<TravelJourneyView view={viewAt('2026-11-12T13:25:00Z')} actions={actions} />);
  expect(host.querySelector('[data-testid="travel-journey-lock_in"]')).toBeTruthy();
  expect(host.textContent).toContain('LOCK-IN');
  expect(host.textContent).toContain('not live tracking');
  expect(host.querySelector('[role="progressbar"]')).toBeTruthy();
  const landed = button('I’ve landed')!;
  await act(async () => landed.click());
  expect(actions.onConfirmArrival).toHaveBeenCalledTimes(1);
  expect(button('I’m ready')).toBeUndefined();
});

it('arrival shows the city, the standard line, and opens the arrival Moment', async () => {
  await render(<TravelJourneyView view={viewAt('2026-11-12T15:30:00Z', '2026-11-12T15:20:00Z')} actions={actions} />);
  expect(host.textContent).toContain('Miami');
  expect(host.textContent).toContain('New city. Same standard.');
  expect(host.textContent).toContain('City photography coming');
  await act(async () => button('Plan your Miami arrival')!.click());
  expect(actions.onOpenPlan).toHaveBeenCalledWith('travel2:mia:l1:arrival');
  await act(async () => button('I’m ready')!.click());
  expect(actions.onReady).toHaveBeenCalledTimes(1);
  await act(async () => button('I haven’t landed yet')!.click());
  expect(actions.onUndoArrival).toHaveBeenCalledTimes(1);
});

it('preview never shows invented weather', async () => {
  await render(<TravelJourneyView view={viewAt('2026-11-11T23:05:00Z')} actions={actions} />);
  expect(host.textContent).toContain('Your next destination awaits.');
  expect(host.textContent).toContain('Unavailable');
  expect(host.textContent).not.toMatch(/\d+°F/);
});

it('a review flag is announced', async () => {
  const v = { ...viewAt('2026-11-12T10:30:00Z'), needsReview: true };
  await render(<TravelJourneyView view={v} actions={actions} />);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('cancellation or diversion');
});

it('busy disables actions', async () => {
  await render(<TravelJourneyView view={viewAt('2026-11-12T13:25:00Z')} actions={{ ...actions, busy: true }} />);
  await act(async () => button('I’ve landed')!.click());
  expect(actions.onConfirmArrival).not.toHaveBeenCalled();
});
