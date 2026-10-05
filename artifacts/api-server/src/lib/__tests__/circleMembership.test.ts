import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  failInsert: false,
}));
vi.mock("@workspace/db", async (original) => {
  const actual = await original<typeof import("@workspace/db")>();
  const name = (t: any) => t[Symbol.for("drizzle:Name")];
  const params = (w: any) => new PgDialect().sqlToQuery(w).params;
  const match = (t: string, w: any, r: any) => {
    const p = params(w);
    if (t === "aforce_circle_invitations") {
      if (p.length === 3)
        return (
          r.codeHash === p[0] &&
          r.expiresAt > new Date(p[1] as string) &&
          r.ownerUserId !== p[2] &&
          !r.acceptedAt &&
          !r.revokedAt
        );
      if (p.length === 1) return r.ownerUserId === p[0];
      const sql = new PgDialect().sqlToQuery(w).sql;
      if (sql.includes('"expires_at"'))
        return (
          r.ownerUserId === p[0] &&
          r.expiresAt > new Date(p[1] as string) &&
          !r.acceptedAt &&
          !r.revokedAt
        );
      return (
        (sql.includes('"code_hash"') ? r.codeHash : r.id) === p[0] &&
        r.ownerUserId === p[1] &&
        (!sql.includes("is null") || (!r.acceptedAt && !r.revokedAt))
      );
    }
    return (
      (r.ownerUserId === p[0] && r.memberUserId === p[1]) ||
      (p.length === 4 && r.ownerUserId === p[2] && r.memberUserId === p[3])
    );
  };
  const fake: any = {
    execute: async () => undefined,
    transaction: async (fn: any) => {
      const before = structuredClone(state.tables);
      try {
        return await fn(fake);
      } catch (e) {
        state.tables = before;
        throw e;
      }
    },
    select: () => {
      let table: string;
      let where: any;
      const q: any = {
        from: (t: any) => {
          table = name(t);
          return q;
        },
        where: (w: any) => {
          where = w;
          return q;
        },
        orderBy: () => q,
        limit: () => q,
        then: (yes: any, no: any) =>
          Promise.resolve(
            state.tables[table].filter((r) => match(table, where, r)),
          ).then(yes, no),
      };
      return q;
    },
    update: (t: any) => {
      let values: any, where: any;
      const table = name(t);
      const q: any = {
        set: (v: any) => {
          values = v;
          return q;
        },
        where: (w: any) => {
          where = w;
          return q;
        },
        returning: async () => {
          const rows = state.tables[table].filter((r) =>
            match(table, where, r),
          );
          rows.forEach((r) => Object.assign(r, values));
          return rows;
        },
      };
      return q;
    },
    insert: (t: any) => {
      let values: any[];
      const table = name(t);
      const insert = () => {
        if (state.failInsert) throw new Error("write failure");
        for (const row of values) {
          const existing =
            table === "aforce_circle_users" &&
            state.tables[table].find(
              (r) =>
                r.ownerUserId === row.ownerUserId &&
                r.memberUserId === row.memberUserId,
            );
          if (existing) {
            if (existing.status === "pending") existing.status = "active";
          } else
            state.tables[table].push({
              status: "active",
              joinedAt: new Date(),
              ...row,
            });
        }
        return values;
      };
      return {
        values: (v: any) => {
          values = Array.isArray(v) ? v : [v];
          return {
            returning: async () => insert(),
            onConflictDoUpdate: async () => insert(),
          };
        },
      };
    },
    delete: (t: any) => ({
      where: async (w: any) => {
        const table = name(t);
        state.tables[table] = state.tables[table].filter(
          (r) => !match(table, w, r),
        );
      },
    }),
  };
  return { ...actual, db: fake };
});
import {
  createInvitation,
  acceptInvitation,
  revokeInvitation,
  listInvitations,
  removeMembership,
  hashInvitation,
} from "../circleMembership";
const identity = { displayName: "Alice", group: "friends" };
const invites = () => state.tables.aforce_circle_invitations;
const members = () => state.tables.aforce_circle_users;
beforeEach(() => {
  state.tables = {
    aforce_circle_invitations: [],
    aforce_circle_users: [],
    aforce_circle_statuses: [],
  };
  state.failInsert = false;
});
describe("Circle invitation transactions", () => {
  it("creates a random one-use secret, stores only its digest, and lists only owner metadata", async () => {
    const first = await createInvitation("a", identity);
    const second = await createInvitation("a", identity);
    expect(first.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.code).not.toBe(second.code);
    expect(invites()[0].codeHash).toBe(hashInvitation(first.code));
    expect(JSON.stringify(invites())).not.toContain(first.code);
    expect(await listInvitations("b")).toEqual([]);
    expect(JSON.stringify(await listInvitations("a"))).not.toContain(
      "codeHash",
    );
  });
  it("caps live invites at ten and frees capacity after revoke", async () => {
    for (let i = 0; i < 10; i++) await createInvitation("a", identity);
    await expect(createInvitation("a", identity)).rejects.toMatchObject({
      code: "invitation_limit_reached",
    });
    await revokeInvitation("a", invites()[0].id);
    await createInvitation("a", identity);
    expect(await listInvitations("a")).toHaveLength(10);
  });
  it("accepts reciprocally without health sharing, clears stale snapshots, rejects replay", async () => {
    const { code } = await createInvitation("a", identity);
    state.tables.aforce_circle_statuses.push(
      { ownerUserId: "a", memberUserId: "b" },
      { ownerUserId: "b", memberUserId: "a" },
      { ownerUserId: "c", memberUserId: "d" },
    );
    const user = await acceptInvitation("b", code, {
      displayName: "Bob",
      group: "family",
    });
    expect(user.memberUserId).toBe("a");
    expect(members()).toHaveLength(2);
    expect(members().find((r) => r.ownerUserId === "a").name).toBe("Bob");
    expect(state.tables.aforce_circle_statuses).toEqual([
      { ownerUserId: "c", memberUserId: "d" },
    ]);
    await expect(acceptInvitation("c", code, identity)).rejects.toMatchObject({
      code: "invitation_unavailable",
    });
  });
  it("rejects self, expiration, and revoked invitations without consuming", async () => {
    const { code, invitation } = await createInvitation("a", identity);
    await expect(acceptInvitation("a", code, identity)).rejects.toMatchObject({
      code: "cannot_accept_own_invitation",
    });
    expect(invites()[0].acceptedAt).toBeUndefined();
    invites()[0].expiresAt = new Date(0);
    await expect(acceptInvitation("b", code, identity)).rejects.toMatchObject({
      code: "invitation_unavailable",
    });
    invites()[0].expiresAt = new Date(Date.now() + 100000);
    await revokeInvitation("a", invitation.id);
    await expect(acceptInvitation("b", code, identity)).rejects.toMatchObject({
      code: "invitation_unavailable",
    });
    expect(members()).toEqual([]);
  });
  it("prevents cross-owner revocation and unrelated relationship deletion", async () => {
    const { invitation } = await createInvitation("a", identity);
    await expect(revokeInvitation("b", invitation.id)).rejects.toMatchObject({
      status: 404,
    });
    state.tables.aforce_circle_users.push({
      ownerUserId: "b",
      memberUserId: "c",
    });
    await removeMembership("a", "c");
    expect(members()).toHaveLength(1);
  });
  it("removes both directions and shared snapshots", async () => {
    const { code } = await createInvitation("a", identity);
    await acceptInvitation("b", code, identity);
    await removeMembership("a", "b");
    expect(members()).toEqual([]);
  });
  it("rolls back token consumption and snapshot deletion if membership write fails", async () => {
    const { code } = await createInvitation("a", identity);
    state.failInsert = true;
    await expect(acceptInvitation("b", code, identity)).rejects.toThrow(
      "write failure",
    );
    expect(invites()[0].acceptedAt).toBeUndefined();
    expect(members()).toEqual([]);
  });
  it("promotes a pending relationship and preserves muted preferences", async () => {
    const { code } = await createInvitation("a", identity);
    members().push(
      { ownerUserId: "a", memberUserId: "b", status: "pending" },
      { ownerUserId: "b", memberUserId: "a", status: "muted" },
    );
    await acceptInvitation("b", code, identity);
    expect(members().map((r) => r.status)).toEqual(["active", "muted"]);
  });
});
