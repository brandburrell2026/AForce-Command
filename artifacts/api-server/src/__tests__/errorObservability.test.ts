/**
 * Wave-3 PR8 — production error observability (server side, no vendor).
 *
 * Before: no process-level handlers (an unhandled rejection crashed with
 * zero log output), no Express error middleware (route throws fell
 * through to the default HTML page, unlogged), requireAuth's prod
 * misconfig logged via raw console.error (unstructured, unredacted),
 * and ~40 logger.error({err}) sites bypassed the token-scrubbing
 * serializeError.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import type { Server } from "node:http";

vi.mock("../lib/logger", () => ({
  logger: { error: vi.fn(), warn: () => {}, info: () => {}, debug: () => {}, fatal: vi.fn() },
}));

import { serializeError } from "../lib/serializeError";
import { logger } from "../lib/logger";

describe("error middleware behavior", () => {
  it("an uncaught route throw → structured redacted log + fixed JSON 500", async () => {
    const app = express();
    app.get("/boom", () => {
      throw new Error("kaboom Bearer secrettoken1234567890abcdefghijklmnop");
    });
    // mirror the app.ts middleware exactly
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      logger.error({ err: serializeError(err), url: req.url.split("?")[0] }, "unhandled route error");
      if (!res.headersSent) res.status(500).json({ error: "internal_error" });
    });
    const server: Server = await new Promise((r) => {
      const s = app.listen(0, () => r(s));
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/boom?token=x`);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "internal_error" });
      const call = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
        err: { message: string };
        url: string;
      };
      // token scrubbed, query string stripped
      expect(call.err.message).not.toContain("secrettoken");
      expect(call.url).toBe("/boom");
    } finally {
      server.close();
    }
  });
});

describe("wiring locks", () => {
  it("app.ts mounts the final 4-arg error middleware after the router", () => {
    const src = readFileSync(resolve(__dirname, "../app.ts"), "utf8");
    const routerIdx = src.indexOf('app.use("/api", router);');
    const mwIdx = src.indexOf("unhandled route error");
    expect(routerIdx).toBeGreaterThan(-1);
    expect(mwIdx).toBeGreaterThan(routerIdx);
    expect(src).toContain("serializeError(err)");
    expect(src).toContain('res.status(500).json({ error: "internal_error" })');
  });

  it("index.ts registers fatal process handlers that exit non-zero", () => {
    const src = readFileSync(resolve(__dirname, "../index.ts"), "utf8");
    expect(src).toContain('process.on("unhandledRejection"');
    expect(src).toContain('process.on("uncaughtException"');
    const rejBlock = src.slice(src.indexOf('process.on("unhandledRejection"'));
    expect(rejBlock).toContain("serializeError");
    expect(rejBlock).toContain("process.exit(1)");
  });

  it("requireAuth logs its production misconfig via pino, not console", () => {
    const src = readFileSync(resolve(__dirname, "../middlewares/requireAuth.ts"), "utf8");
    expect(src).not.toContain("console.error(");
    expect(src).toContain("logger.error(");
  });

  it("no bare logger.error({ err }) remains — every site scrubs tokens", () => {
    // The sweep applied serializeError at 40 sites; this lock keeps new
    // code from reintroducing the unscrubbed pattern in reachable source.
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const out = execSync(
      String.raw`grep -rn "logger\.error({ err }" --include=*.ts ` +
        resolve(__dirname, "..") +
        " | grep -v __tests__ || true",
      { encoding: "utf8" },
    );
    expect(out.trim()).toBe("");
  });

  it("client root boundary no longer swallows render crashes (device-local log)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../../aforce-os/app/_layout.tsx"),
      "utf8",
    );
    expect(src).toMatch(/<ErrorBoundary\s*\n?\s*onError=/);
    expect(src).toContain("render crash");
  });
});
