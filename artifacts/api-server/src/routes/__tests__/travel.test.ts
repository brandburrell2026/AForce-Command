import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'node:http';
const auth = vi.hoisted(() => ({ userId: 'pilot_A' as string | null }));
vi.mock('@clerk/express', () => ({ getAuth: () => ({ userId: auth.userId }) }));
vi.mock('../../lib/aforceState', () => ({ DEFAULT_USER_ID: 'default' }));
import { buildTravelRouter } from '../travel';

const input = { flightNumber: 'AA123', departureDate: '2026-11-01', origin: 'JFK', destination: 'LAX' };
let server: http.Server, base: string, enabled: boolean;
const lookup = vi.fn();
beforeEach(async () => {
  vi.stubEnv('CLERK_SECRET_KEY', 'synthetic-test-only');
  auth.userId = 'pilot_A'; enabled = true;
  lookup.mockReset(); lookup.mockResolvedValue({ version: 1, availability: 'unavailable', reason: 'not_connected' });
  const app = express(); app.use(express.json());
  app.use('/api/travel', buildTravelRouter({ enabled: () => enabled, members: () => new Set(['pilot_A']), lookup }));
  server = http.createServer(app);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/travel/flight-status`;
});
afterEach(async () => { vi.unstubAllEnvs(); await new Promise<void>(resolve => server.close(() => resolve())); });
const post = (body: unknown = input) => fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('AForce travel HTTP boundary', () => {
  it('requires genuine auth and an explicit pilot cohort even in development', async () => {
    auth.userId = null; expect((await post()).status).toBe(401);
    auth.userId = 'default'; expect((await post()).status).toBe(401);
    auth.userId = 'non_member'; expect((await post()).status).toBe(403);
    expect(lookup).not.toHaveBeenCalled();
  });
  it('fails closed without operator enablement or auth configuration', async () => {
    enabled = false; expect((await post()).status).toBe(503);
    enabled = true; vi.stubEnv('CLERK_SECRET_KEY', '');
    expect((await post()).status).toBe(503);
    expect(lookup).not.toHaveBeenCalled();
  });
  it('validates itinerary and rejects owner identity/URL injection before upstream access', async () => {
    expect((await post({ ...input, userId: 'victim' })).status).toBe(400);
    expect((await post({ ...input, url: 'http://localhost' })).status).toBe(400);
    expect((await post({ ...input, departureDate: '2026-02-30' })).status).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });
  it('normalizes the request and returns a private no-store response', async () => {
    const result = await post({ ...input, flightNumber: 'aa 123' });
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    expect(lookup).toHaveBeenCalledWith(input);
  });
  it('caps manual checks at five per minute for each authenticated pilot', async () => {
    for (let count = 0; count < 5; count++) expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(429);
    expect(lookup).toHaveBeenCalledTimes(5);
  });
  it('does not leak upstream diagnostics', async () => {
    lookup.mockRejectedValue(new Error('private diagnostics'));
    const result = await post();
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain('private diagnostics');
  });
});
