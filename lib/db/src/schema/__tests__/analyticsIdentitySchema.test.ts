/**
 * S1-1 SCHEMA DECLARATION LAWS — the analytics identity/consent tables.
 *
 * SCOPE. S1-1 is DECLARATIONS ONLY. There is no resolver, no consent handler
 * and no applied DDL, so the only properties that exist to assert are
 * structural ones. These laws pin exactly those, and deliberately claim
 * nothing further.
 *
 * NOT CLAIMED BY THIS PR, and assigned to their real owners:
 *   - the end-to-end `deleteMyData` → suppressed acceptance law belongs to
 *     S1-6. Suppression is UNREACHABLE before that PR, so a law asserting it
 *     here could only pass by hand-seeding a row — green on a build where the
 *     behaviour does not exist. That is the vacuity pattern this repo has
 *     shipped before and it is refused here.
 *   - resolver race laws (concurrent resolve/rotate/suppress) belong to S1-3
 *     and must run against real Postgres in the db-lane; a mocked race proves
 *     nothing.
 *   - writer-gating laws belong to S1-4.
 *
 * WHY THESE ASSERT ON THE DRIZZLE OBJECTS, NOT ON SOURCE TEXT. This repo has
 * twice shipped source-scan laws that passed on a comment or a prefix match.
 * `getTableConfig` returns the parsed table definition, so these read the
 * SAME structure drizzle-kit compiles into DDL. A law that greps for
 * "check(" would pass on this very docblock; these cannot.
 */
import { describe, it, expect } from "vitest";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";

/**
 * Render a CHECK's predicate to SQL.
 *
 * Asserting the constraint NAME is not enough and this is not a hypothetical:
 * a mutant that widened the status enum to admit 'zombie', gutted the
 * suppressed invariant to `true`, and pointed the unique index at the wrong
 * column passed a name-only suite in full. These laws compare the PREDICATE.
 */
const renderCheck = (c: { value: unknown }) =>
  new PgDialect().sqlToQuery(c.value as never).sql;

import {
  aforceAnalyticsIdentities,
  aforceAnalyticsConsentState,
  aforceAnalyticsConsentEvents,
} from "../aforce";

describe("S1-1 · aforce_analytics_identities", () => {
  const t = getTableConfig(aforceAnalyticsIdentities);

  it("declares exactly the approved columns, and nothing that re-identifies", () => {
    expect(t.name).toBe("aforce_analytics_identities");
    expect(t.columns.map((c) => c.name).sort()).toEqual([
      "analytics_id",
      "issued_at",
      "status",
      "updated_at",
      "user_id",
    ]);
    // The exact-list assertion above already excludes every other column, so
    // a follow-up loop over forbidden names could never fail. Recorded as
    // intent instead: device_id/ip/user_agent/email re-identify, and
    // last_rotated_at/rotation_count are timestamp-correlation channels that
    // would let a retired pseudonym be joined back to its owner.
  });

  it("analytics_id is NULLABLE — a suppressed member holds no pseudonym", () => {
    const col = t.columns.find((c) => c.name === "analytics_id");
    expect(col?.notNull, "a NOT NULL pseudonym would make suppression unrepresentable").toBe(
      false,
    );
    // MUTATION: add .notNull() to analyticsId → red.
  });

  it("the status-enum CHECK admits EXACTLY 'active' and 'suppressed'", () => {
    const c = t.checks.find((x) => x.name === "aforce_analytics_identities_status_enum");
    expect(c, "the status-enum CHECK must exist").toBeDefined();
    const sql = renderCheck(c!);
    expect(sql).toContain('"status"');
    expect(sql).toMatch(/in \('active', 'suppressed'\)/);
    // A third state must not be admissible — this is the assertion a
    // name-only law misses.
    for (const extra of ["zombie", "deleted", "pending", "unknown"]) {
      expect(sql, `status must not admit '${extra}'`).not.toContain(`'${extra}'`);
    }
    // MUTATION: delete the check → red. MUTATION: widen the enum → red.
  });

  it("the suppressed invariant actually constrains status AND analytics_id", () => {
    const c = t.checks.find(
      (x) => x.name === "aforce_analytics_identities_suppressed_has_no_id",
    );
    expect(c, "the suppressed-has-no-id CHECK must exist").toBeDefined();
    const sql = renderCheck(c!);
    // Both columns must appear, and the predicate must be a real disjunction —
    // a constraint gutted to `true` carries the right name and enforces
    // nothing, which is exactly how this law was vacuous before.
    expect(sql).toContain('"status"');
    expect(sql).toContain('"analytics_id"');
    expect(sql).toMatch(/<>\s*'suppressed'/);
    expect(sql).toMatch(/is null/i);
    expect(sql.trim().toLowerCase()).not.toBe("true");
    // This is what makes "a suppressed member can never be revived" a
    // DATABASE guarantee rather than a code convention.
    // MUTATION: delete it, or replace the body with `true` → red.
  });

  it("has both CHECKs — neither substitutes for the other", () => {
    // The status enum stops a third state being written; the suppressed
    // invariant stops a valid state holding a value it must not. Removing
    // either leaves a real hole, so the count is asserted too: a future edit
    // that replaces one with the other is caught.
    expect(t.checks.length).toBe(2);
  });

  it("declares the PARTIAL unique index on analytics_id", () => {
    const idx = t.indexes.find(
      (i) => i.config.name === "aforce_analytics_identities_analytics_id_uq",
    );
    expect(idx, "the ingest gate will resolve through this index").toBeDefined();
    expect(
      idx?.config.columns.map((c) => (c as { name: string }).name),
      "must guard analytics_id — a unique index on the wrong column is silent",
    ).toEqual(["analytics_id"]);
    expect(idx?.config.unique, "pseudonyms must be globally unique while live").toBe(true);
    expect(
      idx?.config.where,
      "must be PARTIAL: suppressed rows all hold NULL, and a plain unique " +
        "index would permit only one of them",
    ).toBeDefined();
    // MUTATION: drop .where(...) → red. MUTATION: uniqueIndex → index → red.
  });

  it("user_id is the primary key", () => {
    const pk = t.columns.find((c) => c.name === "user_id");
    expect(pk?.primary).toBe(true);
  });
});

