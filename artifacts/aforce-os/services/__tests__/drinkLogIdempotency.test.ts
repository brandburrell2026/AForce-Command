/**
 * RA-N5: the same member action can never save a drink twice.
 *
 * Two layers are proved here: the id registry (pure), and `postRecordedDrink`
 * against a fake server that behaves like the real route, storing one row per
 * (member, client event id) and replaying a repeat.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../data/products', () => ({ PRODUCTS: { water: { fluidType: 'water', ozPerServing: 12 } } }));
vi.mock('../../data/mockData', () => ({ defaultUserState: { intakeEvents: [] } }));
vi.mock('../../utils/scoringEngine', () => ({ calculateScore: vi.fn(() => ({ score: 50 })) }));
vi.mock('../authToken', () => ({
  getAuthHeaders: async () => ({}),
  getAuthToken: async () => null,
}));

import { postRecordedDrink } from '../realApi';
import {
  createDrinkEventIdRegistry,
  drinkFingerprint,
  isDefinitiveRejection,
  DRINK_EVENT_ID_REUSE_WINDOW_MS,
} from '../drinkLogIdempotency';

const COFFEE = { categoryId: 'coffee', displayName: 'Coffee · Drip · 12 oz', ozAmount: 12, entrySource: 'scan' as const };
const TEA = { ...COFFEE, categoryId: 'tea', displayName: 'Tea · Green · 12 oz' };

describe('drink event id registry', () => {
  it('one action keeps one id until it is settled', () => {
    const r = createDrinkEventIdRegistry();
    const fp = drinkFingerprint(COFFEE);
    const first = r.idFor(fp);
    expect(r.idFor(fp)).toBe(first);
    expect(r.idFor(fp)).toBe(first);
    r.settle(fp);
    expect(r.idFor(fp)).not.toBe(first);
  });

  it('different drinks, amounts or surfaces never share an id', () => {
    const r = createDrinkEventIdRegistry();
    const ids = new Set([
      r.idFor(drinkFingerprint(COFFEE)),
      r.idFor(drinkFingerprint(TEA)),
      r.idFor(drinkFingerprint({ ...COFFEE, ozAmount: 16 })),
      r.idFor(drinkFingerprint({ ...COFFEE, entrySource: 'manual' })),
    ]);
    expect(ids.size).toBe(4);
  });

  it('an unanswered attempt lets go of its id after the reuse window', () => {
    let t = 1_000_000;
    const r = createDrinkEventIdRegistry({ now: () => t });
    const fp = drinkFingerprint(COFFEE);
    const first = r.idFor(fp);
    t += DRINK_EVENT_ID_REUSE_WINDOW_MS - 1;
    expect(r.idFor(fp)).toBe(first);
    t += 2;
    expect(r.pendingCount()).toBe(0);
    expect(r.idFor(fp)).not.toBe(first);
  });

  it('ids fit the server contract (1 to 64 characters)', () => {
    const id = createDrinkEventIdRegistry().idFor(drinkFingerprint(COFFEE));
    expect(id.length).toBeGreaterThan(0);
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it('only a real refusal counts as definitive', () => {
    expect(isDefinitiveRejection(new Error('POST /drinks → 400'))).toBe(true);
    expect(isDefinitiveRejection(new Error('POST /drinks → 401'))).toBe(true);
    for (const unknown of ['POST /drinks → 500', 'POST /drinks → 503', 'POST /drinks → 408', 'POST /drinks → 429', 'Network request failed', '']) {
      expect(isDefinitiveRejection(new Error(unknown)), unknown).toBe(false);
    }
    expect(isDefinitiveRejection('not an error')).toBe(false);
  });
});

/** Behaves like `POST /aforce/drinks`: one row per client event id; a repeat is replayed. */
function fakeServer() {
  const rows = new Map<string, { id: number; categoryId: string; displayName: string; ozAmount: number; recordedAt: string }>();
  const sentIds: string[] = [];
  let mode: 'ok' | 'store_then_drop_reply' | 'unreachable' | 'reject_400' | 'error_500' = 'ok';
  const handler = vi.fn(async (_url: unknown, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? '{}') as { clientEventId: string; categoryId: string; displayName: string; ozAmount: number };
    sentIds.push(body.clientEventId);
    if (mode === 'unreachable') throw new TypeError('Network request failed');
    if (mode === 'reject_400') return new Response('{"error":"recorded_drink_invalid"}', { status: 400 });
    if (mode === 'error_500') return new Response('{"error":"recorded_drink_write_failed"}', { status: 500 });
    const replayed = rows.has(body.clientEventId);
    if (!replayed) {
      rows.set(body.clientEventId, { id: rows.size + 1, categoryId: body.categoryId, displayName: body.displayName, ozAmount: body.ozAmount, recordedAt: '2026-11-18T12:00:00Z' });
    }
    if (mode === 'store_then_drop_reply') throw new TypeError('Network request failed');
    return new Response(JSON.stringify({ drink: rows.get(body.clientEventId), replayed }), { status: replayed ? 200 : 201 });
  });
  return { rows, sentIds, handler, set: (m: typeof mode) => { mode = m; } };
}

