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
describe("legacy Circle sharing retirement", () => {
  it("fails closed for every score/state grant request", async () => {
    expect(await listSharingGrants("a")).toEqual([]);
    for (const fields of [["score"], ["state"], ["score", "state"]] as const) {
      await expect(
        updateSharingGrant("a", "b", {
          fields: [...fields],
          expectedVersion: 0,
          acknowledgementVersion: ack,
        }),
      ).rejects.toMatchObject({ code: "legacy_circle_sharing_retired", status: 410 });
    }
    expect(state.grants).toEqual([]);
  });

  it("permits revocation of an existing legacy grant without membership or a rollout flag", async () => {
    state.grants = [{
      sourceUserId: "a", recipientUserId: "b", allowScore: true, allowState: true,
      version: 1, acknowledgementVersion: ack, updatedAt: new Date(),
    }];
    vi.stubEnv("CIRCLE_SHARING_ENABLED", "false");
    state.members = [];
    const revoked = await updateSharingGrant("a", "b", {
      fields: [], expectedVersion: 1,
    });
    expect(revoked).toEqual({
      memberUserId: "b", fields: [], version: 2, acknowledgementVersion: null,
    });
  });

  it("returns no legacy score/state activity even if historical grants exist", async () => {
    expect(await readCircleActivity("b")).toEqual([]);
  });

  it("keeps missing-migration revocation safe", async () => {
    state.present = false;
    expect(
      (await updateSharingGrant("a", "b", { fields: [], expectedVersion: 0 })).fields,
    ).toEqual([]);
    await expect(
      updateSharingGrant("a", "b", {
        fields: ["state"], expectedVersion: 0, acknowledgementVersion: ack,
      }),
    ).rejects.toMatchObject({ code: "legacy_circle_sharing_retired", status: 410 });
  });
});
