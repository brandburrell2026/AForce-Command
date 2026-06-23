import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory AsyncStorage backing the service. Hoisted so the vi.mock factory
// can close over it and so it survives vi.resetModules() cold restarts.
const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
}));

const STORAGE_KEY = '@aforce/performance-memory-capture';
// The service prunes against the real Date.now(), so signals must be fresh
// (inside the 180-day retention window) — anchor the fixture to the live clock.
const NOW = Date.now();

async function freshService() {
  vi.resetModules();
  const mod = await import('../performanceMemoryCapture');
  await mod.hydratePerformanceMemoryCapture();
  return mod;
}

describe('performanceMemoryCapture service · recording', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('records travel / caffeine / priority into the snapshot and persists the key', async () => {
    const svc = await freshService();
    await svc.recordTravelSignal(NOW);
    await svc.recordCaffeineSignal({ intakeEventId: 'evt-1', atMs: NOW, categoryId: 'coffee' });
    await svc.recordUserPrioritySignal({ goal: 'train', atMs: NOW });

    const snap = svc.getPerformanceMemoryCaptureSnapshot();
    expect(snap.travel).toHaveLength(1);
    expect(snap.caffeine).toHaveLength(1);
    expect(snap.caffeine[0].categoryId).toBe('coffee');
    expect(snap.priorities).toHaveLength(1);
    expect(snap.priorities[0].goal).toBe('train');
    // It actually wrote through to storage under the documented key.
    expect(mem.has(STORAGE_KEY)).toBe(true);
  });

  it('same-day travel is idempotent (day-keyed id dedupe)', async () => {
    const svc = await freshService();
    await svc.recordTravelSignal(NOW);
    await svc.recordTravelSignal(NOW + 3_600_000); // same UTC day
    expect(svc.getPerformanceMemoryCaptureSnapshot().travel).toHaveLength(1);
  });

  it('notifies subscribers on write', async () => {
    const svc = await freshService();
    const listener = vi.fn();
    const unsub = svc.subscribePerformanceMemoryCapture(listener);
    await svc.recordTravelSignal(NOW);
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('clear performs a REAL delete — empties state AND removes the storage key', async () => {
    const svc = await freshService();
    await svc.recordTravelSignal(NOW);
    await svc.recordCaffeineSignal({ intakeEventId: 'e', atMs: NOW });
    expect(mem.has(STORAGE_KEY)).toBe(true);

    await svc.clearPerformanceMemoryCapture();

    const snap = svc.getPerformanceMemoryCaptureSnapshot();
    expect(snap.travel).toEqual([]);
    expect(snap.caffeine).toEqual([]);
    expect(snap.priorities).toEqual([]);
    expect(mem.has(STORAGE_KEY)).toBe(false);
  });
});

describe('performanceMemoryCapture service · hydration', () => {
  beforeEach(() => {
    mem.clear();
  });

  it('hydrates a previously persisted snapshot from storage', async () => {
    mem.set(
      STORAGE_KEY,
      JSON.stringify({
        travel: [{ id: 'travel:1', kind: 'travel', atMs: NOW, dayIndex: 1 }],
        caffeine: [],
        priorities: [{ id: 'p1', kind: 'priority', atMs: NOW, dayIndex: 1, goal: 'compete' }],
      }),
    );
    const svc = await freshService();
    const snap = svc.getPerformanceMemoryCaptureSnapshot();
    expect(snap.travel).toHaveLength(1);
    expect(snap.priorities[0].goal).toBe('compete');
    expect(snap.hydrated).toBe(true);
  });

  it('a persisted entry survives a same-id in-flight write (existing-wins merge)', async () => {
    // Seed with the SAME day-keyed id the recorder will generate today, so the
    // re-record collides and the persisted entry must win.
    const today = Math.floor(NOW / 86_400_000);
    mem.set(
      STORAGE_KEY,
      JSON.stringify({
        travel: [{ id: `travel:${today}`, kind: 'travel', atMs: NOW, dayIndex: today }],
        caffeine: [],
        priorities: [],
      }),
    );
    const svc = await freshService();
    // Re-record the SAME day — must not clobber the persisted entry.
    await svc.recordTravelSignal(NOW + 1000);
    const snap = svc.getPerformanceMemoryCaptureSnapshot();
    expect(snap.travel).toHaveLength(1);
    expect(snap.travel[0].atMs).toBe(NOW);
  });

  it('drops malformed persisted entries instead of fabricating', async () => {
    mem.set(
      STORAGE_KEY,
      JSON.stringify({
        travel: [{ id: '', atMs: NOW }, { id: 'travel:1', atMs: NOW, dayIndex: 1 }],
        caffeine: 'not-an-array',
        priorities: [{ id: 'p1', atMs: NOW }], // missing goal ⇒ dropped
      }),
    );
    const svc = await freshService();
    const snap = svc.getPerformanceMemoryCaptureSnapshot();
    expect(snap.travel).toHaveLength(1);
    expect(snap.caffeine).toEqual([]);
    expect(snap.priorities).toEqual([]);
  });
});
