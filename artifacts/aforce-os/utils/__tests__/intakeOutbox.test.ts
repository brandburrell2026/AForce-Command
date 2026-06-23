import { describe, it, expect } from 'vitest';
import {
  mergeOutboxItems,
  normalizeOutboxItem,
  markSyncing,
  markSynced,
  markFailed,
  dueItems,
  pendingItems,
  countPending,
  pruneSynced,
  pendingOverlay,
  isStale,
  eventLoggedAtMs,
  backoffDelayMs,
  outboxInvariantsHold,
  MAX_OUTBOX_ITEMS,
  STALE_WINDOW_MS,
  BACKOFF_BASE_MS,
  BACKOFF_MAX_MS,
  type OutboxItem,
} from '../intakeOutbox';

const NOW = Date.UTC(2026, 5, 23, 12, 0, 0); // 2026-06-23T12:00:00Z

function makeItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  const prepared = {
    clientEventId: `cid-${Math.random().toString(36).slice(2)}`,
    fluidType: 'water',
    ozAmount: 16,
    scoreBefore: 90,
    scoreAfter: 92,
    event: {
      id: `evt-${Math.random().toString(36).slice(2)}`,
      fluidType: 'water',
      oz: 16,
      loggedAt: new Date(NOW).toISOString(),
      baseImpact: 5,
      capAdjusted: 5,
      immediate: 3,
      delayed: 2,
      delayedDurationMin: 30,
      heatGuardActiveAtLog: false,
      scoreBeforeAtLog: 90,
    },
    ...(overrides.prepared ?? {}),
  };
  return {
    prepared,
    status: 'pending',
    attempts: 0,
    createdAtMs: NOW,
    nextAttemptAtMs: NOW,
    ...overrides,
    // keep the merged prepared (overrides.prepared already folded above)
    ...(overrides.prepared ? {} : {}),
  } as OutboxItem;
}

describe('mergeOutboxItems — dedupe / order / cap (offline save + restart-with-queued)', () => {
  it('dedupes by clientEventId with first-occurrence-wins (idempotent re-enqueue)', () => {
    const a = makeItem({ prepared: { clientEventId: 'k1', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event } });
    const dupNewerStatus = { ...a, status: 'failed' as const, attempts: 9 };
    const merged = mergeOutboxItems([a], [dupNewerStatus]);
    expect(merged).toHaveLength(1);
    // existing (first) wins — the late duplicate cannot clobber it
    expect(merged[0]!.status).toBe('pending');
    expect(merged[0]!.attempts).toBe(0);
  });

  it('sorts by createdAtMs ascending so replay order is the order logged', () => {
    const older = makeItem({ createdAtMs: NOW - 5000 });
    const newer = makeItem({ createdAtMs: NOW });
    const merged = mergeOutboxItems([newer], [older]);
    expect(merged.map((m) => m.createdAtMs)).toEqual([NOW - 5000, NOW]);
  });

  it('caps by dropping the OLDEST beyond the cap', () => {
    const items = Array.from({ length: 5 }, (_, i) => makeItem({ createdAtMs: NOW + i }));
    const merged = mergeOutboxItems([], items, { cap: 2 });
    expect(merged.map((m) => m.createdAtMs)).toEqual([NOW + 3, NOW + 4]);
  });

  it('a bad cap falls back to MAX_OUTBOX_ITEMS — never silently wipes the queue', () => {
    const items = Array.from({ length: 3 }, (_, i) => makeItem({ createdAtMs: NOW + i }));
    for (const cap of [0, -5, NaN, 1.5]) {
      expect(mergeOutboxItems([], items, { cap }).length).toBe(3);
    }
    expect(MAX_OUTBOX_ITEMS).toBeGreaterThan(0);
  });

  it('an empty incoming returns the normalized existing queue unchanged', () => {
    const a = makeItem();
    expect(mergeOutboxItems([a], [])).toHaveLength(1);
  });

  it('drops corrupt persisted items instead of crashing (restart safety)', () => {
    const good = makeItem();
    const merged = mergeOutboxItems(
      [good, null, 7, { prepared: { clientEventId: '' } }, { prepared: { clientEventId: 'x', fluidType: 'water', ozAmount: -1, scoreBefore: 1, scoreAfter: 2, event: { id: 'e', loggedAt: 'z' } } }],
      [],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.prepared.clientEventId).toBe(good.prepared.clientEventId);
  });

  it('normalizeOutboxItem fills sane defaults for a minimally-valid record', () => {
    const it = normalizeOutboxItem({
      prepared: {
        clientEventId: 'k',
        fluidType: 'water',
        ozAmount: 12,
        scoreBefore: 50,
        scoreAfter: 55,
        event: { id: 'e', loggedAt: new Date(NOW).toISOString() },
      },
    });
    expect(it).not.toBeNull();
    expect(it!.status).toBe('pending');
    expect(it!.attempts).toBe(0);
    expect(it!.nextAttemptAtMs).toBe(it!.createdAtMs);
  });
});

