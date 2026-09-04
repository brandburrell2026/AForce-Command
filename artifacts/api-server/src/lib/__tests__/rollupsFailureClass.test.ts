/**
 * ROLLUPS FAILURE CLASSIFICATION — and the one law the whole canary rests on.
 *
 * The obvious implementation of this classifier is `err.code === "42703"`, and
 * it is DEAD CODE. drizzle-orm wraps every driver error in a
 * `DrizzleQueryError` that sets `this.cause` and copies nothing else, so the
 * SQLSTATE is never at the top level. A canary shipped that way would typecheck,
 * pass every other test in this repo, and report every schema outage as an
 * aggregation bug — the exact inversion it exists to prevent, silently, in
 * production only.
 *
 * So the first test below constructs a REAL `DrizzleQueryError` — not a
 * hand-made `{ code }` object, which would pass against the broken
 * implementation and prove nothing.
 */
import { describe, it, expect } from "vitest";
import { DrizzleQueryError } from "drizzle-orm";
import { classifyRollupsFailure, pgSqlState } from "../rollupsFailureClass";

/** A driver error as `pg` actually throws it, wrapped as drizzle actually wraps it. */
const wrapped = (code: string, message = "boom") =>
  new DrizzleQueryError("select 1", [], Object.assign(new Error(message), { code }));

describe("THE LOAD-BEARING LAW — a real DrizzleQueryError is classified as schema", () => {
  it("42703 undefined_column, wrapped exactly as drizzle wraps it", () => {
    const err = wrapped("42703", 'column "history_start_at" does not exist');
    // THE PROOF THAT THE NAIVE READ IS DEAD CODE. If this assertion ever
    // fails, drizzle stopped wrapping and the walk could be simplified — but
    // until then, `err.code` is undefined and any classifier reading it is
    // permanently silent.
    expect((err as unknown as { code?: unknown }).code).toBeUndefined();
    expect(err.name).toBe("Error"); // not even a distinctive name to match on

    expect(classifyRollupsFailure(err)).toEqual({
      kind: "schema", status: 500, sqlState: "42703",
    });
  });

  it("the SQLSTATE is reachable only through the cause chain", () => {
    expect(pgSqlState(wrapped("42703"))).toBe("42703");
    expect(pgSqlState({ code: "42703" })).toBe("42703");        // already top-level
    expect(pgSqlState({ cause: { cause: { code: "42P01" } } })).toBe("42P01"); // nested
  });

  it.each(["42P01", "42P07", "42883", "42704", "3F000"])(
    "%s is also a schema fault — an un-run migration, not a bug",
    (code) => {
      expect(classifyRollupsFailure(wrapped(code)).kind).toBe("schema");
    },
  );
});

describe("the other three kinds", () => {
  it("a ZodError-shaped throw is the ONLY 400", () => {
    // Structural, not `instanceof` — zod may be duplicated in the tree, and a
    // failed instanceof would report a bad query string as a server fault.
    expect(classifyRollupsFailure({ name: "ZodError", issues: [] })).toEqual({
      kind: "bad_request", status: 400,
    });
    expect(classifyRollupsFailure({ issues: [{ path: ["days"] }] }).status).toBe(400);
  });

  it("THE ZOD TRAP: the query parse is inside the try, so a bad ?days= lands here", () => {
    // `rollupsQuery.parse(req.query)` throws into the same catch as a dead
    // database. A ZodError carries no `.code` and no `.cause`, so without the
    // structural check it would fall through to `aggregation` and answer 500 —
    // telling a client its own bad request was our outage.
    const zodish = { name: "ZodError", issues: [{ code: "too_big", path: ["days"] }] };
    expect(pgSqlState(zodish)).toBeUndefined();
    expect(classifyRollupsFailure(zodish).kind).toBe("bad_request");
  });

  it("any other database-reported error is `db`, not `schema`", () => {
    expect(classifyRollupsFailure(wrapped("23505")).kind).toBe("db");   // unique_violation
    expect(classifyRollupsFailure(wrapped("57014")).kind).toBe("db");   // query_canceled
    expect(classifyRollupsFailure(wrapped("08006")).kind).toBe("db");   // connection_failure
  });

  it("a throw carrying no SQLSTATE anywhere is ours — `aggregation`", () => {
    expect(classifyRollupsFailure(new TypeError("x is not a function"))).toEqual({
      kind: "aggregation", status: 500,
    });
    expect(classifyRollupsFailure("a string").kind).toBe("aggregation");
    expect(classifyRollupsFailure(null).kind).toBe("aggregation");
    expect(classifyRollupsFailure(undefined).kind).toBe("aggregation");
  });
});

describe("the walk cannot become a second failure", () => {
  it("a cyclic cause chain terminates instead of hanging", () => {
    const a: Record<string, unknown> = { name: "A" };
    const b: Record<string, unknown> = { name: "B", cause: a };
    a.cause = b;
    expect(pgSqlState(a)).toBeUndefined();
    expect(classifyRollupsFailure(a).kind).toBe("aggregation");
  });

  it("a SQLSTATE buried deeper than the depth limit reads as aggregation, not as a crash", () => {
    // Honest limitation, stated rather than hidden: five levels is deeper than
    // drizzle nests, and a runaway walk inside a catch block would turn one
    // failure into two.
    const deep = { cause: { cause: { cause: { cause: { cause: { code: "42703" } } } } } };
    expect(pgSqlState(deep)).toBeUndefined();
    expect(classifyRollupsFailure(deep).kind).toBe("aggregation");
  });

  it("a non-string code is not mistaken for a SQLSTATE", () => {
    expect(pgSqlState({ code: 42703 })).toBeUndefined();
    expect(pgSqlState({ code: "" })).toBeUndefined();
  });
});

describe("nothing derived from the error reaches a client", () => {
  it("the failure carries only a stable kind, a status, and the SQLSTATE for the log", () => {
    const f = classifyRollupsFailure(
      wrapped("42703", 'column "history_start_at" of relation "aforce_user_state" does not exist'),
    );
    // Postgres messages carry table names, column names and bound parameters.
    // That is operator diagnostics and belongs in the log, never in a body.
    expect(Object.keys(f).sort()).toEqual(["kind", "sqlState", "status"]);
    expect(JSON.stringify(f)).not.toMatch(/aforce_user_state|does not exist|select/i);
  });
});
