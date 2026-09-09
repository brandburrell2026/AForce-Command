/**
 * S1-2B · SCHEMA-INTEGRITY GUARD — real PostgreSQL, db-lane only.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * The S1-2A experiment established, against a real PostgreSQL 16.14, that
 * `drizzle-kit push` 0.31.9 compares these objects by PRESENCE, not by
 * DEFINITION. Measured, not assumed:
 *
 *   detected      a missing CHECK; a missing index; uniqueness changed;
 *                 index columns changed; a new column
 *   NOT detected  a CHECK predicate widened to admit a third status
 *                 a partial-index WHERE predicate changed
 *
 * So `push` reporting "No changes detected" does NOT mean the database
 * enforces what the schema file declares. A constraint can be silently
 * redefined — in the file or in the database — and the two diverge with no
 * signal. Deletion is caught; corruption is not.
 *
 * That is the precise gap this guard closes, and nothing else in the repo
 * closes it: `analyticsIdentitySchema.test.ts` asserts the DRIZZLE
 * DECLARATIONS (what we asked for), while this asserts the POSTGRES CATALOG
 * (what we actually got) plus the BEHAVIOUR (what it actually enforces).
 *
 * ── WHY CATALOG FIELDS, NOT JUST `indexdef` ────────────────────────────────
 *
 * Uniqueness, partial-ness and the indexed column are each read from a
 * STRUCTURED catalog field — `pg_index.indisunique`, `pg_index.indpred`, and
 * the `pg_attribute` join through `indkey` — not inferred from substrings of
 * one `indexdef` blob. A single string comparison would let a change in one
 * property be masked by the rest of the string still matching, and it would
 * fail for uninteresting formatting reasons. `indexdef` is asserted too, as a
 * belt-and-braces whole-definition pin, but it is not the load-bearing check.
 *
 * ── WHERE THIS RUNS ────────────────────────────────────────────────────────
 *
 * DB LANE ONLY: `describe.runIf(DB_TESTS)`. In the unit lane DB_TESTS is
 * unset and every case skips. In CI the db-lane job provisions a THROWAWAY
 * `postgres:16` service container on 127.0.0.1 and applies the schema to it
 * (ci.yml). This guard never targets a shared or production database — it has
 * no connection string of its own and inherits whatever the lane provides.
 *
 * Every probe that writes does so inside a transaction that is ALWAYS rolled
 * back, and the final case proves all three S1 tables are empty afterwards.
 */
import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";

import { db } from "../../index";

// Real Postgres required — db lane only (`pnpm test:db`).
const DB = Boolean(process.env["DB_TESTS"]);

const TABLE = "aforce_analytics_identities";
const IDX = "aforce_analytics_identities_analytics_id_uq";

/**
 * The canonical definitions PostgreSQL 16 produced for these declarations,
 * captured verbatim from the S1-2A experiment. PostgreSQL deparses a stored
 * constraint from its parse tree rather than preserving source text, so these
 * are what the catalog reports — NOT the text of the schema file.
 */
const EXPECTED_CHECKS: Record<string, string> = {
  aforce_analytics_identities_status_enum:
    "CHECK ((status = ANY (ARRAY['active'::text, 'suppressed'::text])))",
  aforce_analytics_identities_suppressed_has_no_id:
    "CHECK (((status <> 'suppressed'::text) OR (analytics_id IS NULL)))",
};

const EXPECTED_INDEX_PREDICATE = "(analytics_id IS NOT NULL)";

/** The violated constraint name, unwrapping Drizzle's error wrapper. */
function constraintOf(e: unknown): string | null {
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur; i++) {
    const c = (cur as { constraint?: unknown }).constraint;
    if (typeof c === "string" && c.length > 0) return c;
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}

/** Run `fn` inside a transaction that is ALWAYS rolled back. */
async function inRolledBackTx(fn: (tx: unknown) => Promise<void>): Promise<void> {
  const SENTINEL = Symbol("rollback");
  try {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw SENTINEL;
    });
  } catch (e) {
    if (e !== SENTINEL) throw e;
  }
}

/**
 * Attempt an insert inside a rolled-back transaction.
 * Resolves to the violated constraint name, or null when accepted.
 */
async function tryInsert(
  rows: ReadonlyArray<[string, string | null, string]>,
): Promise<string | null> {
  let violated: string | null = null;
  await inRolledBackTx(async (tx) => {
    const t = tx as { execute: (q: unknown) => Promise<unknown> };
    for (const [userId, analyticsId, status] of rows) {
      await t.execute(sql`
        insert into aforce_analytics_identities (user_id, analytics_id, status)
        values (${userId}, ${analyticsId}, ${status})
      `);
    }
  }).catch((e: unknown) => {
    // Drizzle wraps driver errors, so the pg error — and therefore the
    // `constraint` field naming WHICH invariant fired — lives on `.cause`.
    // Reading only the top-level error yields "Failed query: …" and the probe
    // could not tell a constraint violation from a syntax error.
    violated = constraintOf(e) ?? "unknown";
  });
  return violated;
}

describe.runIf(DB)("S1-2B · CHECK constraints as PostgreSQL actually stored them", () => {
  it.each(Object.keys(EXPECTED_CHECKS))(
    "%s matches its canonical definition exactly",
    async (name) => {
      const res = await db.execute(sql`
        select conname, pg_get_constraintdef(oid) as def
          from pg_constraint
         where conrelid = ${TABLE}::regclass and contype = 'c' and conname = ${name}
      `);
      const rows = (res as unknown as { rows: Array<{ def: string }> }).rows;
      expect(rows.length, `${name} is MISSING from the database`).toBe(1);
      // The whole predicate, not a substring: a widened enum or a weakened
      // disjunction changes this string, and `push` would not have noticed.
      expect(rows[0]!.def).toBe(EXPECTED_CHECKS[name]);
    },
  );

  it("the table carries EXACTLY these two CHECKs — no more, no fewer", async () => {
    const res = await db.execute(sql`
      select conname from pg_constraint
       where conrelid = ${TABLE}::regclass and contype = 'c'
       order by conname
    `);
    const names = (res as unknown as { rows: Array<{ conname: string }> }).rows.map(
      (r) => r.conname,
    );
    expect(names).toEqual(Object.keys(EXPECTED_CHECKS).sort());
  });
});

