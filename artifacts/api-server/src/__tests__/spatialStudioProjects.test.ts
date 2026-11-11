import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { createMemorySpatialStudioStore } from "../lib/spatialStudio/memoryProjectStore";
import { ProjectBodySchema, isValidProjectId } from "../lib/spatialStudio/projectBody";
import { buildSpatialStudioProjectsRouter } from "../routes/spatialStudioProjects";

const document = {
  schemaVersion: 1,
  name: "Test activation",
  unit: "ft",
  floor: { width: 20, depth: 20, wallHeight: 10 },
  fixtures: [
    {
      id: "centerpiece",
      kind: "centerpiece",
      label: "Inverted-N centerpiece",
      description: "",
      position: [0, 0, 0.5],
      rotationY: 0,
      footprint: { width: 6, depth: 6, height: 7.5 },
    },
  ],
  style: { accent: "#C1281B" },
  assets: [],
};

describe("project body validation", () => {
  it("accepts a well-formed project and rejects bad ids and non-image assets", () => {
    expect(ProjectBodySchema.safeParse({ name: "A", document, thumbnail: null, expectedUpdatedAt: null }).success).toBe(true);
    expect(isValidProjectId("project-m2x9k-1")).toBe(true);
    expect(isValidProjectId("../etc")).toBe(false);
    expect(isValidProjectId("ab")).toBe(false);
    const withBadAsset = {
      ...document,
      assets: [{ id: "a1", kind: "logo", name: "x", dataUrl: "javascript:alert(1)", width: 1, height: 1, bytes: 1 }],
    };
    expect(ProjectBodySchema.safeParse({ name: "A", document: withBadAsset, thumbnail: null, expectedUpdatedAt: null }).success).toBe(false);
  });
});

describe("projects router", () => {
  let server: http.Server;
  let base = "";
  let userId = "user_a";

  beforeAll(async () => {
    const app = express();
    const router = buildSpatialStudioProjectsRouter({
      store: createMemorySpatialStudioStore(),
      auth: (req, _res, next) => {
        (req as express.Request & { userId?: string }).userId = userId;
        next();
      },
      skipRateLimit: true,
    });
    app.use("/api/spatial-studio/projects", router);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/spatial-studio/projects`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const put = (id: string, body: unknown) =>
    fetch(`${base}/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("creates, lists, reads, conflicts on stale writes, and soft-deletes, all owner scoped", async () => {
    userId = "user_a";
    const created = await put("project-one", { name: "One", document, thumbnail: null, expectedUpdatedAt: null });
    expect(created.status).toBe(201);
    const meta = ((await created.json()) as { project: { updatedAt: string; fixtureCount: number } }).project;
    expect(meta.fixtureCount).toBe(1);

    const list = (await (await fetch(base)).json()) as { projects: Array<{ id: string }> };
    expect(list.projects.map((p) => p.id)).toEqual(["project-one"]);

    const read = await fetch(`${base}/project-one`);
    expect(read.status).toBe(200);

    const stale = await put("project-one", {
      name: "One edited elsewhere",
      document,
      thumbnail: null,
      expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
    });
    expect(stale.status).toBe(409);

    const fresh = await put("project-one", { name: "One v2", document, thumbnail: null, expectedUpdatedAt: meta.updatedAt });
    expect(fresh.status).toBe(200);

    userId = "user_b";
    expect((await fetch(`${base}/project-one`)).status).toBe(404);
    expect((await fetch(`${base}/project-one`, { method: "DELETE" })).status).toBe(404);

    userId = "user_a";
    expect((await fetch(`${base}/project-one`, { method: "DELETE" })).status).toBe(204);
    expect((await fetch(`${base}/project-one`)).status).toBe(404);
  });

  it("rejects malformed ids and bodies", async () => {
    userId = "user_a";
    expect((await fetch(`${base}/x`)).status).toBe(400);
    const bad = await put("project-two", { name: "", document, thumbnail: null, expectedUpdatedAt: null });
    expect(bad.status).toBe(400);
  });
});
