import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "node:http";
const mock = vi.hoisted(() => ({
  userId: "source" as string | null,
  update: vi.fn(),
  list: vi.fn(),
  activity: vi.fn(),
}));
vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: mock.userId }) }));
vi.mock("../../lib/circleSharing", async (original) => ({
  ...(await original<typeof import("../../lib/circleSharing")>()),
  updateSharingGrant: mock.update,
  listSharingGrants: mock.list,
  readCircleActivity: mock.activity,
}));
import router from "../circleSharing";
import { CircleSharingError } from "../../lib/circleSharing";
let server: http.Server;
let base: string;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("CLERK_SECRET_KEY", "configured");
  mock.userId = "source";
  const app = express();
  app.use(express.json());
  app.use(router);
  server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  if (server?.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()));
});
const call = (path: string, method = "GET", data?: unknown) =>
  fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
describe("sharing HTTP privacy boundary", () => {
  it("requires real authentication in development", async () => {
    mock.userId = null;
    expect((await call("/activity")).status).toBe(401);
    expect((await call("/sharing")).status).toBe(401);
    expect(mock.activity).not.toHaveBeenCalled();
  });
  it("rejects unknown fields, caller identity injection and missing versions", async () => {
    for (const body of [
      { fields: ["score"] },
      { fields: ["email"], expectedVersion: 0 },
      { fields: [], expectedVersion: 0, sourceUserId: "victim" },
      { fields: ["score", "score"], expectedVersion: 0 },
    ]) {
      expect((await call("/sharing/recipient", "PUT", body)).status).toBe(400);
    }
    expect(mock.update).not.toHaveBeenCalled();
  });
  it("rejects score/state grants before they reach the service and keeps inspection private", async () => {
    mock.list.mockResolvedValue([]);
    const response = await call("/sharing/recipient", "PUT", {
      fields: ["score"],
      expectedVersion: 0,
      acknowledgementVersion: "circle-sharing-v1",
    });
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "legacy_circle_sharing_retired" });
    expect(mock.update).not.toHaveBeenCalled();
    const grants = await call("/sharing");
    expect(grants.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.list).toHaveBeenCalledWith("source");
  });
  it("routes revoke with no acknowledgement even when rollout is off", async () => {
    vi.stubEnv("CIRCLE_SHARING_ENABLED", "false");
    mock.update.mockResolvedValue({ fields: [], version: 2 });
    expect(
      (await call("/sharing/recipient", "DELETE", { expectedVersion: 1 }))
        .status,
    ).toBe(200);
    expect(mock.update).toHaveBeenCalledWith("source", "recipient", {
      fields: [],
      expectedVersion: 1,
    });
  });
  it("returns version conflict and disabled feed errors without payload leakage", async () => {
    mock.update.mockRejectedValue(
      new CircleSharingError("sharing_version_conflict", 409),
    );
    const conflict = await call("/sharing/recipient", "PUT", {
      fields: [],
      expectedVersion: 0,
    });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      error: "sharing_version_conflict",
    });
    mock.activity.mockRejectedValue(
      new CircleSharingError("circle_sharing_unavailable", 503),
    );
    expect((await call("/activity")).status).toBe(503);
  });
});
