import { beforeEach, describe, it, expect, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  platform: 'ios', cancel: vi.fn(), dismiss: vi.fn(), permission: vi.fn(), requestPermission: vi.fn(), schedule: vi.fn(),
  channel: vi.fn(), clearResponse: vi.fn(), lastResponse: vi.fn(), handler: vi.fn(), unsubscribe: vi.fn(),
  listener: null as null | ((response: unknown) => void),
}));
vi.mock('react-native', () => ({ Platform: { get OS() { return mock.platform; } } }));
vi.mock('@/services/pushNotifications', () => ({ ensureForegroundHandler: mock.handler }));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: async (_algorithm: string, owner: string) => `hash_${owner}` }));
vi.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: mock.cancel, dismissNotificationAsync: mock.dismiss,
  getPermissionsAsync: mock.permission, requestPermissionsAsync: mock.requestPermission,
  scheduleNotificationAsync: mock.schedule, setNotificationChannelAsync: mock.channel,
  clearLastNotificationResponseAsync: mock.clearResponse, getLastNotificationResponseAsync: mock.lastResponse,
  SchedulableTriggerInputTypes: { DATE: 'date' }, AndroidImportance: { LOW: 2 },
  addNotificationResponseReceivedListener: (listener: (response: unknown) => void) => { mock.listener = listener; return { remove: mock.unsubscribe }; },
}));
import { travelReminderNative, observeTravelReminderTaps, TRAVEL_REMINDER_KIND } from '../reminderNative';
import { TRAVEL_REMINDER_ID } from '../reminders';
beforeEach(() => {
  vi.clearAllMocks(); mock.platform = 'ios'; mock.listener = null;
  mock.permission.mockResolvedValue({ granted: true, status: 'granted', canAskAgain: true });
  mock.requestPermission.mockResolvedValue({ granted: false, status: 'denied' });
  mock.lastResponse.mockResolvedValue(null); mock.cancel.mockResolvedValue(undefined); mock.dismiss.mockResolvedValue(undefined);
});
const response = (kind = TRAVEL_REMINDER_KIND) => ({ actionIdentifier: 'default', notification: {
  date: 123, request: { identifier: TRAVEL_REMINDER_ID, content: { data: { kind, ownerHash: 'hash_A', journeyCreatedAt: '2026-11-01T00:00:00Z' } } },
} });

describe('native preparation reminder adapter', () => {
  it('uses a generic lock-screen message and an opaque owner fingerprint', async () => {
    const fireAt = new Date(Date.now() + 3_600_000).toISOString();
    await travelReminderNative.schedule(fireAt, 'private-account', '2026-11-01T00:00:00Z');
    const options = mock.schedule.mock.calls[0]![0];
    expect(options.identifier).toBe(TRAVEL_REMINDER_ID);
    expect(options.content).toEqual({ title: 'AForce travel reminder', body: 'Open Travel to review your journey and prepare.', sound: false,
      data: { kind: TRAVEL_REMINDER_KIND, ownerHash: 'hash_private-account', journeyCreatedAt: '2026-11-01T00:00:00Z' } });
    expect(options.trigger.date.toISOString()).toBe(fireAt);
    expect(Object.keys(options.content.data).sort()).toEqual(['journeyCreatedAt', 'kind', 'ownerHash']);
    expect(mock.requestPermission).not.toHaveBeenCalled();
  });
  it('never creates an overdue notification or schedules on web', async () => {
    await expect(travelReminderNative.schedule(new Date(Date.now() - 10_000).toISOString(), 'A', 'created')).rejects.toThrow('passed');
    mock.platform = 'web';
    await expect(travelReminderNative.schedule(new Date(Date.now() + 10_000).toISOString(), 'A', 'created')).rejects.toThrow('unavailable');
    expect(mock.schedule).not.toHaveBeenCalled();
  });
  it('cancels/dismisses only its own identifier and reports any partial OS failure', async () => {
    await travelReminderNative.cancel();
    expect(mock.cancel).toHaveBeenCalledWith(TRAVEL_REMINDER_ID); expect(mock.dismiss).toHaveBeenCalledWith(TRAVEL_REMINDER_ID);
    mock.dismiss.mockRejectedValue(new Error('OS failure'));
    await expect(travelReminderNative.cancel()).rejects.toThrow('incomplete');
  });
  it('purges only its own stored response during explicit device-data clearing', async () => {
    mock.lastResponse.mockResolvedValue(response('another.stream'));
    await travelReminderNative.purgeResponse!(); expect(mock.clearResponse).not.toHaveBeenCalled();
    mock.lastResponse.mockResolvedValue(response());
    await travelReminderNative.purgeResponse!(); expect(mock.clearResponse).toHaveBeenCalledOnce();
  });
  it('never prompts at boot and respects a permanent permission denial', async () => {
    mock.permission.mockResolvedValue({ granted: false, status: 'undetermined', canAskAgain: true });
    expect(await travelReminderNative.permission(false)).toBe(false); expect(mock.requestPermission).not.toHaveBeenCalled();
    expect(await travelReminderNative.permission(true)).toBe(false); expect(mock.requestPermission).toHaveBeenCalledOnce();
    mock.permission.mockResolvedValue({ granted: false, status: 'denied', canAskAgain: false });
    await travelReminderNative.permission(true); expect(mock.requestPermission).toHaveBeenCalledOnce();
  });
  it('creates the Android notification channel before a user permission request', async () => {
    mock.platform = 'android'; mock.permission.mockResolvedValue({ granted: false, canAskAgain: true });
    await travelReminderNative.permission(true);
    expect(mock.channel).toHaveBeenCalledWith('travel-preparation', expect.objectContaining({ importance: 2, sound: null }));
    expect(mock.channel.mock.invocationCallOrder[0]).toBeLessThan(mock.requestPermission.mock.invocationCallOrder[0]!);
  });
  it('ignores other notification streams and deduplicates its own response', async () => {
    const handle = vi.fn(async () => {}); const remove = await observeTravelReminderTaps(handle);
    mock.listener!(response('another.stream')); await Promise.resolve();
    expect(mock.clearResponse).not.toHaveBeenCalled(); expect(handle).not.toHaveBeenCalled();
    mock.listener!(response()); mock.listener!(response());
    await vi.waitFor(() => expect(handle).toHaveBeenCalledOnce());
    expect(handle).toHaveBeenCalledWith('hash_A', '2026-11-01T00:00:00Z'); expect(mock.clearResponse).toHaveBeenCalledOnce();
    remove(); expect(mock.unsubscribe).toHaveBeenCalledOnce();
  });
  it('handles a cold-start response and discards responses after unmount', async () => {
    mock.lastResponse.mockResolvedValue(response());
    const handle = vi.fn(async () => {}); const remove = await observeTravelReminderTaps(handle);
    await vi.waitFor(() => expect(handle).toHaveBeenCalledOnce()); remove();
    mock.listener!({ ...response(), notification: { ...response().notification, date: 456 } });
    await Promise.resolve(); expect(handle).toHaveBeenCalledOnce();
  });
});
