/**
 * Server-seed honesty lock (PR-2, founder-authorized).
 *
 * `defaultSeed()` writes the FIRST row for every new account. It
 * previously mirrored the client's DEMO-tuned day (5 units / 45 oz /
 * streak 5 — "keeps the seeded engine score at a BALANCED 76"), which
 * meant every fresh production account was born with a fabricated day
 * that the client then adopted wholesale on first fetch — defeating any
 * client-side seed honesty. This pins the honest empty row.
 *
 * Pure test: defaultSeed builds a value; no DB required.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, sep } from "node:path";
import { defaultSeed } from "../aforceState";

describe("defaultSeed — a new account's first row is the honest empty day", () => {
  const seed = defaultSeed();

  it("claims nothing that did not happen", () => {
    expect(seed.unitsConsumedToday).toBe(0);
    expect(seed.ozConsumedToday).toBe(0);
    expect(seed.aforceUnitsToday).toBe(0);
    expect(seed.complianceStreak).toBe(0);
    expect(seed.overnightLossOz).toBe(0);
    expect(seed.hasSeenMorningCommand).toBe(false);
    expect(seed.symptoms).toEqual([]);
    expect(seed.symptomState).toBe("none");
    expect(seed.urineSignal).toBe(3); // true neutral (2 read as "optimal")
    expect(seed.lastIntakeType).toBe("water");
    expect(seed.wakeTime).toBeNull();
    expect(seed.intakeEvents).toEqual([]);
    expect(seed.socialMode).toBeNull();
    expect(seed.biometrics).toBeNull();
  });

  it("matches the client's fresh-account normalize defaults (drives 4/3/5, targets 8/96)", () => {
    expect(seed.heatLoad).toBe(4);
    expect(seed.sweatRate).toBe(3);
    expect(seed.activityLevel).toBe(5);
    expect(seed.dailyTarget).toBe(8);
    expect(seed.ozTarget).toBe(96);
  });

  it("honors the recorded non-nullable constraints (documented residuals)", () => {
    // W3-PR10: lastIntakeTime non-nullable through the engine — "now",
    // never a tuned "12 minutes ago" and never an epoch sentinel.
    expect(seed.lastIntakeTime).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - (seed.lastIntakeTime as Date).getTime())).toBeLessThan(60_000);
    // The recorded 180 default (client normalizeUserState ?? 180).
    expect(seed.bodyWeightLbs).toBe(180);
  });
});

/* ═══════ HISTORY START — stamped once, at the one moment it is true ═══════
 *
 * FOUNDER RULING, 2026-09-02. `historyStartAt` records when a member's
 * HydroState history begins, so the rollups route can densify an EFFECTIVE
 * window and a 12-day-old member is not charged for 30 days.
 *
 * It is written in exactly one place — the seed INSERT in `getUserState`, which
 * is the moment AForce could first observe this member — and never again. A
 * member's history cannot begin twice, and a value that moved would silently
 * reshape every window computed from it.
 *
 * NULL is a real, permanent state: rows seeded before this column existed never
 * recorded the information and it cannot be recovered. Those members fall back
 * to HYDROSTATE_HISTORY_EPOCH. No backfill is authorized, and `now()` would be
 * the worst possible fill — this repo has no migration files, so a
 * `NOT NULL DEFAULT now()` column would stamp the push date on every existing
 * row and fabricate tenure for the entire pre-existing member base.
 */
