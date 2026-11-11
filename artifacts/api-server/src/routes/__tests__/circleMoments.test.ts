import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "node:http";

const mock = vi.hoisted(() => ({
  userId: "source" as string | null,
  create: vi.fn(),
  list: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: mock.userId }) }));
vi.mock("../../lib/circleMoments", async (original) => ({
  ...(await original<typeof import("../../lib/circleMoments")>()),
  shareMoment: mock.create,
  listIncomingMomentShares: mock.list,
  revokeMomentShare: mock.revoke,
}));

import router from "../circleMoments";

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

function call(path: string, method = "GET", body?: unknown) {
  return fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("Circle Moment-sharing HTTP boundary", () => {
  it("requires real authentication", async () => {
    mock.userId = null;
    expect((await call("/moment-shares")).status).toBe(401);
    expect(mock.list).not.toHaveBeenCalled();
  });

  it("accepts only the explicit Moment projection", async () => {
    mock.create.mockResolvedValue({ id: "share", title: "Training", startsAt: "2026-11-07T15:00:00.000Z" });
    const response = await call("/moment-shares", "POST", {
      memberUserId: "recipient",
      momentId: "moment-1",
      title: "Training",
      startsAt: "2026-11-07T15:00:00.000Z",
    });
    expect(response.status).toBe(201);
    expect(mock.create).toHaveBeenCalledWith("source", {
      memberUserId: "recipient",
      momentId: "moment-1",
      title: "Training",
      startsAt: new Date("2026-11-07T15:00:00.000Z"),
    });
  });

  it("rejects health and performance payload fields", async () => {
    const body = {
      memberUserId: "recipient",
      momentId: "moment-1",
      title: "Training",
      startsAt: "2026-11-07T15:00:00.000Z",
      score: 98,
    };
    expect((await call("/moment-shares", "POST", body)).status).toBe(400);
    expect(mock.create).not.toHaveBeenCalled();
  });

  it("keeps reads private and lets only the sender revoke", async () => {
    mock.list.mockResolvedValue([]);
    const list = await call("/moment-shares");
    expect(list.headers.get("cache-control")).toBe("private, no-store");
    expect(mock.list).toHaveBeenCalledWith("source");
    expect((await call("/moment-shares/share-1", "DELETE")).status).toBe(204);
    expect(mock.revoke).toHaveBeenCalledWith("source", "share-1");
  });
});
