/** Production consent/feed operations on disposable PostgreSQL only. */
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
vi.mock("@workspace/db", async () => ({
  ...(await import("../schema")),
  ...(await import("../whoopTokenStore")),
  ...(await import("../garminTokenStore")),
  ...(await import("../ouraTokenStore")),
  ...(await import("../stravaTokenStore")),
  ...(await import("../healthRecordsRepo")),
  ...(await import("../accountDeletionCascade")),
  db: new Proxy(
    {},
    {
      get: (_target, key) => {
        const value = holder.db[key];
        return typeof value === "function" ? value.bind(holder.db) : value;
      },
    },
  ),
}));
import {
  listSharingGrants,
  updateSharingGrant,
  readCircleActivity,
  clearCircleSharingForUser,
  SHARING_ACKNOWLEDGEMENT,
} from "../../../../artifacts/api-server/src/lib/circleSharing";
import {
  createInvitation,
  acceptInvitation,
  removeMembership,
} from "../../../../artifacts/api-server/src/lib/circleMembership";
import { buildDefaultAccountDeletionDeps } from "../../../../artifacts/api-server/src/routes/accountDeletion";

let container: StartedPostgreSqlContainer | undefined;
let pool: pg.Pool | undefined;
const originalFlag = process.env.CIRCLE_SHARING_ENABLED;
const query = (sql: string, params?: unknown[]) => pool!.query(sql, params);
const identity = { displayName: "QA member", group: "friends" };
async function connect(a = "alice", b = "bob") {
  const invitation = await createInvitation(a, identity);
  await acceptInvitation(b, invitation.code, identity);
}
async function version(a = "alice", b = "bob") {
  return (
    (await listSharingGrants(a)).find((row) => row.memberUserId === b)
      ?.version ?? 0
  );
}
async function grant(fields: ("score" | "state")[], a = "alice", b = "bob") {
  return updateSharingGrant(a, b, {
    fields,
    expectedVersion: await version(a, b),
    acknowledgementVersion: SHARING_ACKNOWLEDGEMENT,
  });
}
async function snapshot(score = 81, level = "PEAK", ageMs = 60000) {
  await query(
    "INSERT INTO aforce_score_snapshots(user_id,score,level,captured_at) VALUES ($1,$2,$3,$4)",
    ["alice", score, level, new Date(Date.now() - ageMs)],
  );
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine").start();
  pool = new pg.Pool({
    connectionString: container.getConnectionUri(),
    max: 8,
    statement_timeout: 10000,
  });
  holder.db = drizzle(pool);
  for (const name of [
    "20261005_circle_invitations.sql",
    "20261005_circle_sharing.sql",
  ]) {
    await query(
      readFileSync(
        new URL(`../../migrations/${name}`, import.meta.url),
        "utf8",
      ),
    );
  }
  await query(`CREATE TABLE aforce_circle_users (
    id serial PRIMARY KEY, owner_user_id text NOT NULL, member_user_id text NOT NULL,
    name text NOT NULL, initials text NOT NULL, city text, "group" text NOT NULL DEFAULT 'friends',
    status text NOT NULL DEFAULT 'active', joined_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_user_id,member_user_id));
    CREATE TABLE aforce_circle_statuses (
    id serial PRIMARY KEY, owner_user_id text NOT NULL, member_user_id text NOT NULL,
    score integer NOT NULL DEFAULT 0, state text NOT NULL DEFAULT 'Balanced', streak_days integer NOT NULL DEFAULT 0,
    protocol_complete boolean NOT NULL DEFAULT false, trend text NOT NULL DEFAULT 'flat',
    updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_user_id,member_user_id));
    CREATE TABLE aforce_score_snapshots (id serial PRIMARY KEY,user_id text NOT NULL,score integer NOT NULL,level text NOT NULL,captured_at timestamptz NOT NULL);
    CREATE TABLE aforce_privacy (user_id text PRIMARY KEY, scope text NOT NULL, fields jsonb NOT NULL);`);
  // Minimal real tables touched by the production health-delete cascade.
  for (const provider of ["whoop", "garmin", "oura", "strava"]) {
    await query(`CREATE TABLE aforce_${provider}_tokens (user_id text PRIMARY KEY);
      CREATE TABLE aforce_${provider}_auth_states (user_id text NOT NULL);`);
  }
  await query(`CREATE TABLE aforce_user_state (user_id text PRIMARY KEY, biometrics jsonb);
    CREATE TABLE aforce_health_records (id text PRIMARY KEY, user_id text NOT NULL);`);
});
afterAll(async () => {
  await pool?.end();
  await container?.stop();
  if (originalFlag === undefined) delete process.env.CIRCLE_SHARING_ENABLED;
  else process.env.CIRCLE_SHARING_ENABLED = originalFlag;
});
beforeEach(async () => {
  process.env.CIRCLE_SHARING_ENABLED = "true";
  await query(
    "TRUNCATE aforce_circle_invitations,aforce_circle_users,aforce_circle_statuses,aforce_circle_sharing_grants,aforce_score_snapshots,aforce_privacy",
  );
  await connect();
});

