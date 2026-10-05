import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  scope: { status: 'AUTHENTICATED', userId: 'A' } as object,
  headers: vi.fn(),
}));
vi.mock('../userScope', () => ({ getScopeState: () => mocks.scope }));
vi.mock('../authToken', () => ({ getAuthHeaders: mocks.headers }));
vi.mock('@/lib/apiBase', () => ({ API_BASE: 'https://api.example.test/api' }));
import { createCircleMembershipClient } from '../circleMembershipService';
import type { ScopeState } from '../userScope';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  mocks.scope = { status: 'AUTHENTICATED', userId: 'A' };
  mocks.headers.mockResolvedValue({
    Authorization: `Bearer header.${btoa(JSON.stringify({ sub: 'A' }))}.signature`,
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const client = () => createCircleMembershipClient(mocks.scope as ScopeState);
describe('Circle membership transport', () => {
  it('does not send requests without a bearer', async () => {
    mocks.headers.mockResolvedValue({});
    await expect(client().list()).rejects.toMatchObject({
      code: 'sign_in_required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects a token from a different account before sending', async () => {
    mocks.headers.mockResolvedValue({
      Authorization: `Bearer header.${btoa(JSON.stringify({ sub: 'B' }))}.signature`,
    });
    await expect(client().list()).rejects.toMatchObject({
      code: 'sign_in_required',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects account changes while token retrieval is pending', async () => {
    let release!: (value: object) => void;
    mocks.headers.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const pending = client().invite('Alice');
    mocks.scope = { status: 'AUTHENTICATED', userId: 'B' };
    release({
      Authorization: `Bearer header.${btoa(JSON.stringify({ sub: 'A' }))}.signature`,
    });
    await expect(pending).rejects.toMatchObject({ code: 'session_changed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('discards a late A response after an A → B → A transition', async () => {
    let release!: (value: object) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const pending = client().list();
    await Promise.resolve();
    mocks.scope = { status: 'AUTHENTICATED', userId: 'B' };
    mocks.scope = { status: 'AUTHENTICATED', userId: 'A' };
    release({
      ok: true,
      json: async () => ({ users: [{ name: 'Private member' }] }),
    });
    await expect(pending).rejects.toMatchObject({ code: 'session_changed' });
  });
  it('sends explicit display name and code, preserving server failures', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'invitation_unavailable' }),
    });
    await expect(client().accept(' code ', ' Alice ')).rejects.toMatchObject({
      code: 'invitation_unavailable',
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/circle/invitations/accept',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          code: 'code',
          displayName: 'Alice',
          group: 'friends',
        }),
      }),
    );
  });
  it('loads the dedicated membership endpoint including muted connections', async () => {
    const users = [{ userId: 'friend', name: 'Muted Friend', status: 'muted' }];
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ users }) });
    await expect(client().list()).resolves.toEqual({ users });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/circle/members',
      expect.objectContaining({ method: 'GET' }),
    );
  });
  it('works without atob on native and decodes UTF-8 claims', async () => {
    vi.stubGlobal('atob', undefined);
    const payload = Buffer.from(
      JSON.stringify({ sub: 'A', name: 'Renée 東京' }),
      'utf8',
    ).toString('base64url');
    mocks.headers.mockResolvedValue({
      Authorization: `Bearer header.${payload}.signature`,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ users: [] }),
    });
    await expect(client().list()).resolves.toEqual({ users: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each(['!', 'a', 'e30_', '____', 'bnVsbA'])(
    'rejects malformed or subjectless payload %s without a request',
    async (payload) => {
      mocks.headers.mockResolvedValue({
        Authorization: `Bearer header.${payload}.signature`,
      });
      await expect(client().list()).rejects.toMatchObject({
        code: 'sign_in_required',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
