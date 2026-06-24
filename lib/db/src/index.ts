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
});
export const db = drizzle(pool, { schema });

export * from "./schema";
export * from "./scanRepo";
export * from "./demandSnapshotRepo";
export * from "./whoopTokenStore";
export * from "./garminTokenStore";
