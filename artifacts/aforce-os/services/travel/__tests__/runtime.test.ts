import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createJourney } from '../journey';
const mock = vi.hoisted(() => ({
  scope: { status: 'AUTHENTICATED', userId: 'A' } as { status: string; userId?: string },
  load: vi.fn(), cancel: vi.fn(async () => {}), schedule: vi.fn(), permission: vi.fn(async () => true),
  disk: new Map<string, string>(),
}));
vi.mock('@/services/userScope', () => ({ getScopeState: () => mock.scope }));
vi.mock('../storage', () => ({
  journeyRepository: { load: mock.load, save: vi.fn(), finish: vi.fn(), remove: vi.fn() },
  travelStorage: { getItem: async (key: string) => mock.disk.get(key) ?? null, setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock('../reminderNative', () => ({
  travelReminderNative: { supported: true, cancel: mock.cancel, permission: mock.permission, schedule: mock.schedule },
  travelOwnerHash: async (owner: string) => `hash_${owner}`,
}));
import { travelRuntime } from '../runtime';
const journey = createJourney({ flightNumber: 'AA123', origin: 'JFK', destination: 'LAX', departureDate: '2026-11-01', departureTime: '14:30', utcOffset: '-05:00' });
beforeEach(() => {
  vi.clearAllMocks(); mock.scope = { status: 'AUTHENTICATED', userId: 'A' }; mock.disk.clear();
  mock.load.mockResolvedValue(journey); travelRuntime.setEnabled(true);
});

describe('travel runtime identity binding', () => {
  it('uses the authority state object to reject A-to-B-to-A even when namespace isolation is off', () => {
    const current = travelRuntime.captureOwner('A'); expect(current()).toBe(true);
    mock.scope = { status: 'AUTHENTICATED', userId: 'B' }; expect(current()).toBe(false);
    mock.scope = { status: 'AUTHENTICATED', userId: 'A' }; expect(current()).toBe(false);
    expect(travelRuntime.captureOwner('A')()).toBe(true);
  });
  it('does not cancel existing reminders on an unresolved/unverifiable transport hop', async () => {
    mock.scope = { status: 'UNVERIFIABLE' }; await travelRuntime.sync(); expect(mock.cancel).not.toHaveBeenCalled();
    mock.scope = { status: 'UNRESOLVED' }; await travelRuntime.sync(); expect(mock.cancel).not.toHaveBeenCalled();
    mock.scope = { status: 'ANONYMOUS' }; await travelRuntime.sync(); expect(mock.cancel).toHaveBeenCalledOnce();
  });
  it('matches both the owner fingerprint and the active trip before accepting a notification tap', async () => {
    expect(await travelRuntime.canOpenReminder('hash_B', journey.createdAt)).toBe(false); expect(mock.load).not.toHaveBeenCalled();
    expect(await travelRuntime.canOpenReminder('hash_A', 'old-trip')).toBe(false);
    expect(await travelRuntime.canOpenReminder('hash_A', journey.createdAt)).toBe(true);
    mock.load.mockResolvedValue({ ...journey, completedAt: new Date().toISOString() });
    expect(await travelRuntime.canOpenReminder('hash_A', journey.createdAt)).toBe(false);
    travelRuntime.setEnabled(false); expect(await travelRuntime.canOpenReminder('hash_A', journey.createdAt)).toBe(false);
  });
  it('rejects a delayed trip read that completes after an account switch', async () => {
    let release!: (value: typeof journey) => void;
    mock.load.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const tap = travelRuntime.canOpenReminder('hash_A', journey.createdAt);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    mock.scope = { status: 'AUTHENTICATED', userId: 'B' }; release(journey);
    expect(await tap).toBe(false);
  });
});
