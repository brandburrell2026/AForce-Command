/**
 * Full account deletion against a real PostgreSQL (PGlite, in-process).
 *
 * The whole schema is created from `../schema`, every registry key is seeded
 * for the member being deleted AND for a bystander, the executor runs, and the
 * database is then read back. Nothing here is a fake: the statements that run
 * are the statements production runs.
 *
 * What is NOT covered here: CHECK constraints are dropped so rows can be
 * seeded generically, and foreign-key triggers are off while seeding. The
 * sign-in provider and billing are stage 3 and are not touched.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig, type PgColumn } from "drizzle-orm/pg-core";

import * as schema from "../schema";
import {
  ACCOUNT_DELETION_REGISTRY,
  MEMBER_ID_COLUMN,
} from "../accountDeletionRegistry";
import {
  buildAccountDeletionPlan,
  executeAccountDeletion,
  ACCOUNT_TABLE,
} from "../accountDeletionExecutor";

const A = "user_deleted_A";
const B = "user_bystander_B";
const A_EMAIL = "Member.A@example.test";
const B_EMAIL = "member.b@example.test";

const pg = new PGlite();
const db = drizzle(pg);
// The executor only needs `execute`; PGlite's drizzle handle provides it.
const handle = db as unknown as Parameters<typeof executeAccountDeletion>[0];

const tables = new Map<string, PgColumn[]>();
for (const value of Object.values(schema)) {
  if (!is(value, PgTable)) continue;
  const config = getTableConfig(value);
  tables.set(config.name, config.columns);
}

let seq = 0;
/** A value that satisfies the column's type and is unique per call. */
function filler(column: PgColumn): unknown {
  seq += 1;
  const type = column.getSQLType().toLowerCase();
  if (type.endsWith("[]")) return "{}";
  if (type.startsWith("uuid")) {
    return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  }
  if (/^(integer|bigint|smallint|serial|bigserial|real|double|numeric|decimal)/.test(type)) return seq;
  if (type.startsWith("boolean")) return true;
  if (type.startsWith("timestamp")) return new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString();
  if (type.startsWith("date")) return "2026-01-01";
  if (type.startsWith("json")) return "{}";
  if (type.startsWith("bytea")) return new Uint8Array([0]);
  return `v${seq}`;
}

const q = (name: string): string => `"${name.replace(/"/g, '""')}"`;

async function insert(table: string, overrides: Record<string, unknown>): Promise<void> {
  const columns = tables.get(table);
  if (!columns) throw new Error(`no such table ${table}`);
  const names: string[] = [];
  const values: unknown[] = [];
  for (const column of columns) {
    const type = column.getSQLType().toLowerCase();
    if (column.name in overrides) {
      names.push(column.name);
      values.push(overrides[column.name]);
    } else if (/serial/.test(type)) {
      continue; // let the sequence fill it
    } else if (MEMBER_ID_COLUMN.test(column.name)) {
      // Some other member, different on every row so unique indexes hold.
      seq += 1;
      names.push(column.name);
      values.push(`user_other_${seq}`);
    } else {
      names.push(column.name);
      values.push(filler(column));
    }
  }
  await pg.query(
    `insert into ${q(table)} (${names.map(q).join(",")}) values (${names.map((_, i) => `$${i + 1}`).join(",")})`,
    values,
  );
}

async function count(table: string, where = "true", params: unknown[] = []): Promise<number> {
  const r = await pg.query<{ n: number }>(`select count(*)::int n from ${q(table)} where ${where}`, params);
  return r.rows[0]?.n ?? 0;
}

const A_ANALYTICS = "analytics-id-of-A";
const B_ANALYTICS = "analytics-id-of-B";
const A_PROGRESSION = "progression-of-A";
const B_PROGRESSION = "progression-of-B";

