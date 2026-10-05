import { API_BASE } from '@/lib/apiBase';
import { getAuthHeaders } from './authToken';
import { getScopeState, type ScopeState } from './userScope';
import type { CircleUser } from '@/types/circle';

export interface CircleInvitation {
  id: string;
  group: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
}
export class CircleMembershipError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 0,
  ) {
    super(code);
  }
}

/** Decode only for identity comparison, never authentication. No native globals
 * (atob, Buffer, TextDecoder) are assumed on Hermes. Invalid UTF-8/base64 fails
 * closed; signature verification remains exclusively the server's job. */
function readTokenSubject(authorization: string): unknown {
  const encoded = authorization.replace(/^Bearer /, '').split('.')[1];
  if (
    !encoded ||
    encoded.length > 16_384 ||
    !/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)
  ) {
    throw new Error('invalid token payload');
  }
  const input = encoded.replace(/=+$/, '');
  if (input.length % 4 === 1) throw new Error('invalid base64url length');
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let buffer = 0;
  let bits = 0;
  let escaped = '';
  for (const character of input) {
    buffer = (buffer << 6) | alphabet.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      const byte = (buffer >> bits) & 255;
      escaped += '%' + byte.toString(16).padStart(2, '0');
      buffer &= (1 << bits) - 1;
    }
  }
  if (buffer !== 0) throw new Error('invalid base64url padding');
  const claims: unknown = JSON.parse(decodeURIComponent(escaped));
  return claims !== null && typeof claims === 'object'
    ? (claims as { sub?: unknown }).sub
    : undefined;
}

/** No shared cache: each client belongs to one exact identity transition. */
export function createCircleMembershipClient(scope: ScopeState) {
  function assertCurrent() {
    if (getScopeState() !== scope)
      throw new CircleMembershipError('session_changed');
    if (scope.status !== 'AUTHENTICATED')
      throw new CircleMembershipError('sign_in_required');
  }
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    assertCurrent();
    const auth = await getAuthHeaders();
    assertCurrent();
    if (!auth.Authorization)
      throw new CircleMembershipError('sign_in_required');
    // Bridge effects may install the new scope before its token getter. This
    // is only a stale-token guard; the server still verifies the signature.
    try {
      const subject = readTokenSubject(auth.Authorization);
      if (scope.status !== 'AUTHENTICATED' || subject !== scope.userId)
        throw new Error('mismatch');
    } catch {
      throw new CircleMembershipError('sign_in_required');
    }
    const response = await fetch(`${API_BASE}/circle${path}`, {
      method,
      headers: {
        ...auth,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assertCurrent();
    const data = await response.json();
    assertCurrent();
    if (!response.ok)
      throw new CircleMembershipError(
        typeof data?.error === 'string'
          ? data.error
          : typeof data?.code === 'string'
            ? data.code
            : 'request_failed',
        response.status,
      );
    return data as T;
  }
  return {
    list: () => request<{ users: CircleUser[] }>('GET', '/members'),
    invitations: () =>
      request<{ invitations: CircleInvitation[] }>('GET', '/invitations'),
    invite: (displayName: string) =>
      request<{ invitation: CircleInvitation; code: string }>(
        'POST',
        '/invitations',
        { displayName: displayName.trim(), group: 'friends' },
      ),
    accept: (code: string, displayName: string) =>
      request<{ user: CircleUser }>('POST', '/invitations/accept', {
        code: code.trim(),
        displayName: displayName.trim(),
        group: 'friends',
      }),
    revoke: (id: string) =>
      request<{ revoked: string }>(
        'DELETE',
        `/invitations/${encodeURIComponent(id)}`,
      ),
    remove: (id: string) =>
      request<{ removed: string }>(
        'DELETE',
        `/users/${encodeURIComponent(id)}`,
      ),
  };
}
