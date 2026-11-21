/**
 * The app tells the server its time zone, so "today" ends at the member's
 * own midnight. The zone name only, on the app's own requests, never stored.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../clientIdentity', () => ({ CLIENT_HEADER_NAME: 'x-aforce-client', buildClientIdentityHeader: () => null }));

import { deviceTimeZone, getAuthHeaders, TIME_ZONE_HEADER_NAME } from '../authToken';

afterEach(() => vi.restoreAllMocks());
const zoneIs = (timeZone: unknown) =>
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((() => ({ resolvedOptions: () => ({ timeZone }) })) as never);

describe('time zone header', () => {
  it('every request carries the device zone', async () => {
    zoneIs('America/New_York');
    expect((await getAuthHeaders())[TIME_ZONE_HEADER_NAME]).toBe('America/New_York');
  });

  it('sends nothing when the zone cannot be read or is not a zone name', async () => {
    zoneIs(undefined);
    expect(deviceTimeZone()).toBeNull();
    expect(TIME_ZONE_HEADER_NAME in (await getAuthHeaders())).toBe(false);
    zoneIs('somewhere; odd');
    expect(deviceTimeZone()).toBeNull();
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((() => { throw new Error('no intl'); }) as never);
    expect(deviceTimeZone()).toBeNull();
  });

  it('the server reads the same header name', () => {
    const server = readFileSync(join(__dirname, '..', '..', '..', 'api-server', 'src', 'lib', 'requestTimeZone.ts'), 'utf8');
    expect(server).toContain(`TIME_ZONE_HEADER = "${TIME_ZONE_HEADER_NAME}"`);
  });
});
