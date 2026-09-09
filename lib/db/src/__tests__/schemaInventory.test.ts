/**
 * Laws for the catalog-inventory delta classifier.
 *
 * THE DEFECT THESE PIN. The S1-2 production apply was reviewed against an
 * expected delta of 14 objects, measured on PostgreSQL 16. Production —
 * PostgreSQL 18.6 — returned 29. The extra 15 were catalogued NOT NULL
 * constraints, which PG17+ records in pg_constraint and PG16 does not record
 * at all. Same DDL, different catalogue representation.
 *
 * A count-based check cannot tell that from real drift. The danger runs in
 * BOTH directions, and both are pinned below: a version artifact must not be
 * reported as drift, and drift must never be excused as a version artifact.
 *
 * Pure functions, unit lane, no database required.
 */
import { describe, it, expect } from "vitest";

import {
  classifyDelta,
  INVENTORY_SQL,
  S1_EXPECTED_DELTA,
  type InventoryRow,
} from "../schemaInventory";

const row = (kind: string, name: string, detail = ""): InventoryRow => ({ kind, name, detail });

/** A minimal pre-state standing in for "the database before the apply". */
const PRE: InventoryRow[] = [
  row("table", "aforce_user_state"),
  row("index", "aforce_user_state_pkey", "CREATE UNIQUE INDEX …"),
];

/** Everything the reviewed S1-2 apply adds on PostgreSQL 18. */
function postPg18(): InventoryRow[] {
  const added = [
    ...S1_EXPECTED_DELTA.explicit,
    ...S1_EXPECTED_DELTA.implied,
    ...S1_EXPECTED_DELTA.catalogued.map((c) => c.key),
  ].map((k) => {
    const [kind, name] = k.split("|") as [string, string];
    return row(kind, name);
  });
  return [...PRE, ...added];
}

/** The same apply on PostgreSQL 16: no catalogued NOT NULL rows exist. */
function postPg16(): InventoryRow[] {
  const added = [...S1_EXPECTED_DELTA.explicit, ...S1_EXPECTED_DELTA.implied].map((k) => {
    const [kind, name] = k.split("|") as [string, string];
    return row(kind, name);
  });
  return [...PRE, ...added];
}

describe("classifyDelta — the reviewed S1-2 apply", () => {
  it("PostgreSQL 18: every added object is classified, none unexpected", () => {
    const r = classifyDelta(PRE, postPg18(), S1_EXPECTED_DELTA);
    expect(r.explicit).toHaveLength(7);
    expect(r.implied).toHaveLength(7);
    expect(r.catalogued).toHaveLength(15);
    expect(r.unexpected).toEqual([]);
    expect(r.removed).toEqual([]);
    expect(r.changed).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.ok).toBe(true);
    // 7 + 7 + 15 = 29 — exactly the production delta, fully accounted for.
    expect(r.explicit.length + r.implied.length + r.catalogued.length).toBe(29);
  });

  it("PostgreSQL 16: the same apply is OK with the catalogued group absent", () => {
    // The version-specific rows simply do not exist on PG16. That is not a
    // missing object and must not fail — otherwise the classifier would force
    // the two lanes to disagree about an identical schema.
    const r = classifyDelta(PRE, postPg16(), S1_EXPECTED_DELTA);
    expect(r.catalogued).toEqual([]);
    expect(r.unexpected).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.explicit.length + r.implied.length).toBe(14);
  });
});

describe("classifyDelta — real drift is never excused", () => {
  it("an unrecognised NOT NULL constraint is UNEXPECTED, not waved through as a version artifact", () => {
    // The subtle failure this guards: the PG18 lesson could be over-applied
    // into "contype:n rows are always fine". They are fine only for the
    // columns the reviewed DDL declared NOT NULL.
    const post = [...postPg18(), row("constraint:n", "aforce_analytics_identities_secret_col_not_null")];
    const r = classifyDelta(PRE, post, S1_EXPECTED_DELTA);
    expect(r.unexpected).toEqual([
      "constraint:n|aforce_analytics_identities_secret_col_not_null",
    ]);
    expect(r.ok).toBe(false);
  });

  it("an unexpected TABLE is drift", () => {
    const post = [...postPg18(), row("table", "aforce_secret_side_table")];
    const r = classifyDelta(PRE, post, S1_EXPECTED_DELTA);
    expect(r.unexpected).toEqual(["table|aforce_secret_side_table"]);
    expect(r.ok).toBe(false);
  });

  it("a removed object is a stop condition", () => {
    const post = postPg18().filter((x) => x.name !== "aforce_user_state");
    const r = classifyDelta(PRE, post, S1_EXPECTED_DELTA);
    expect(r.removed).toEqual(["table|aforce_user_state"]);
    expect(r.ok).toBe(false);
  });

  it("a CHANGED definition on a pre-existing object is a stop condition", () => {
    // The apply must not silently redefine anything that was already there.
    const pre = [row("index", "aforce_user_state_pkey", "CREATE UNIQUE INDEX … (user_id)")];
    const post = [row("index", "aforce_user_state_pkey", "CREATE UNIQUE INDEX … (something_else)")];
    const r = classifyDelta(pre, post, S1_EXPECTED_DELTA);
    expect(r.changed).toEqual(["index|aforce_user_state_pkey"]);
    expect(r.ok).toBe(false);
  });

  it("an explicit object that never arrived is MISSING", () => {
    const post = postPg18().filter((x) => x.name !== "aforce_analytics_identities_status_enum");
    const r = classifyDelta(PRE, post, S1_EXPECTED_DELTA);
    expect(r.missing).toEqual([
      "constraint:c|aforce_analytics_identities_status_enum",
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("the inventory query itself", () => {
  it("casts contype — without it PostgreSQL raises 42725", () => {
    // `contype` is "char"; `'constraint:'||contype` fails with
    // "operator is not unique: unknown || \"char\"". Learned the hard way.
    expect(INVENTORY_SQL).toContain("contype::text");
  });

  it("covers all four object classes the review depends on", () => {
    for (const src of ["pg_tables", "pg_indexes", "pg_constraint", "pg_sequences"]) {
      expect(INVENTORY_SQL).toContain(src);
    }
  });

  it("every catalogued entry carries a written reason", () => {
    for (const c of S1_EXPECTED_DELTA.catalogued) {
      expect(c.reason.length, `${c.key} has no reason`).toBeGreaterThan(40);
    }
  });
});
