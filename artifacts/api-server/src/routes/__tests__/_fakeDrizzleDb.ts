/**
 * DB-free harness shared by the battles + circle route suites.
 *
 * Those suites assert two things about GET handlers: that they perform
 * NO write, and that the WHERE they build excludes the legacy seeded
 * rows. So the fake replaces only the `db` handle — drizzle-orm and the
 * real table objects stay untouched, and the `SQL` captured here is the
 * genuine object the route hands to Postgres. `renderWhere` prints it
 * with drizzle's own `PgDialect`, so what gets asserted is the exact
 * statement text and bound params the database would receive, not a
 * hand-rolled reading of drizzle internals.
 *
 * What this lane does NOT prove: that Postgres, executing that SQL,
 * really withholds the excluded rows. That is a real-database question
 * and belongs in the DB lane (vitest.db.config.ts).
 */

import express, { type IRouter } from "express";
import http from "node:http";
import { getTableName, type SQL, type Table } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { logger } from "../../lib/logger";

export interface RecordedSelect {
  /** SQL table name, e.g. `aforce_battles`. */
  table: string;
  where: SQL | undefined;
}

export interface FakeDb {
  db: unknown;
  selects: RecordedSelect[];
  /** Every attempted write, as `insert:aforce_battles`. Must stay empty
   *  for a GET — a non-empty array IS the fabrication regression. */
  writes: string[];
}

/**
 * Fake of the drizzle chain the read paths use:
 * `db.select().from(t).where(w).orderBy(x)`. Rows come back per table,
 * keyed by SQL table name; an unstocked table reads as empty, which is
 * exactly the fresh-user case.
 *
 * The fake does not evaluate the WHERE — filtering is Postgres's job,
 * and pretending to reimplement it here would prove nothing. It records
 * the WHERE for inspection and returns the stocked rows as-is.
 */
export function makeFakeDb(
  rowsByTable: Record<string, unknown[]> = {},
): FakeDb {
  const selects: RecordedSelect[] = [];
  const writes: string[] = [];

  function chain(): unknown {
    const call: RecordedSelect = { table: "", where: undefined };
    const link = {
      from(table: Table) {
        call.table = getTableName(table);
        return link;
      },
      where(where: SQL | undefined) {
        call.where = where;
        return link;
      },
      orderBy() {
        return link;
      },
      limit() {
        return link;
      },
      // Thenable rather than a promise: the feed awaits the chain right
      // after `.where()`, every other read awaits it after `.orderBy()`.
      then(
        onOk: (rows: unknown[]) => unknown,
        onErr: (err: unknown) => unknown,
      ) {
        selects.push({ ...call });
        return Promise.resolve(rowsByTable[call.table] ?? []).then(onOk, onErr);
      },
    };
    return link;
  }

  // Throwing (not just recording) makes a re-introduced seeder fail the
  // request loudly instead of quietly passing a row-count assertion.
  const refuseWrite = (method: string) => (table: Table) => {
    const name = getTableName(table);
    writes.push(`${method}:${name}`);
    throw new Error(`fake db: unexpected ${method} on ${name}`);
  };

  return {
    db: {
      select: () => chain(),
      insert: refuseWrite("insert"),
      update: refuseWrite("update"),
      delete: refuseWrite("delete"),
    },
    selects,
    writes,
  };
}

const dialect = new PgDialect();

/** Render a captured WHERE to the statement text + params Postgres gets. */
export function renderWhere(where: SQL | undefined): {
  sql: string;
  params: unknown[];
} {
  if (!where) throw new Error("no WHERE was captured for this query");
  const { sql, params } = dialect.sqlToQuery(where);
  return { sql, params };
}

export interface Harness {
  /** `headers` is optional and additive — existing callers are unaffected. */
  get(path: string, headers?: Record<string, string>): Promise<{ status: number; json: unknown }>;
  close(): Promise<void>;
}

/** Mount one router on an ephemeral port and drive it over real HTTP. */
export async function serveRouter(
  mountPath: string,
  router: IRouter,
): Promise<Harness> {
  const app = express();
  app.use(express.json());
  // The routers log unhappy paths through pino-http's req.log.
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });
  app.use(mountPath, router);

  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    async get(path, headers) {
      const res = await fetch(`${baseUrl}${path}`, headers ? { headers } : undefined);
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json };
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
