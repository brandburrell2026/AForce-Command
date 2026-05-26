import { describe, it, expect } from "vitest";
import {
  createInMemoryHydroScanRepo,
  HYDRO_SCAN_LIST_DEFAULT_LIMIT,
  HYDRO_SCAN_LIST_MAX_LIMIT,
  type HydroScanInsert,
} from "@workspace/db";

function sample(overrides: Partial<HydroScanInsert> = {}): HydroScanInsert {
  return {
    userId: "user_a",
    clientScanId: "scan_1",
    scannedAt: new Date("2026-05-01T12:00:00Z"),
    sourceKind: "barcode",
    rawValue: "012345678905",
    productId: "p_smartwater",
    productName: "Smartwater",
    brand: "Glaceau",
    category: "water",
    isAForce: false,
    verdict: "acceptable",
    currentFitScore: 62,
    efficiency: 0.71,
    efficiencyLabel: "Hydrates at 71% efficiency",
    evaluatedAgainstState: "BALANCED",
    aforceEquivalentId: "aforce_classic",
    payload: { note: "preserved verbatim" },
    ...overrides,
  };
}

describe("HydroScanRepo (in-memory)", () => {
  it("insert returns a record with a generated id and createdAt", async () => {
    const repo = createInMemoryHydroScanRepo();
    const rec = await repo.insert(sample());
    expect(rec.id).toBeGreaterThan(0);
    expect(rec.createdAt).toBeInstanceOf(Date);
    expect(rec.userId).toBe("user_a");
    expect(rec.payload).toEqual({ note: "preserved verbatim" });
  });

  it("insert is idempotent on (userId, clientScanId) — same key returns the same row", async () => {
    const repo = createInMemoryHydroScanRepo();
    const first = await repo.insert(sample());
    const replay = await repo.insert(sample({ verdict: "avoid", currentFitScore: 1 }));
    expect(replay.id).toBe(first.id);
    // The original row wins; the replay's payload is discarded so a
    // retry can never silently mutate history.
    expect(replay.verdict).toBe("acceptable");
    expect(replay.currentFitScore).toBe(62);
    expect(await repo.countForUser("user_a")).toBe(1);
  });

  it("two users with the same clientScanId do NOT collide", async () => {
    const repo = createInMemoryHydroScanRepo();
    const a = await repo.insert(sample({ userId: "user_a", clientScanId: "scan_x" }));
    const b = await repo.insert(sample({ userId: "user_b", clientScanId: "scan_x" }));
    expect(a.id).not.toBe(b.id);
    expect(await repo.countForUser("user_a")).toBe(1);
    expect(await repo.countForUser("user_b")).toBe(1);
  });

  it("listForUser returns rows ordered by scannedAt DESC", async () => {
    const repo = createInMemoryHydroScanRepo();
    await repo.insert(sample({ clientScanId: "old", scannedAt: new Date("2026-05-01T08:00:00Z") }));
    await repo.insert(sample({ clientScanId: "mid", scannedAt: new Date("2026-05-01T10:00:00Z") }));
    await repo.insert(sample({ clientScanId: "new", scannedAt: new Date("2026-05-01T12:00:00Z") }));
    const rows = await repo.listForUser("user_a");
    expect(rows.map((r) => r.clientScanId)).toEqual(["new", "mid", "old"]);
  });

  it("listForUser scopes rows to the requesting user", async () => {
    const repo = createInMemoryHydroScanRepo();
    await repo.insert(sample({ userId: "user_a", clientScanId: "a1" }));
    await repo.insert(sample({ userId: "user_b", clientScanId: "b1" }));
    const aRows = await repo.listForUser("user_a");
    const bRows = await repo.listForUser("user_b");
    expect(aRows.map((r) => r.clientScanId)).toEqual(["a1"]);
    expect(bRows.map((r) => r.clientScanId)).toEqual(["b1"]);
  });

  it("listForUser honors limit, defaults to 50, hard-caps at 200", async () => {
    expect(HYDRO_SCAN_LIST_DEFAULT_LIMIT).toBe(50);
    expect(HYDRO_SCAN_LIST_MAX_LIMIT).toBe(200);
    const repo = createInMemoryHydroScanRepo();
    for (let i = 0; i < 300; i += 1) {
      await repo.insert(
        sample({
          clientScanId: `s_${i}`,
          scannedAt: new Date(2026, 0, 1, 0, 0, i),
        }),
      );
    }
    expect((await repo.listForUser("user_a")).length).toBe(50);
    expect((await repo.listForUser("user_a", { limit: 10 })).length).toBe(10);
    expect((await repo.listForUser("user_a", { limit: 500 })).length).toBe(200);
    expect((await repo.listForUser("user_a", { limit: 0 })).length).toBe(50);
    expect((await repo.listForUser("user_a", { limit: -3 })).length).toBe(50);
    expect((await repo.listForUser("user_a", { limit: Number.NaN })).length).toBe(50);
  });

  it("countForUser returns 0 for an unknown user and matches insert count otherwise", async () => {
    const repo = createInMemoryHydroScanRepo();
    expect(await repo.countForUser("ghost")).toBe(0);
    await repo.insert(sample({ clientScanId: "s1" }));
    await repo.insert(sample({ clientScanId: "s2" }));
    expect(await repo.countForUser("user_a")).toBe(2);
  });

  it("payload is preserved verbatim (no coercion)", async () => {
    const repo = createInMemoryHydroScanRepo();
    const richPayload = {
      scannedAt: "2026-05-01T12:00:00Z",
      recommendation: {
        headline: "Solid pick.",
        command: "Drink 12oz now.",
        personalization: { dominantSignals: ["heat", "activity"] },
      },
      efficiency: 0.71,
    };
    const rec = await repo.insert(sample({ payload: richPayload }));
    expect(rec.payload).toEqual(richPayload);
  });
});
