/**
 * The flush loop, and the persistence underneath it.
 *
 * Phase 7 proved every queue transition and then shipped with nothing calling
 * them: the queue lived in `useState`, lost everything on reload, and never
 * drained — so the cap was not a cap and the conflict path could not fire
 * even in principle.
 *
 * The properties below are the ones a sideline depends on, so each is stated
 * as a scenario rather than as a call.
 */
import { describe, expect, it } from "vitest";

import { MAX_ITEMS, enqueue, prune, type OutboxItem } from "../trainerOutbox";
import {
  OUTBOX_VERSION,
  clearOutbox,
  loadOutbox,
  outboxKey,
  saveOutbox,
} from "../trainerOutboxStore";
import { flushOnce, hasWork, nextDueAtMs, type SendResult, type SyncTransport } from "../trainerSync";

const VIEWER = "user_trainer_1";
const T0 = 1_700_000_000_000;

/** An in-memory CacheStorage that can be told to fail. */
function memoryStorage(opts: { failRead?: boolean; failWrite?: boolean } = {}) {
  const map = new Map<string, string>();
  return {
    map,
    async getItem(k: string) {
      if (opts.failRead) throw new Error("storage unavailable");
      return map.get(k) ?? null;
    },
    async setItem(k: string, v: string) {
      if (opts.failWrite) throw new Error("disk full");
      map.set(k, v);
    },
    async removeItem(k: string) {
      map.delete(k);
    },
  };
}

function item(over: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: over.id ?? "item_1",
    kind: "availability",
    athleteUserId: over.athleteUserId ?? "athlete_1",
    programId: "prog_1",
    payload: { status: "out" },
    baseVersion: 3,
    state: "pending",
    attempts: 0,
    createdAtMs: T0,
    nextAttemptAtMs: T0,
    ...over,
  };
}

/** A transport that answers from a script, and records what it was given. */
function transportOf(answers: Record<string, SendResult>, fallback: SendResult = { ok: true }) {
  const seen: OutboxItem[] = [];
  const t: SyncTransport = {
    async send(i) {
      seen.push(i);
      return answers[i.id] ?? fallback;
    },
  };
  return { transport: t, seen };
}

// ─── Persistence ──────────────────────────────────────────────────────────