describe.runIf(DB)("S1-2B · the partial unique index, proved from catalog fields", () => {
  async function indexFacts() {
    const res = await db.execute(sql`
      select
        i.indisunique                                   as is_unique,
        (i.indpred is not null)                         as is_partial,
        pg_get_expr(i.indpred, i.indrelid)              as predicate,
        json_agg(a.attname order by a.attnum)           as columns
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where c.relname = ${IDX}
      group by i.indisunique, i.indpred, i.indrelid
    `);
    return (res as unknown as {
      rows: Array<{
        is_unique: boolean;
        is_partial: boolean;
        predicate: string;
        columns: string[];
      }>;
    }).rows;
  }

  it("exists", async () => {
    expect((await indexFacts()).length, `${IDX} is MISSING`).toBe(1);
  });

  it("is UNIQUE — read from pg_index.indisunique, not from a string", async () => {
    expect((await indexFacts())[0]!.is_unique).toBe(true);
  });

  it("is PARTIAL — read from pg_index.indpred", async () => {
    // Without the predicate the index is still unique, so uniqueness alone
    // cannot detect this: a non-partial unique index would reject the SECOND
    // suppressed member (they all hold NULL analytics_id).
    expect((await indexFacts())[0]!.is_partial).toBe(true);
  });

  it("its predicate is exactly the approved one", async () => {
    expect((await indexFacts())[0]!.predicate).toBe(EXPECTED_INDEX_PREDICATE);
  });

  it("indexes exactly the analytics_id column", async () => {
    // json_agg, not array_agg: the driver returns a raw Postgres array as the
    // literal string "{analytics_id}", which would have made a toEqual on a
    // JS array fail for a formatting reason rather than a real one.
    expect((await indexFacts())[0]!.columns).toEqual(["analytics_id"]);
  });

  it("its whole indexdef is pinned too (belt and braces)", async () => {
    const res = await db.execute(sql`
      select indexdef from pg_indexes where schemaname = 'public' and indexname = ${IDX}
    `);
    const def = (res as unknown as { rows: Array<{ indexdef: string }> }).rows[0]!.indexdef;
    expect(def).toBe(
      `CREATE UNIQUE INDEX ${IDX} ON public.${TABLE} USING btree (analytics_id) ` +
        `WHERE (analytics_id IS NOT NULL)`,
    );
  });
});

describe.runIf(DB)("S1-2B · behavioural probes against real PostgreSQL", () => {
  // POSITIVE CONTROLS. Without these a guard that rejected every database —
  // or a database that rejected every write — would pass the negative cases
  // and be indistinguishable from a correct one.
  it("1 · accepts status 'active'", async () => {
    expect(await tryInsert([["s1probe_a", "anon_probe_a1", "active"]])).toBeNull();
  });

  it("2 · accepts status 'suppressed'", async () => {
    expect(await tryInsert([["s1probe_b", null, "suppressed"]])).toBeNull();
  });

  it("4 · accepts suppressed + NULL analytics_id", async () => {
    expect(await tryInsert([["s1probe_c", null, "suppressed"]])).toBeNull();
  });

  it("6 · accepts two different users both holding NULL analytics_id", async () => {
    // The partial predicate is what makes this legal.
    expect(
      await tryInsert([
        ["s1probe_d1", null, "suppressed"],
        ["s1probe_d2", null, "suppressed"],
      ]),
    ).toBeNull();
  });

  it("8 · accepts two different non-null analytics ids", async () => {
    expect(
      await tryInsert([
        ["s1probe_e1", "anon_probe_e1", "active"],
        ["s1probe_e2", "anon_probe_e2", "active"],
      ]),
    ).toBeNull();
  });

  // NEGATIVE CASES — each must be refused by the NAMED constraint, so a
  // rejection for an unrelated reason cannot be mistaken for enforcement.
  it.each([["zombie"], ["archived"], [""], ["Active"], ["ACTIVE"], ["deleted"]])(
    "3 · rejects invalid status %j",
    async (status) => {
      expect(await tryInsert([["s1probe_f", "anon_probe_f1", status]])).toBe(
        "aforce_analytics_identities_status_enum",
      );
    },
  );

  it("5 · rejects suppressed + non-null analytics_id", async () => {
    expect(await tryInsert([["s1probe_g", "anon_probe_g1", "suppressed"]])).toBe(
      "aforce_analytics_identities_suppressed_has_no_id",
    );
  });

  it("7 · rejects two different users sharing one non-null analytics_id", async () => {
    expect(
      await tryInsert([
        ["s1probe_h1", "anon_probe_dup", "active"],
        ["s1probe_h2", "anon_probe_dup", "active"],
      ]),
    ).toBe(IDX);
  });
});

describe.runIf(DB)("S1-2B · the probes left nothing behind", () => {
  it.each([
    "aforce_analytics_identities",
    "aforce_analytics_consent_state",
    "aforce_analytics_consent_events",
  ])("%s holds zero rows", async (table) => {
    const res = await db.execute(
      sql`select count(*)::int as n from ${sql.identifier(table)}`,
    );
    expect((res as unknown as { rows: Array<{ n: number }> }).rows[0]!.n).toBe(0);
  });
});
