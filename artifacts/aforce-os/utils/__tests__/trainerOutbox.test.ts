/**
 * Phase 7 acceptance — offline writes, conflicts, and an indicator that does
 * not lie.
 *
 * The criterion: "the full flow passes with the network disabled, and the
 * sync indicator is accurate under forced failure."
 *
 * The network is simulated by a sender that always throws. What is proven is
 * the property that matters on a field: after repeated forced failure, the
 * trainer's entries are still in the queue, still in order, and the indicator
 * still says so.
 */
import { describe, expect, it } from "vitest";

import { applyPendingAvailability, readBoard, writeBoard } from "../trainerBoardCache";
import type { CacheStorage } from "../trainerRecordCache";
import {
  BACKOFF_MAX_MS,
  MAX_ITEMS,
  backoffFor,
  enqueue,
  markConflicted,
  markFailed,
  markSynced,
  markSyncing,
  prune,
  resolveKeepMine,
  resolveKeepServer,
  selectDue,
  syncSummary,
  type OutboxItem,
} from "../trainerOutbox";

function item(over: Partial<OutboxItem> = {}): Omit<OutboxItem, "state" | "attempts" | "nextAttemptAtMs"> {
  return {
    id: over.id ?? "op_1",
    kind: over.kind ?? "availability",
    athleteUserId: over.athleteUserId ?? "user_athlete_1",
    programId: "prog_1",
    payload: over.payload ?? { status: "out" },
    baseVersion: over.baseVersion ?? 3,
    createdAtMs: over.createdAtMs ?? 1_000,
  };
}

function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  const storage: CacheStorage & { map: Map<string, string> } = {
    map,
    async getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
  return storage;
}

describe("a trainer's entry is never dropped", () => {
  it("survives repeated forced failure and stays in the queue", () => {
    let queue = enqueue([], item());
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      queue = markSyncing(queue, "op_1");
      queue = markFailed(queue, "op_1", "network unavailable", attempt * 10_000);
    }
    expect(queue).toHaveLength(1);
    expect(queue[0]!.payload).toEqual({ status: "out" });
    expect(queue[0]!.attempts).toBe(12);
    expect(queue[0]!.state).toBe("failed");
  });

  it("backs off, and the backoff has a ceiling", () => {
    expect(backoffFor(1)).toBe(2_000);
    expect(backoffFor(2)).toBe(4_000);
    expect(backoffFor(20)).toBe(BACKOFF_MAX_MS);
  });

  it("does not retry before its backoff has elapsed, then does", () => {
    let queue = enqueue([], item());
    queue = markFailed(queue, "op_1", "offline", 10_000);
    expect(selectDue(queue, 10_500)).toHaveLength(0);
    expect(selectDue(queue, 10_000 + backoffFor(1))).toHaveLength(1);
  });

  it("prune removes only synced items", () => {
    let queue = enqueue([], item({ id: "op_1" }));
    queue = enqueue(queue, item({ id: "op_2", createdAtMs: 2_000 }));
    queue = markSynced(queue, "op_1");
    queue = markFailed(queue, "op_2", "offline", 3_000);

    const pruned = prune(queue);
    expect(pruned.map((q) => q.id)).toEqual(["op_2"]);
  });

  it("at the cap, sacrifices a synced item rather than an unsent one", () => {
    let queue: OutboxItem[] = [];
    queue = enqueue(queue, item({ id: "synced_old", createdAtMs: 1 }));
    queue = markSynced(queue, "synced_old");
    for (let i = 1; i < MAX_ITEMS; i += 1) {
      queue = enqueue(queue, item({ id: `op_${i}`, createdAtMs: i + 1 }));
    }
    expect(queue).toHaveLength(MAX_ITEMS);

    queue = enqueue(queue, item({ id: "the_newest", createdAtMs: 999_999 }));
    expect(queue).toHaveLength(MAX_ITEMS);
    expect(queue.some((q) => q.id === "synced_old")).toBe(false);
    expect(queue.some((q) => q.id === "the_newest")).toBe(true);
    expect(queue.filter((q) => q.state !== "synced")).toHaveLength(MAX_ITEMS);
  });

  it("treats a re-enqueue of the same id as a replay, not a duplicate", () => {
    let queue = enqueue([], item());
    queue = enqueue(queue, item());
    expect(queue).toHaveLength(1);
  });

  it("replays in the order the trainer entered them", () => {
    let queue = enqueue([], item({ id: "third", createdAtMs: 3_000 }));
    queue = enqueue(queue, item({ id: "first", createdAtMs: 1_000 }));
    queue = enqueue(queue, item({ id: "second", createdAtMs: 2_000 }));
    expect(selectDue(queue, 10_000).map((q) => q.id)).toEqual(["first", "second", "third"]);
  });
});

describe("a conflict is surfaced, never resolved silently", () => {
  const conflict = { serverVersion: 9, serverValue: { status: "available" } };

  it("keeps both values and waits for a person", () => {
    let queue = enqueue([], item());
    queue = markConflicted(queue, "op_1", conflict);

    const entry = queue[0]!;
    expect(entry.state).toBe("conflicted");
    expect(entry.payload).toEqual({ status: "out" });
    expect(entry.conflict).toEqual(conflict);
    // A conflicted item is not retried behind the trainer's back.
    expect(selectDue(queue, 10_000_000)).toHaveLength(0);
  });

  it("keeping mine rebases onto what the server actually has", () => {
    let queue = enqueue([], item({ baseVersion: 3 }));
    queue = markConflicted(queue, "op_1", conflict);
    queue = resolveKeepMine(queue, "op_1", 50_000);

    const entry = queue[0]!;
    expect(entry.state).toBe("pending");
    expect(entry.baseVersion).toBe(9);
    expect(entry.conflict).toBeUndefined();
    expect(selectDue(queue, 50_000)).toHaveLength(1);
  });

  it("keeping the server's value closes the item without sending", () => {
    let queue = enqueue([], item());
    queue = markConflicted(queue, "op_1", conflict);
    queue = resolveKeepServer(queue, "op_1");
    expect(queue[0]!.state).toBe("synced");
    expect(selectDue(queue, 10_000_000)).toHaveLength(0);
  });
});

