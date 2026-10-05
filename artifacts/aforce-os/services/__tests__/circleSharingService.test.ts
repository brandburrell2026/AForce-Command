import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ scope: { status: 'AUTHENTICATED', userId: 'A' } as object, headers: vi.fn() }));
vi.mock('../userScope', () => ({ getScopeState: () => mocks.scope }));
vi.mock('../authToken', () => ({ getAuthHeaders: mocks.headers }));
vi.mock('@/lib/apiBase', () => ({ API_BASE: 'https://api.example.test/api' }));
import { createCircleSharingClient } from '../circleSharingService';
import type { ScopeState } from '../userScope';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); mocks.scope = { status: 'AUTHENTICATED', userId: 'A' };
  mocks.headers.mockResolvedValue({ Authorization: `Bearer h.${btoa(JSON.stringify({ sub: 'A' }))}.s` });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const client = () => createCircleSharingClient(mocks.scope as ScopeState);
describe('Circle sharing transport', () => {
  it('sends only selected fields with explicit acknowledgement and expected version', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ grant: { fields: ['score'], version: 2 } }) });
    await client().save('friend/1', ['score'], 1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/circle/sharing/friend%2F1', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ fields: ['score'], expectedVersion: 1, acknowledgementVersion: 'circle-sharing-v1' }) }));
  });
  it('revokes with an expected version without sending a fresh sharing acknowledgement', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ grant: { fields: [], version: 2 } }) });
    await client().revoke('friend', 1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/circle/sharing/friend', expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ expectedVersion: 1 }) }));
  });
  it('preserves server conflict instead of claiming saved consent', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'sharing_version_conflict' }) });
    await expect(client().save('friend', ['state'], 0)).rejects.toMatchObject({ code: 'sharing_version_conflict', status: 409 });
  });
  it('discards private activity that returns after account switch', async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = client().activity(); await Promise.resolve();
    mocks.scope = { status: 'AUTHENTICATED', userId: 'B' };
    resolve({ ok: true, json: async () => ({ activity: [{ score: 88 }] }) });
    await expect(pending).rejects.toMatchObject({ code: 'session_changed' });
  });
});
