import { describe, it, expect, vi } from 'vitest';

import {
  getWhoopStatus,
  startWhoopConnect,
  disconnectWhoop,
  syncWhoopSnapshot,
} from '../whoopConnect';
import { AforceApiError } from '../aforceApiClient';

const notFound = (path = '/whoop/x'): AforceApiError =>
  new AforceApiError(404, `GET ${path} → 404`);
const conflict = (path = '/whoop/sync'): AforceApiError =>
  new AforceApiError(409, `POST ${path} → 409 not_connected`);

describe('whoop service — getWhoopStatus', () => {
  it('maps a 404 to credentials_missing (dormant), not a throw', async () => {
    const getJson = vi.fn(async () => {
      throw notFound('/whoop/status');
    });
    await expect(getWhoopStatus({ getJson })).resolves.toEqual({
      state: 'credentials_missing',
      expiresAt: null,
    });
  });

  it('returns connected with expiresAt when the server says connected', async () => {
    const getJson = vi.fn(async () => ({
      credentialsConfigured: true,
      connected: true,
      expiresAt: 1_700_000_000_000,
    }));
    await expect(getWhoopStatus({ getJson })).resolves.toEqual({
      state: 'connected',
      expiresAt: 1_700_000_000_000,
    });
  });

  it('returns not_connected when configured but no token (→ UI shows Connect)', async () => {
    const getJson = vi.fn(async () => ({
      credentialsConfigured: true,
      connected: false,
      expiresAt: null,
    }));
    await expect(getWhoopStatus({ getJson })).resolves.toEqual({
      state: 'not_connected',
      expiresAt: null,
    });
  });

  it('rethrows non-404 errors (real failures are not swallowed)', async () => {
    const getJson = vi.fn(async () => {
      throw new AforceApiError(500, 'GET /whoop/status → 500');
    });
    await expect(getWhoopStatus({ getJson })).rejects.toBeInstanceOf(AforceApiError);
  });
});

describe('whoop service — startWhoopConnect', () => {
  it('returns the authorize url + state on success', async () => {
    const postJson = vi.fn(async () => ({
      authorizeUrl: 'https://api.prod.whoop.com/oauth/oauth2/auth?x=1',
      state: 'ab12cd34',
    }));
    await expect(startWhoopConnect({ postJson })).resolves.toEqual({
      status: 'ok',
      authorizeUrl: 'https://api.prod.whoop.com/oauth/oauth2/auth?x=1',
      state: 'ab12cd34',
    });
    expect(postJson).toHaveBeenCalledWith('/whoop/oauth/start', {});
  });

  it('maps a 404 to credentials_missing', async () => {
    const postJson = vi.fn(async () => {
      throw notFound('/whoop/oauth/start');
    });
    await expect(startWhoopConnect({ postJson })).resolves.toEqual({
      status: 'credentials_missing',
    });
  });
});

describe('whoop service — disconnectWhoop', () => {
  it('returns ok on success', async () => {
    const deleteJson = vi.fn(async () => ({ ok: true }));
    await expect(disconnectWhoop({ deleteJson })).resolves.toEqual({ status: 'ok' });
    expect(deleteJson).toHaveBeenCalledWith('/whoop/disconnect');
  });

  it('maps a 404 to credentials_missing', async () => {
    const deleteJson = vi.fn(async () => {
      throw notFound('/whoop/disconnect');
    });
    await expect(disconnectWhoop({ deleteJson })).resolves.toEqual({
      status: 'credentials_missing',
    });
  });
});

describe('whoop service — syncWhoopSnapshot', () => {
  it('returns ok + synced + fetchedAt on success', async () => {
    const postJson = vi.fn(async () => ({
      ok: true,
      synced: true,
      fetchedAt: 1_700_000_111_000,
    }));
    await expect(syncWhoopSnapshot({ postJson })).resolves.toEqual({
      status: 'ok',
      synced: true,
      fetchedAt: 1_700_000_111_000,
    });
    expect(postJson).toHaveBeenCalledWith('/whoop/sync', {});
  });

  it('maps a 409 to not_connected', async () => {
    const postJson = vi.fn(async () => {
      throw conflict();
    });
    await expect(syncWhoopSnapshot({ postJson })).resolves.toEqual({
      status: 'not_connected',
    });
  });

  it('maps a 404 to credentials_missing', async () => {
    const postJson = vi.fn(async () => {
      throw notFound('/whoop/sync');
    });
    await expect(syncWhoopSnapshot({ postJson })).resolves.toEqual({
      status: 'credentials_missing',
    });
  });
});
