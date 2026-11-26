import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ owner: 'A', hangAuth: false, disk: new Map<string, string>() }));
vi.mock('../userScope', () => ({ getScopeState: () => ({ status: 'AUTHENTICATED', userId: fixture.owner }) }));
vi.mock('../authToken', () => ({ getAuthHeaders: async () => { if (fixture.hangAuth) return new Promise<never>(() => {}); return { Authorization: 'Bearer test' }; }, getAuthToken: async () => null }));
vi.mock('../travel/storage', () => ({ travelStorage: {
  getItem: async (k: string) => fixture.disk.get(k) ?? null,
  setItem: async (k: string, v: string) => { fixture.disk.set(k, v); },
  removeItem: async (k: string) => { fixture.disk.delete(k); },
} }));
vi.mock('../intakeOutbox', () => ({ hydrateIntakeOutbox: async () => {}, getIntakeOutboxState: () => ({ items: [] }) }));
vi.mock('../scoringEngine', () => ({ calculateScore: (state: { ozConsumedToday: number }) => ({ score: state.ozConsumedToday }) }));
const state = () => ({ unitsConsumedToday: 2, ozConsumedToday: 24, aforceUnitsToday: 0, dailyTarget: 8, ozTarget: 96, lastIntakeTime: new Date().toISOString(), lastIntakeType: 'water', intakeEvents: [] });
beforeEach(() => { vi.resetModules(); vi.stubEnv('EXPO_PUBLIC_BETA_STAGING', '1'); fixture.owner = 'A'; fixture.hangAuth = false; fixture.disk.clear(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Home with the transport disconnected', () => {
  it('opens cached Home after a cold restart and reconciles when the connection returns', async () => {
    const fetcher = vi.fn(async () => Response.json({ userState: state(), serverTime: '2026-11-25T12:00:00Z' }));
    vi.stubGlobal('fetch', fetcher);
    let api = await import('../realApi');
    const empty = api.normalizeUserState({});
    await api.fetchHome(empty);
    vi.resetModules(); api = await import('../realApi');
    fetcher.mockRejectedValue(new TypeError('Network request failed'));
    const offline = await api.fetchHome(empty);
    expect(offline).toMatchObject({ offlineRestored: true, stale: true, serverTime: null, userState: { ozConsumedToday: 24 } });
    expect(offline.userState.lastIntakeTime).toBeInstanceOf(Date);
    fetcher.mockImplementation(async () => Response.json({ userState: { ...state(), ozConsumedToday: 40 }, serverTime: '2026-11-25T12:01:00Z' }));
    const online = await api.fetchHome(offline.userState);
    expect(online.userState.ozConsumedToday).toBe(40);
    expect(online.stale).toBeUndefined();
  });
  it('does not unlock cached Home after a 401 or load another account’s snapshot', async () => {
    const fetcher = vi.fn(async () => Response.json({ userState: state(), serverTime: 'now' })); vi.stubGlobal('fetch', fetcher);
    let api = await import('../realApi'); const empty = api.normalizeUserState({}); await api.fetchHome(empty);
    vi.resetModules(); api = await import('../realApi'); fetcher.mockImplementation(async () => new Response('', { status: 401 }));
    expect((await api.fetchHome(empty)).offlineRestored).toBeUndefined();
    fixture.owner = 'B'; fetcher.mockRejectedValue(new TypeError('Network request failed'));
    expect((await api.fetchHome(empty)).userState.ozConsumedToday).toBe(0);
  });
  it('bounds a stalled session refresh so Home cannot hang indefinitely offline', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const api = await import('../realApi');
    fixture.hangAuth = true; vi.useFakeTimers();
    const pending = api.fetchHome(api.normalizeUserState({}));
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await pending).toMatchObject({ stale: true, serverTime: null });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects a late response when the account changes during the request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { fixture.owner = 'B'; return Response.json({ userState: state(), serverTime: 'now' }); }));
    const api = await import('../realApi'); const result = await api.fetchHome(api.normalizeUserState({}));
    expect(result.userState.ozConsumedToday).toBe(0);
    expect(fixture.disk.size).toBe(0);
  });
});
