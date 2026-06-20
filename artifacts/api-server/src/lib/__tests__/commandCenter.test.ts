import { describe, it, expect } from "vitest";

import {
  buildDailyFive,
  CommandCenterDailyFiveSchema,
  type DailyFiveRaw,
} from "../commandCenter";

const AT = "2026-06-19T00:00:00.000Z";

const base: DailyFiveRaw = {
  activationsTotal: 0,
  activationsLast7d: 0,
  retentionCohort: 0,
  retentionRetained: 0,
  confirmationsTotal: 0,
  confirmationsFollowed: 0,
  usersTotal: 0,
  usersSubscribed: 0,
  scoreCurrentAvg: null,
  scoreCurrentSamples: 0,
  scorePreviousAvg: null,
  scorePreviousSamples: 0,
};

describe("buildDailyFive", () => {
  it("returns null rates and a null trend on an empty dataset (never fabricates)", () => {
    const d = buildDailyFive(base, AT);
    expect(d.generatedAt).toBe(AT);
    expect(d.windowDays).toBe(7);
    expect(d.activations).toEqual({ total: 0, recent: 0 });
    expect(d.d7ReturnRate).toEqual({ numerator: 0, denominator: 0, rate: null });
    expect(d.commandFollowRate.rate).toBeNull();
    expect(d.subscriptionConversion.rate).toBeNull();
    expect(d.readinessScoreTrend).toEqual({
      current: null,
      previous: null,
      delta: null,
      direction: null,
      currentSamples: 0,
      previousSamples: 0,
    });
    expect(() => CommandCenterDailyFiveSchema.parse(d)).not.toThrow();
  });

  it("computes rates with explicit numerator/denominator", () => {
    const d = buildDailyFive(
      {
        ...base,
        retentionCohort: 8,
        retentionRetained: 6,
        confirmationsTotal: 10,
        confirmationsFollowed: 7,
        usersTotal: 50,
        usersSubscribed: 10,
      },
      AT,
    );
    expect(d.d7ReturnRate).toEqual({ numerator: 6, denominator: 8, rate: 0.75 });
    expect(d.commandFollowRate.rate).toBeCloseTo(0.7);
    expect(d.subscriptionConversion.rate).toBeCloseTo(0.2);
  });

  it("passes activations through as total + recent", () => {
    const d = buildDailyFive(
      { ...base, activationsTotal: 42, activationsLast7d: 9 },
      AT,
    );
    expect(d.activations).toEqual({ total: 42, recent: 9 });
  });

  it("marks score trend up/down/flat and rounds to 1 decimal", () => {
    const up = buildDailyFive(
      {
        ...base,
        scoreCurrentAvg: 81.27,
        scoreCurrentSamples: 5,
        scorePreviousAvg: 74.0,
        scorePreviousSamples: 4,
      },
      AT,
    ).readinessScoreTrend;
    expect(up).toEqual({
      current: 81.3,
      previous: 74,
      delta: 7.3,
      direction: "up",
      currentSamples: 5,
      previousSamples: 4,
    });

    const down = buildDailyFive(
      {
        ...base,
        scoreCurrentAvg: 60,
        scoreCurrentSamples: 3,
        scorePreviousAvg: 70,
        scorePreviousSamples: 3,
      },
      AT,
    ).readinessScoreTrend;
    expect(down.direction).toBe("down");
    expect(down.delta).toBe(-10);

    const flat = buildDailyFive(
      {
        ...base,
        scoreCurrentAvg: 80.1,
        scoreCurrentSamples: 2,
        scorePreviousAvg: 80.0,
        scorePreviousSamples: 2,
      },
      AT,
    ).readinessScoreTrend;
    expect(flat.direction).toBe("flat");
    expect(flat.delta).toBe(0.1);
  });

  it("keeps the trend null when one window has no samples", () => {
    const t = buildDailyFive(
      {
        ...base,
        scoreCurrentAvg: 80,
        scoreCurrentSamples: 3,
        scorePreviousAvg: null,
        scorePreviousSamples: 0,
      },
      AT,
    ).readinessScoreTrend;
    expect(t.current).toBe(80);
    expect(t.previous).toBeNull();
    expect(t.delta).toBeNull();
    expect(t.direction).toBeNull();
  });

  it("treats avg-present-but-zero-samples as no data", () => {
    const t = buildDailyFive(
      { ...base, scoreCurrentAvg: 99, scoreCurrentSamples: 0 },
      AT,
    ).readinessScoreTrend;
    expect(t.current).toBeNull();
  });
});