/** Seeds one row per registry key for A, and a full set for B. */
async function seed(): Promise<void> {
  await pg.exec("set session_replication_role = replica");
  for (const [table, entry] of Object.entries(ACCOUNT_DELETION_REGISTRY)) {
    const columns = tables.get(table) ?? [];
    if (table === ACCOUNT_TABLE) {
      await insert(table, { id: A, email: A_EMAIL });
      await insert(table, { id: B, email: B_EMAIL });
      continue;
    }
    if (entry.keys.length === 0) {
      await insert(table, {});
      continue;
    }
    for (const key of entry.keys) {
      const match = key.match ?? "member_id";
      if (match === "email") {
        await insert(table, { [key.column]: A_EMAIL.toLowerCase() });
        await insert(table, { [key.column]: B_EMAIL });
      } else if (match === "indirect") {
        const mine = key.via?.table === "aforce_analytics_identities" ? A_ANALYTICS : A_PROGRESSION;
        const theirs = key.via?.table === "aforce_analytics_identities" ? B_ANALYTICS : B_PROGRESSION;
        await insert(table, { [key.column]: mine });
        await insert(table, { [key.column]: theirs });
      } else {
        const extra: Record<string, unknown> = {};
        if (table === "aforce_analytics_identities") extra["analytics_id"] = A_ANALYTICS;
        if (table === "aforce_rtp_progressions" && key.column === "athlete_user_id") {
          extra["id"] = A_PROGRESSION;
        }
        await insert(table, { [key.column]: A, ...extra });
      }
    }
    // The bystander's own row: every member column is B.
    const extraB: Record<string, unknown> = {};
    if (table === "aforce_analytics_identities") extraB["analytics_id"] = B_ANALYTICS;
    if (table === "aforce_rtp_progressions") extraB["id"] = B_PROGRESSION;
    if (entry.keys.some((k) => (k.match ?? "member_id") === "member_id")) {
      for (const column of columns) if (MEMBER_ID_COLUMN.test(column.name)) extraB[column.name] = B;
      await insert(table, extraB);
    }
  }
  await pg.exec("set session_replication_role = origin");
}

async function wipe(): Promise<void> {
  await pg.exec(`truncate ${[...tables.keys()].map(q).join(",")} restart identity cascade`);
}

beforeAll(async () => {
  const { generateDrizzleJson, generateMigration } = await import("drizzle-kit/api");
  const statements = await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson(schema as unknown as Record<string, unknown>),
  );
  for (const statement of statements) await pg.exec(statement);
  // CHECK constraints would reject generic filler values; they are not what
  // this file tests.
  const checks = await pg.query<{ t: string; c: string }>(
    `select conrelid::regclass::text t, conname c from pg_constraint
      where contype = 'c' and connamespace = 'public'::regnamespace`,
  );
  for (const { t, c } of checks.rows) await pg.exec(`alter table ${t} drop constraint ${q(c)}`);
}, 120_000);

beforeEach(async () => {
  await wipe();
  seq = 0;
  await seed();
});

describe("buildAccountDeletionPlan", () => {
  const plan = buildAccountDeletionPlan();

  it("runs indirect keys first and the account row last", () => {
    const firstDirect = plan.findIndex((s) => s.match !== "indirect");
    expect(plan.slice(0, firstDirect).every((s) => s.match === "indirect")).toBe(true);
    expect(plan.slice(firstDirect).some((s) => s.match === "indirect")).toBe(false);
    expect(plan[plan.length - 1]).toMatchObject({ table: ACCOUNT_TABLE, column: "id", kind: "purge" });
  });

  it("reads email-matched tables before the account row is removed", () => {
    const email = plan.findIndex((s) => s.match === "email");
    const account = plan.findIndex((s) => s.table === ACCOUNT_TABLE);
    expect(email).toBeGreaterThan(-1);
    expect(email).toBeLessThan(account);
  });

  it("has no step for a retained key", () => {
    expect(plan.some((s) => s.table === "aforce_web_entitlements")).toBe(false);
    expect(plan.some((s) => s.column === "author_user_id")).toBe(false);
  });
});

