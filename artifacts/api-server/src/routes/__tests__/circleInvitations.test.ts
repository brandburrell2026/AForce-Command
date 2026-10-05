import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "node:http";
const mock = vi.hoisted(() => ({
  userId: "user_a" as string | null,
  create: vi.fn(),
  accept: vi.fn(),
  list: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: mock.userId }) }));
vi.mock("../../lib/circleMembership", async (original) => ({
  ...(await original<typeof import("../../lib/circleMembership")>()),
  createInvitation: mock.create,
  acceptInvitation: mock.accept,
  listInvitations: mock.list,
  revokeInvitation: mock.revoke,
}));
import circle from "../circle";
let server: http.Server, base: string;
beforeEach(async () => {
  vi.stubEnv("CIRCLE_MEMBERSHIP_ENABLED", "true");
  vi.stubEnv("CLERK_SECRET_KEY", "test");
  mock.userId = "user_a";
  vi.clearAllMocks();
  const app = express();
  app.use(express.json());
  app.use("/circle", circle);
  server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as any).port}/circle`;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server?.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()));
});
const post = (path: string, data: unknown) =>
  fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
describe("Circle invitation HTTP boundary", () => {
  it("gates all new routes without touching persistence", async () => {
    vi.stubEnv("CIRCLE_MEMBERSHIP_ENABLED", "false");
    const response = await post("/invitations", { displayName: "Alice" });
    expect(response.status).toBe(503);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("rejects demo fallback and missing real auth in development", async () => {
    mock.userId = null;
    const response = await post("/invitations", { displayName: "Alice" });
    expect(response.status).toBe(401);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it("validates body and never accepts caller-supplied owner identity", async () => {
    expect((await post("/invitations", { displayName: "  " })).status).toBe(
      400,
    );
    mock.create.mockResolvedValue({ invitation: { id: "i" }, code: "secret" });
    const response = await post("/invitations", {
      displayName: " Alice ",
      ownerUserId: "victim",
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.create).toHaveBeenCalledWith("user_a", {
      displayName: "Alice",
      group: "friends",
    });
  });
  it("scopes list and revoke to authenticated caller", async () => {
    mock.list.mockResolvedValue([]);
    mock.revoke.mockResolvedValue(undefined);
    expect((await fetch(base + "/invitations")).status).toBe(200);
    expect(
      (await fetch(base + "/invitations/other", { method: "DELETE" })).status,
    ).toBe(200);
    expect(mock.list).toHaveBeenCalledWith("user_a");
    expect(mock.revoke).toHaveBeenCalledWith("user_a", "other");
  });
  it("rejects malformed codes before attempting redemption", async () => {
    expect(
      (await post("/invitations/accept", { displayName: "Bob", code: "guess" }))
        .status,
    ).toBe(400);
    expect(mock.accept).not.toHaveBeenCalled();
  });
});
