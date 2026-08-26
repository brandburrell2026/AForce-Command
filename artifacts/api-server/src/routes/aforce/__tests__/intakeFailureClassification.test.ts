/**
 * A fault on OUR side must never be reported as the member's bad entry.
 *
 * `POST /aforce/intake` answered `400 intake_failed` for every throw. When
 * `aforce_intake_logs` was missing four columns in production, every query threw
 * and the member was told "Not saved — entry rejected. The server wouldn't
 * accept this entry … update AForce if it keeps happening" — advice that was
 * actively wrong. Nothing about the entry was invalid and no client update could
 * have helped. One opaque status turned a schema fault into a full device-QA
 * cycle of misattribution.
 *
 * The client classifies from the status alone (`store/app/writeFailure.ts`):
 * >=500 reads as "Something broke on our end", 4xx reads as "entry rejected".
 * Returning the right status IS the fix; the member-facing copy follows.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyIntakeFailure,
  USER_STATE_MISSING,
} from "../intakeFailure";

describe("intake failure classification", () => {
  it("a schema rejection is the client's — 400", () => {
    const zodish = Object.assign(new Error("bad body"), {
      name: "ZodError",
      issues: [{ path: ["ozAmount"], message: "Expected number" }],
    });
    expect(classifyIntakeFailure(zodish)).toEqual({ kind: "invalid", status: 400 });
  });

  it("recognises a ZodError structurally, not by instanceof", () => {
    // zod can be duplicated in the dependency tree; a failed instanceof would
    // silently report a malformed body as a server fault.
    expect(classifyIntakeFailure({ issues: [{ message: "x" }] }).status).toBe(400);
  });

  it("a missing user-state row is a conflict — 409, not 400 and not 500", () => {
    expect(classifyIntakeFailure(new Error(USER_STATE_MISSING))).toEqual({
      kind: "conflict",
      status: 409,
    });
  });

  it("A MISSING DATABASE COLUMN IS 500 — never a client-invalid 4xx", () => {
    // The exact Build-65 production fault, in the shape drizzle threw it.
    const dbErr = new Error(
      'Failed query: select "id", "user_id", "entry_source", "confirmation_level" ' +
        'from "aforce_intake_logs" where ("aforce_intake_logs"."user_id" = $1)',
    );
    const failure = classifyIntakeFailure(dbErr);
    expect(failure.status, "a schema fault must not blame the member's entry").toBe(500);
    expect(failure.kind).toBe("internal");
  });

  it.each([
    ["a dropped connection", new Error("Connection terminated unexpectedly")],
    ["a bug", new TypeError("x is not a function")],
    ["a non-Error throw", "boom"],
    ["null", null],
    ["undefined", undefined],
  ])("%s is internal — 500", (_label, err) => {
    expect(classifyIntakeFailure(err).status).toBe(500);
  });

  it("only ever yields the three declared statuses", () => {
    const samples: unknown[] = [
      new Error(USER_STATE_MISSING),
      { name: "ZodError", issues: [] },
      new Error("Failed query"),
      42,
    ];
    for (const s of samples) {
      expect([400, 409, 500]).toContain(classifyIntakeFailure(s).status);
    }
  });
});

describe("the route uses the classification and leaks nothing", () => {
  const ROUTE = readFileSync(
    resolve(__dirname, "..", "intake.ts"),
    "utf8",
  );
  const stripped = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("no intake path answers a hardcoded 400 for every failure any more", () => {
    expect(
      /status\(400\)\.json\(\{\s*error:\s*"intake_failed"/.test(stripped),
      "the blanket 400 intake_failed must be gone",
    ).toBe(false);
    expect(
      /status\(400\)\.json\(\{\s*error:\s*"correction_failed"/.test(stripped),
      "the blanket 400 correction_failed must be gone",
    ).toBe(false);
  });

  it("both catch blocks classify", () => {
    const catches = [...stripped.matchAll(/catch \(err\)/g)].length;
    const classified = [...stripped.matchAll(/classifyIntakeFailure\(err\)/g)].length;
    expect(classified, "every catch in the intake path must classify").toBe(catches);
  });

  it("the response body carries a stable code, never the error text", () => {
    // Postgres errors carry table names, column names and bound parameters.
    // Those are operator diagnostics; they must not reach a client.
    for (const m of stripped.matchAll(/res\.status\([^)]*\)\.json\(([^;]*)\)/g)) {
      const body = m[1] ?? "";
      expect(body, `response body leaks error detail: ${body}`).not.toMatch(
        /err\b|\.message|serializeError|issues|stack/,
      );
    }
  });

  it("the full error still reaches the log", () => {
    // Classification must not cost us the diagnosis — the reason the Build-65
    // fault was findable at all was the server-side log.
    expect(stripped).toMatch(/logger\.error\(\s*\{\s*err: serializeError\(err\)/);
  });
});
