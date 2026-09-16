/**
 * The scheduler, driven by a fake clock and a fake timer.
 *
 * Nothing here sleeps and nothing uses fake timers: the clock and the timer
 * are injected, so every assertion about backoff, foregrounding and
 * overlapping flushes is deterministic rather than a race the CI machine
 * might lose.
 */
import { describe, expect, it } from "vitest";

import { enqueue, type OutboxItem } from "../trainerOutbox";
import { createOutboxScheduler, type Scheduler } from "../trainerScheduler";
import {
  DEFAULT_MAX_AUTO_ATTEMPTS,
  type SendResult,
  type SyncTransport,
} from "../trainerSync";

const T0 = 1_700_000_000_000;

/** A controllable world: time only moves when a test moves it. */
function world() {
  let now = T0;
  const timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  let queue: OutboxItem[] = [];
  const flushes: number[] = [];
  const errors: unknown[] = [];
  let respond: (item: OutboxItem) => SendResult | Promise<SendResult> = () => ({ ok: true });
  const sent: string[] = [];

  const transport: SyncTransport = {
    async send(item) {
      sent.push(item.id);
      return respond(item);
    },
  };

  const deps = {
    now: () => now,
    setTimer(fn: () => void, ms: number) {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimer(handle: unknown) {
      const i = timers.findIndex((t) => t.id === handle);
      if (i >= 0) timers.splice(i, 1);
    },
    getQueue: () => queue,
    setQueue: (next: OutboxItem[]) => {
      queue = next;
    },
    transport,
    onError: (e: unknown) => errors.push(e),
    onFlush: () => flushes.push(now),
  };

  return {
    deps,
    get queue() {
      return queue;
    },
    set queue(q: OutboxItem[]) {
      queue = q;
    },
    get timers() {
      return timers;
    },
    get now() {
      return now;
    },
    sent,
    flushes,
    errors,
    setResponder(fn: typeof respond) {
      respond = fn;
    },
    /** Move time forward and fire every timer that comes due. */
    async advance(ms: number) {
      now += ms;
      let guard = 0;
      for (;;) {
        const due = timers.filter((t) => t.at <= now).sort((a, b) => a.at - b.at)[0];
        if (!due || guard++ > 100) break;
        timers.splice(timers.indexOf(due), 1);
        due.fn();
        await settle();
      }
    },
  };
}

/** Let queued microtasks run. */
const settle = () => new Promise<void>((r) => setTimeout(r, 0));

function item(over: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: over.id ?? "i1",
    kind: "availability",
    athleteUserId: over.athleteUserId ?? "athlete_1",
    programId: "prog_1",
    payload: { status: "out" },
    baseVersion: null,
    state: "pending",
    attempts: 0,
    createdAtMs: T0,
    nextAttemptAtMs: T0,
    ...over,
  };
}

async function started(w: ReturnType<typeof world>): Promise<Scheduler> {
  const s = createOutboxScheduler(w.deps);
  s.start();
  await settle();
  return s;
}

describe("it drains the queue without being asked twice", () => {
  it("flushes on start", async () => {
    const w = world();
    w.queue = [item({ id: "a" })];
    await started(w);
    expect(w.sent).toEqual(["a"]);
    expect(w.queue[0]!.state).toBe("synced");
  });

  it("flushes when something is enqueued", async () => {
    const w = world();
    const s = await started(w);
    expect(w.sent).toEqual([]);

    w.queue = enqueue(w.queue, {
      id: "new",
      kind: "availability",
      athleteUserId: "athlete_1",
      programId: "prog_1",
      payload: { status: "out" },
      baseVersion: null,
      createdAtMs: w.now,
    });
    s.onEnqueued();
    await settle();

    expect(w.sent).toEqual(["new"]);
  });

  it("keeps draining past the per-pass limit without waiting for a timer", async () => {
    const w = world();
    w.queue = Array.from({ length: 7 }, (_, i) => item({ id: `i${i}`, createdAtMs: T0 + i }));
    const s = createOutboxScheduler(w.deps, { limit: 3 });
    s.start();
    await settle();
    expect(w.sent).toHaveLength(7);
  });
});