describe('status transitions (reconnect sync / retry safety / failed-stays-queued)', () => {
  it('markSyncing flips status without touching attempts', () => {
    const a = makeItem({ prepared: { clientEventId: 'k1', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event } });
    const [out] = markSyncing([a], 'k1');
    expect(out!.status).toBe('syncing');
    expect(out!.attempts).toBe(0);
  });

  it('markSynced confirms the item (drops out of pending)', () => {
    const a = makeItem({ prepared: { clientEventId: 'k1', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event } });
    const synced = markSynced([a], 'k1');
    expect(synced[0]!.status).toBe('synced');
    expect(countPending(synced)).toBe(0);
    expect(pruneSynced(synced)).toHaveLength(0);
  });

  it('markFailed bumps attempts, schedules a backoff retry, and keeps it queued', () => {
    const a = makeItem({ prepared: { clientEventId: 'k1', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event } });
    const failed = markFailed([a], 'k1', NOW);
    expect(failed[0]!.status).toBe('failed');
    expect(failed[0]!.attempts).toBe(1);
    expect(failed[0]!.nextAttemptAtMs).toBe(NOW + backoffDelayMs(1));
    expect(failed[0]!.lastErrorAtMs).toBe(NOW);
    // a failed item is still pending work — never lost
    expect(countPending(failed)).toBe(1);
  });

  it('repeated failures grow the backoff exponentially up to the cap', () => {
    expect(backoffDelayMs(1)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelayMs(2)).toBe(BACKOFF_BASE_MS * 2);
    expect(backoffDelayMs(3)).toBe(BACKOFF_BASE_MS * 4);
    expect(backoffDelayMs(100)).toBe(BACKOFF_MAX_MS);
    // invalid attempt counts fall back to the base delay
    expect(backoffDelayMs(0)).toBe(BACKOFF_BASE_MS);
    expect(backoffDelayMs(NaN)).toBe(BACKOFF_BASE_MS);
  });
});

describe('dueItems — what the flusher should send, in Water-First order', () => {
  it('returns only unsynced items whose retry time has arrived', () => {
    const ready = makeItem({ prepared: { clientEventId: 'ready', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event }, nextAttemptAtMs: NOW - 1 });
    const backoff = makeItem({ prepared: { clientEventId: 'backoff', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event }, status: 'failed', nextAttemptAtMs: NOW + 10_000 });
    const done = makeItem({ prepared: { clientEventId: 'done', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event }, status: 'synced', nextAttemptAtMs: NOW - 1 });
    const due = dueItems([ready, backoff, done], NOW);
    expect(due.map((d) => d.prepared.clientEventId)).toEqual(['ready']);
  });

  it('a stuck `syncing` item becomes due again once its retry time passes (crash recovery)', () => {
    const stuck = makeItem({ status: 'syncing', nextAttemptAtMs: NOW - 1 });
    expect(dueItems([stuck], NOW)).toHaveLength(1);
  });

  it('orders due items by the time they were logged, not enqueue time (never reorders water)', () => {
    const firstLogged = makeItem({
      prepared: { clientEventId: 'first', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: { ...makeItem().prepared.event, id: 'e-first', loggedAt: new Date(NOW - 60_000).toISOString() } },
      createdAtMs: NOW, // enqueued LATER...
      nextAttemptAtMs: NOW - 1,
    });
    const secondLogged = makeItem({
      prepared: { clientEventId: 'second', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: { ...makeItem().prepared.event, id: 'e-second', loggedAt: new Date(NOW).toISOString() } },
      createdAtMs: NOW - 60_000, // ...but logged-at says it came second
      nextAttemptAtMs: NOW - 1,
    });
    const due = dueItems([secondLogged, firstLogged], NOW);
    expect(due.map((d) => d.prepared.clientEventId)).toEqual(['first', 'second']);
  });

  it('stale (>24h) items are still due to send (server keeps a historical log)', () => {
    const stale = makeItem({
      prepared: { clientEventId: 'stale', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: { ...makeItem().prepared.event, loggedAt: new Date(NOW - 25 * 60 * 60 * 1000).toISOString() } },
      nextAttemptAtMs: NOW - 1,
    });
    expect(isStale(stale, NOW)).toBe(true);
    expect(dueItems([stale], NOW)).toHaveLength(1);
  });
});

describe('staleness helpers', () => {
  it('isStale uses the event loggedAt and the 24h window', () => {
    const fresh = makeItem();
    const stale = makeItem({ prepared: { ...makeItem().prepared, event: { ...makeItem().prepared.event, loggedAt: new Date(NOW - STALE_WINDOW_MS - 1).toISOString() } } });
    expect(isStale(fresh, NOW)).toBe(false);
    expect(isStale(stale, NOW)).toBe(true);
  });

  it('eventLoggedAtMs falls back to createdAtMs when loggedAt is unparseable', () => {
    const bad = makeItem({ prepared: { ...makeItem().prepared, event: { ...makeItem().prepared.event, loggedAt: 'not-a-date' } }, createdAtMs: NOW - 123 });
    expect(eventLoggedAtMs(bad)).toBe(NOW - 123);
  });
});

