// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { createJourney } from '@/services/travel/journey';

const state = vi.hoisted(() => ({ owner: 'pilot_A', token: async () => 'synthetic-session' as string | null }));
vi.mock('@clerk/expo', () => ({ useAuth: () => ({ userId: state.owner, getToken: () => state.token() }) }));
vi.mock('expo-router', () => ({ useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]) }));
vi.mock('@/lib/apiBase', () => ({ API_BASE: 'https://aforce.example.test/api' }));
import { TravelFlightStatus } from '../travel/TravelFlightStatus';

const journey = createJourney({ flightNumber: 'AA123', origin: 'JFK', destination: 'LAX', departureDate: '2026-11-01', departureTime: '14:30', utcOffset: '-05:00' });
const observation = () => ({
  version: 1, availability: 'available', provider: 'flightaware', fetchedAt: new Date().toISOString(),
  flight: { flightNumber: 'AA123', origin: 'JFK', destination: 'LAX', departureDate: '2026-11-01', status: 'delayed', scheduledDeparture: '2026-11-01T19:30:00Z', estimatedDeparture: '2026-11-01T20:00:00Z', departureGate: 'B12', departureTerminal: '8' },
});
let host: HTMLDivElement, root: Root, client: QueryClient;
const fetch = vi.fn<typeof globalThis.fetch>();
async function waitUI(assertion: () => void) {
  let last: unknown;
  for (let attempt = 0; attempt < 60; attempt++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    try { assertion(); return; } catch (error) { last = error; }
  }
  throw last;
}
async function render() {
  await act(async () => { root.render(<QueryClientProvider client={client}><TravelFlightStatus key={state.owner} journey={journey} /></QueryClientProvider>); });
}
async function check() {
  const button = host.querySelector('[role="button"]') as HTMLElement;
  await act(async () => { button.click(); });
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetch);
  state.owner = 'pilot_A'; state.token = async () => 'synthetic-session';
  fetch.mockReset(); fetch.mockImplementation(async () => Response.json(observation()));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('flight status panel', () => {
  it('makes no background request and shows provider provenance after an explicit check', async () => {
    await render(); expect(fetch).not.toHaveBeenCalled();
    expect(host.textContent).toContain('This sends your flight number');
    await check();
    await waitUI(() => expect(host.textContent).toContain('Delayed'));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('FlightAware');
    expect(host.textContent).toContain('Reported gate: B12');
    expect(host.textContent).not.toContain('Stale information');
  });
  it('preserves the last known observation, clearly stale, after a failed refresh', async () => {
    await render(); await check(); await waitUI(() => expect(host.textContent).toContain('Delayed'));
    fetch.mockRejectedValue(new Error('offline'));
    await check(); await waitUI(() => expect(host.textContent).toContain('The latest check failed'));
    expect(host.textContent).toContain('Last known result');
    expect(host.textContent).toContain('Last reported gate: B12');
    expect(host.textContent).toContain('Stale information');
  });
  it('shows an honest unconnected state and never invents a gate or status', async () => {
    fetch.mockImplementation(async () => Response.json({ version: 1, availability: 'unavailable', reason: 'not_connected' }));
    await render(); await check();
    await waitUI(() => expect(host.textContent).toContain('not connected for this pilot'));
    expect(host.textContent).not.toContain('B12');
    expect(host.textContent).toContain('Status unavailable');
  });
  it('reclassifies a result when the local clock crosses freshness without another fetch', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    await render(); await check(); await waitUI(() => expect(host.textContent).toContain('Delayed'));
    await act(async () => { await vi.advanceTimersByTimeAsync(150_000); });
    // happy-dom can report background AppState; focus is also a refresh seam.
    await render();
    // The pure resolver separately proves the exact boundary; this fixture
    // drives the foreground event through the actual AppState web adapter.
    document.dispatchEvent(new Event('visibilitychange'));
    await waitUI(() => expect(host.textContent).toContain('Stale information'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('aborts a pending token lookup on account change before sending the request', async () => {
    let resolve!: (value: string) => void;
    state.token = () => new Promise<string>(done => { resolve = done; });
    await render(); await check();
    await waitUI(() => expect(resolve).toBeTypeOf('function'));
    state.owner = 'pilot_B'; await render();
    await act(async () => { resolve('old-account-session'); });
    await waitUI(() => expect(host.textContent).toContain('Check your flight'));
    expect(fetch).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('B12');
  });
});
