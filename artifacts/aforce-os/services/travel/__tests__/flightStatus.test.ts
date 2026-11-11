import { describe, it, expect, vi } from 'vitest';
import { fetchTravelFlightStatus } from '../flightStatus';
import { travelStatusPresentation } from '@/utils/travel/statusPresentation';
// Accept both Expo-native and DOM fetch overloads in the test-only mock.
const request = { flightNumber: 'AA123', departureDate: '2026-11-01', origin: 'JFK', destination: 'LAX' };
const observation = () => ({
  version: 1 as const, availability: 'available' as const, provider: 'flightaware' as const, fetchedAt: new Date().toISOString(),
  flight: { ...request, status: 'scheduled' as const, scheduledDeparture: '2026-11-01T19:30:00Z', estimatedDeparture: null, departureGate: 'B12', departureTerminal: '8' },
});
const options = () => ({ request, apiBase: 'https://aforce.example.test/api', getToken: async () => 'synthetic-user-session', signal: new AbortController().signal });

describe('mobile flight status boundary', () => {
  it('sends the user session only to AForce and transmits no health or account-link data', async () => {
    const fetch = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>().mockResolvedValue(Response.json(observation()));
    await fetchTravelFlightStatus({ ...options(), fetch });
    expect(fetch).toHaveBeenCalledWith('https://aforce.example.test/api/travel/flight-status', expect.objectContaining({
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-user-session' }, body: JSON.stringify(request),
    }));
  });
  it('does not fetch without a session or after an account-switch abort', async () => {
    const fetch = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();
    await expect(fetchTravelFlightStatus({ ...options(), getToken: async () => null, fetch })).rejects.toMatchObject({ reason: 'unauthorized' });
    const controller = new AbortController(); controller.abort();
    await expect(fetchTravelFlightStatus({ ...options(), signal: controller.signal, fetch })).rejects.toMatchObject({ reason: 'cancelled' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('ends a hung token lookup promptly when the request is aborted', async () => {
    const controller = new AbortController();
    const fetch = vi.fn<(input: unknown, init?: unknown) => Promise<Response>>();
    const pending = fetchTravelFlightStatus({ ...options(), getToken: () => new Promise(() => {}), signal: controller.signal, fetch });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ reason: 'cancelled' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects mismatched flights and unverified provider data', async () => {
    const data = observation(); data.flight.destination = 'MIA';
    await expect(fetchTravelFlightStatus({ ...options(), fetch: vi.fn().mockResolvedValue(Response.json(data)) })).rejects.toMatchObject({ reason: 'mismatch' });
    await expect(fetchTravelFlightStatus({ ...options(), fetch: vi.fn().mockResolvedValue(Response.json({ fake: true })) })).rejects.toMatchObject({ reason: 'invalid_response' });
  });
  it('reports unavailable and rate-limited states without a fabricated status', async () => {
    await expect(fetchTravelFlightStatus({ ...options(), fetch: vi.fn().mockResolvedValue(Response.json({ version: 1, availability: 'unavailable', reason: 'not_connected' })) })).rejects.toMatchObject({ reason: 'not_connected' });
    await expect(fetchTravelFlightStatus({ ...options(), fetch: vi.fn().mockResolvedValue(new Response(null, { status: 429 })) })).rejects.toMatchObject({ reason: 'rate_limited' });
  });
  it('keeps old or failed-check observations explicitly stale as time passes', () => {
    const data = observation(), now = Date.parse(data.fetchedAt);
    expect(travelStatusPresentation({ data, failed: false, now }).stale).toBe(false);
    expect(travelStatusPresentation({ data, failed: false, now: now + 120_000 }).stale).toBe(true);
    expect(travelStatusPresentation({ data, failed: true, now }).evidence).toContain('Last known result');
    expect(travelStatusPresentation({ data, failed: false, now: now - 60_000 }).title).toBe('Status unavailable');
  });
});