describe("the queue survives a reload", () => {
  it("round-trips every item", async () => {
    const storage = memoryStorage();
    const queue = [item({ id: "a" }), item({ id: "b", athleteUserId: "athlete_2" })];

    expect(await saveOutbox(storage, VIEWER, queue)).toBe(true);
    const loaded = await loadOutbox(storage, VIEWER);

    expect(loaded.items).toHaveLength(2);
    expect(loaded.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(loaded.dropped).toBe(0);
  });

  it("is scoped per viewer, so two staff on one device do not share a queue", async () => {
    const storage = memoryStorage();
    await saveOutbox(storage, "trainer_a", [item({ id: "mine" })]);
    await saveOutbox(storage, "trainer_b", [item({ id: "theirs" })]);

    expect((await loadOutbox(storage, "trainer_a")).items.map((i) => i.id)).toEqual(["mine"]);
    expect((await loadOutbox(storage, "trainer_b")).items.map((i) => i.id)).toEqual(["theirs"]);
  });

  it("returns an empty queue when nothing is stored", async () => {
    expect(await loadOutbox(memoryStorage(), VIEWER)).toEqual({ items: [], dropped: 0 });
  });

  it("drops a corrupt envelope and cleans up after itself", async () => {
    const storage = memoryStorage();
    storage.map.set(outboxKey(VIEWER), "{not json");
    expect((await loadOutbox(storage, VIEWER)).items).toEqual([]);
    expect(storage.map.has(outboxKey(VIEWER))).toBe(false);
  });

  it("drops a wrong-version envelope rather than guessing at it", async () => {
    const storage = memoryStorage();
    storage.map.set(
      outboxKey(VIEWER),
      JSON.stringify({ v: OUTBOX_VERSION + 1, items: [item()] }),
    );
    expect((await loadOutbox(storage, VIEWER)).items).toEqual([]);
  });

  /** One bad row must not cost the other forty-nine. */
  it("drops only the unreadable ITEMS inside a readable envelope", async () => {
    const storage = memoryStorage();
    storage.map.set(
      outboxKey(VIEWER),
      JSON.stringify({
        v: OUTBOX_VERSION,
        items: [item({ id: "good_1" }), { id: "no-kind" }, null, item({ id: "good_2" })],
      }),
    );
    const loaded = await loadOutbox(storage, VIEWER);
    expect(loaded.items.map((i) => i.id)).toEqual(["good_1", "good_2"]);
    expect(loaded.dropped).toBe(2);
  });

  it("an item caught mid-flight by a crash becomes pending, not stuck syncing", async () => {
    const storage = memoryStorage();
    await saveOutbox(storage, VIEWER, [item({ id: "midflight", state: "syncing" })]);
    const loaded = await loadOutbox(storage, VIEWER);
    // `selectDue` ignores `syncing`, so leaving it would strand the entry
    // forever with nothing able to complete it.
    expect(loaded.items[0]!.state).toBe("pending");
  });

  it("an unreadable storage layer yields an empty queue and deletes nothing", async () => {
    const storage = memoryStorage({ failRead: true });
    storage.map.set(outboxKey(VIEWER), JSON.stringify({ v: OUTBOX_VERSION, items: [item()] }));
    expect((await loadOutbox(storage, VIEWER)).items).toEqual([]);
    expect(storage.map.has(outboxKey(VIEWER))).toBe(true);
  });

  it("a failed write is reported rather than thrown", async () => {
    expect(await saveOutbox(memoryStorage({ failWrite: true }), VIEWER, [item()])).toBe(false);
  });

  it("clearOutbox removes the queue", async () => {
    const storage = memoryStorage();
    await saveOutbox(storage, VIEWER, [item()]);
    await clearOutbox(storage, VIEWER);
    expect((await loadOutbox(storage, VIEWER)).items).toEqual([]);
  });
});

describe("the cap is enforced on load, not only on enqueue", () => {
  /**
   * The proven failure: 550 items against a cap of 500 left 550, because the
   * cap only drops an already-synced item and nothing ever synced.
   */
  it("an oversized stored queue is brought back under the cap", async () => {
    const storage = memoryStorage();
    const oversized = Array.from({ length: MAX_ITEMS + 50 }, (_, i) =>
      item({ id: `i${i}`, createdAtMs: T0 + i }),
    );
    storage.map.set(outboxKey(VIEWER), JSON.stringify({ v: OUTBOX_VERSION, items: oversized }));

    const loaded = await loadOutbox(storage, VIEWER);
    expect(loaded.items).toHaveLength(MAX_ITEMS);
    expect(loaded.dropped).toBe(50);
  });

  it("sacrifices synced entries before it touches an unsent one", async () => {
    const storage = memoryStorage();
    const synced = Array.from({ length: 100 }, (_, i) =>
      item({ id: `s${i}`, state: "synced", createdAtMs: T0 + i }),
    );
    const unsent = Array.from({ length: MAX_ITEMS - 20 }, (_, i) =>
      item({ id: `u${i}`, createdAtMs: T0 + 1000 + i }),
    );
    storage.map.set(
      outboxKey(VIEWER),
      JSON.stringify({ v: OUTBOX_VERSION, items: [...synced, ...unsent] }),
    );

    const loaded = await loadOutbox(storage, VIEWER);
    expect(loaded.items).toHaveLength(MAX_ITEMS);
    // Every unsent entry survived; only synced ones were dropped.
    expect(loaded.items.filter((i) => i.state !== "synced")).toHaveLength(MAX_ITEMS - 20);
  });

  it("loads oldest first, whatever order was stored", async () => {
    const storage = memoryStorage();
    storage.map.set(
      outboxKey(VIEWER),
      JSON.stringify({
        v: OUTBOX_VERSION,
        items: [item({ id: "late", createdAtMs: T0 + 900 }), item({ id: "early", createdAtMs: T0 })],
      }),
    );
    expect((await loadOutbox(storage, VIEWER)).items.map((i) => i.id)).toEqual(["early", "late"]);
  });
});

// ─── The flush loop ───────────────────────────────────────────────────────

describe("a flush drains what is due", () => {
  it("sends due items and marks them synced", async () => {
    const queue = [item({ id: "a" }), item({ id: "b", athleteUserId: "athlete_2" })];
    const { transport, seen } = transportOf({});
    const out = await flushOnce(queue, transport, T0);

    expect(out.sent).toBe(2);
    expect(seen.map((i) => i.id)).toEqual(["a", "b"]);
    expect(out.queue.every((i) => i.state === "synced")).toBe(true);
    // And now the cap can actually work, because prune has something to take.
    expect(prune(out.queue)).toEqual([]);
  });

  it("does not send an item whose backoff has not elapsed", async () => {
    const queue = [item({ id: "later", nextAttemptAtMs: T0 + 60_000 })];
    const { transport, seen } = transportOf({});
    const out = await flushOnce(queue, transport, T0);
    expect(seen).toEqual([]);
    expect(out.sent).toBe(0);
  });

  it("replays oldest first, because availability is a sequence not a set", async () => {
    const queue = [
      item({ id: "second", createdAtMs: T0 + 100 }),
      item({ id: "first", createdAtMs: T0 }),
      item({ id: "third", createdAtMs: T0 + 200 }),
    ];
    const { transport, seen } = transportOf({});
    await flushOnce(queue, transport, T0 + 1000);
    expect(seen.map((i) => i.id)).toEqual(["first", "second", "third"]);
  });

  it("honours the per-pass limit", async () => {
    const queue = Array.from({ length: 10 }, (_, i) => item({ id: `i${i}`, createdAtMs: T0 + i }));
    const { transport, seen } = transportOf({});
    const out = await flushOnce(queue, transport, T0 + 100, { limit: 3 });
    expect(seen).toHaveLength(3);
    expect(out.sent).toBe(3);
  });
});

describe("failures are kept, never dropped", () => {
  it("a retryable failure goes back to the queue with a backoff", async () => {
    const queue = [item({ id: "a" })];
    const { transport } = transportOf({ a: { ok: false, kind: "retry", message: "offline" } });
    const out = await flushOnce(queue, transport, T0);

    expect(out.failed).toBe(1);
    expect(out.queue[0]!.state).toBe("failed");
    expect(out.queue[0]!.attempts).toBe(1);
    expect(out.queue[0]!.nextAttemptAtMs).toBeGreaterThan(T0);
    expect(out.queue[0]!.lastError).toBe("offline");
  });

  it("a transport that THROWS is a retry, not a crash", async () => {
    const queue = [item({ id: "a" })];
    const transport: SyncTransport = {
      async send() {
        throw new Error("network down");
      },
    };
    const out = await flushOnce(queue, transport, T0);
    expect(out.failed).toBe(1);
    expect(out.queue[0]!.state).toBe("failed");
    expect(out.queue[0]!.lastError).toBe("network down");
  });

  it("a permanent rejection still keeps the entry", async () => {
    const queue = [item({ id: "a" })];
    const { transport } = transportOf({
      a: { ok: false, kind: "permanent", message: "athlete_not_found" },
    });
    const out = await flushOnce(queue, transport, T0);

    // A trainer's entry is evidence of a clinical decision even when the
    // server will not take it.
    expect(out.queue).toHaveLength(1);
    expect(out.queue[0]!.lastError).toBe("athlete_not_found");
  });

  it("retries the same item on the next pass once the backoff elapses", async () => {
    let queue: OutboxItem[] = [item({ id: "a" })];
    const flaky: SyncTransport = {
      async send() {
        return attempts++ === 0 ? { ok: false, kind: "retry" } : { ok: true };
      },
    };
    let attempts = 0;

    queue = (await flushOnce(queue, flaky, T0)).queue;
    expect(queue[0]!.state).toBe("failed");

    queue = (await flushOnce(queue, flaky, T0 + 10 * 60_000)).queue;
    expect(queue[0]!.state).toBe("synced");
  });
});

describe("a conflict stops one athlete's chain and nobody else's", () => {
  const conflict: SendResult = {
    ok: false,
    kind: "conflict",
    serverVersion: 9,
    serverValue: { status: "out" },
  };

  it("holds both values on the item", async () => {
    const queue = [item({ id: "a" })];
    const { transport } = transportOf({ a: conflict });
    const out = await flushOnce(queue, transport, T0);

    expect(out.conflicted).toBe(1);
    expect(out.queue[0]!.state).toBe("conflicted");
    expect(out.queue[0]!.conflict).toEqual({ serverVersion: 9, serverValue: { status: "out" } });
  });

  it("does not send a later edit for the SAME athlete in that pass", async () => {
    const queue = [
      item({ id: "first", createdAtMs: T0 }),
      item({ id: "second", createdAtMs: T0 + 10 }),
    ];
    const { transport, seen } = transportOf({ first: conflict });
    const out = await flushOnce(queue, transport, T0 + 100);

    expect(seen.map((i) => i.id)).toEqual(["first"]);
    expect(out.blocked).toBe(1);
    expect(out.queue.find((i) => i.id === "second")!.state).toBe("pending");
  });

  it("keeps flushing a DIFFERENT athlete", async () => {
    const queue = [
      item({ id: "first", athleteUserId: "athlete_1", createdAtMs: T0 }),
      item({ id: "other", athleteUserId: "athlete_2", createdAtMs: T0 + 10 }),
    ];
    const { transport, seen } = transportOf({ first: conflict });
    const out = await flushOnce(queue, transport, T0 + 100);

    expect(seen.map((i) => i.id)).toEqual(["first", "other"]);
    expect(out.sent).toBe(1);
  });

  it("stays blocked on later passes until a person resolves it", async () => {
    let queue: OutboxItem[] = [
      item({ id: "first", createdAtMs: T0 }),
      item({ id: "second", createdAtMs: T0 + 10 }),
    ];
    const { transport } = transportOf({ first: conflict });
    queue = (await flushOnce(queue, transport, T0 + 100)).queue;

    const { transport: t2, seen: seen2 } = transportOf({});
    const out = await flushOnce(queue, t2, T0 + 999_999);
    expect(seen2).toEqual([]);
    expect(out.blocked).toBe(1);
  });

  it("a permanent rejection also stops that athlete's chain", async () => {
    const queue = [
      item({ id: "first", createdAtMs: T0 }),
      item({ id: "second", createdAtMs: T0 + 10 }),
    ];
    const { transport, seen } = transportOf({
      first: { ok: false, kind: "permanent", message: "not_permitted" },
    });
    await flushOnce(queue, transport, T0 + 100);
    expect(seen.map((i) => i.id)).toEqual(["first"]);
  });
});

describe("scheduling", () => {
  it("reports whether there is anything to do", () => {
    expect(hasWork([], T0)).toBe(false);
    expect(hasWork([item()], T0)).toBe(true);
    expect(hasWork([item({ nextAttemptAtMs: T0 + 1 })], T0)).toBe(false);
  });

  it("reports when the next item becomes due, so a caller can sleep", () => {
    expect(nextDueAtMs([])).toBeNull();
    expect(nextDueAtMs([item({ state: "synced" })])).toBeNull();
    expect(
      nextDueAtMs([item({ id: "a", nextAttemptAtMs: T0 + 900 }), item({ id: "b", nextAttemptAtMs: T0 + 50 })]),
    ).toBe(T0 + 50);
  });
});

describe("end to end: a sideline with no signal, then signal", () => {
  it("entries survive a reload and drain when the network returns", async () => {
    const storage = memoryStorage();

    // Offline: a trainer clears a squad.
    let queue: OutboxItem[] = [];
    for (let i = 0; i < 12; i += 1) {
      queue = enqueue(queue, {
        id: `avail_${i}`,
        kind: "availability",
        athleteUserId: `athlete_${i}`,
        programId: "prog_1",
        payload: { status: i % 3 === 0 ? "out" : "available" },
        baseVersion: null,
        createdAtMs: T0 + i,
      });
    }
    await saveOutbox(storage, VIEWER, queue);

    // The app is killed and relaunched. This is the step that used to lose
    // everything.
    const reloaded = await loadOutbox(storage, VIEWER);
    expect(reloaded.items).toHaveLength(12);

    // Still no signal.
    const offline: SyncTransport = {
      async send() {
        throw new Error("offline");
      },
    };
    const afterOffline = await flushOnce(reloaded.items, offline, T0 + 1000);
    expect(afterOffline.sent).toBe(0);
    expect(afterOffline.queue).toHaveLength(12);

    // Signal returns, after the backoff.
    const { transport } = transportOf({});
    const afterOnline = await flushOnce(afterOffline.queue, transport, T0 + 10 * 60_000, {
      limit: 50,
    });
    expect(afterOnline.sent).toBe(12);
    expect(prune(afterOnline.queue)).toEqual([]);
  });
});
