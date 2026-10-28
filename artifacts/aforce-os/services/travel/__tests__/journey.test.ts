import { describe, it, expect, vi } from 'vitest';
import { createJourney, createJourneyRepository, departureInputSchema, journeyStorageKey, type DepartureInput, type JourneyStorage } from '../journey';

const input: DepartureInput = { flightNumber: ' aa123 ', origin: 'jfk', destination: 'lax', departureDate: '2026-11-01', departureTime: '14:30', utcOffset: '-05:00' };
function setup() {
  const values = new Map<string, string>();
  const storage: JourneyStorage = {
    getItem: vi.fn(async key => values.get(key) ?? null),
    setItem: vi.fn(async (key, value) => { values.set(key, value); }),
    removeItem: vi.fn(async key => { values.delete(key); }),
  };
  return { values, storage, repository: createJourneyRepository(storage) };
}

describe('manual journey validation', () => {
  it('normalizes the flight and airports and preserves departure timezone', () => {
    const journey = createJourney(input);
    expect(journey.details.flightNumber).toBe('AA123');
    expect(journey.details.origin).toBe('JFK');
    expect(journey.departureAt).toBe('2026-11-01T19:30:00.000Z');
    expect(journey.source).toBe('manual');
  });
  it.each([
    { departureDate: '2026-02-30' }, { departureDate: '2025-02-29' },
    { departureDate: '2026-13-01' }, { departureTime: '24:30' },
    { utcOffset: '+14:01' }, { utcOffset: '-15:00' },
    { utcOffset: 'America/New_York' }, { origin: 'JFK', destination: 'JFK' },
    { flightNumber: '' }, { origin: 'New York' },
  ])('rejects invalid journey input %j', change => {
    expect(departureInputSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it('accepts leap dates and fractional-hour offsets', () => {
    expect(createJourney({ ...input, departureDate: '2028-02-29', utcOffset: '+05:45' }).departureAt).toBe('2028-02-29T08:45:00.000Z');
  });
});

describe('account-owned journey persistence', () => {
  it('never reads another account’s itinerary', async () => {
    const { repository } = setup();
    await repository.save('account_A', input);
    expect(await repository.load('account_B')).toBeNull();
    expect((await repository.load('account_A'))?.details.origin).toBe('JFK');
    await repository.remove('account_B');
    expect(await repository.load('account_A')).not.toBeNull();
  });
  it('rejects an absent identity and produces collision-free secure keys', () => {
    expect(() => journeyStorageKey('')).toThrow();
    expect(journeyStorageKey('a:b')).not.toBe(journeyStorageKey('a_b'));
    expect(journeyStorageKey('user_A')).toMatch(/^[A-Za-z0-9._-]+$/);
  });
  it('does not replace an active journey', async () => {
    const { repository } = setup();
    await repository.save('A', input);
    await expect(repository.save('A', { ...input, destination: 'MIA' })).rejects.toThrow('Finish or remove');
    expect((await repository.load('A'))?.details.destination).toBe('LAX');
  });
  it('finishes idempotently, permits a next trip, and removes the saved journey', async () => {
    const { repository } = setup();
    await repository.save('A', input);
    const first = await repository.finish('A');
    expect((await repository.finish('A'))?.completedAt).toBe(first.completedAt);
    await repository.save('A', { ...input, destination: 'MIA' });
    expect((await repository.load('A'))?.completedAt).toBeNull();
    await repository.remove('A');
    expect(await repository.load('A')).toBeNull();
  });
  it('serializes a finish and removal behind a delayed save', async () => {
    const { storage, repository } = setup();
    let release!: () => void;
    const original = storage.setItem;
    storage.setItem = async (key, value) => { await new Promise<void>(resolve => { release = resolve; }); await original(key, value); };
    const save = repository.save('A', input);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    storage.setItem = original;
    const finish = repository.finish('A');
    const remove = repository.remove('A');
    release();
    await Promise.all([save, finish, remove]);
    expect(await repository.load('A')).toBeNull();
  });
  it('reports a failed write and preserves the previously saved journey', async () => {
    const { storage, repository } = setup();
    await repository.save('A', input);
    storage.setItem = vi.fn().mockRejectedValue(new Error('keychain unavailable'));
    await expect(repository.finish('A')).rejects.toThrow('keychain unavailable');
    expect((await repository.load('A'))?.completedAt).toBeNull();
  });
  it('reports a failed removal rather than claiming success', async () => {
    const { storage, repository } = setup();
    await repository.save('A', input);
    storage.removeItem = vi.fn().mockRejectedValue(new Error('device locked'));
    await expect(repository.remove('A')).rejects.toThrow('device locked');
    expect(await repository.load('A')).not.toBeNull();
  });
  it('never overwrites corrupt data and allows explicit removal to recover', async () => {
    const { values, repository } = setup();
    values.set(journeyStorageKey('A'), '{broken');
    await expect(repository.load('A')).rejects.toThrow();
    await expect(repository.save('A', input)).rejects.toThrow();
    await repository.remove('A');
    expect(await repository.load('A')).toBeNull();
  });
  it('rejects a forged provider source and inconsistent stored times', async () => {
    const { values, repository } = setup();
    values.set(journeyStorageKey('A'), JSON.stringify({ ...createJourney(input), source: 'live' }));
    await expect(repository.load('A')).rejects.toThrow();
    values.set(journeyStorageKey('A'), JSON.stringify({ ...createJourney(input), departureAt: '2026-11-01T14:30:00.000Z' }));
    await expect(repository.load('A')).rejects.toThrow();
  });
});
