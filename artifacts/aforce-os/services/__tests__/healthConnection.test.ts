import { describe, it, expect, vi } from 'vitest';
import {
  createInMemoryHealthConnectionStore,
  createHealthConnection,
} from '../healthConnection';

describe('healthConnection', () => {
  it("returns 'unavailable' on the wrong platform and never prompts", async () => {
    const requestPermissions = vi.fn();
    const conn = createHealthConnection({
      providerId: 'apple_health',
      store: createInMemoryHealthConnectionStore(),
      isSupported: () => false,
      requestPermissions,
    });
    expect(await conn.getStatus()).toBe('unavailable');
    expect(await conn.connect()).toBe('unavailable');
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("returns 'not_determined' on supported platforms with no stored record", async () => {
    const conn = createHealthConnection({
      providerId: 'apple_health',
      store: createInMemoryHealthConnectionStore(),
      isSupported: () => true,
      requestPermissions: vi.fn(),
    });
    expect(await conn.getStatus()).toBe('not_determined');
  });

  it("connect() persists on grant and reports 'connected' afterwards", async () => {
    const store = createInMemoryHealthConnectionStore();
    const conn = createHealthConnection({
      providerId: 'samsung_health',
      store,
      isSupported: () => true,
      requestPermissions: vi.fn(async () => true),
      nowMs: () => 1_234_567,
    });
    expect(await conn.connect()).toBe('connected');
    expect(await conn.getStatus()).toBe('connected');
    expect(await store.read('samsung_health')).toEqual({ connectedAt: 1_234_567 });
  });

  it("connect() returns 'denied' and persists nothing when permission is refused", async () => {
    const store = createInMemoryHealthConnectionStore();
    const conn = createHealthConnection({
      providerId: 'apple_health',
      store,
      isSupported: () => true,
      requestPermissions: vi.fn(async () => false),
    });
    expect(await conn.connect()).toBe('denied');
    expect(await store.read('apple_health')).toBeNull();
    expect(await conn.getStatus()).toBe('not_determined');
  });

  it('disconnect() clears the stored record', async () => {
    const store = createInMemoryHealthConnectionStore({
      apple_health: { connectedAt: 999 },
    });
    const conn = createHealthConnection({
      providerId: 'apple_health',
      store,
      isSupported: () => true,
      requestPermissions: vi.fn(),
    });
    expect(await conn.getStatus()).toBe('connected');
    await conn.disconnect();
    expect(await conn.getStatus()).toBe('not_determined');
    expect(await store.read('apple_health')).toBeNull();
  });

  it('two providers share one store without colliding', async () => {
    const store = createInMemoryHealthConnectionStore();
    const apple = createHealthConnection({
      providerId: 'apple_health',
      store,
      isSupported: () => true,
      requestPermissions: vi.fn(async () => true),
      nowMs: () => 100,
    });
    const samsung = createHealthConnection({
      providerId: 'samsung_health',
      store,
      isSupported: () => true,
      requestPermissions: vi.fn(async () => true),
      nowMs: () => 200,
    });
    await apple.connect();
    expect(await samsung.getStatus()).toBe('not_determined');
    await samsung.connect();
    expect(await apple.getStatus()).toBe('connected');
    expect(await samsung.getStatus()).toBe('connected');
    await apple.disconnect();
    expect(await apple.getStatus()).toBe('not_determined');
    expect(await samsung.getStatus()).toBe('connected');
  });

  it("connect() swallows bridge throws and reports 'denied'", async () => {
    const store = createInMemoryHealthConnectionStore();
    const conn = createHealthConnection({
      providerId: 'apple_health',
      store,
      isSupported: () => true,
      requestPermissions: vi.fn(async () => {
        throw new Error('native bridge crashed');
      }),
    });
    expect(await conn.connect()).toBe('denied');
    expect(await store.read('apple_health')).toBeNull();
  });

  it('in-memory seed primes connected status', async () => {
    const store = createInMemoryHealthConnectionStore({
      samsung_health: { connectedAt: 42 },
    });
    const conn = createHealthConnection({
      providerId: 'samsung_health',
      store,
      isSupported: () => true,
      requestPermissions: vi.fn(),
    });
    expect(await conn.getStatus()).toBe('connected');
  });
});
