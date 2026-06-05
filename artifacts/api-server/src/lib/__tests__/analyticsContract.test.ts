import { describe, it, expect } from "vitest";
import {
  SCHEMA_VERSION,
  PHASE1_EVENTS,
  PHASE1_EVENT_TYPES,
  isPhase1EventType,
  assembleEnvelope,
} from "@workspace/analytics-contract";
import {
  analyticsEnvelopeSchema,
  analyticsBatchSchema,
  analyticsForgetSchema,
} from "@workspace/analytics-contract/zod";

describe("analytics-contract envelope", () => {
  it("stamps the schema version and never leaks a Clerk user id field", () => {
    const env = assembleEnvelope({
      eventId: "evt_l9x2_ab12cd34ef",
      eventType: "app_opened",
      analyticsId: "anon_l9x2_ab12cd34ef",
      payload: { platform: "ios" },
      occurredAt: "2026-06-05T00:00:00.000Z",
    });
    expect(env.schemaVersion).toBe(SCHEMA_VERSION);
    expect(env.analytics_id).toBe("anon_l9x2_ab12cd34ef");
    expect(env).not.toHaveProperty("userId");
    expect(env).not.toHaveProperty("user_id");
  });

  it("defaults payload to an empty object and stamps occurredAt when omitted", () => {
    const env = assembleEnvelope({
      eventId: "evt_l9x3_zz98yy76xx",
      eventType: "session_started",
      analyticsId: "anon_l9x3_zz98yy76xx",
    });
    expect(env.payload).toEqual({});
    expect(typeof env.occurredAt).toBe("string");
    expect(env.occurredAt.length).toBeGreaterThan(0);
  });

  it("only recognizes Phase-1 event types", () => {
    expect(isPhase1EventType("water_cycle_logged")).toBe(true);
    expect(isPhase1EventType("definitely_not_an_event")).toBe(false);
    expect(isPhase1EventType(42)).toBe(false);
  });
});

describe("analytics-contract zod schemas", () => {
  const valid = {
    eventId: "evt_l9x2_ab12cd34ef",
    eventType: "consent_granted" as const,
    analytics_id: "anon_l9x2_ab12cd34ef",
    occurredAt: "2026-06-05T00:00:00.000Z",
    schemaVersion: SCHEMA_VERSION,
    payload: { consentVersion: 1 },
  };

  it("accepts a well-formed envelope", () => {
    expect(analyticsEnvelopeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown event type at the trust boundary", () => {
    const bad = { ...valid, eventType: "rogue_event" };
    expect(analyticsEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a short (un-pseudonymized) analytics_id", () => {
    const bad = { ...valid, analytics_id: "short" };
    expect(analyticsEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a Clerk user id submitted as analytics_id", () => {
    const bad = { ...valid, analytics_id: "user_2abcDEF123456789ghijkl" };
    expect(analyticsEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an event id without the evt_ structural prefix", () => {
    const bad = { ...valid, eventId: "free-form-id-12345678" };
    expect(analyticsEnvelopeSchema.safeParse(bad).success).toBe(false);
  });

  it("bounds a batch to 1..100 events", () => {
    expect(analyticsBatchSchema.safeParse({ events: [] }).success).toBe(false);
    expect(
      analyticsBatchSchema.safeParse({ events: [valid] }).success,
    ).toBe(true);
    const overflow = Array.from({ length: 101 }, (_, i) => ({
      ...valid,
      eventId: `evt_l9x2_${String(i).padStart(10, "0")}`,
    }));
    expect(
      analyticsBatchSchema.safeParse({ events: overflow }).success,
    ).toBe(false);
  });

  it("forget schema requires a pseudonymous id", () => {
    expect(
      analyticsForgetSchema.safeParse({ analytics_id: "anon_l9x2_ab12cd34ef" })
        .success,
    ).toBe(true);
    expect(
      analyticsForgetSchema.safeParse({ analytics_id: "x" }).success,
    ).toBe(false);
    expect(
      analyticsForgetSchema.safeParse({
        analytics_id: "user_2abcDEF123456789ghijkl",
      }).success,
    ).toBe(false);
  });
});

describe("catalog parity", () => {
  it("PHASE1_EVENT_TYPES mirrors PHASE1_EVENTS exactly", () => {
    expect(PHASE1_EVENT_TYPES).toEqual(PHASE1_EVENTS.map((e) => e.eventType));
  });
});
