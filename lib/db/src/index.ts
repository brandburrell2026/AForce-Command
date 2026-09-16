import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Cap concurrent connections so we stay under the Postgres connection
  // limit on the Replit backend.
  max: 10,
  // Fail fast when no connection is available within 10s instead of the
  // pg default (0 = wait forever), so a starved/saturated pool surfaces
  // as an error rather than a hung request.
  connectionTimeoutMillis: 10_000,
  // A CEILING ON ANY SINGLE STATEMENT.
  //
  // `connectionTimeoutMillis` bounds the wait for a connection; nothing
  // bounded what happened once a query had one. A statement that ran long —
  // a missing index after a data shape changes, a lock held by another
  // session, a plan that flipped — held one of ten connections for as long
  // as it liked, and the pool is shared by every route in this process. The
  // first symptom was unrelated endpoints timing out.
  //
  // 15s is far above any query this application intends to run (the slowest
  // measured path is a chart export at a few hundred milliseconds) and far
  // below the point at which a stuck statement has taken the process with
  // it. A query that needs longer than this should be asking for it
  // explicitly with a per-transaction `SET LOCAL statement_timeout`, which
  // is a decision someone makes rather than a default nobody set.
  //
  // Applied per connection as it is established, which is where `pg` allows
  // session-level settings.
  statement_timeout: Number(process.env["PG_STATEMENT_TIMEOUT_MS"] ?? 15_000),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
export * from "./scanRepo";
export * from "./demandSnapshotRepo";
export * from "./whoopTokenStore";
export * from "./garminTokenStore";
export * from "./ouraTokenStore";
export * from "./stravaTokenStore";
export * from "./profileRepo";
export * from "./analyticsIdentityRepo";
export * from "./scoreSnapshotRepo";
export * from "./healthRecordsRepo";
export * from "./accountDeletionCascade";
export * from "./trainerRepo";
export * from "./trainerDocsRepo";
export * from "./trainerRtpRepo";