describe("historyStartAt — the immutable per-member history stamp", () => {
  it("the SEED does not mint a start date — only creating a row may", () => {
    // `defaultSeed()` describes the CONTENT of a fresh day. The stamp is an
    // EVENT ("this row was created now"), so seeding it here would let any
    // caller mint a start date without a row ever being written, and would
    // make defaultSeed() impure into the bargain.
    expect(defaultSeed().historyStartAt).toBeNull();
  });

  it("the seed insert in getUserState is the ONLY writer", () => {
    const src = readFileSync(join(__dirname, "..", "aforceState.ts"), "utf8");
    // Structural, not lexical: count the sites that could WRITE the column.
    const writes = src.match(/historyStartAt:\s*new Date\(\)/g) ?? [];
    expect(writes.length, "exactly one site may stamp it").toBe(1);
    // ...and that site is the insert, not an update.
    const insert = /\.insert\(aforceUserState\)[\s\S]*?\.returning\(\)/.exec(src)?.[0] ?? "";
    expect(insert, "the insert block must be locatable").not.toBe("");
    expect(insert, "the stamp belongs to the insert").toMatch(/historyStartAt:\s*new Date\(\)/);
  });

  /**
   * A WRITE-shaped mention of the column: `historyStartAt:` inside the
   * argument of a `.set(` or `.values(` call — never a `.select(` projection
   * or a plain response object, both of which legitimately name the field to
   * READ it (the rollups route does both, additively, and must keep doing so).
   * Scoped to a bounded window after the opening paren rather than true
   * bracket-matching — every real patch object in this codebase is well under
   * that width, and a false negative here would need an implausibly long
   * `.set(...)`/`.values(...)` argument before the field appears.
   */
  const WRITE_WINDOW = 1000;
  function findHistoryStartAtWrites(text: string): number[] {
    const hits: number[] = [];
    // AN EMPTY CALL IS NEVER A WRITE. Drizzle's `.set(...)` / `.values(...)`
    // always take an argument, while `Map.prototype.values()` takes none — and
    // the rollups aggregation now does `measured.values()` a few lines above
    // its legitimate `historyStartAt:` RESPONSE field, which tripped this scan
    // as a phantom writer. The lookahead only excludes zero-argument calls, so
    // it cannot hide a real write: `.set({...})`, `.set(patch)`, `.values(rows)`
    // all still match.
    for (const call of text.matchAll(/\.(?:set|values)\(\s*(?!\))/g)) {
      const start = call.index! + call[0].length;
      const window = text.slice(start, start + WRITE_WINDOW);
      const m = /historyStartAt\s*:/.exec(window);
      if (m) hits.push(start + m.index);
    }
    return hits;
  }

  it("no OTHER file in api-server ever WRITES historyStartAt (repo-wide, not just aforceState.ts)", () => {
    // THE GAP THIS CLOSES. `updateUserState`'s type guard, and the test above,
    // only protect callers that go through `updateUserState`. Four sites
    // build a `.update(aforceUserState).set(...)` patch DIRECTLY — status.ts's
    // `/confirm` route (now typed through the branded `SafeUserStatePatch`,
    // which excludes the column at the type level), both intake.ts
    // apply/undo paths, and the provider-kit repos (userStateRepo.ts,
    // disconnect.ts) — and a scratch patch including
    // `historyStartAt: new Date()` compiled clean through every one of their
    // shapes before this law existed. A future one-line addition to any of
    // them — or a route not yet written — would silently move a member's
    // history stamp with no compiler error and no test failure, so the
    // search has to be repo-wide and WRITE-scoped, not file-local and blind
    // to context: a naive `historyStartAt:` grep also matches the rollups
    // route's `.select({ historyStartAt: ... })` projection and its
    // `res.json({ historyStartAt: ... })` response field, both of which are
    // legitimate READS this PR's own founder ruling requires.
    const root = join(__dirname, "..", "..");
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "__tests__") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith(".ts") || full.endsWith(`${sep}aforceState.ts`)) continue;
        const text = readFileSync(full, "utf8");
        for (const idx of findHistoryStartAtWrites(text)) {
          offenders.push(`${full.slice(root.length)}:${text.slice(0, idx).split("\n").length}`);
        }
      }
    };
    walk(root);
    expect(offenders, "no writer outside aforceState.ts may set() or values() the field").toEqual([]);
  });

  it("mutation-verify: a WRITE in a sibling file is detected, a READ is not", () => {
    // Proves the scan above is not vacuous, and specifically not vacuous in
    // the direction that matters: it must flag a real write while staying
    // silent on the legitimate reads this same branch added to journal.ts.
    const scratch = join(__dirname, "..", "__scratch_historyStartAt_regression_probe.ts");
    writeFileSync(
      scratch,
      [
        "// A read must NOT trip the scan.",
        "db.select({ historyStartAt: aforceUserState.historyStartAt }).from(aforceUserState);",
        "res.json({ historyStartAt: row.historyStartAt });",
        "// Nor must an ARGUMENT-LESS .values() standing near a read — this is",
        "// the rollups aggregation's shape, and it is a Map iteration.",
        "const rows = Array.from(measured.values());",
        "return { rows, historyStartAt: stamp?.toISOString() ?? null };",
        "// A write MUST trip the scan.",
        "db.update(aforceUserState).set({ historyStartAt: new Date() });",
        "",
      ].join("\n"),
    );
    try {
      const text = readFileSync(scratch, "utf8");
      const hits = findHistoryStartAtWrites(text);
      expect(hits.length, "exactly the one .set(...) write is flagged").toBe(1);
      // ...and it is the write, not either read: the flagged offset sits just
      // inside the `.update(...).set({` call, not inside `.select(` or
      // `res.json(`.
      expect(text.slice(0, hits[0])).toMatch(/\.update\(aforceUserState\)\.set\(\{\s*$/);
    } finally {
      unlinkSync(scratch);
    }
  });

  it("mutation-verify: the empty-call refinement still catches a VARIABLE write", () => {
    // The refinement above must exclude ONLY zero-argument calls. A Drizzle
    // write that passes a variable rather than an object literal — the shape
    // that would slip past a naive `.set({` matcher — must still be flagged,
    // or the loosening would have opened the hole it was meant to avoid.
    const write = "db.update(aforceUserState).set(patchWith({ historyStartAt: d }));";
    expect(findHistoryStartAtWrites(write).length, "a variable-argument write is caught").toBe(1);
    const values = "db.insert(aforceUserState).values(buildRow({ historyStartAt: d }));";
    expect(findHistoryStartAtWrites(values).length, "so is .values(expr)").toBe(1);
    // ...while the Map read that caused the false positive stays silent.
    const read = "const out = Array.from(m.values()); return { historyStartAt: s };";
    expect(findHistoryStartAtWrites(read), "an argument-less .values() is not a write").toEqual([]);
  });

  it("updateUserState cannot express a patch that moves it", () => {
    const src = readFileSync(join(__dirname, "..", "aforceState.ts"), "utf8");
    // The TYPE is the real guard — a typed caller gets a compile error. Pinned
    // here because a future widening of the Omit would silently re-open it.
    expect(src).toMatch(
      /patch:\s*Partial<Omit<AforceUserStateRow,\s*"userId"\s*\|\s*"updatedAt"\s*\|\s*"historyStartAt">>/,
    );
    // ...and the runtime strip catches an `any`-typed caller the type cannot.
    const update = /export async function updateUserState[\s\S]*?\n}/.exec(src)?.[0] ?? "";
    expect(update, "updateUserState must be locatable").not.toBe("");
    expect(update, "the column is destructured out before the SET").toMatch(
      /const\s*\{\s*historyStartAt:[\s\S]*?\}\s*=\s*patch/,
    );
    expect(update, "the SET must use the stripped object").toMatch(/\.set\(\{\s*\.\.\.safe,/);
  });

  it("the column is NULLABLE in the schema — a NOT NULL default would fabricate tenure", () => {
    const schema = readFileSync(
      join(__dirname, "..", "..", "..", "..", "..", "lib", "db", "src", "schema", "aforce.ts"),
      "utf8",
    );
    const col = /historyStartAt:\s*timestamp\("history_start_at"[^\n]*/.exec(schema)?.[0] ?? "";
    expect(col, "the column must exist").not.toBe("");
    expect(col, "nullable: no notNull()").not.toMatch(/notNull\(\)/);
    expect(col, "and no default — now() would stamp the push date on every old row")
      .not.toMatch(/default/);
  });
});