describe("S1-1 · aforce_analytics_consent_state (OPERATIVE)", () => {
  const t = getTableConfig(aforceAnalyticsConsentState);

  it("declares exactly the approved columns", () => {
    expect(t.name).toBe("aforce_analytics_consent_state");
    expect(t.columns.map((c) => c.name).sort()).toEqual([
      "decision_seq",
      "disclosure_version",
      "granted",
      "updated_at",
      "user_id",
    ]);
  });

  it("granted has no default — an absent row means NEVER DECIDED", () => {
    const granted = t.columns.find((c) => c.name === "granted");
    expect(granted?.notNull).toBe(true);
    expect(
      granted?.hasDefault,
      "a default would let 'never decided' silently read as a decision",
    ).toBe(false);
    // MUTATION: .default(false) → red. A member who has not answered is not
    // a member who said no.
  });

  it("carries no pseudonym — the gate and the identity stay separable", () => {
    expect(t.columns.map((c) => c.name)).not.toContain("analytics_id");
  });
});

describe("S1-1 · aforce_analytics_consent_events (EVIDENCE)", () => {
  const t = getTableConfig(aforceAnalyticsConsentEvents);

  it("declares exactly the approved columns", () => {
    expect(t.name).toBe("aforce_analytics_consent_events");
    expect(t.columns.map((c) => c.name).sort()).toEqual([
      "action",
      "decision_seq",
      "disclosure_version",
      "id",
      "recorded_at",
      "user_id",
    ]);
  });

  it("carries NO pseudonym — evidence must not re-link a member to a retired id", () => {
    expect(t.columns.map((c) => c.name)).not.toContain("analytics_id");
    // MUTATION: add an analytics_id column → red. An evidence row plus an
    // identity row must never combine into a member ⇄ pseudonym link.
  });

  it("declares the subject-access retrieval index", () => {
    const idx = t.indexes.find(
      (i) => i.config.name === "aforce_analytics_consent_events_user_idx",
    );
    expect(idx).toBeDefined();
    expect(
      idx?.config.columns.map((c) => (c as { name: string }).name),
      "order is load-bearing: (user_id, recorded_at) serves one member's " +
        "decisions in time order; the reverse does not",
    ).toEqual(["user_id", "recorded_at"]);
    // MUTATION: delete the index, reorder it, or change a column → red.
  });
});

describe("S1-1 · retention is not encoded in the schema", () => {
  it("no S1 table declares a foreign key, so retention is a DELETE not a migration", () => {
    // Counsel has not ruled on retaining consent evidence after a deletion
    // request. Whichever way that lands, it must not require a destructive
    // migration — so nothing references these tables and nothing cascades.
    for (const table of [
      aforceAnalyticsIdentities,
      aforceAnalyticsConsentState,
      aforceAnalyticsConsentEvents,
    ]) {
      expect(getTableConfig(table).foreignKeys.length).toBe(0);
    }
    // MUTATION: add a foreign key between any two of them → red.
  });
});
