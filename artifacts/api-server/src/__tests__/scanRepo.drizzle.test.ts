import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  aforceHydroScans,
  createDrizzleHydroScanRepo,
  type HydroScanInsert,
} from "@workspace/db";

// requires real Postgres — runs in the DB lane (pnpm test:db)
const DB = Boolean(process.env['DB_TESTS']);

const repo = createDrizzleHydroScanRepo(db);

const TEST_USER_PREFIX = "test_scan_user_";

function user(name: string): string {
  return `${TEST_USER_PREFIX}${name}`;
}

function sample(overrides: Partial<HydroScanInsert> = {}): HydroScanInsert {
  return {
    userId: user("alpha"),
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

async function cleanupTestRows(): Promise<void> {
  // Only delete rows owned by test users so other data is untouched.
  const all = await db.select().from(aforceHydroScans);
  for (const row of all) {
    if (row.userId.startsWith(TEST_USER_PREFIX)) {
      await db.delete(aforceHydroScans).where(eq(aforceHydroScans.id, row.id));
    }
  }
}

describe.runIf(DB)("HydroScanRepo (Drizzle binding, real DB)", () => {
  beforeEach(async () => {
    await cleanupTestRows();
  });
  afterAll(async () => {
    await cleanupTestRows();
  });

  it("insert persists a row and returns it with id + createdAt", async () => {
    const rec = await repo.insert(sample());
    expect(rec.id).toBeGreaterThan(0);
    expect(rec.createdAt).toBeInstanceOf(Date);
    expect(rec.userId).toBe(user("alpha"));
    expect(rec.payload).toEqual({ note: "preserved verbatim" });
  });

  it("insert is idempotent on (userId, clientScanId) — replay returns the original row", async () => {
    const first = await repo.insert(sample());
    const replay = await repo.insert(
      sample({ verdict: "avoid", currentFitScore: 1, payload: { note: "different" } }),
    );
    expect(replay.id).toBe(first.id);
    // First write wins — the on-conflict path must NOT mutate the row.
    expect(replay.verdict).toBe("acceptable");
    expect(replay.currentFitScore).toBe(62);
    expect(replay.payload).toEqual({ note: "preserved verbatim" });
    expect(await repo.countForUser(user("alpha"))).toBe(1);
  });

  it("listForUser returns rows ordered by scannedAt DESC, scoped to user", async () => {
    await repo.insert(sample({ clientScanId: "old", scannedAt: new Date("2026-05-01T08:00:00Z") }));
    await repo.insert(sample({ clientScanId: "mid", scannedAt: new Date("2026-05-01T10:00:00Z") }));
    await repo.insert(sample({ clientScanId: "new", scannedAt: new Date("2026-05-01T12:00:00Z") }));
    await repo.insert(sample({ userId: user("beta"), clientScanId: "other" }));

    const rows = await repo.listForUser(user("alpha"));
    expect(rows.map((r) => r.clientScanId)).toEqual(["new", "mid", "old"]);
    const betaRows = await repo.listForUser(user("beta"));
    expect(betaRows.map((r) => r.clientScanId)).toEqual(["other"]);
  });

  it("countForUser matches insert count", async () => {
    expect(await repo.countForUser(user("alpha"))).toBe(0);
    await repo.insert(sample({ clientScanId: "s1" }));
    await repo.insert(sample({ clientScanId: "s2" }));
    await repo.insert(sample({ clientScanId: "s3" }));
    expect(await repo.countForUser(user("alpha"))).toBe(3);
  });

  it("same clientScanId across two users does NOT collide", async () => {
    const a = await repo.insert(sample({ userId: user("alpha"), clientScanId: "shared" }));
    const b = await repo.insert(sample({ userId: user("beta"), clientScanId: "shared" }));
    expect(a.id).not.toBe(b.id);
    expect(await repo.countForUser(user("alpha"))).toBe(1);
    expect(await repo.countForUser(user("beta"))).toBe(1);
  });
});
