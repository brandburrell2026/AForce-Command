/**
 * `GET /aforce/journal/rollups` — the route ACTUALLY densifies.
 *
 * WHY THIS FILE EXISTS. The first densification attempt shipped a
 * "route-wiring" law that mutated the route's source text via `.replace()`
 * and asserted the mutated STRING contained the right substrings — which
 * only proves `String.prototype.replace` succeeded, not that the route
 * would fail without the real wiring. This is the honest replacement.
 *
 * The route now delegates its entire aggregation to
 * `buildJournalRollupsResponse` (lib/journalRollupsAggregation.ts, fully
 * execution-tested in journalRollupsAggregation.test.ts) and responds with
 * exactly that function's return value. So proving "the route densifies" no
 * longer requires re-deriving the aggregation logic here — it only requires
 * proving the route's remaining shell (fetch → call → respond) has nothing
 * left in it to diverge. That is a THIN, honest check specifically because
 * the route is now thin for real.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "journal.ts"), "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, "");

/**
 * THE REAL GUARD, extracted so it can run against more than one string.
 * Throws (via a failing `expect`) on anything that re-implements the
 * aggregation inline instead of delegating to the extracted function.
 */
function assertRouteDelegatesToAggregation(code: string): void {
  const handlerStart = code.indexOf('router.get("/journal/rollups"');
  expect(handlerStart, "the handler must be locatable").toBeGreaterThan(-1);
  const handlerEnd = code.indexOf("});", code.indexOf("export default router;") > -1
    ? Math.min(code.indexOf("export default router;"), handlerStart + 4000)
    : handlerStart + 4000);
  const handler = code.slice(handlerStart, handlerEnd);

  // The response is EXACTLY the extracted function's return value — not a
  // locally reconstructed object, and not a partial pass-through.
  //
  // The canary PR bound it to a const so the served-counter can read the BUILT
  // response rather than the request flag (counting the flag would make
  // `rollups_served` a restatement of `rollups_requested`). The guarantee is
  // unchanged and both prohibitions below still hold: what is returned is the
  // function's own return value, whole and unmodified.
  expect(handler).toMatch(
    /const built = buildJournalRollupsResponse\(\{/,
  );
  expect(handler).toMatch(/return res\.json\(built\);/);
  // Nothing may be spread, patched or reshaped on the way out.
  expect(handler, 'the built response must not be reshaped').not.toMatch(
    /res\.json\(\{\s*\.\.\.built/,
  );
  // Every field the aggregation needs is threaded through from the real fetch
  // results. THE ASSERTIONS MUST BE SCOPED TO THE CALL: `snapshots,` /
  // `intakes,` / `correctionRows,` / `days,` all appear on the DESTRUCTURING
  // line at the top of the handler too, so matching them against the whole
  // handler passed even when the call itself hardcoded them — the exact
  // vacuity the adversarial gate caught. Slice to the call's own argument
  // object first.
  const callStart = handler.indexOf('buildJournalRollupsResponse({');
  expect(callStart, 'the aggregation call must be locatable').toBeGreaterThan(-1);
  const call = handler.slice(callStart, handler.indexOf('}),', callStart));
  expect(call).toMatch(/\bsnapshots,/);
  expect(call).toMatch(/\bintakes,/);
  expect(call).toMatch(/\bcorrectionRows,/);
  expect(call).toMatch(/historyStartAt:\s*stateRows\[0\]\?\.historyStartAt\s*\?\?\s*null,/);
  expect(call).toMatch(/\bdays,/);
  expect(call).toMatch(/now:\s*new Date\(\),/);
  // THE CAPABILITY REACHES THE AGGREGATION. Parsing `dense` and then not
  // passing it would leave the aggregation on its own default and make the
  // whole opt-in cosmetic.
  expect(call).toMatch(/dense:\s*dense === 1,/);
  expect(call, 'the capability must not be hardcoded on').not.toMatch(/dense:\s*true/);
  // ...and nothing in the call is hardcoded away from the fetched values.
  expect(call, 'snapshots must not be stubbed').not.toMatch(/snapshots:\s*\[\]/);
  expect(call, 'intakes must not be stubbed').not.toMatch(/intakes:\s*\[\]/);
  expect(call, 'the history stamp must not be discarded').not.toMatch(/historyStartAt:\s*null,/);

  // NOTHING ELSE may build a `rollups` array in this handler — the whole
  // point of the extraction is that there is exactly one place this happens.
  expect(handler).not.toMatch(/const\s+acc\s*=\s*new Map/);
  expect(handler).not.toMatch(/function ensure\(/);
  expect(handler).not.toMatch(/densifyRollups\(/);
}

/**
 * THE CAPABILITY IS OPT-IN AT THE ROUTE.
 *
 * The schema itself is executed in lib/__tests__/journalRollupsQuery.test.ts —
 * that is where "no param means sparse" is actually proven. What CANNOT be
 * executed here (the route imports `db` at module scope, which is why its own
 * suites are DB-gated) is that this handler uses that schema rather than a
 * second, looser one of its own. That is what this guard holds.
 */
function assertCapabilityIsOptIn(code: string): void {
  expect(code).toContain(
    'import { rollupsQuery } from "../../lib/journalRollupsQuery";',
  );
  // The handler parses through the extracted contract...
  expect(code).toMatch(/const \{ days, dense \} = rollupsQuery\.parse\(req\.query\);/);
  // ...and NOT through a locally redeclared schema that could drift from it.
  expect(code, 'the capability schema must not be redeclared inline').not.toMatch(
    /dense:\s*z\.coerce/,
  );

  // THE CAPABILITY MUST NOT LEAK ONTO A ROUTE THAT IGNORES IT. `daysQuery` is
  // shared with /journal/timeline; folding `dense` into it would advertise a
  // contract that route does not honour.
  expect(code).toMatch(/const daysQuery = z\.object\(\{\s*days:/);
  const daysDecl = code.slice(code.indexOf("const daysQuery"), code.indexOf("const daysQuery") + 200);
  expect(daysDecl).not.toMatch(/dense/);
  const timelineStart = code.indexOf('router.get("/journal/timeline"');
  expect(timelineStart, "the timeline handler must be locatable").toBeGreaterThan(-1);
  const timeline = code.slice(timelineStart, timelineStart + 400);
  expect(timeline).toMatch(/daysQuery\.parse\(req\.query\)/);
  expect(timeline).not.toMatch(/rollupsQuery/);
}

describe("GET /journal/rollups delegates its entire response to buildJournalRollupsResponse", () => {
  it("imports the aggregation function — not the lower-level dense-range helpers directly", () => {
    expect(CODE).toContain(
      'import { buildJournalRollupsResponse } from "../../lib/journalRollupsAggregation";',
    );
    // The route no longer needs the dense-range primitives itself — importing
    // them here would mean the aggregation is (at least partly) reimplemented
    // inline again, the exact regression this file exists to catch.
    expect(CODE).not.toMatch(/from ["']\.\.\/\.\.\/lib\/journalDenseRange["']/);
  });

  it("the handler is a thin shell: fetch, delegate, respond", () => {
    assertRouteDelegatesToAggregation(CODE);
  });

  it("mutation-verify: reintroducing the inline aggregation is detectable", () => {
    // A HAND-WRITTEN regressed handler — the literal pre-extraction shape —
    // run through the SAME assertion function the real law above uses, so
    // drift between the two is structurally impossible (the vacuity this
    // program has hit before came from a mutated-string check that was never
    // re-validated against the real guard).
    const regressed = `
      router.get("/journal/rollups", async (req, res) => {
        try {
          const { days } = daysQuery.parse(req.query);
          const [snapshots, intakes, correctionRows, stateRows] = await Promise.all([]);
          const acc = new Map();
          function ensure(date) { return acc.get(date); }
          const rollups = densifyRollups(acc, []);
          return res.json({ rollups, days });
        } catch (err) {}
      });
      export default router;
    `;
    expect(() => assertRouteDelegatesToAggregation(regressed)).toThrow();
  });

  it("mutation-verify: silently discarding the real historyStartAt is detectable", () => {
    const regressed = CODE.replace(
      "historyStartAt: stateRows[0]?.historyStartAt ?? null,",
      "historyStartAt: null,",
    );
    expect(regressed).not.toBe(CODE); // the replacement must have actually applied
    expect(() => assertRouteDelegatesToAggregation(regressed)).toThrow();
  });

  it("the dense contract is requested by the caller, never assumed by the route", () => {
    assertCapabilityIsOptIn(CODE);
  });

  it("mutation-verify: folding the capability into the shared schema is detectable", () => {
    // ONLY the leak is introduced. The earlier version ALSO deleted the
    // `rollupsQuery` import, and since the guard checks that import first, the
    // throw was guaranteed by the deletion — the leak assertion was never
    // reached and could have been broken without anyone noticing.
    const regressed = CODE.replace(
      "const daysQuery = z.object({",
      "const daysQuery = z.object({\n  dense: z.coerce.number().default(1),",
    );
    expect(regressed).not.toBe(CODE);
    expect(regressed).toContain('import { rollupsQuery } from "../../lib/journalRollupsQuery";');
    expect(() => assertCapabilityIsOptIn(regressed)).toThrow();
  });

  it("mutation-verify: dropping the extracted schema import is SEPARATELY detectable", () => {
    const regressed = CODE.replace(
      'import { rollupsQuery } from "../../lib/journalRollupsQuery";',
      "",
    );
    expect(regressed).not.toBe(CODE);
    expect(() => assertCapabilityIsOptIn(regressed)).toThrow();
  });

  it("mutation-verify: parsing the capability and not forwarding it is detectable", () => {
    const regressed = CODE.replace("dense: dense === 1,", "dense: true,");
    expect(regressed).not.toBe(CODE);
    expect(() => assertRouteDelegatesToAggregation(regressed)).toThrow();
  });
});
