/**
 * Completeness laws for the account deletion registry (SS-04, stage 1).
 *
 * The registry is only useful if it cannot fall behind the schema. These
 * tests read every table exported from `../schema` and fail when one is
 * missing from the registry, when a member-id column is not named, or when
 * an entry names something the schema does not have.
 *
 * Pure, unit lane, no database.
 */
import { describe, it, expect } from "vitest";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";

import * as schema from "../schema";
import {
  ACCOUNT_DELETION_REGISTRY,
  MEMBER_ID_COLUMN,
  type DeletionKey,
} from "../accountDeletionRegistry";

const tables = new Map<string, string[]>();
for (const value of Object.values(schema)) {
  if (!is(value, PgTable)) continue;
  const config = getTableConfig(value);
  tables.set(
    config.name,
    config.columns.map((c) => c.name),
  );
}

const entries = Object.entries(ACCOUNT_DELETION_REGISTRY);
const allKeys: Array<[string, DeletionKey]> = entries.flatMap(([table, e]) =>
  e.keys.map((k): [string, DeletionKey] => [table, k]),
);

describe("account deletion registry: coverage", () => {
  it("the schema was actually read", () => {
    expect(tables.size).toBeGreaterThan(50);
  });

  it("every schema table has an entry", () => {
    const missing = [...tables.keys()].filter((t) => !(t in ACCOUNT_DELETION_REGISTRY));
    expect(missing).toEqual([]);
  });

  it("no entry names a table that is not in the schema", () => {
    const stale = entries.map(([t]) => t).filter((t) => !tables.has(t));
    expect(stale).toEqual([]);
  });

  it("every member-id column in every table is named by its entry", () => {
    const unnamed: string[] = [];
    for (const [table, columns] of tables) {
      const named = new Set((ACCOUNT_DELETION_REGISTRY[table]?.keys ?? []).map((k) => k.column));
      for (const column of columns) {
        if (MEMBER_ID_COLUMN.test(column) && !named.has(column)) unnamed.push(`${table}.${column}`);
      }
    }
    expect(unnamed).toEqual([]);
  });

  it("every key names a column that exists", () => {
    const bad = allKeys
      .filter(([table, k]) => !(tables.get(table) ?? []).includes(k.column))
      .map(([table, k]) => `${table}.${k.column}`);
    expect(bad).toEqual([]);
  });

  it("a table has keys, or says why it holds no member data, never both", () => {
    const bad = entries
      .filter(([, e]) => (e.keys.length === 0) !== (typeof e.noMemberData === "string"))
      .map(([t]) => t);
    expect(bad).toEqual([]);
  });
});

describe("account deletion registry: the founder decisions", () => {
  it("a retained key always gives a reason, and nothing else does", () => {
    const bad = allKeys
      .filter(([, k]) => (k.action === "retain") !== (k.retainReason !== undefined))
      .map(([t, k]) => `${t}.${k.column}`);
    expect(bad).toEqual([]);
  });

  it("billing is retained in exactly one table", () => {
    const billing = new Set(
      allKeys.filter(([, k]) => k.retainReason === "billing").map(([t]) => t),
    );
    expect([...billing]).toEqual(["aforce_web_entitlements"]);
  });

  it("the member's own rows are never retained", () => {
    // A column that identifies the member as the SUBJECT of the row must be
    // purged or anonymised. Only billing and author-side columns may stay.
    const subjectColumns = /^(user_id|id|athlete_user_id|subject_user_id|owner_user_id|member_user_id|source_user_id|recipient_user_id)$/;
    const bad = allKeys
      .filter(
        ([, k]) =>
          subjectColumns.test(k.column) && k.action === "retain" && k.retainReason !== "billing",
      )
      .map(([t, k]) => `${t}.${k.column}`);
    expect(bad).toEqual([]);
  });

  it("every Circle table removes the member from both sides", () => {
    const circle = entries.filter(([t]) => t.startsWith("aforce_circle_"));
    expect(circle.length).toBe(7);
    for (const [table, e] of circle) {
      expect(e.keys.every((k) => k.action !== "retain"), table).toBe(true);
    }
  });

  it("an indirect key names its parent, and the parent exists", () => {
    for (const [table, k] of allKeys) {
      if (k.match !== "indirect") {
        expect(k.via, `${table}.${k.column}`).toBeUndefined();
        continue;
      }
      const parent = tables.get(k.via?.table ?? "") ?? [];
      expect(parent, `${table}.${k.column}`).toContain(k.via?.joinColumn);
      expect(parent, `${table}.${k.column}`).toContain(k.via?.memberColumn);
    }
  });

  it("the rows that need counsel are the ones this list says", () => {
    // Pinned so that adding or removing a counsel flag is a visible change.
    const flagged = allKeys
      .filter(([, k]) => k.counselReview)
      .map(([t, k]) => `${t}.${k.column}`)
      .sort();
    expect(flagged).toEqual([
      "aforce_analytics_consent_events.user_id",
      "aforce_athlete_availability.set_by_user_id",
      "aforce_athlete_consent_events.athlete_user_id",
      "aforce_athlete_medical_notes.author_user_id",
      "aforce_athlete_medical_notes.subject_user_id",
      "aforce_athlete_screenings.screened_by_user_id",
      "aforce_athlete_sessions.entered_by_user_id",
      "aforce_athlete_soap_notes.author_user_id",
      "aforce_athlete_soap_notes.subject_user_id",
      "aforce_medical_access_log.actor_user_id",
      "aforce_medical_access_log.subject_user_id",
      "aforce_rtp_progressions.started_by_user_id",
      "aforce_rtp_protocols.created_by_user_id",
      "aforce_rtp_signoffs.signed_by_user_id",
    ]);
  });
});
