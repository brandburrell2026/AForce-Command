/**
 * Operability for the trainer surface: the kill switch, the limits, and the
 * rule that no athlete id may reach a metric name.
 *
 * The last is the one worth writing first. A metrics registry has different
 * retention and a different access list from the database, and `requests_total`
 * keyed on a concrete path would put a roster in it — one series per athlete,
 * unbounded cardinality and a disclosure at the same time. The middleware keys
 * on the matched route PATTERN; this is what stops that being re-decided.
 */
import express, { type Express } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  __resetFlagsForTests,
  flagSources,
  isEnabled,
  setFlag,
  snapshot,
} from "../../config/featureFlags";
import { __resetForTests, snapshot as metricsSnapshot } from "../../observability/metrics";
import { trainerMetrics } from "../trainerOps";

const ATHLETE = "user_athlete_00e1f2a3b4c5";

const servers: http.Server[] = [];

function appWithMetrics(): Express {
  const app = express();
  app.use(trainerMetrics);
  const router = express.Router();
  router.get("/programs/:programId/athletes/:athleteId/notes", (_req, res) => {
    res.json({ ok: true });
  });
  router.get("/programs/:programId/roster", (_req, res) => res.json({ ok: true }));
  app.use("/trainer", router);
  return app;
}

async function start(app: Express): Promise<string> {
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterAll(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

beforeEach(() => {
  __resetFlagsForTests();
  __resetForTests();
  delete process.env["AFORCE_FLAGS"];
});

// ─── The kill switch ──────────────────────────────────────────────────────

describe("a flag can be changed without a deploy", () => {
  it("defaults to off, as it always did", () => {
    expect(isEnabled("feature.trainer_api")).toBe(false);
  });

  it("reads an override out of AFORCE_FLAGS", () => {
    process.env["AFORCE_FLAGS"] = "feature.trainer_api=true";
    expect(isEnabled("feature.trainer_api")).toBe(true);
    expect(flagSources()["feature.trainer_api"]).toBe("env");
  });

  it("turns something OFF as well as on — which is the point of a kill switch", () => {
    process.env["AFORCE_FLAGS"] = "feature.heat_save_share=false";
    expect(isEnabled("feature.heat_save_share")).toBe(false);
  });

  it("handles several flags, spacing and a trailing comma", () => {
    process.env["AFORCE_FLAGS"] = " feature.trainer_api=true , kill.ai_router=true ,";
    expect(isEnabled("feature.trainer_api")).toBe(true);
    expect(isEnabled("kill.ai_router")).toBe(true);
  });

  it("picks up a change without reimporting the module", () => {
    process.env["AFORCE_FLAGS"] = "feature.trainer_api=true";
    expect(isEnabled("feature.trainer_api")).toBe(true);
    process.env["AFORCE_FLAGS"] = "feature.trainer_api=false";
    expect(isEnabled("feature.trainer_api")).toBe(false);
  });

  /**
   * Fails closed, entry by entry. One malformed entry must not discard the
   * rest of the list, and nothing malformed may turn a flag ON.
   */
  it.each([
    ["an unknown flag", "not.a.flag=true"],
    ["no equals sign", "feature.trainer_api"],
    ["a non-boolean value", "feature.trainer_api=1"],
    ["yes instead of true", "feature.trainer_api=yes"],
    ["an empty value", "feature.trainer_api="],
    ["nonsense", "%%%"],
  ])("ignores %s and leaves the default standing", (_label, raw) => {
    process.env["AFORCE_FLAGS"] = raw;
    expect(isEnabled("feature.trainer_api")).toBe(false);
    expect(flagSources()["feature.trainer_api"]).toBe("default");
  });

  it("applies the good entries around a bad one", () => {
    process.env["AFORCE_FLAGS"] = "garbage,feature.trainer_api=true,also.garbage=maybe";
    expect(isEnabled("feature.trainer_api")).toBe(true);
  });

  it("a hot-reload override still beats the environment", () => {
    process.env["AFORCE_FLAGS"] = "feature.trainer_api=true";
    setFlag("feature.trainer_api", false);
    expect(isEnabled("feature.trainer_api")).toBe(false);
    expect(flagSources()["feature.trainer_api"]).toBe("override");
  });

  it("the snapshot agrees with isEnabled, flag for flag", () => {
    process.env["AFORCE_FLAGS"] = "feature.trainer_api=true,kill.voice_overlay=true";
    const values = snapshot();
    for (const key of Object.keys(values) as (keyof typeof values)[]) {
      expect(values[key], key).toBe(isEnabled(key));
    }
  });
});

// ─── Metrics must not carry identity ──────────────────────────────────────

describe("metrics carry route shapes, never athlete ids", () => {
  it("records latency under the route pattern", async () => {
    const base = await start(appWithMetrics());
    await fetch(`${base}/trainer/programs/prog_1/athletes/${ATHLETE}/notes`);

    const keys = Object.keys(metricsSnapshot().histograms);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.includes(":athleteId"))).toBe(true);
  });

  it("no metric name anywhere contains an athlete id or a program id", async () => {
    const base = await start(appWithMetrics());
    await fetch(`${base}/trainer/programs/prog_1/athletes/${ATHLETE}/notes`);
    await fetch(`${base}/trainer/programs/prog_1/roster`);
    await fetch(`${base}/trainer/programs/prog_1/athletes/${ATHLETE}/nope`);

    const snap = metricsSnapshot();
    const names = [
      ...Object.keys(snap.histograms),
      ...Object.keys(snap.counters),
      ...Object.keys(snap.gauges),
    ];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name, `metric "${name}" contains an athlete id`).not.toContain(ATHLETE);
      expect(name, `metric "${name}" contains a program id`).not.toContain("prog_1");
    }
  });

  it("an unmatched path still yields a bounded key", async () => {
    const base = await start(appWithMetrics());
    // No route matches, so there is no pattern to read: the fallback has to
    // do the redaction itself or a 404 sweep would fill the registry.
    await fetch(`${base}/trainer/programs/prog_1/athletes/${ATHLETE}/unmatched`);
    const names = Object.keys(metricsSnapshot().histograms);
    for (const name of names) {
      expect(name).not.toContain(ATHLETE);
    }
  });

  it("counts outcome by status class", async () => {
    const base = await start(appWithMetrics());
    await fetch(`${base}/trainer/programs/prog_1/roster`);
    const counters = metricsSnapshot().counters;
    expect(Object.keys(counters).some((k) => k.startsWith("requests_total.trainer."))).toBe(true);
  });
});