describe("executeAccountDeletion (real PostgreSQL)", () => {
  it("the seed put the member in every keyed table", async () => {
    for (const [table, entry] of Object.entries(ACCOUNT_DELETION_REGISTRY)) {
      for (const key of entry.keys) {
        if ((key.match ?? "member_id") !== "member_id") continue;
        const column = table === ACCOUNT_TABLE ? "id" : key.column;
        expect(await count(table, `${q(column)} = $1`, [A]), `${table}.${column}`).toBeGreaterThan(0);
      }
    }
  });

  it("removes the member from every purge and anonymise key, and keeps retained keys", async () => {
    const result = await db.transaction((tx) =>
      executeAccountDeletion(tx as unknown as typeof handle, A),
    );
    expect(result.skippedTables).toEqual([]);
    expect(result.accountRowDeleted).toBe(true);

    for (const [table, entry] of Object.entries(ACCOUNT_DELETION_REGISTRY)) {
      for (const key of entry.keys) {
        const match = key.match ?? "member_id";
        const label = `${table}.${key.column}`;
        if (match === "member_id") {
          const left = await count(table, `${q(key.column)} = $1`, [A]);
          if (key.action === "retain") expect(left, label).toBeGreaterThan(0);
          else expect(left, label).toBe(0);
        } else if (match === "email") {
          const left = await count(table, `lower(${q(key.column)}) = lower($1)`, [A_EMAIL]);
          if (key.action === "retain") expect(left, label).toBeGreaterThan(0);
          else expect(left, label).toBe(0);
        }
      }
    }
    expect(await count("aforce_analytics_events", "analytics_id = $1", [A_ANALYTICS])).toBe(0);
    expect(await count("aforce_rtp_signoffs", "progression_id = $1", [A_PROGRESSION])).toBe(0);
  });

  it("matches the waitlist email without regard to case", async () => {
    expect(await count("early_access_signups", "email = $1", [A_EMAIL.toLowerCase()])).toBe(1);
    await executeAccountDeletion(handle, A);
    expect(await count("early_access_signups", "email = $1", [A_EMAIL.toLowerCase()])).toBe(0);
    expect(await count("early_access_signups", "email = $1", [B_EMAIL])).toBe(1);
  });

  it("clears the acceptor on a Circle invitation and keeps the invitation", async () => {
    const before = await count("aforce_circle_invitations", "owner_user_id = $1", [B]);
    const result = await executeAccountDeletion(handle, A);
    expect(result.anonymised["aforce_circle_invitations"]).toBe(1);
    expect(await count("aforce_circle_invitations", "owner_user_id = $1", [B])).toBe(before);
    expect(await count("aforce_circle_invitations", "accepted_by_user_id = $1", [A])).toBe(0);
  });

  it("leaves the bystander's rows exactly as they were", async () => {
    const snapshot = async (): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      for (const [table, columns] of tables) {
        const member = columns.filter((c) => MEMBER_ID_COLUMN.test(c.name)).map((c) => c.name);
        if (table === ACCOUNT_TABLE) out[table] = await count(table, "id = $1", [B]);
        else if (member.length > 0) {
          // Rows that mention only the bystander, never the deleted member.
          out[table] = await count(table, member.map((m) => `${q(m)} is distinct from $1`).join(" and "), [A]);
        } else out[table] = await count(table);
      }
      return out;
    };
    const before = await snapshot();
    await executeAccountDeletion(handle, A);
    const after = await snapshot();
    // Indirect and email tables have no member column: A's row goes, B's stays.
    before["aforce_analytics_events"] = (before["aforce_analytics_events"] ?? 0) - 1;
    before["early_access_signups"] = (before["early_access_signups"] ?? 0) - 1;
    // The sign-off on A's progression was written by someone else; it goes with the progression.
    before["aforce_rtp_signoffs"] = (before["aforce_rtp_signoffs"] ?? 0) - 1;
    // The invitation A accepted is kept with its sender, with the acceptor cleared.
    before["aforce_circle_invitations"] = (before["aforce_circle_invitations"] ?? 0) + 1;
    expect(after).toEqual(before);
    expect(await count("aforce_analytics_events", "analytics_id = $1", [B_ANALYTICS])).toBe(1);
    expect(await count("aforce_rtp_signoffs", "progression_id = $1", [B_PROGRESSION])).toBe(1);
    expect(after[ACCOUNT_TABLE]).toBe(1);
  });

  it("keeps the billing record", async () => {
    await executeAccountDeletion(handle, A);
    expect(await count("aforce_web_entitlements", "user_id = $1", [A])).toBe(1);
  });

  it("is idempotent: a second run finds nothing", async () => {
    await executeAccountDeletion(handle, A);
    const again = await executeAccountDeletion(handle, A);
    expect(again.purged).toEqual({});
    expect(again.anonymised).toEqual({});
    expect(again.accountRowDeleted).toBe(false);
  });

  it("rolls back completely when the transaction fails after the deletes", async () => {
    const before = await count("aforce_intake_logs", "user_id = $1", [A]);
    await expect(
      db.transaction(async (tx) => {
        await executeAccountDeletion(tx as unknown as typeof handle, A);
        throw new Error("simulated failure after deletion");
      }),
    ).rejects.toThrow("simulated failure");
    expect(await count(ACCOUNT_TABLE, "id = $1", [A])).toBe(1);
    expect(await count("aforce_intake_logs", "user_id = $1", [A])).toBe(before);
    expect(before).toBeGreaterThan(0);
  });

  it("reports a table that is missing instead of failing or passing silently", async () => {
    await pg.exec('alter table "aforce_achievements" rename to "aforce_achievements_gone"');
    try {
      const result = await executeAccountDeletion(handle, A);
      expect(result.skippedTables).toEqual(["aforce_achievements"]);
      expect(result.accountRowDeleted).toBe(true);
    } finally {
      await pg.exec('alter table "aforce_achievements_gone" rename to "aforce_achievements"');
    }
  });

  it("refuses an empty member id before running anything", async () => {
    await expect(executeAccountDeletion(handle, "")).rejects.toThrow("member id is required");
    await expect(executeAccountDeletion(handle, "   ")).rejects.toThrow("member id is required");
    expect(await count(ACCOUNT_TABLE)).toBe(2);
  });
});