describe('pendingOverlay — Score-Protection: stale never inflates today', () => {
  it('counts every unsynced item but excludes stale items from today deltas', () => {
    const fresh = makeItem({ prepared: { clientEventId: 'fresh', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event }, nextAttemptAtMs: NOW });
    const freshAforce = makeItem({ prepared: { clientEventId: 'aforce', fluidType: 'aforce_stick', ozAmount: 8, scoreBefore: 1, scoreAfter: 2, event: { ...makeItem().prepared.event, id: 'e-af' } }, nextAttemptAtMs: NOW });
    const stale = makeItem({ prepared: { clientEventId: 'stale', fluidType: 'water', ozAmount: 99, scoreBefore: 1, scoreAfter: 2, event: { ...makeItem().prepared.event, id: 'e-st', loggedAt: new Date(NOW - 25 * 60 * 60 * 1000).toISOString() } }, nextAttemptAtMs: NOW });
    const synced = makeItem({ prepared: { clientEventId: 'synced', fluidType: 'water', ozAmount: 50, scoreBefore: 1, scoreAfter: 2, event: { ...makeItem().prepared.event, id: 'e-sy' } }, status: 'synced' });

    const overlay = pendingOverlay([fresh, freshAforce, stale, synced], NOW);
    expect(overlay.count).toBe(3); // fresh + aforce + stale (badge), synced excluded
    expect(overlay.unitsPending).toBe(2); // only the two fresh items
    expect(overlay.ozPending).toBe(24); // 16 + 8 (stale's 99oz excluded)
    expect(overlay.aforceUnitsPending).toBe(1);
  });

  it('an all-synced / empty queue overlays nothing', () => {
    expect(pendingOverlay([], NOW)).toEqual({ count: 0, unitsPending: 0, ozPending: 0, aforceUnitsPending: 0 });
    const synced = makeItem({ status: 'synced' });
    expect(pendingOverlay([synced], NOW)).toEqual({ count: 0, unitsPending: 0, ozPending: 0, aforceUnitsPending: 0 });
  });
});

describe('invariants — Score-Protection + structural integrity hold across a lifecycle', () => {
  it('a full offline→retry→sync lifecycle never fabricates score or loses an item', () => {
    // 1. user logs two waters offline (frozen scores travel verbatim)
    const w1 = makeItem({ prepared: { clientEventId: 'w1', fluidType: 'water', ozAmount: 16, scoreBefore: 80, scoreAfter: 83, event: { ...makeItem().prepared.event, id: 'e1', loggedAt: new Date(NOW - 2000).toISOString() } }, createdAtMs: NOW - 2000, nextAttemptAtMs: NOW - 2000 });
    const w2 = makeItem({ prepared: { clientEventId: 'w2', fluidType: 'water', ozAmount: 16, scoreBefore: 83, scoreAfter: 86, event: { ...makeItem().prepared.event, id: 'e2', loggedAt: new Date(NOW - 1000).toISOString() } }, createdAtMs: NOW - 1000, nextAttemptAtMs: NOW - 1000 });
    let q = mergeOutboxItems([], [w1, w2]);
    expect(outboxInvariantsHold(q)).toBe(true);

    // 2. flusher picks them up Water-First and marks the first in-flight
    const due = dueItems(q, NOW);
    expect(due.map((d) => d.prepared.clientEventId)).toEqual(['w1', 'w2']);
    q = markSyncing(q, 'w1');

    // 3. first send fails → stays queued with backoff; frozen scores unchanged
    q = markFailed(q, 'w1', NOW);
    expect(q.find((i) => i.prepared.clientEventId === 'w1')!.prepared.scoreAfter).toBe(83);
    expect(countPending(q)).toBe(2);

    // 4. retry succeeds for both
    q = markSynced(q, 'w1');
    q = markSynced(q, 'w2');
    expect(countPending(q)).toBe(0);
    expect(outboxInvariantsHold(q)).toBe(true);

    // 5. nothing fabricated: the queue carried frozen scores, never recomputed
    expect(pendingItems(q)).toHaveLength(0);
  });

  it('outboxInvariantsHold rejects duplicate keys, negative volume, and bad status', () => {
    const a = makeItem({ prepared: { clientEventId: 'dup', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event } });
    const b = makeItem({ prepared: { clientEventId: 'dup', fluidType: 'water', ozAmount: 16, scoreBefore: 1, scoreAfter: 2, event: makeItem().prepared.event } });
    expect(outboxInvariantsHold([a, b])).toBe(false);
    const neg = makeItem();
    (neg.prepared as { ozAmount: number }).ozAmount = -1;
    expect(outboxInvariantsHold([neg])).toBe(false);
    const badStatus = makeItem();
    (badStatus as { status: string }).status = 'weird';
    expect(outboxInvariantsHold([badStatus])).toBe(false);
  });
});
