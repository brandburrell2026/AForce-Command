import { z } from "zod";

/**
 * The query contract for `GET /aforce/journal/rollups`.
 *
 * EXTRACTED SO IT IS EXECUTABLE. The route module imports `db` at the top
 * level, so a test cannot import it without a database — which is why this
 * route's own suites are DB-gated and skipped locally. The single most
 * important behavior in the whole rollout ruling is "a request with no
 * capability parameter parses as SPARSE", and that must be provable by
 * running it, not by scanning the route's source for a `.default(0)` and
 * trusting zod to mean what it looks like it means.
 *
 * DEFAULT OFF, DELIBERATELY. An already-installed build sends `?days=7` and
 * nothing else. It parses to `dense: 0`, and the server returns the wire that
 * build was compiled against. Capability is stated by the caller and is never
 * inferred from a user agent, an app version string, or deployment timing.
 *
 * Kept OUT of the shared `daysQuery` that `/journal/timeline` also parses: a
 * capability belongs to the one route that honours it, and advertising
 * `dense` on a route that ignores it would be a contract that does not exist.
 *
 * ── THE SPARSE RESPONSE IS A SUPPORTED CONTRACT, INDEFINITELY (ruling R3) ──
 *
 * It is NOT scaffolding to be removed once the first dense-capable client
 * ships. Do not delete the sparse branch, do not flip this default, and do not
 * "simplify" the two paths into one. Every build in the field that predates the
 * capability depends on it, and the app currently has no way to make those
 * builds update: there is no minimum-version gate and no OTA update path.
 *
 * RETIREMENT REQUIRES A SEPARATE FOUNDER-APPROVED PLAN containing all five of:
 *   1. the known minimum dense-capable app version;
 *   2. a working force-update / min-version capability;
 *   3. installed-version evidence from the field;
 *   4. a rollback plan;
 *   5. explicit authorization to remove sparse.
 *
 * Until every one of those exists: no capability → sparse; capability → dense;
 * and a migrated client that asked for dense and did not get it fails closed
 * rather than reinterpreting the legacy rows.
 */
export const rollupsQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
  /**
   * `1` requests the dense effective window. ANYTHING ELSE — absent, empty,
   * misspelled, repeated, junk from a proxy or a shared deep link — is `0`.
   *
   * IT FAILS CLOSED, TOWARD THE LEGACY WIRE. Two failure modes were available
   * and only one is safe:
   *
   *   · `z.coerce.boolean()` treats EVERY non-empty string as true, so
   *     `dense=0` and even `dense=false` would REQUEST DENSE — the forbidden
   *     default reintroduced by a type coercion nobody would think to test.
   *   · A strict numeric schema rejects junk, and this route's catch turns a
   *     parse error into HTTP 400. `?dense=true`, `?dense=2` and a duplicated
   *     `?dense=1&dense=1` (Express hands that over as an ARRAY) would all
   *     turn a request that returns 200 on main into a 400 — a behavior change
   *     for a route that has always ignored parameters it did not recognise.
   *
   * So the capability is granted on an exact match and withheld otherwise. An
   * unrecognised value can never over-serve a client a contract it was not
   * written against, and can never break a request that works today.
   */
  dense: z.preprocess((v) => (v === "1" ? 1 : 0), z.union([z.literal(0), z.literal(1)])),
});

export type RollupsQuery = z.infer<typeof rollupsQuery>;
