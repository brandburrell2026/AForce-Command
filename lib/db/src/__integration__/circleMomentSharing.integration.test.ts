/** Private Circle Moment shares against an isolated disposable PostgreSQL. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { readFileSync } from "node:fs";

const holder = vi.hoisted(() => ({ db: null as any }));
vi.mock("@workspace/db", async () => ({
  ...(await import("../schema")),
  db: new Proxy({}, {
    get: (_target, key) => {
      const value = holder.db[key];
      return typeof value === "function" ? value.bind(holder.db) : value;
    },
  }),
}));

import { acceptInvitation, createInvitation, removeMembership } from "../../../../artifacts/api-server/src/lib/circleMembership";
import { clearMomentSharesForUser, listIncomingMomentShares, revokeMomentShare, shareMoment } from "../../../../artifacts/api-server/src/lib/circleMoments";
import { readCircleActivity, updateSharingGrant } from "../../../../artifacts/api-server/src/lib/circleSharing";

let container: StartedPostgreSqlContainer | undefined;
let pool: pg.Pool | undefined;
const query = (sql: string, params?: unknown[]) => pool!.query(sql, params);
const identity = { displayName: "QA member", group: "friends" };

async function connect(first = "alice", second = "bob") {
  const invitation = await createInvitation(first, identity);
  await acceptInvitation(second, invitation.code, identity);
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine").start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri(), max: 8, statement_timeout: 10000 });
  holder.db = drizzle(pool);
  for (const name of ["20261005_circle_invitations.sql", "20261106_circle_moment_shares.sql"]) {
    await query(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
  }
  await query(`CREATE TABLE aforce_circle_users (
    id serial PRIMARY KEY, owner_user_id text NOT NULL, member_user_id text NOT NULL,
    name text NOT NULL, initials text NOT NULL, city text, "group" text NOT NULL DEFAULT 'friends',
    status text NOT NULL DEFAULT 'active', joined_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(owner_user_id, member_user_id));
    CREATE TABLE aforce_circle_statuses (
    id serial PRIMARY KEY, owner_user_id text NOT NULL, member_user_id text NOT NULL,
    score integer NOT NULL DEFAULT 0, state text NOT NULL DEFAULT 'Balanced', streak_days integer NOT NULL DEFAULT 0,
    protocol_complete boolean NOT NULL DEFAULT false, trend text NOT NULL DEFAULT 'flat', updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(owner_user_id, member_user_id));`);
});

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

beforeEach(async () => {
  await query("TRUNCATE aforce_circle_invitations, aforce_circle_users, aforce_circle_statuses, aforce_circle_moment_shares");
  await connect();
});

describe("Circle Moment sharing on Postgres", () => {
  it("shares only a selected Moment title and time with the selected active member", async () => {
    const shared = await shareMoment("alice", {
      memberUserId: "bob",
      momentId: "moment-1",
      title: "Team sync",
      startsAt: new Date("2026-11-07T14:00:00.000Z"),
    });

    expect(Object.keys(shared).sort()).toEqual(
      ["id", "sourceUserId", "recipientUserId", "momentId", "title", "startsAt", "sharedAt"].sort(),
    );
    expect(await listIncomingMomentShares("alice")).toEqual([]);
    expect(await listIncomingMomentShares("bob")).toMatchObject([
      { id: shared.id, sourceUserId: "alice", recipientUserId: "bob", momentId: "moment-1", title: "Team sync", startsAt: "2026-11-07T14:00:00.000Z" },
    ]);
  });

  it("does not allow a stale connection to create or retain a Moment share", async () => {
    const shared = await shareMoment("alice", {
      memberUserId: "bob", momentId: "moment-1", title: "Doctor visit", startsAt: new Date("2026-11-07T14:00:00.000Z"),
    });
    await removeMembership("alice", "bob");
    expect(await listIncomingMomentShares("bob")).toEqual([]);
    await expect(revokeMomentShare("alice", shared.id)).rejects.toMatchObject({ code: "moment_share_not_found" });
    await expect(shareMoment("alice", {
      memberUserId: "bob", momentId: "moment-2", title: "Private", startsAt: new Date("2026-11-07T15:00:00.000Z"),
    })).rejects.toMatchObject({ code: "member_not_available" });
  });

  it("withdraws sent and received Moments during account-side deletion cleanup", async () => {
    await shareMoment("alice", {
      memberUserId: "bob", momentId: "moment-1", title: "Planning", startsAt: new Date("2026-11-07T14:00:00.000Z"),
    });
    await holder.db.transaction((tx: any) => clearMomentSharesForUser(tx, "alice"));
    expect(await listIncomingMomentShares("bob")).toEqual([]);
  });

  it("keeps retired score/state sharing unavailable", async () => {
    await expect(updateSharingGrant("alice", "bob", {
      fields: ["score"], expectedVersion: 0, acknowledgementVersion: "circle-sharing-v1",
    })).rejects.toMatchObject({ code: "legacy_circle_sharing_retired", status: 410 });
    expect(await readCircleActivity("bob")).toEqual([]);
  });
});
