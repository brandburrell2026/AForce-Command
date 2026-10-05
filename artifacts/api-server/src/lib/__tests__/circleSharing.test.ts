import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const state = vi.hoisted(() => ({
  grants: [] as any[],
  members: [] as any[],
  present: true,
}));
vi.mock("@workspace/db", async (original) => {
  const actual = await original<typeof import("@workspace/db")>();
  const name = (table: any) => table[Symbol.for("drizzle:Name")];
  const tableRows = (table: any) =>
    name(table) === "aforce_circle_sharing_grants"
      ? state.grants
      : state.members;
  const matching = (rows: any[], where: any) => {
    const query = new PgDialect().sqlToQuery(where);
    const p = query.params;
    if (query.sql.includes('"source_user_id"'))
      return rows.filter(
        (row) =>
          row.sourceUserId === p[0] &&
          (p.length === 1 || row.recipientUserId === p[1]),
      );
    return rows.filter(
      (row) =>
        (row.ownerUserId === p[0] && row.memberUserId === p[1]) ||
        (row.ownerUserId === p[2] && row.memberUserId === p[3]),
    );
  };
  const db: any = {
    execute: async () => ({ rows: [{ present: state.present }] }),
    transaction: async (work: any) => {
      const before = structuredClone(state.grants);
      try {
        return await work(db);
      } catch (err) {
        state.grants = before;
        throw err;
      }
    },
    select: () => {
      let rows: any[];
      return {
        from: (table: any) => {
          rows = tableRows(table);
          return { where: async (where: any) => matching(rows, where) };
        },
      };
    },
    insert: () => ({
      values: (value: any) => ({
        onConflictDoUpdate: () => ({
          returning: async () => {
            const index = state.grants.findIndex(
              (row) =>
                row.sourceUserId === value.sourceUserId &&
                row.recipientUserId === value.recipientUserId,
            );
            if (index < 0) state.grants.push(value);
            else state.grants[index] = value;
            return [value];
          },
        }),
      }),
    }),
  };
  return { ...actual, db };
});
import {
  filterRecordedActivity,
  updateSharingGrant,
  listSharingGrants,
  readCircleActivity,
} from "../circleSharing";
const ack = "circle-sharing-v1";
beforeEach(() => {
  state.grants = [];
  state.present = true;
  state.members = [
    { ownerUserId: "a", memberUserId: "b", status: "active" },
    { ownerUserId: "b", memberUserId: "a", status: "active" },
  ];
  vi.stubEnv("CIRCLE_SHARING_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());
describe("directional explicit sharing consent", () => {
  it("defaults to no grants and requires fresh acknowledgement", async () => {
    expect(await listSharingGrants("a")).toEqual([]);
    await expect(
      updateSharingGrant("a", "b", { fields: ["score"], expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "sharing_acknowledgement_required" });
    expect(state.grants).toEqual([]);
  });
  it("stores only caller's direction and rejects stale expected versions", async () => {
    const saved = await updateSharingGrant("a", "b", {
      fields: ["state"],
      expectedVersion: 0,
      acknowledgementVersion: ack,
    });
    expect(saved).toEqual({
      memberUserId: "b",
      fields: ["state"],
      version: 1,
      acknowledgementVersion: ack,
    });
    expect(await listSharingGrants("b")).toEqual([]);
    await expect(
      updateSharingGrant("a", "b", {
        fields: ["score"],
        expectedVersion: 0,
        acknowledgementVersion: ack,
      }),
    ).rejects.toMatchObject({ code: "sharing_version_conflict" });
    expect(state.grants[0].allowScore).toBe(false);
  });
  it.each(["muted", "pending"])(
    "rejects reciprocal %s membership",
    async (status) => {
      state.members[1].status = status;
      await expect(
        updateSharingGrant("a", "b", {
          fields: ["score"],
          expectedVersion: 0,
          acknowledgementVersion: ack,
        }),
      ).rejects.toMatchObject({ code: "member_not_available" });
    },
  );
  it("rejects unilateral and self membership", async () => {
    state.members.pop();
    await expect(
      updateSharingGrant("a", "b", {
        fields: ["score"],
        expectedVersion: 0,
        acknowledgementVersion: ack,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      updateSharingGrant("a", "a", { fields: [], expectedVersion: 0 }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("revokes with flag off and without current membership or acknowledgement", async () => {
    await updateSharingGrant("a", "b", {
      fields: ["score", "state"],
      expectedVersion: 0,
      acknowledgementVersion: ack,
    });
    vi.stubEnv("CIRCLE_SHARING_ENABLED", "false");
    state.members = [];
    const revoked = await updateSharingGrant("a", "b", {
      fields: [],
      expectedVersion: 1,
    });
    expect(revoked).toEqual({
      memberUserId: "b",
      fields: [],
      version: 2,
      acknowledgementVersion: null,
    });
    await expect(readCircleActivity("b")).rejects.toMatchObject({
      code: "circle_sharing_unavailable",
    });
    await expect(
      updateSharingGrant("a", "b", {
        fields: ["score"],
        expectedVersion: 2,
        acknowledgementVersion: ack,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("missing migration permits empty inspection and safe revocation", async () => {
    state.present = false;
    expect(await listSharingGrants("a")).toEqual([]);
    expect(
      (await updateSharingGrant("a", "b", { fields: [], expectedVersion: 0 }))
        .fields,
    ).toEqual([]);
    await expect(
      updateSharingGrant("a", "b", {
        fields: ["state"],
        expectedVersion: 0,
        acknowledgementVersion: ack,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});
describe("recorded activity projection", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const valid = {
    score: 76,
    level: "BALANCED",
    capturedAt: new Date("2026-10-05T11:00:00Z"),
  };
  it("omits every ungranted field, with no metadata when fields are absent", () => {
    expect(filterRecordedActivity(valid, [], now)).toBeNull();
    expect(filterRecordedActivity(valid, ["score"], now)).toEqual({
      score: 76,
      recordedAt: valid.capturedAt.toISOString(),
      source: "recorded_app_data",
    });
    expect(filterRecordedActivity(valid, ["state"], now)).toEqual({
      state: "Balanced",
      recordedAt: valid.capturedAt.toISOString(),
      source: "recorded_app_data",
    });
  });
  it.each(["NOT_COMPUTED", "UNKNOWN", "toString"])(
    "rejects latest invalid level %s",
    (level) => {
      expect(
        filterRecordedActivity({ ...valid, level }, ["score", "state"], now),
      ).toBeNull();
    },
  );
  it.each([-1, 101, 2.5, NaN, Infinity])(
    "rejects invalid score %s",
    (score) => {
      expect(
        filterRecordedActivity({ ...valid, score }, ["state"], now),
      ).toBeNull();
    },
  );
  it("rejects stale, future and invalid timestamps; accepts exactly 24 hours", () => {
    for (const capturedAt of [
      new Date(now.getTime() + 1),
      new Date(now.getTime() - 86400001),
      new Date(NaN),
    ]) {
      expect(
        filterRecordedActivity({ ...valid, capturedAt }, ["score"], now),
      ).toBeNull();
    }
    expect(
      filterRecordedActivity(
        { ...valid, capturedAt: new Date(now.getTime() - 86400000) },
        ["score"],
        now,
      ),
    ).not.toBeNull();
  });
});
