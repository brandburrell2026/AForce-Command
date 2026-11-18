/**
 * Analytics stores only what an event is declared to carry.
 *
 * Before this, the event TYPE was allow-listed but the payload was stored as
 * sent, so any key with any value (free text included) could land in
 * `aforce_analytics_events`. These laws pin the sanitiser, prove the shared
 * schema applies it, and keep the two copies of the event catalogue equal.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PHASE1_EVENTS,
  SCHEMA_VERSION,
  ANALYTICS_PAYLOAD_STRING_MAX,
  sanitizeAnalyticsPayload,
} from "@workspace/analytics-contract";
import { analyticsEnvelopeSchema, analyticsBatchSchema } from "@workspace/analytics-contract/zod";

const envelope = (eventType: string, payload: unknown) => ({
  eventId: "evt_l9x2_ab12cd34ef",
  eventType,
  analytics_id: "anon_l9x2_ab12cd34ef",
  occurredAt: "2026-11-18T00:00:00.000Z",
  schemaVersion: SCHEMA_VERSION,
  payload,
});

describe("sanitizeAnalyticsPayload", () => {
  it("keeps declared fields with primitive values", () => {
    const r = sanitizeAnalyticsPayload("water_cycle_logged", { fluidType: "water", oz: 16 });
    expect(r.payload).toEqual({ fluidType: "water", oz: 16 });
    expect(r.dropped).toEqual([]);
  });

  it("drops a field the event does not declare", () => {
    const r = sanitizeAnalyticsPayload("water_cycle_logged", {
      fluidType: "water",
      oz: 16,
      note: "felt dizzy after my oncology appointment",
      calendarTitle: "Oncology follow-up",
    });
    expect(r.payload).toEqual({ fluidType: "water", oz: 16 });
    expect(r.dropped.sort()).toEqual(["calendarTitle", "note"]);
  });

  it("drops a declared field whose value is long text, an object, an array, null or not finite", () => {
    const long = "x".repeat(ANALYTICS_PAYLOAD_STRING_MAX + 1);
    for (const bad of [long, { nested: "text" }, ["a"], null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = sanitizeAnalyticsPayload("command_followed", { commandId: bad });
      expect(r.payload, String(bad)).toEqual({});
      expect(r.dropped).toEqual(["commandId"]);
    }
    const edge = "x".repeat(ANALYTICS_PAYLOAD_STRING_MAX);
    expect(sanitizeAnalyticsPayload("command_followed", { commandId: edge }).payload).toEqual({ commandId: edge });
  });

  it("an event that declares no fields stores an empty payload", () => {
    expect(sanitizeAnalyticsPayload("onboarding_completed", { anything: "at all" }).payload).toEqual({});
  });

  it("an unknown event type keeps nothing", () => {
    expect(sanitizeAnalyticsPayload("not_an_event", { a: 1 }).payload).toEqual({});
  });

  it("a payload that is not a plain object becomes empty", () => {
    for (const bad of [null, undefined, "text", 7, ["a", "b"]]) {
      expect(sanitizeAnalyticsPayload("app_opened", bad).payload).toEqual({});
    }
  });

  it("the model version travels with a score, so a model change is not read as behaviour", () => {
    const r = sanitizeAnalyticsPayload("hydration_score_updated", {
      score: 72,
      level: "BALANCED",
      modelVersion: "hydrostate-v2.0",
    });
    expect(r.payload).toEqual({ score: 72, level: "BALANCED", modelVersion: "hydrostate-v2.0" });
  });
});

describe("the shared schema applies the sanitiser, so every writer does", () => {
  it("a parsed envelope never carries an undeclared field", () => {
    const parsed = analyticsEnvelopeSchema.parse(
      envelope("notification_opened", { slot: "3", freeText: "my private note", nested: { a: 1 } }),
    );
    expect(parsed.payload).toEqual({ slot: "3" });
  });

  it("the event is still accepted when a field is dropped", () => {
    const result = analyticsBatchSchema.safeParse({
      events: [envelope("receipt_scanned", { sourceKind: "barcode", extra: "x" })],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.events[0]!.payload).toEqual({ sourceKind: "barcode" });
  });

  it("a missing payload parses to an empty one", () => {
    const { payload: _omit, ...rest } = envelope("session_started", {});
    expect(analyticsEnvelopeSchema.parse(rest).payload).toEqual({});
  });

  it("both server writers store the parsed payload, not the raw body", () => {
    const root = path.resolve(__dirname, "..", "..");
    const route = fs.readFileSync(path.join(root, "routes/aforce/analytics.ts"), "utf8");
    const emitter = fs.readFileSync(path.join(root, "lib/serverAnalytics.ts"), "utf8");
    expect(route).toContain("analyticsBatchSchema.safeParse(req.body)");
    expect(route).toContain("const { events } = parsed.data;");
    expect(route).not.toMatch(/req\.body\.events/);
    expect(emitter).toContain("analyticsEnvelopeSchema.safeParse(");
    expect(emitter).toContain("const e = parsed.data;");
  });
});

describe("the two copies of the event catalogue agree", () => {
  const jsonPath = path.resolve(__dirname, "../../../../aforce-os/analytics/analytics_events.json");
  const mirror = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
    phase1: Array<{ eventType: string; payloadFields: string[] }>;
  };

  it("same events, same declared fields", () => {
    const fromTs = Object.fromEntries(PHASE1_EVENTS.map((e) => [e.eventType, [...e.payloadFields]]));
    const fromJson = Object.fromEntries(mirror.phase1.map((e) => [e.eventType, e.payloadFields]));
    expect(fromJson).toEqual(fromTs);
  });
});
