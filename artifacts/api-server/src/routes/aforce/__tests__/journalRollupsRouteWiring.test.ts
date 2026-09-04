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
  expect(handler).toMatch(
    /return res\.json\(\s*buildJournalRollupsResponse\(\{/,
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
});
