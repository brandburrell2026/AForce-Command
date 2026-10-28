import { describe, it, expect, vi } from 'vitest';
import { createJourney, createJourneyRepository, type JourneyStorage, type DepartureInput } from '../journey';
import { createTravelReminderController, planTravelReminder, reminderStorageKey, TRAVEL_REMINDER_ID, TravelClearError, type ReminderContext, type ReminderSnapshot, type TravelReminderNative } from '../reminders';

const input: DepartureInput = { flightNumber: 'AA123', origin: 'JFK', destination: 'LAX', departureDate: '2026-11-01', departureTime: '14:30', utcOffset: '-05:00' };
const NOW = Date.parse('2026-10-31T12:00:00Z');
function setup() {
  let now = NOW;
  let ctx: ReminderContext = { owner: 'A', enabled: true, token: {} };
  let snapshot: ReminderSnapshot | undefined;
  const disk = new Map<string, string>(), scheduled = new Map<string, string>();
  const storage: JourneyStorage = {
    getItem: vi.fn(async key => disk.get(key) ?? null),
    setItem: vi.fn(async (key, value) => { disk.set(key, value); }),
    removeItem: vi.fn(async key => { disk.delete(key); }),
  };
  const native: TravelReminderNative = {
    supported: true,
    cancel: vi.fn(async () => { scheduled.delete(TRAVEL_REMINDER_ID); }),
    permission: vi.fn(async () => true),
    schedule: vi.fn(async fireAt => { scheduled.set(TRAVEL_REMINDER_ID, fireAt); }),
  };
  const journeys = createJourneyRepository(storage);
  const controller = createTravelReminderController({ context: () => ctx, storage, journeys, native, now: () => now, publish: value => { snapshot = value; } });
  return { disk, scheduled, storage, native, journeys, controller, snapshot: () => snapshot,
    scope: (owner: string | null, enabled = true) => { ctx = { owner, enabled, token: {} }; },
    time: (value: number) => { now = value; },
  };
}

describe('travel preparation reminder planning', () => {
  it('plans exactly two hours before the entered departure without reading provider status', () => {
    expect(planTravelReminder(createJourney(input), NOW)).toEqual({ state: 'scheduled', fireAt: '2026-11-01T17:30:00.000Z' });
  });
  it.each(['00:00', '06:30', '08:30', '00:30'])('suppresses quiet-hour reminder for departure %s', departureTime => {
    expect(planTravelReminder(createJourney({ ...input, departureTime }), NOW).state).toBe('quiet_hours');
  });
  it('allows the exact 07:00 boundary, drops past-due and completed journeys', () => {
    const journey = createJourney({ ...input, departureTime: '09:00' });
    expect(planTravelReminder(journey, NOW).state).toBe('scheduled');
    expect(planTravelReminder(journey, Date.parse(journey.departureAt)).state).toBe('too_late');
    expect(planTravelReminder({ ...journey, completedAt: new Date(NOW).toISOString() }, NOW).state).toBe('no_journey');
    expect(planTravelReminder(null, NOW).state).toBe('no_journey');
  });
});

