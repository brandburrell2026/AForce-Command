import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOfflineHomeRepository, projectOfflineHome } from '../offlineHome';
import type { UserState } from '@/types';
import type { OutboxItem, PreparedIntake } from '@/utils/intakeOutbox';

const disk = vi.hoisted(() => ({ data: new Map<string, string>(), failWrite: false, failRead: false }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: vi.fn(async (k: string) => { if (disk.failRead) throw new Error('locked'); return disk.data.get(k) ?? null; }),
  setItem: vi.fn(async (k: string, v: string) => { if (disk.failWrite) throw new Error('disk full'); disk.data.set(k, v); }),
  removeItem: vi.fn(async (k: string) => { disk.data.delete(k); }),
} }));
const NOW = new Date(2026, 10, 25, 12).getTime();
const prepared = (id = 'one', at = NOW): PreparedIntake => ({ clientEventId: id, fluidType: 'water', ozAmount: 16, scoreBefore: 20, scoreAfter: 22,
  event: { id: `evt-${id}`, fluidType: 'water', oz: 16, loggedAt: new Date(at).toISOString(), baseImpact: 5, capAdjusted: 5, immediate: 3, delayed: 2, delayedDurationMin: 30, heatGuardActiveAtLog: false, scoreBeforeAtLog: 20 } });
const queued = (id = 'one', at = NOW): OutboxItem => ({ prepared: prepared(id, at), status: 'pending', attempts: 0, createdAtMs: at, nextAttemptAtMs: at });
const base = (): UserState => ({ unitsConsumedToday: 2, ozConsumedToday: 24, aforceUnitsToday: 0, dailyTarget: 8, ozTarget: 96, lastIntakeTime: new Date(NOW - 60_000), lastIntakeType: 'water', intakeEvents: [] } as unknown as UserState);
beforeEach(() => { disk.data.clear(); disk.failWrite = false; disk.failRead = false; vi.resetModules(); });

describe('airplane-mode durable saving', () => {
  it('survives module restart, dedupes retries, and isolates accounts', async () => {
    let outbox = await import('../intakeOutbox');
    outbox.setIntakeOutboxUser('A');
    await Promise.all([outbox.enqueueIntake(prepared()), outbox.enqueueIntake(prepared())]);
    expect(outbox.selectPendingCount(outbox.getIntakeOutboxState())).toBe(1);
    vi.resetModules(); outbox = await import('../intakeOutbox'); outbox.setIntakeOutboxUser('B');
    await outbox.hydrateIntakeOutbox(); expect(outbox.getIntakeOutboxState().items).toEqual([]);
    outbox.setIntakeOutboxUser('A'); await outbox.hydrateIntakeOutbox();
    expect(outbox.getIntakeOutboxState().items[0].prepared).toEqual(prepared());
    await outbox.markIntakeSyncing('one'); await outbox.markIntakeFailed('one', NOW);
    expect(outbox.selectPendingCount(outbox.getIntakeOutboxState())).toBe(1);
    await outbox.markIntakeSynced('one'); await outbox.pruneSyncedIntakes();
    expect(outbox.selectPendingCount(outbox.getIntakeOutboxState())).toBe(0);
  });
  it('never acknowledges a failed disk write or unreadable existing queue', async () => {
    const outbox = await import('../intakeOutbox'); outbox.setIntakeOutboxUser('A'); disk.failWrite = true;
    await expect(outbox.enqueueIntake(prepared())).rejects.toThrow('disk full');
    expect(outbox.selectPendingCount(outbox.getIntakeOutboxState())).toBe(0);
    outbox.setIntakeOutboxUser('B'); disk.failRead = true;
    await expect(outbox.enqueueIntake(prepared())).rejects.toThrow('Could not read');
    disk.failRead = false; disk.failWrite = false;
    await outbox.enqueueIntake(prepared()); expect(outbox.selectPendingCount(outbox.getIntakeOutboxState())).toBe(1);
  });
  it('refuses a full queue without evicting any unsynced entries', async () => {
    const { MAX_OUTBOX_ITEMS } = await import('@/utils/intakeOutbox');
    const outbox = await import('../intakeOutbox');
    const items = Array.from({ length: MAX_OUTBOX_ITEMS }, (_, i) => queued(`saved-${i}`));
    disk.data.set('@aforce/intake-outbox:A', JSON.stringify(items)); outbox.setIntakeOutboxUser('A');
    await expect(outbox.enqueueIntake(prepared('overflow'))).rejects.toThrow('queue is full');
    expect(outbox.getIntakeOutboxState().items).toHaveLength(MAX_OUTBOX_ITEMS);
    expect(JSON.parse(disk.data.get('@aforce/intake-outbox:A')!)).toEqual(items);
  });
  it('refuses anonymous saving and account changes during a pending save', async () => {
    const outbox = await import('../intakeOutbox');
    await expect(outbox.enqueueIntake(prepared())).rejects.toThrow('Sign in');
    outbox.setIntakeOutboxUser('A'); const pending = outbox.enqueueIntake(prepared()); outbox.setIntakeOutboxUser('B');
    await expect(pending).rejects.toThrow('Account changed');
    expect(outbox.getIntakeOutboxState().items).toEqual([]);
  });
  it('restores account-owned Home snapshots and keeps previous data after an interrupted write', async () => {
    const data = new Map<string, string>(); let fail = false;
    const adapter = { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { if (fail) throw new Error('disk'); data.set(k, v); }, removeItem: async (k: string) => { data.delete(k); } };
    const repo = createOfflineHomeRepository(adapter); await repo.save('A', base(), NOW);
    expect(await repo.load('B')).toBeNull();
    fail = true; await expect(repo.save('A', { ...base(), ozConsumedToday: 999 }, NOW)).rejects.toThrow(); fail = false;
    const restored = await createOfflineHomeRepository(adapter).load('A'); expect(restored?.state.ozConsumedToday).toBe(24);
  });
  it('rebuilds pending totals once and rolls daily counters over without discarding the replay queue', () => {
    const item = queued();
    expect(projectOfflineHome(base(), NOW, [item], NOW).ozConsumedToday).toBe(40);
    const projected = projectOfflineHome(base(), NOW, [item], NOW);
    expect(projectOfflineHome(projected, NOW, [item], NOW).ozConsumedToday).toBe(40);
    const tomorrow = NOW + 86400000;
    expect(projectOfflineHome(base(), NOW, [item, queued('two', tomorrow)], tomorrow).ozConsumedToday).toBe(16);
    expect(item.status).toBe('pending');
  });
});