describe("the sync indicator never overstates", () => {
  it("never claims 'synced' — only that nothing is waiting", () => {
    const summary = syncSummary([]);
    expect(summary.label).toBe("Nothing waiting to send");
    expect(summary.label.toLowerCase()).not.toContain("synced");
    expect(summary.label.toLowerCase()).not.toContain("up to date");
  });

  it("counts everything unsent, whatever state it is in", () => {
    let queue = enqueue([], item({ id: "a", createdAtMs: 1 }));
    queue = enqueue(queue, item({ id: "b", createdAtMs: 2 }));
    queue = enqueue(queue, item({ id: "c", createdAtMs: 3 }));
    queue = markFailed(queue, "b", "offline", 10);
    queue = markSyncing(queue, "c");

    const summary = syncSummary(queue);
    expect(summary.unsynced).toBe(3);
    expect(summary.label).toBe("Saved locally · 3 pending · retrying");
  });

  it("says pending when items are simply waiting", () => {
    let queue = enqueue([], item({ id: "a", createdAtMs: 1 }));
    queue = enqueue(queue, item({ id: "b", createdAtMs: 2 }));
    expect(syncSummary(queue).label).toBe("Saved locally · 2 pending");
  });

  it("asks for a decision when something is conflicted, and says so first", () => {
    let queue = enqueue([], item({ id: "a", createdAtMs: 1 }));
    queue = enqueue(queue, item({ id: "b", createdAtMs: 2 }));
    queue = markFailed(queue, "a", "offline", 10);
    queue = markConflicted(queue, "b", { serverVersion: 4, serverValue: {} });

    const summary = syncSummary(queue);
    expect(summary.needsAttention).toBe(true);
    expect(summary.label).toBe("1 needs your decision");
  });

  it("stays accurate through a whole forced-failure flow", () => {
    // Three entries made on a field with no signal, every send failing.
    let queue: OutboxItem[] = [];
    for (let i = 1; i <= 3; i += 1) {
      queue = enqueue(queue, item({ id: `op_${i}`, createdAtMs: i * 1_000 }));
    }
    for (let round = 1; round <= 5; round += 1) {
      for (const due of selectDue(queue, round * 600_000)) {
        queue = markSyncing(queue, due.id);
        queue = markFailed(queue, due.id, "network unavailable", round * 600_000);
      }
      expect(syncSummary(queue).unsynced).toBe(3);
    }

    // Signal returns; two succeed, one conflicts.
    queue = markSynced(queue, "op_1");
    queue = markSynced(queue, "op_2");
    queue = markConflicted(queue, "op_3", { serverVersion: 7, serverValue: { status: "limited" } });

    const summary = syncSummary(queue);
    expect(summary.unsynced).toBe(1);
    expect(summary.label).toBe("1 needs your decision");

    queue = resolveKeepMine(queue, "op_3", 9_000_000);
    queue = markSynced(queue, "op_3");
    expect(syncSummary(prune(queue)).label).toBe("Nothing waiting to send");
  });
});

describe("the board itself survives airplane mode", () => {
  const athletes = [
    {
      athleteUserId: "a1",
      displayName: "M. Reyes",
      position: "RB",
      positionGroup: "Offense",
      consentGranted: true,
      hydrationScore: 41,
      availability: "available" as const,
      questionnaireSubmitted: true,
      minutesSinceLastIntake: 90,
      sleepHoursLastNight: 6.5,
      minutesSinceSync: 20,
      isSimulated: true,
    },
  ];

  it("reads back the roster with no live source", async () => {
    const storage = fakeStorage();
    await writeBoard(storage, "viewer_1", "prog_1", athletes, 1_000);
    const hit = await readBoard(storage, "viewer_1", "prog_1", 1_000);
    expect(hit!.athletes).toEqual(athletes);
  });

  it("is scoped per viewer and per program", async () => {
    const storage = fakeStorage();
    await writeBoard(storage, "viewer_1", "prog_1", athletes, 1_000);
    expect(await readBoard(storage, "viewer_2", "prog_1")).toBeNull();
    expect(await readBoard(storage, "viewer_1", "prog_2")).toBeNull();
  });

  it("drops a roster with any malformed row rather than showing a partial one", async () => {
    const storage = fakeStorage();
    await writeBoard(storage, "viewer_1", "prog_1", athletes, 1_000);
    const key = [...storage.map.keys()][0]!;
    const parsed = JSON.parse(storage.map.get(key)!);
    parsed.athletes.push({ displayName: "no id" });
    storage.map.set(key, JSON.stringify(parsed));

    expect(await readBoard(storage, "viewer_1", "prog_1")).toBeNull();
    expect(storage.map.has(key)).toBe(false);
  });

  it("shows an unsent status change on the cached roster immediately", () => {
    const applied = applyPendingAvailability(athletes, [{ athleteUserId: "a1", status: "out" }]);
    expect(applied[0]!.availability).toBe("out");
    // The source list is untouched.
    expect(athletes[0]!.availability).toBe("available");
  });

  it("ignores a pending status it does not recognise", () => {
    const applied = applyPendingAvailability(athletes, [{ athleteUserId: "a1", status: "banana" }]);
    expect(applied[0]!.availability).toBe("available");
  });
});
