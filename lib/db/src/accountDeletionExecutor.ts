/**
 * Full account deletion (SS-04, stage 2): turns the registry into ordered
 * statements and runs them on the handle it is given.
 *
 * The caller owns the transaction. Run this inside `db.transaction` so a
 * failure on any table leaves the account untouched; the function itself
 * never commits, and never touches the sign-in provider or billing (stage 3).
 *
 * Order matters, and is fixed by `buildAccountDeletionPlan`:
 *   1. indirect keys   (their parent rows must still exist to be matched)
 *   2. email keys      (the account email is read before `aforce_users` goes)
 *   3. every other table
 *   4. `aforce_users`  (the account row, last)
 *
 * Retained keys produce no statement. A table that is not present in the
 * database is skipped and reported, never treated as success by silence:
 * some tables ship by separate migration and may not exist everywhere.
 */

import { sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  ACCOUNT_DELETION_REGISTRY,
  type DeletionKey,
  type DeletionTableEntry,
} from "./accountDeletionRegistry";

export const ACCOUNT_TABLE = "aforce_users";

export interface DeletionStep {
  readonly table: string;
  readonly column: string;
  readonly kind: "purge" | "anonymise";
  readonly match: "member_id" | "email" | "indirect";
  readonly via?: DeletionKey["via"];
}

/** The ordered statements full deletion runs. Pure; no database. */
export function buildAccountDeletionPlan(
  registry: Readonly<Record<string, DeletionTableEntry>> = ACCOUNT_DELETION_REGISTRY,
): DeletionStep[] {
  const steps: DeletionStep[] = [];
  for (const [table, entry] of Object.entries(registry)) {
    for (const key of entry.keys) {
      if (key.action === "retain") continue;
      steps.push({
        table,
        column: key.column,
        kind: key.action,
        match: key.match ?? "member_id",
        via: key.via,
      });
    }
  }
  const rank = (s: DeletionStep): number =>
    s.match === "indirect" ? 0 : s.match === "email" ? 1 : s.table === ACCOUNT_TABLE ? 3 : 2;
  // Stable sort: registry order is kept within each rank.
  return steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
    .map(({ s }) => s);
}

function statementFor(step: DeletionStep, userId: string, email: string | null): SQL | null {
  const table = sql.identifier(step.table);
  const column = sql.identifier(step.column);
  let where: SQL;
  if (step.match === "email") {
    if (!email) return null;
    where = sql`lower(${column}) = lower(${email})`;
  } else if (step.match === "indirect") {
    const via = step.via;
    if (!via) throw new Error(`account deletion: ${step.table}.${step.column} has no parent`);
    where = sql`${column} in (select ${sql.identifier(via.joinColumn)} from ${sql.identifier(
      via.table,
    )} where ${sql.identifier(via.memberColumn)} = ${userId})`;
  } else {
    where = sql`${column} = ${userId}`;
  }
  return step.kind === "purge"
    ? sql`delete from ${table} where ${where}`
    : sql`update ${table} set ${column} = null where ${where}`;
}

export interface AccountDeletionResult {
  /** Rows deleted, per table. Tables with nothing to delete are omitted. */
  readonly purged: Readonly<Record<string, number>>;
  /** Rows whose member id was cleared, per table. */
  readonly anonymised: Readonly<Record<string, number>>;
  /** Registry tables that do not exist in this database. */
  readonly skippedTables: readonly string[];
  /** False when no account row existed (already deleted, or never created). */
  readonly accountRowDeleted: boolean;
}

/** node-postgres reports `rowCount`; PGlite reports `affectedRows`. */
type Rows = {
  rows?: Array<Record<string, unknown>>;
  rowCount?: number | null;
  affectedRows?: number | null;
};

/**
 * Runs the plan for one member. Idempotent: a second run finds nothing and
 * returns empty counts. Call inside a transaction.
 */
export async function executeAccountDeletion(
  dbx: Pick<NodePgDatabase<Record<string, unknown>>, "execute">,
  userId: string,
  registry: Readonly<Record<string, DeletionTableEntry>> = ACCOUNT_DELETION_REGISTRY,
): Promise<AccountDeletionResult> {
  if (typeof userId !== "string" || userId.trim() === "") {
    // An empty id must never reach a WHERE clause.
    throw new Error("account deletion: a member id is required");
  }

  const existing = (await dbx.execute(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )) as Rows;
  const present = new Set((existing.rows ?? []).map((r) => String(r["tablename"])));

  const plan = buildAccountDeletionPlan(registry);

  let email: string | null = null;
  if (present.has(ACCOUNT_TABLE) && plan.some((s) => s.match === "email")) {
    const found = (await dbx.execute(
      sql`select email from ${sql.identifier(ACCOUNT_TABLE)} where id = ${userId}`,
    )) as Rows;
    const value = found.rows?.[0]?.["email"];
    email = typeof value === "string" && value.trim() !== "" ? value : null;
  }

  const purged: Record<string, number> = {};
  const anonymised: Record<string, number> = {};
  const skipped = new Set<string>();

  for (const step of plan) {
    if (!present.has(step.table) || (step.via && !present.has(step.via.table))) {
      skipped.add(step.table);
      continue;
    }
    const statement = statementFor(step, userId, email);
    if (!statement) continue;
    const result = (await dbx.execute(statement)) as Rows;
    const count = result.rowCount ?? result.affectedRows ?? 0;
    if (count === 0) continue;
    const bucket = step.kind === "purge" ? purged : anonymised;
    bucket[step.table] = (bucket[step.table] ?? 0) + count;
  }

  return {
    purged,
    anonymised,
    skippedTables: [...skipped].sort(),
    accountRowDeleted: (purged[ACCOUNT_TABLE] ?? 0) > 0,
  };
}
