import { describe, it, expect, vi } from 'vitest';

import {
  getGarminStatus,
  startGarminConnect,
  disconnectGarmin,
  syncGarminSnapshot,
} from '../garmin';
import { AforceApiError } from '../aforceApiClient';

const notFound = (path = '/garmin/x'): AforceApiError =>
  new AforceApiError(404, `GET ${path} → 404`);
const conflict = (path = '/garmin/sync'): AforceApiError =>
  new AforceApiError(409, `POST ${path} → 409 not_connected`);

describe('garmin service — getGarminStatus', () => {
  it('maps a 404 to credentials_missing (dormant), not a throw', async () => {
    const getJson = vi.fn(async () => {
      throw notFound('/garmin/status');
    });
    await expect(getGarminStatus({ getJson })).resolves.toEqual({
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
    await expect(getGarminStatus({ getJson })).resolves.toEqual({
      state: 'connected',
      expiresAt: 1_700_000_000_000,
    });
  });

  it('returns not_connected when configured but no tokens', async () => {
    const getJson = vi.fn(async () => ({
      credentialsConfigured: true,
      connected: false,
      expiresAt: null,
    }));
    await expect(getGarminStatus({ getJson })).resolves.toEqual({
      state: 'not_connected',
      expiresAt: null,
    });
  });

  it('rethrows non-404 errors (real failures are not swallowed)', async () => {
    const getJson = vi.fn(async () => {
      throw new AforceApiError(500, 'GET /garmin/status → 500');
    });
    await expect(getGarminStatus({ getJson })).rejects.toBeInstanceOf(
      AforceApiError,
    );
  });
});

describe('garmin service — startGarminConnect', () => {
  it('returns the authorize url + state on success', async () => {
    const postJson = vi.fn(async () => ({
      authorizeUrl: 'https://connect.garmin.com/oauth2Confirm?x=1',
      state: 'abc',
    }));
    await expect(startGarminConnect({ postJson })).resolves.toEqual({
      status: 'ok',
      authorizeUrl: 'https://connect.garmin.com/oauth2Confirm?x=1',
      state: 'abc',
    });
    expect(postJson).toHaveBeenCalledWith('/garmin/oauth/start', {});
  });

  it('maps a 404 to credentials_missing', async () => {
    const postJson = vi.fn(async () => {
      throw notFound('/garmin/oauth/start');
    });
    await expect(startGarminConnect({ postJson })).resolves.toEqual({
      status: 'credentials_missing',
    });
  });
});

describe('garmin service — disconnectGarmin', () => {
  it('returns ok on success', async () => {
    const deleteJson = vi.fn(async () => ({ ok: true }));
    await expect(disconnectGarmin({ deleteJson })).resolves.toEqual({
      status: 'ok',
    });
    expect(deleteJson).toHaveBeenCalledWith('/garmin/disconnect');
  });

  it('maps a 404 to credentials_missing', async () => {
    const deleteJson = vi.fn(async () => {
      throw notFound('/garmin/disconnect');
    });
    await expect(disconnectGarmin({ deleteJson })).resolves.toEqual({
      status: 'credentials_missing',
    });
  });
});

describe('garmin service — syncGarminSnapshot', () => {
  it('returns ok + synced + fetchedAt on success', async () => {
    const postJson = vi.fn(async () => ({
      ok: true,
      synced: true,
      fetchedAt: 1_700_000_111_000,
    }));
    await expect(syncGarminSnapshot({ postJson })).resolves.toEqual({
      status: 'ok',
      synced: true,
      fetchedAt: 1_700_000_111_000,
    });
    expect(postJson).toHaveBeenCalledWith('/garmin/sync', {});
  });

  it('maps a 409 to not_connected', async () => {
    const postJson = vi.fn(async () => {
      throw conflict();
    });
    await expect(syncGarminSnapshot({ postJson })).resolves.toEqual({
      status: 'not_connected',
    });
  });

  it('maps a 404 to credentials_missing', async () => {
    const postJson = vi.fn(async () => {
      throw notFound('/garmin/sync');
    });
    await expect(syncGarminSnapshot({ postJson })).resolves.toEqual({
      status: 'credentials_missing',
    });
  });
});
