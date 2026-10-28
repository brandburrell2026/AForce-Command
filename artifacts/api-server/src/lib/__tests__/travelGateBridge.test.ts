import { describe, it, expect, vi } from 'vitest';
import { lookupTravelGateFlight, TRAVELGATE_BRIDGE_URL } from '../travelGateBridge';
const input = { flightNumber: 'AA123', departureDate: '2026-11-01', origin: 'JFK', destination: 'LAX' };
const now = Date.parse('2026-11-01T18:00:00Z');
const observation = () => ({
  version: 1, availability: 'available', provider: 'flightaware', fetchedAt: new Date(now).toISOString(),
  flight: { ...input, status: 'scheduled', scheduledDeparture: '2026-11-01T19:30:00Z', estimatedDeparture: null, departureGate: 'B12', departureTerminal: '8' },
});
const key = 'a'.repeat(64);
function transport(body: unknown, status = 200) { return vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status })); }

describe('AForce server-to-server TravelGate client', () => {
  it('does not fetch without a separately configured integration key', async () => {
    const fetch = transport({});
    expect(await lookupTravelGateFlight(input, { key: undefined, fetch })).toMatchObject({ reason: 'not_connected' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses only the approved destination and refuses redirects', async () => {
    const fetch = transport(observation());
    const result = await lookupTravelGateFlight(input, { key, fetch, now });
    expect(result.availability).toBe('available');
    expect(fetch).toHaveBeenCalledWith(TRAVELGATE_BRIDGE_URL, expect.objectContaining({
      redirect: 'error', method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(input),
    }));
  });
  it('rejects an unexpected leg and invalid payload', async () => {
    const body = observation(); body.flight.destination = 'MIA';
    expect(await lookupTravelGateFlight(input, { key, fetch: transport(body), now })).toMatchObject({ reason: 'mismatch' });
    expect(await lookupTravelGateFlight(input, { key, fetch: transport({ fake: true }), now })).toMatchObject({ reason: 'invalid_response' });
  });
  it('ages old observations and rejects future fetch timestamps', async () => {
    expect((await lookupTravelGateFlight(input, { key, fetch: transport(observation()), now: now + 120_000 })).availability).toBe('stale');
    expect(await lookupTravelGateFlight(input, { key, fetch: transport(observation()), now: now - 60_000 })).toMatchObject({ reason: 'invalid_response' });
  });
  it('bounds response size and maps transport failures and throttling', async () => {
    const big = vi.fn<typeof fetch>().mockResolvedValue(new Response('x'.repeat(20_000)));
    expect(await lookupTravelGateFlight(input, { key, fetch: big })).toMatchObject({ reason: 'provider_unavailable' });
    expect(await lookupTravelGateFlight(input, { key, fetch: transport({}, 429) })).toMatchObject({ reason: 'rate_limited' });
    const failed = vi.fn<typeof fetch>().mockRejectedValue(new Error('private diagnostics'));
    expect(await lookupTravelGateFlight(input, { key, fetch: failed })).toEqual({ version: 1, availability: 'unavailable', reason: 'provider_unavailable' });
  });
});