describe('postRecordedDrink cannot save the same action twice', () => {
  let server: ReturnType<typeof fakeServer>;
  beforeEach(() => {
    server = fakeServer();
    vi.stubGlobal('fetch', server.handler);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the reply is lost after the server stored the drink; trying again saves nothing new', async () => {
    server.set('store_then_drop_reply');
    await expect(postRecordedDrink(COFFEE)).rejects.toThrow();
    expect(server.rows.size).toBe(1);

    server.set('ok');
    const drink = await postRecordedDrink(COFFEE);
    expect(server.rows.size).toBe(1);
    expect(drink.id).toBe(1);
    expect(server.sentIds[1]).toBe(server.sentIds[0]);
  });

  it('several failed attempts in a row still end as one row', async () => {
    server.set('store_then_drop_reply');
    await expect(postRecordedDrink(TEA)).rejects.toThrow();
    server.set('error_500');
    await expect(postRecordedDrink(TEA)).rejects.toThrow();
    server.set('unreachable');
    await expect(postRecordedDrink(TEA)).rejects.toThrow();
    server.set('ok');
    await postRecordedDrink(TEA);
    expect(server.rows.size).toBe(1);
    expect(new Set(server.sentIds).size).toBe(1);
  });

  it('a drink that never reached the server is saved once on the retry', async () => {
    const drink = { ...COFFEE, displayName: 'Coffee · Espresso · 2 oz', ozAmount: 2 };
    server.set('unreachable');
    await expect(postRecordedDrink(drink)).rejects.toThrow();
    expect(server.rows.size).toBe(0);
    server.set('ok');
    await postRecordedDrink(drink);
    expect(server.rows.size).toBe(1);
  });

  it('two real drinks, logged one after the other, are two rows', async () => {
    const drink = { ...COFFEE, displayName: 'Coffee · Cold brew · 16 oz', ozAmount: 16 };
    await postRecordedDrink(drink);
    await postRecordedDrink(drink);
    expect(server.rows.size).toBe(2);
    expect(server.sentIds[0]).not.toBe(server.sentIds[1]);
  });

  it('a refused drink does not hold its id; the next action is a new one', async () => {
    const drink = { ...COFFEE, displayName: 'Coffee · Latte · 12 oz' };
    server.set('reject_400');
    await expect(postRecordedDrink(drink)).rejects.toThrow('400');
    server.set('ok');
    await postRecordedDrink(drink);
    expect(server.sentIds[0]).not.toBe(server.sentIds[1]);
    expect(server.rows.size).toBe(1);
  });

  it('every request carries a client event id', async () => {
    await postRecordedDrink({ ...COFFEE, displayName: 'Coffee · Mocha · 12 oz' });
    expect(server.sentIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });
});