describe("no busy loop", () => {
  it("schedules NOTHING when the queue is empty", async () => {
    const w = world();
    await started(w);
    expect(w.timers).toHaveLength(0);
  });

  it("schedules nothing once everything has synced", async () => {
    const w = world();
    w.queue = [item({ id: "a" })];
    await started(w);
    expect(w.queue[0]!.state).toBe("synced");
    expect(w.timers).toHaveLength(0);
  });

  it("holds exactly one timer at a time", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry" }));
    w.queue = [item({ id: "a" }), item({ id: "b", athleteUserId: "athlete_2" })];
    const s = await started(w);

    expect(w.timers).toHaveLength(1);
    s.onEnqueued();
    s.onEnqueued();
    await settle();
    expect(w.timers).toHaveLength(1);
  });

  it("waits for the backoff rather than spinning", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry" }));
    w.queue = [item({ id: "a" })];
    await started(w);

    expect(w.sent).toHaveLength(1);
    // Well inside the first backoff (2s): no further attempt.
    await w.advance(500);
    expect(w.sent).toHaveLength(1);
    // Past it: exactly one more.
    await w.advance(2_000);
    expect(w.sent).toHaveLength(2);
  });

  it("never sets a delay below the floor", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry" }));
    w.queue = [item({ id: "a", nextAttemptAtMs: T0 - 10_000 })];
    const s = createOutboxScheduler(w.deps, { minDelayMs: 1_000 });
    s.start();
    await settle();
    expect(s.inspect().wakeAtMs).toBeGreaterThanOrEqual(w.now + 1_000);
  });

  it("caps a very distant backoff, so returning to signal is not a long wait", async () => {
    const w = world();
    w.queue = [item({ id: "a", state: "failed", attempts: 8, nextAttemptAtMs: T0 + 5 * 60_000 })];
    const s = createOutboxScheduler(w.deps, { maxDelayMs: 60_000 });
    s.start();
    await settle();
    expect(s.inspect().wakeAtMs).toBeLessThanOrEqual(w.now + 60_000);
  });
});

describe("one flush at a time", () => {
  it("a request during a flush runs once, after — not N more passes", async () => {
    const w = world();
    let release: (() => void) | null = null;
    w.setResponder(
      () =>
        new Promise<SendResult>((resolve) => {
          release = () => resolve({ ok: true });
        }),
    );
    w.queue = [item({ id: "a" })];
    const s = createOutboxScheduler(w.deps);
    s.start();
    await settle();

    expect(s.inspect().inFlight).toBe(true);
    s.onEnqueued();
    s.onEnqueued();
    s.onForeground();

    w.setResponder(() => ({ ok: true }));
    release!();
    await settle();
    await settle();

    // "a" sent once by the first pass. The coalesced request ran a second
    // pass, found nothing due, and sent nothing more.
    expect(w.sent).toEqual(["a"]);
    expect(s.inspect().inFlight).toBe(false);
  });

  it("a coalesced request is not lost when work arrives mid-flight", async () => {
    const w = world();
    let release: (() => void) | null = null;
    w.setResponder(
      () =>
        new Promise<SendResult>((resolve) => {
          release = () => resolve({ ok: true });
        }),
    );
    w.queue = [item({ id: "a" })];
    const s = createOutboxScheduler(w.deps);
    s.start();
    await settle();

    // Arrives while the first pass is still waiting on the network.
    w.queue = [...w.queue, item({ id: "b", athleteUserId: "athlete_2", createdAtMs: T0 + 1 })];
    s.onEnqueued();

    w.setResponder(() => ({ ok: true }));
    release!();
    await settle();
    await settle();

    expect(w.sent).toContain("b");
  });
});

describe("foreground and background", () => {
  it("stops waking up in the background", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry" }));
    w.queue = [item({ id: "a" })];
    const s = await started(w);
    expect(w.timers).toHaveLength(1);

    s.onBackground();
    expect(w.timers).toHaveLength(0);

    // Time passes with the app backgrounded; nothing fires.
    const before = w.sent.length;
    await w.advance(10 * 60_000);
    expect(w.sent).toHaveLength(before);
  });

  it("flushes immediately on return to the foreground", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry" }));
    w.queue = [item({ id: "a" })];
    const s = await started(w);
    s.onBackground();
    await w.advance(10 * 60_000);

    const before = w.sent.length;
    w.setResponder(() => ({ ok: true }));
    s.onForeground();
    await settle();

    // The moment that matters: a trainer walking back into signal.
    expect(w.sent.length).toBe(before + 1);
    expect(w.queue[0]!.state).toBe("synced");
  });

  it("stop() clears the timer and start() resumes", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry" }));
    w.queue = [item({ id: "a" })];
    const s = await started(w);

    s.stop();
    expect(w.timers).toHaveLength(0);
    expect(s.inspect().running).toBe(false);

    await w.advance(60_000);
    const before = w.sent.length;

    s.start();
    await settle();
    expect(w.sent.length).toBeGreaterThan(before);
  });

  it("is idempotent — start twice, stop twice", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry" }));
    w.queue = [item({ id: "a" })];
    const s = createOutboxScheduler(w.deps);
    s.start();
    s.start();
    await settle();
    expect(w.timers).toHaveLength(1);
    s.stop();
    s.stop();
    expect(w.timers).toHaveLength(0);
  });
});

