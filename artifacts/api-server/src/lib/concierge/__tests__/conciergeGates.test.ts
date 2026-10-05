/**
 * AForce Concierge — output gates. Fail-closed invariants:
 *   §42 claims vocabulary, §59/§64 stems + population comparison, DR-013
 *   quantity grounding (mirror-exact or nothing), action grounding, sources.
 */
import { describe, it, expect } from "vitest";
import {
  buildGroundingSet,
  collectNumbers,
  findLanguageViolations,
  findUngroundedQuantities,
  gateAction,
  gateReply,
  gateText,
} from "../gates";
import type { ClientContext, ModelReply } from "../types";

export function baseContext(over: Partial<ClientContext> = {}): ClientContext {
  return {
    schemaVersion: 1,
    localTime: { iso: "2026-10-05T14:05:00-04:00", timeZone: "America/New_York", hour: 14 },
    locale: "en",
    demoMode: false,
    hydroState: { score: 72, level: "BALANCED", urgency: "moderate", confidence: "medium", evidence: "ready" },
    command: {
      action: "Drink 16 oz water now. Recheck in 20 min.",
      explanation: "Behind pace since the 11:40 log.",
      urgencyLevel: "medium",
      confidence: "medium",
      guard: "approved",
    },
    intake: { ozToday: 40, ozTarget: 96, unitsToday: 3, unitsTarget: 8, lastIntakeMinutesAgo: 145, provenance: "logged" },
    signals: [
      { id: "sleep", label: "Sleep", value: 6.5, unit: "h", provider: "whoop", provenance: "measured", freshness: "aging" },
    ],
    providers: [{ id: "whoop", connected: true, lastSyncIso: "2026-10-05T08:00:00.000Z", freshness: "aging" }],
    recentDays: [],
    capabilities: ["log_hydration", "open_screen", "start_checkin", "set_reminder"],
    screens: ["home", "hydration", "urine_check"],
    ...over,
  };
}

function reply(over: Partial<ModelReply> = {}): ModelReply {
  return {
    kind: "answer",
    answer: "You are 40 oz into a 96 oz day, so the next move is the engine's 16 oz water.",
    nextStep: "Drink 16 oz water now.",
    why: "Your last log was 145 minutes ago.",
    action: { type: "log_hydration", fluidType: "water", oz: 16, label: "Log 16 oz water" },
    remember: null,
    sources: ["intake", "command"],
    ...over,
  };
}

const ctx = baseContext();
const grounding = buildGroundingSet("what should I do?", ctx, null);
const sources = new Set(["hydrostate", "command", "intake", "signal:sleep"]);

describe("§42 claims gate", () => {
  it("blocks the server vocabulary (whole word)", () => {
    expect(gateText("This could be a symptom of something.", grounding).map((v) => v.rule)).toContain("claims");
    expect(gateText("You are unhealthy today.", grounding).map((v) => v.rule)).toContain("claims");
  });
  it("lets clean observation copy through", () => {
    expect(gateText("Your intake is behind the pace your command set this morning.", grounding)).toEqual([]);
  });
});

describe("§59 / §64 language rule", () => {
  it("catches the four stems at a word boundary and their inflections", () => {
    expect(findLanguageViolations("This lowers your risk of cramping.")).toEqual(["risk"]);
    expect(findLanguageViolations("Injury prevention matters")).toEqual(["injury", "prevention"]);
    expect(findLanguageViolations("A brisk walk helps; note the asterisk.")).toEqual([]);
  });
  it("catches population comparison", () => {
    expect(findLanguageViolations("You sleep less than the average user.")).toEqual(["than the average"]);
    expect(findLanguageViolations("Most people drink less than you.")).toEqual(["most people"]);
  });
});

describe("DR-013 quantity grounding", () => {
  it("collects numbers from nested context including digits inside strings", () => {
    const n = collectNumbers({ a: 16, b: "Recheck in 20 min", c: [40, { d: 96.0 }] });
    expect([...n]).toEqual(expect.arrayContaining(["16", "20", "40", "96"]));
  });
  it("accepts quantities that exist in the context or the member's message", () => {
    expect(findUngroundedQuantities("Drink 16 oz now and recheck in 20 minutes.", grounding)).toEqual([]);
    const g2 = buildGroundingSet("I just had 24 oz", ctx, null);
    expect(findUngroundedQuantities("Log the 24 oz you mentioned.", g2)).toEqual([]);
  });
  it("rejects a dose, clock or percentage the engine never issued", () => {
    expect(findUngroundedQuantities("Drink 32 oz over the next 45 minutes.", grounding)).toEqual(["32 oz", "45 minutes"]);
    expect(findUngroundedQuantities("Aim for 500 mg sodium.", grounding)).toEqual(["500 mg"]);
  });
  it("derives remaining-to-target and percent from grounded inputs only", () => {
    // 96 - 40 = 56 remaining; 40/96 ≈ 42%
    expect(findUngroundedQuantities("56 oz remain; you are at 42% of target.", grounding)).toEqual([]);
  });
  it("ignores plain counts that carry no unit", () => {
    expect(findUngroundedQuantities("Three things, then 2 quick wins.", grounding)).toEqual([]);
  });
});

describe("action grounding", () => {
  it("rejects a capability the client did not offer", () => {
    const c = baseContext({ capabilities: ["open_screen"] });
    const v = gateAction({ type: "log_hydration", fluidType: "water", oz: 16, label: "Log" }, c, grounding);
    expect(v[0]).toEqual({ rule: "action", detail: "capability_not_offered:log_hydration" });
  });
  it("rejects an ungrounded hydration amount", () => {
    const v = gateAction({ type: "log_hydration", fluidType: "water", oz: 32, label: "Log" }, ctx, grounding);
    expect(v).toEqual([{ rule: "action", detail: "ungrounded_oz:32" }]);
  });
  it("rejects a screen the client did not list", () => {
    const v = gateAction({ type: "open_screen", screen: "moments", label: "Open Moments" }, ctx, grounding);
    expect(v).toEqual([{ rule: "action", detail: "screen_not_offered:moments" }]);
  });
  it("rejects a reminder dated in the past (member-local)", () => {
    const v = gateAction(
      { type: "set_reminder", title: "Water", timeLocal: "15:00", dateLocal: "2026-10-04", recurrence: "once", label: "Set" },
      ctx,
      grounding,
    );
    expect(v).toEqual([{ rule: "action", detail: "reminder_in_past" }]);
  });
  it("passes a grounded, offered action", () => {
    expect(gateAction({ type: "log_hydration", fluidType: "water", oz: 16, label: "Log 16 oz water" }, ctx, grounding)).toEqual([]);
  });
});

describe("gateReply", () => {
  it("delivers a clean reply", () => {
    expect(gateReply(reply(), ctx, grounding, sources)).toEqual([]);
  });
  it("rejects an invented source id", () => {
    expect(gateReply(reply({ sources: ["calendar"] }), ctx, grounding, sources)).toEqual([
      { rule: "sources", detail: "calendar" },
    ]);
  });
  it("gates every free-text field, including a remember suggestion", () => {
    const v = gateReply(
      reply({ remember: { key: "note", value: "Diagnosed with nothing" } }),
      ctx,
      grounding,
      sources,
    );
    expect(v.map((x) => x.rule)).toEqual(expect.arrayContaining(["claims", "language"]));
  });
});
