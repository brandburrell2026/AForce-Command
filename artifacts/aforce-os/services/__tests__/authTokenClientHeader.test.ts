/**
 * THE HEADER LEAVES THROUGH THE CANONICAL SEAM.
 *
 * `getAuthHeaders()` is the single place every AForce request gets its
 * headers — `realApi`'s getJson/postJson, `aforceApiClient`, `lib/api` and
 * `useEntitlement` all route through it. Putting the version there means it
 * rides on every call without a second networking layer to build, keep in
 * sync, or forget, which is what the founder's ruling requires.
 *
 * A source scan for the header name would pass if the value were assembled
 * somewhere that never reaches a request, so this executes the real function.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../clientIdentity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../clientIdentity')>();
  return { ...actual, buildClientIdentityHeader: vi.fn(() => 'ios/1.0.0+71') };
});

import { getAuthHeaders, setTokenGetter } from '../authToken';
import { buildClientIdentityHeader, CLIENT_HEADER_NAME } from '../clientIdentity';

beforeEach(() => { setTokenGetter(null); vi.mocked(buildClientIdentityHeader).mockReturnValue('ios/1.0.0+71'); });

describe('getAuthHeaders carries the client version', () => {
  it('THE SEAM: the header is present with no auth token configured', async () => {
    // Clerk unconfigured is a real shipping state (the server falls back to
    // DEFAULT_USER_ID), and the version must still be reported.
    const h = await getAuthHeaders();
    expect(h[CLIENT_HEADER_NAME]).toBe('ios/1.0.0+71');
  });

  it('and alongside the Authorization header when one exists', async () => {
    setTokenGetter(async () => 'tok_123');
    const h = await getAuthHeaders();
    expect(h.Authorization).toBe('Bearer tok_123');
    expect(h[CLIENT_HEADER_NAME]).toBe('ios/1.0.0+71');
  });

  it('AN UNKNOWN IDENTITY SENDS NO HEADER — and never throws', async () => {
    // The server reads a missing header as `unknown`, which blocks nobody.
    // Sending a junk value instead would pollute the telemetry with a
    // population that looks identified but is not.
    vi.mocked(buildClientIdentityHeader).mockReturnValue(null);
    const h = await getAuthHeaders();
    expect(h).not.toHaveProperty(CLIENT_HEADER_NAME);
    expect(Object.keys(h)).toEqual([]);
  });

  it('a thrown token getter does not take the request down with it', async () => {
    setTokenGetter(async () => { throw new Error('clerk down'); });
    await expect(getAuthHeaders()).resolves.toBeTruthy();
  });
});