describe("retry is bounded, and nothing is dropped", () => {
  it("stops retrying an item that has failed too many times", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry" }));
    w.queue = [item({ id: "a" })];
    const s = createOutboxScheduler(w.deps, { maxAutoAttempts: 3 });
    s.start();
    await settle();

    for (let i = 0; i < 12; i += 1) await w.advance(10 * 60_000);

    expect(w.sent.length).toBe(3);
    // Parked, not gone.
    expect(w.queue).toHaveLength(1);
    expect(w.queue[0]!.attempts).toBe(3);
    expect(w.queue[0]!.state).toBe("failed");
  });

  it("a parked item schedules no further wake-ups", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry" }));
    w.queue = [item({ id: "a", state: "failed", attempts: DEFAULT_MAX_AUTO_ATTEMPTS })];
    await started(w);
    expect(w.sent).toEqual([]);
    expect(w.timers).toHaveLength(0);
  });

  it("keeps a permanently rejected entry, with its reason", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "permanent", message: "not_permitted" }));
    w.queue = [item({ id: "a" })];
    await started(w);

    expect(w.queue).toHaveLength(1);
    expect(w.queue[0]!.lastError).toBe("not_permitted");
  });

  it("a conflict is preserved and not retried away", async () => {
    const w = world();
    w.setResponder(() => ({
      ok: false,
      kind: "conflict",
      serverVersion: 9,
      serverValue: { status: "out" },
    }));
    w.queue = [item({ id: "a" })];
    await started(w);
    await w.advance(10 * 60_000);

    expect(w.queue[0]!.state).toBe("conflicted");
    expect(w.queue[0]!.conflict).toEqual({ serverVersion: 9, serverValue: { status: "out" } });
    // One attempt: a conflict waits for a person, it does not back off.
    expect(w.sent).toEqual(["a"]);
  });
});

describe("a bad response does not stop the loop", () => {
  it("reports a throw and keeps scheduling", async () => {
    const w = world();
    let thrown = false;
    w.setResponder(() => {
      if (!thrown) {
        thrown = true;
        return { ok: false, kind: "retry" };
      }
      return { ok: true };
    });
    // A setQueue that throws once — the failure mode outside flushOnce's own
    // try/catch.
    let failNext = true;
    const deps = {
      ...w.deps,
      setQueue: (next: OutboxItem[]) => {
        if (failNext) {
          failNext = false;
          throw new Error("storage full");
        }
        w.queue = next;
      },
    };
    w.queue = [item({ id: "a" })];
    const s = createOutboxScheduler(deps);
    s.start();
    await settle();

    expect(w.errors).toHaveLength(1);
    // Still alive: a wake is scheduled.
    expect(s.inspect().wakeAtMs).not.toBeNull();
  });
});

describe("end to end: a sideline that loses signal and gets it back", () => {
  it("retries with backoff, parks nothing prematurely, and drains on reconnect", async () => {
    const w = world();
    w.setResponder(() => ({ ok: false, kind: "retry", message: "offline" }));
    w.queue = Array.from({ length: 5 }, (_, i) =>
      item({ id: `a${i}`, athleteUserId: `athlete_${i}`, createdAtMs: T0 + i }),
    );

    const s = createOutboxScheduler(w.deps);
    s.start();
    await settle();
    expect(w.sent).toHaveLength(5);
    expect(w.queue.every((q) => q.state === "failed")).toBe(true);

    // The phone goes in a pocket.
    s.onBackground();
    await w.advance(20 * 60_000);

    // Back in signal, app reopened.
    w.setResponder(() => ({ ok: true }));
    s.onForeground();
    await settle();

    expect(w.queue.every((q) => q.state === "synced")).toBe(true);
    expect(w.timers).toHaveLength(0);
  });
});