describe('single-owner reminder lifecycle', () => {
  it('defaults off and never requests permission from boot/foreground sync', async () => {
    const f = setup(); await f.journeys.save('A', input); await f.controller.sync();
    expect(f.snapshot()?.state).toBe('off');
    expect(f.native.permission).not.toHaveBeenCalled(); expect(f.scheduled.size).toBe(0);
  });
  it('records explicit opt-in and schedules a single device slot idempotently', async () => {
    const f = setup(); await f.journeys.save('A', input); await f.controller.choose('A', 'aforce');
    expect(f.native.permission).toHaveBeenLastCalledWith(true);
    expect(f.snapshot()?.state).toBe('scheduled');
    await f.controller.sync(); await f.controller.sync();
    expect(f.native.permission).toHaveBeenLastCalledWith(false);
    expect(f.scheduled.size).toBe(1);
    expect(f.disk.get(reminderStorageKey('A'))).toContain('aforce');
  });
  it('does not schedule after denied permission and does not reprompt on sync', async () => {
    const f = setup(); f.native.permission = vi.fn(async () => false);
    await f.journeys.save('A', input); await f.controller.choose('A', 'aforce');
    expect(f.snapshot()?.state).toBe('permission_required'); expect(f.scheduled.size).toBe(0);
    await f.controller.sync(); expect(f.native.permission).toHaveBeenLastCalledWith(false);
  });
  it('suppresses quiet/past-due reminders without prompting', async () => {
    const f = setup(); await f.journeys.save('A', { ...input, departureTime: '08:00' });
    await f.controller.choose('A', 'aforce');
    expect(f.snapshot()?.state).toBe('quiet_hours'); expect(f.native.permission).not.toHaveBeenCalled();
    f.time(Date.parse('2026-11-05T00:00:00Z')); await f.controller.sync();
    expect(f.snapshot()?.state).toBe('too_late');
  });
  it('rechecks the time after a long permission dialog', async () => {
    const f = setup(); await f.journeys.save('A', input);
    f.native.permission = vi.fn(async () => { f.time(Date.parse('2026-11-01T18:00:00Z')); return true; });
    await f.controller.choose('A', 'aforce');
    expect(f.snapshot()?.state).toBe('too_late'); expect(f.scheduled.size).toBe(0);
  });
  it('lets another app own reminders without claiming to configure that app', async () => {
    const f = setup(); await f.journeys.save('A', input); await f.controller.choose('A', 'aforce');
    await f.controller.choose('A', 'external');
    expect(f.snapshot()?.state).toBe('external'); expect(f.scheduled.size).toBe(0);
    await f.controller.choose('A', 'off'); expect(f.snapshot()?.state).toBe('off');
  });
  it('cancels on completion/removal and makes the next journey usable', async () => {
    const f = setup(); await f.controller.changeJourney('A', { kind: 'save', input }); await f.controller.choose('A', 'aforce');
    await f.controller.changeJourney('A', { kind: 'finish' });
    expect(f.scheduled.size).toBe(0); expect(f.snapshot()?.state).toBe('no_journey');
    await f.controller.changeJourney('A', { kind: 'save', input: { ...input, destination: 'MIA' } });
    expect(f.scheduled.size).toBe(1);
    await f.controller.changeJourney('A', { kind: 'remove' }); expect(f.scheduled.size).toBe(0);
  });
  it('removes a late old-account schedule before the next account can schedule', async () => {
    const f = setup(); await f.journeys.save('A', input);
    let release!: () => void;
    f.native.schedule = vi.fn(async fireAt => { await new Promise<void>(resolve => { release = resolve; }); f.scheduled.set(TRAVEL_REMINDER_ID, fireAt); });
    const pending = f.controller.choose('A', 'aforce');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    f.scope('B'); const next = f.controller.sync(); release(); await pending; await next;
    expect(f.scheduled.size).toBe(0); expect(f.snapshot()).toMatchObject({ owner: 'B', state: 'off' });
    expect(f.disk.has(reminderStorageKey('B'))).toBe(false);
    // B is still usable after the race, not merely blocked forever.
    f.native.schedule = vi.fn(async fireAt => { f.scheduled.set(TRAVEL_REMINDER_ID, fireAt); });
    await f.controller.changeJourney('B', { kind: 'save', input }); await f.controller.choose('B', 'aforce');
    expect(f.scheduled.size).toBe(1); expect(f.snapshot()?.owner).toBe('B');
  });
  it('rejects an old A request after an A-to-B-to-A switch even when the owner matches again', async () => {
    const f = setup(); await f.journeys.save('A', input);
    let release!: (granted: boolean) => void;
    f.native.permission = vi.fn(() => new Promise<boolean>(resolve => { release = resolve; }));
    const old = f.controller.choose('A', 'aforce');
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    f.scope('B'); f.scope('A'); release(true); await old;
    expect(f.native.schedule).not.toHaveBeenCalled();
    f.native.permission = vi.fn(async () => true); await f.controller.sync();
    expect(f.scheduled.size).toBe(1);
  });
  it('cancels on sign-out/disabled feature and retains account-owned trip data', async () => {
    const f = setup(); await f.journeys.save('A', input); await f.controller.choose('A', 'aforce');
    f.scope(null); await f.controller.sync(); expect(f.scheduled.size).toBe(0);
    expect(await f.journeys.load('A')).not.toBeNull();
    f.scope('A', false); await f.controller.sync(); expect(f.scheduled.size).toBe(0);
    await expect(f.controller.choose('A', 'aforce')).rejects.toThrow('account changed');
  });
  it('shows failure if cancellation or scheduling fails; never claims enabled/off success', async () => {
    const f = setup(); await f.journeys.save('A', input);
    f.native.schedule = vi.fn().mockRejectedValue(new Error('OS failure'));
    await f.controller.choose('A', 'aforce'); expect(f.snapshot()?.state).toBe('error');
    f.native.cancel = vi.fn().mockRejectedValue(new Error('OS cancel failure'));
    await f.controller.sync(); expect(f.snapshot()?.state).toBe('error');
    await expect(f.controller.choose('A', 'off')).rejects.toThrow('OS cancel failure');
  });
  it('fails closed on corrupt stored preferences and supports a clean reset', async () => {
    const f = setup(); f.disk.set(reminderStorageKey('A'), '{broken'); await f.controller.sync();
    expect(f.snapshot()?.state).toBe('error'); expect(f.scheduled.size).toBe(0);
    await f.controller.clear('A'); expect(f.snapshot()?.state).toBe('off');
  });
  it('clears only the requested account and reports partial cleanup failures', async () => {
    const f = setup(); await f.journeys.save('A', input); await f.journeys.save('B', input); await f.controller.choose('A', 'aforce');
    f.native.cancel = vi.fn().mockRejectedValue(new Error('device unavailable'));
    let failure: unknown;
    try { await f.controller.clear('A'); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(TravelClearError);
    expect((failure as TravelClearError).result).toEqual({ journey: true, preferences: true, reminders: false });
    expect(await f.journeys.load('A')).toBeNull(); expect(await f.journeys.load('B')).not.toBeNull();
    expect(f.snapshot()?.state).toBe('error');
  });
});
