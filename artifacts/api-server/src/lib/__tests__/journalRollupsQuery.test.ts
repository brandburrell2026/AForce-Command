/**
 * The `/journal/rollups` query contract — EXECUTED.
 *
 * The founder's rollout ruling turns on one behavior: a request that does not
 * ask for the capability must parse as SPARSE. Everything else in the
 * compatibility layer is downstream of that. These run the real schema.
 */
import { describe, it, expect } from "vitest";
import { rollupsQuery } from "../journalRollupsQuery";

describe("dense is opt-in: the legacy request parses as sparse", () => {
  it("THE LEGACY REQUEST — no params at all — is sparse", () => {
    expect(rollupsQuery.parse({})).toEqual({ days: 7, dense: 0 });
  });

  it("the request an installed build actually sends is sparse", () => {
    // `fetchJournalRollups` on origin/main emits exactly `?days=N`.
    expect(rollupsQuery.parse({ days: "30" })).toEqual({ days: 30, dense: 0 });
  });

  it("dense=1 requests the capability", () => {
    expect(rollupsQuery.parse({ days: "7", dense: "1" })).toEqual({ days: 7, dense: 1 });
  });

  it("dense=0 is an explicit sparse request, not a truthy string", () => {
    // THE COERCION TRAP. `z.coerce.boolean()` treats every non-empty string as
    // true, so `dense=0` would have requested DENSE — the forbidden default,
    // reintroduced by a type coercion nobody would think to test.
    expect(rollupsQuery.parse({ dense: "0" }).dense).toBe(0);
  });

  it("EVERY unrecognised value fails CLOSED to sparse, and never 400s", () => {
    // Two things at once. It must never OVER-SERVE: no spelling of the param
    // other than "1" may hand a client the dense contract. And it must never
    // turn a request that works today into an error — this route has always
    // ignored parameters it did not recognise, and its catch block converts a
    // parse throw into HTTP 400 `rollups_failed`, so a strict schema would
    // break a proxy-rewritten or shared deep link that appends junk.
    for (const junk of ["false", "true", "0", "2", "-1", "yes", "abc", "", "01", " 1"]) {
      expect(rollupsQuery.parse({ dense: junk }).dense, `dense=${junk}`).toBe(0);
    }
    // Express hands a repeated `?dense=1&dense=1` over as an ARRAY, which a
    // numeric coercion turns into NaN and a 400.
    expect(rollupsQuery.parse({ dense: ["1", "1"] }).dense).toBe(0);
    expect(rollupsQuery.parse({ dense: undefined }).dense).toBe(0);
    // ANTI-VACUITY: the exact request is still honoured.
    expect(rollupsQuery.parse({ dense: "1" }).dense).toBe(1);
  });

  it("unknown params are ignored — an old client's extras cannot 400 it", () => {
    expect(rollupsQuery.parse({ days: "7", cacheBust: "abc" })).toEqual({ days: 7, dense: 0 });
  });

  it("the `days` contract is untouched by the addition", () => {
    expect(rollupsQuery.parse({ days: "1" }).days).toBe(1);
    expect(rollupsQuery.parse({ days: "365" }).days).toBe(365);
    expect(() => rollupsQuery.parse({ days: "0" })).toThrow();
    expect(() => rollupsQuery.parse({ days: "366" })).toThrow();
    expect(() => rollupsQuery.parse({ days: "abc" })).toThrow();
  });
});
