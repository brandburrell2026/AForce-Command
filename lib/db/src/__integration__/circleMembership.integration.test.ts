/** Real production membership operations against an isolated disposable Postgres.
 * Run: pnpm test:integration lib/db/src/__integration__/circleMembership.integration.test.ts
 * Requires Docker. Never reads DATABASE_URL or connects to a user database.
 */
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { readFileSync } from "node:fs";

const holder = vi.hoisted(() => ({ db: null as any }));
vi.mock("@workspace/db", async () => {
  const schema = await import("../schema");
  return {
    ...schema,
    db: new Proxy(
      {},
      {
        get: (_target, key) => {
          if (!holder.db) throw new Error("Isolated database has not started");
          const value = holder.db[key];
          return typeof value === "function" ? value.bind(holder.db) : value;
        },
      },
    ),
  };
});
import {
  createInvitation,
  acceptInvitation,
  revokeInvitation,
  removeMembership,
} from "../../../../artifacts/api-server/src/lib/circleMembership";

let container: StartedPostgreSqlContainer | undefined;
let pool: pg.Pool | undefined;
const identity = { displayName: "Member", group: "friends" };
const query = (sql: string, params?: unknown[]) => pool!.query(sql, params);

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  pool = new pg.Pool({
    connectionString: container.getConnectionUri(),
    max: 8,
    statement_timeout: 10_000,
  });
  holder.db = drizzle(pool);
  // Apply the actual invitation migration, then the existing table subset it uses.
  await query(
    readFileSync(
      new URL(
        "../../migrations/20261005_circle_invitations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await query(`CREATE TABLE aforce_circle_users (
    id serial PRIMARY KEY, owner_user_id text NOT NULL, member_user_id text NOT NULL,
    name text NOT NULL, initials text NOT NULL, city text,
    "group" text NOT NULL DEFAULT 'friends', status text NOT NULL DEFAULT 'active',
    joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_user_id, member_user_id));
    CREATE TABLE aforce_circle_statuses (
    id serial PRIMARY KEY, owner_user_id text NOT NULL, member_user_id text NOT NULL,
    score integer NOT NULL DEFAULT 0, state text NOT NULL DEFAULT 'Balanced',
    streak_days integer NOT NULL DEFAULT 0, protocol_complete boolean NOT NULL DEFAULT false,
    trend text NOT NULL DEFAULT 'flat', updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(owner_user_id, member_user_id));`);
});
afterAll(async () => {
  await pool?.end();
  await container?.stop();
});
beforeEach(async () => {
  await query(
    "ALTER TABLE aforce_circle_users DROP CONSTRAINT IF EXISTS reject_reciprocal",
  );
  await query(
    "TRUNCATE aforce_circle_invitations, aforce_circle_users, aforce_circle_statuses",
  );
});

describe("Circle membership transactions on Postgres", () => {
  it("enforces the ten-live-invitation limit across concurrent creates", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => createInvitation("owner", identity)),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(10);
    for (const result of results) {
      if (result.status === "rejected")
        expect(result.reason).toMatchObject({
          code: "invitation_limit_reached",
        });
    }
    expect(
      (await query("SELECT * FROM aforce_circle_invitations")).rows,
    ).toHaveLength(10);
  });

  it("promotes pending membership while preserving local group and muted preferences", async () => {
    await query(`INSERT INTO aforce_circle_users(owner_user_id, member_user_id, name, initials, "group", status)
      VALUES ('owner','alice','Alice','A','family','pending'), ('alice','owner','Owner','O','coach','muted')`);
    const invitation = await createInvitation("owner", identity);
    await acceptInvitation("alice", invitation.code, identity);
    expect(
      (
        await query(
          'SELECT owner_user_id, "group", status FROM aforce_circle_users ORDER BY owner_user_id',
        )
      ).rows,
    ).toEqual([
      { owner_user_id: "alice", group: "coach", status: "muted" },
      { owner_user_id: "owner", group: "family", status: "active" },
    ]);
  });

  it("allows exactly one concurrent redeemer and creates only that reciprocal pair", async () => {
    const invitation = await createInvitation("owner", identity);
    const results = await Promise.allSettled([
      acceptInvitation("alice", invitation.code, identity),
      acceptInvitation("bob", invitation.code, identity),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const claim = (
      await query("SELECT accepted_by_user_id FROM aforce_circle_invitations")
    ).rows[0];
    const memberships = (
      await query(
        "SELECT owner_user_id, member_user_id FROM aforce_circle_users ORDER BY owner_user_id",
      )
    ).rows;
    expect(memberships).toHaveLength(2);
    expect(memberships).toEqual(
      expect.arrayContaining([
        { owner_user_id: "owner", member_user_id: claim.accepted_by_user_id },
        { owner_user_id: claim.accepted_by_user_id, member_user_id: "owner" },
      ]),
    );
  });

  it("rolls back the claimed code and health-snapshot cleanup after a real reciprocal insert failure", async () => {
    const invitation = await createInvitation("owner", identity);
    await query(
      "INSERT INTO aforce_circle_statuses(owner_user_id, member_user_id, score) VALUES ('owner','alice',73)",
    );
    await query(
      "ALTER TABLE aforce_circle_users ADD CONSTRAINT reject_reciprocal CHECK (owner_user_id <> 'alice')",
    );
    await expect(
      acceptInvitation("alice", invitation.code, identity),
    ).rejects.toThrow();
    expect(
      (
        await query(
          "SELECT accepted_at, accepted_by_user_id FROM aforce_circle_invitations",
        )
      ).rows,
    ).toEqual([{ accepted_at: null, accepted_by_user_id: null }]);
    expect(
      (await query("SELECT * FROM aforce_circle_users")).rows,
    ).toHaveLength(0);
    expect(
      (await query("SELECT score FROM aforce_circle_statuses")).rows,
    ).toEqual([{ score: 73 }]);
    await query(
      "ALTER TABLE aforce_circle_users DROP CONSTRAINT reject_reciprocal",
    );
    await acceptInvitation("alice", invitation.code, identity);
    expect(
      (await query("SELECT * FROM aforce_circle_users")).rows,
    ).toHaveLength(2);
    expect(
      (await query("SELECT * FROM aforce_circle_statuses")).rows,
    ).toHaveLength(0);
  });

  it("serializes revoke versus accept so only one operation succeeds", async () => {
    const invitation = await createInvitation("owner", identity);
    const results = await Promise.allSettled([
      revokeInvitation("owner", invitation.invitation.id),
      acceptInvitation("alice", invitation.code, identity),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const row = (
      await query(
        "SELECT accepted_at, revoked_at FROM aforce_circle_invitations",
      )
    ).rows[0];
    expect(Boolean(row.accepted_at)).not.toBe(Boolean(row.revoked_at));
    expect(
      (await query("SELECT * FROM aforce_circle_users")).rows,
    ).toHaveLength(row.accepted_at ? 2 : 0);
  });

  it("removes both directions and their snapshots while preserving another connection", async () => {
    for (const member of ["alice", "bob"]) {
      const invitation = await createInvitation("owner", identity);
      await acceptInvitation(member, invitation.code, identity);
    }
    await query(
      "INSERT INTO aforce_circle_statuses(owner_user_id, member_user_id) VALUES ('owner','alice'),('alice','owner'),('owner','bob')",
    );
    await removeMembership("alice", "owner");
    expect(
      (
        await query(
          "SELECT owner_user_id, member_user_id FROM aforce_circle_users",
        )
      ).rows,
    ).toEqual(
      expect.arrayContaining([
        { owner_user_id: "owner", member_user_id: "bob" },
        { owner_user_id: "bob", member_user_id: "owner" },
      ]),
    );
    expect(
      (await query("SELECT * FROM aforce_circle_users")).rows,
    ).toHaveLength(2);
    expect(
      (
        await query(
          "SELECT owner_user_id, member_user_id FROM aforce_circle_statuses",
        )
      ).rows,
    ).toEqual([{ owner_user_id: "owner", member_user_id: "bob" }]);
  });
});