describe("Circle sharing consent and lifecycle on Postgres", () => {
  it("production health-delete transaction rolls back consent on SQL failure and commits revocation on retry", async () => {
    await grant(["score"]);
    await snapshot();
    const initialVersion = await version();
    await query("INSERT INTO aforce_whoop_tokens VALUES ('alice')");
    await query(
      "INSERT INTO aforce_health_records VALUES ('qa-record','alice')",
    );
    const deletion = buildDefaultAccountDeletionDeps(
      holder.db,
    ).runCascadeInTransaction!;
    // Fail at the final cascade step, after sharing and provider-token cleanup.
    await query(
      "ALTER TABLE aforce_health_records RENAME TO unavailable_health_records",
    );
    try {
      await expect(deletion("alice")).rejects.toThrow();
      expect(await version()).toBe(initialVersion);
      expect(await readCircleActivity("bob")).toHaveLength(1);
      expect(
        (await query("SELECT * FROM aforce_whoop_tokens")).rows,
      ).toHaveLength(1);
    } finally {
      await query(
        "ALTER TABLE unavailable_health_records RENAME TO aforce_health_records",
      );
    }
    process.env.CIRCLE_SHARING_ENABLED = "false";
    await expect(deletion("alice")).resolves.toEqual({ purged: 1 });
    process.env.CIRCLE_SHARING_ENABLED = "true";
    expect(await readCircleActivity("bob")).toEqual([]);
    expect(
      (await query("SELECT * FROM aforce_health_records")).rows,
    ).toHaveLength(0);
    expect(
      (await query("SELECT * FROM aforce_whoop_tokens")).rows,
    ).toHaveLength(0);
    // Health-only deletion intentionally preserves recorded score history.
    expect(
      (await query("SELECT * FROM aforce_score_snapshots")).rows,
    ).toHaveLength(1);
    // Only another explicit acknowledgement and current version can share it again.
    await expect(
      updateSharingGrant("alice", "bob", {
        fields: ["score"],
        expectedVersion: initialVersion,
        acknowledgementVersion: SHARING_ACKNOWLEDGEMENT,
      }),
    ).rejects.toMatchObject({ code: "sharing_version_conflict" });
    await grant(["score"]);
    expect(await readCircleActivity("bob")).toHaveLength(1);
  });
  it("denies legacy preview preferences and exposes exactly the selected fields after fresh consent", async () => {
    await snapshot();
    await query(
      `INSERT INTO aforce_privacy VALUES ('alice','circle','{"score":true,"state":true}')`,
    );
    expect(await readCircleActivity("bob")).toEqual([]);
    await grant(["score"]);
    const score = await readCircleActivity("bob");
    expect(score).toHaveLength(1);
    expect(Object.keys(score[0]).sort()).toEqual(
      ["userId", "name", "initials", "score", "recordedAt", "source"].sort(),
    );
    expect(score[0].score).toBe(81);
    expect(await readCircleActivity("alice")).toEqual([]);
    await grant(["state"]);
    const state = await readCircleActivity("bob");
    expect(Object.keys(state[0]).sort()).toEqual(
      ["userId", "name", "initials", "state", "recordedAt", "source"].sort(),
    );
    expect(state[0].state).toBe("Peak");
  });

  it.each([
    [0, "NOT_COMPUTED", 0],
    [101, "PEAK", 0],
    [81, "UNKNOWN", 0],
    [81, "PEAK", -60000],
  ])(
    "does not fall back from a newer inadmissible record (%s,%s,%s)",
    async (score, level, age) => {
      await grant(["score", "state"]);
      await snapshot();
      await snapshot(score as number, level as string, age as number);
      expect(await readCircleActivity("bob")).toEqual([]);
    },
  );

  it("requires fresh records and both active membership directions", async () => {
    await grant(["score"]);
    await snapshot(81, "PEAK", 86400001);
    expect(await readCircleActivity("bob")).toEqual([]);
    await snapshot();
    await query(
      "UPDATE aforce_circle_users SET status='muted' WHERE owner_user_id='alice'",
    );
    expect(await readCircleActivity("bob")).toEqual([]);
  });

  it("permits one concurrent save for a consent version and rejects the stale writer", async () => {
    const expectedVersion = await version();
    const results = await Promise.allSettled([
      updateSharingGrant("alice", "bob", {
        fields: ["score"],
        expectedVersion,
        acknowledgementVersion: SHARING_ACKNOWLEDGEMENT,
      }),
      updateSharingGrant("alice", "bob", {
        fields: ["state"],
        expectedVersion,
        acknowledgementVersion: SHARING_ACKNOWLEDGEMENT,
      }),
    ]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    const failed = results.find(
      (row) => row.status === "rejected",
    ) as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: "sharing_version_conflict" });
    expect(await version()).toBe(expectedVersion + 1);
  });

  it("allows revocation with sharing disabled and denies the next enabled feed read", async () => {
    await grant(["score"]);
    await snapshot();
    process.env.CIRCLE_SHARING_ENABLED = "false";
    await grant([]);
    process.env.CIRCLE_SHARING_ENABLED = "true";
    expect(await readCircleActivity("bob")).toEqual([]);
  });

  it("removal and rejoin never restore a grant or accept a stale first opt-in", async () => {
    // Simulate a connection created before the additive sharing migration.
    await query("DELETE FROM aforce_circle_sharing_grants");
    const beforeFirstOptIn = await version();
    await removeMembership("alice", "bob");
    await connect();
    await expect(
      updateSharingGrant("alice", "bob", {
        fields: ["score"],
        expectedVersion: beforeFirstOptIn,
        acknowledgementVersion: SHARING_ACKNOWLEDGEMENT,
      }),
    ).rejects.toMatchObject({ code: "sharing_version_conflict" });
    await grant(["score"]);
    await snapshot();
    await removeMembership("alice", "bob");
    await connect();
    expect(await readCircleActivity("bob")).toEqual([]);
  });

  it("health cleanup invalidates a pending first opt-in even while sharing is disabled", async () => {
    await query("DELETE FROM aforce_circle_sharing_grants");
    const beforeFirstOptIn = await version();
    process.env.CIRCLE_SHARING_ENABLED = "false";
    await holder.db.transaction((tx: any) =>
      clearCircleSharingForUser(tx, "alice"),
    );
    process.env.CIRCLE_SHARING_ENABLED = "true";
    await expect(
      updateSharingGrant("alice", "bob", {
        fields: ["score"],
        expectedVersion: beforeFirstOptIn,
        acknowledgementVersion: SHARING_ACKNOWLEDGEMENT,
      }),
    ).rejects.toMatchObject({ code: "sharing_version_conflict" });
  });

  it("concurrent removal and grant cannot leave a live grant after reconnection", async () => {
    const expectedVersion = await version();
    const results = await Promise.allSettled([
      updateSharingGrant("alice", "bob", {
        fields: ["score"],
        expectedVersion,
        acknowledgementVersion: SHARING_ACKNOWLEDGEMENT,
      }),
      removeMembership("alice", "bob"),
    ]);
    expect(results[1].status).toBe("fulfilled");
    expect(
      (await query("SELECT * FROM aforce_circle_users")).rows,
    ).toHaveLength(0);
    expect(
      (await listSharingGrants("alice")).find(
        (row) => row.memberUserId === "bob",
      )?.fields,
    ).toEqual([]);
    await connect();
    await snapshot();
    expect(await readCircleActivity("bob")).toEqual([]);
  });
});
