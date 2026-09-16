/**
 * Athlete record — signals, trend and assembly.
 *
 * Covers the Phase 3 criteria that are decidable without a renderer: the
 * signal breakdown the brief names, honest completeness on every one of them,
 * the 14-day trend and its coverage, and history ordering.
 */
import { describe, expect, it } from "vitest";

import { buildTrainerDemoRoster } from "../../data/trainerDemoSeed";
import type { BoardAthlete } from "../trainerBoard";
import {
  buildRecord,
  buildSignals,
  buildTrend,
  trendCompleteness,
  trendStats,
} from "../trainerRecord";

function athlete(over: Partial<BoardAthlete> = {}): BoardAthlete {
  return {
    athleteUserId: "a1",
    displayName: "A. One",
    position: "WR",
    positionGroup: "Offense",
    consentGranted: true,
    hydrationScore: 72,
    availability: "available",
    questionnaireSubmitted: true,
    minutesSinceLastIntake: 95,
    sleepHoursLastNight: 7.2,
    minutesSinceSync: 15,
    isSimulated: true,
    ...over,
  };
}

describe("signal breakdown", () => {
  it("returns the five signals the brief names, in order", () => {
    expect(buildSignals(athlete()).map((s) => s.id)).toEqual([
      "hydrostate",
      "sleep",
      "recovery_window",
      "environment",
      "load",
    ]);
  });

  it("marks what is not wired as unavailable rather than omitting it", () => {
    const byId = Object.fromEntries(buildSignals(athlete()).map((s) => [s.id, s]));
    expect(byId["environment"]!.completeness).toBe("unavailable");
    expect(byId["environment"]!.value).toBeNull();
    expect(byId["load"]!.completeness).toBe("unavailable");
    expect(byId["load"]!.value).toBeNull();
  });

  it("does not overstate elapsed time as a modelled recovery window", () => {
    const recovery = buildSignals(athlete()).find((s) => s.id === "recovery_window")!;
    expect(recovery.completeness).toBe("partial");
  });

  it("reports HydroState as observed when a score exists, unavailable otherwise", () => {
    const withScore = buildSignals(athlete({ hydrationScore: 64 }))[0]!;
    expect(withScore.completeness).toBe("observed");
    expect(withScore.value).toBe("64");

    const noScore = buildSignals(athlete({ hydrationScore: null }))[0]!;
    expect(noScore.completeness).toBe("unavailable");
    expect(noScore.detail).toBe("No score yet.");

    const noConsent = buildSignals(athlete({ consentGranted: false }))[0]!;
    expect(noConsent.completeness).toBe("unavailable");
    expect(noConsent.detail).toBe("Not sharing with staff.");
  });

  it("never renders a value on an unavailable signal", () => {
    for (const a of buildTrainerDemoRoster(120)) {
      for (const signal of buildSignals(a)) {
        if (signal.completeness === "unavailable") expect(signal.value).toBeNull();
        else expect(signal.value).not.toBeNull();
      }
    }
  });
});

describe("14-day trend", () => {
  it("returns 14 points ending with today's live score", () => {
    const a = athlete({ hydrationScore: 58 });
    const trend = buildTrend(a);
    expect(trend).toHaveLength(14);
    expect(trend[trend.length - 1]).toEqual({ daysAgo: 0, score: 58 });
    expect(trend[0]!.daysAgo).toBe(13);
  });

  it("is deterministic per athlete", () => {
    const a = athlete({ athleteUserId: "stable_id", hydrationScore: 70 });
    expect(buildTrend(a)).toEqual(buildTrend(a));
  });

  it("differs between athletes so the board is not fourteen identical charts", () => {
    const one = buildTrend(athlete({ athleteUserId: "x1", hydrationScore: 70 }));
    const two = buildTrend(athlete({ athleteUserId: "x2", hydrationScore: 70 }));
    expect(one).not.toEqual(two);
  });

  it("stays inside the score range", () => {
    for (const point of buildTrend(athlete({ hydrationScore: 96 }))) {
      if (point.score !== null) {
        expect(point.score).toBeGreaterThanOrEqual(5);
        expect(point.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("is all nulls when nothing is known, and reports that honestly", () => {
    const trend = buildTrend(athlete({ consentGranted: false, hydrationScore: null }));
    expect(trend.every((p) => p.score === null)).toBe(true);
    const stats = trendStats(trend);
    expect(stats.average).toBeNull();
    expect(trendCompleteness(stats)).toBe("unavailable");
  });

  it("calls a thin window partial rather than drawing it as a fortnight", () => {
    // Four days of data across a fourteen-day window is the case the rule
    // exists for: a sparkline that looks like a fortnight but is not one.
    const thin = Array.from({ length: 14 }, (_, i) => ({
      daysAgo: 13 - i,
      score: i >= 10 ? 60 + i : null,
    }));
    const stats = trendStats(thin);
    expect(stats.covered).toBe(4);
    expect(stats.window).toBe(14);
    expect(trendCompleteness(stats)).toBe("partial");
  });

  it("calls a well-covered window observed", () => {
    const full = Array.from({ length: 14 }, (_, i) => ({ daysAgo: 13 - i, score: 70 }));
    expect(trendCompleteness(trendStats(full))).toBe("observed");
    // Two thirds is the boundary, and it counts as observed.
    const boundary = Array.from({ length: 14 }, (_, i) => ({
      daysAgo: 13 - i,
      score: i < 10 ? 70 : null,
    }));
    expect(trendStats(boundary).covered).toBe(10);
    expect(trendCompleteness(trendStats(boundary))).toBe("observed");
  });

  it("computes low, average and high over the covered days only", () => {
    const stats = trendStats([
      { daysAgo: 2, score: 40 },
      { daysAgo: 1, score: null },
      { daysAgo: 0, score: 80 },
    ]);
    expect(stats).toMatchObject({ min: 40, max: 80, average: 60, covered: 2, window: 3 });
  });
});

describe("record assembly", () => {
  it("carries tier and command from the engine when data exists", () => {
    const record = buildRecord(athlete({ hydrationScore: 41 }));
    expect(record.tier).toBe("DEPLETED");
    expect(record.command).toContain("PULL FROM ROTATION");
  });

  it("has no tier or command without consent", () => {
    const record = buildRecord(athlete({ consentGranted: false, hydrationScore: null }));
    expect(record.tier).toBeNull();
    expect(record.command).toBeNull();
  });

  it("invents no history, notes or documents", () => {
    const record = buildRecord(athlete());
    expect(record.statusHistory).toEqual([]);
    expect(record.notes).toEqual([]);
    expect(record.documents).toEqual([]);
  });

  it("orders status history and notes newest first", () => {
    const record = buildRecord(athlete(), {
      statusHistory: [
        { status: "available", reason: null, setByDisplayName: "K. Morales", at: "2026-09-14T08:00:00.000Z" },
        { status: "out", reason: "left hamstring", setByDisplayName: "K. Morales", at: "2026-09-16T08:00:00.000Z" },
      ],
      notes: [
        { id: "n1", body: "first", authorDisplayName: "K. Morales", at: "2026-09-14T08:00:00.000Z" },
        { id: "n2", body: "second", authorDisplayName: "K. Morales", at: "2026-09-16T08:00:00.000Z" },
      ],
    });
    expect(record.statusHistory.map((s) => s.status)).toEqual(["out", "available"]);
    expect(record.notes.map((n) => n.id)).toEqual(["n2", "n1"]);
  });

  it("keeps attribution on every status entry", () => {
    const record = buildRecord(athlete(), {
      statusHistory: [
        { status: "out", reason: null, setByDisplayName: "K. Morales", at: "2026-09-16T08:00:00.000Z" },
      ],
    });
    expect(record.statusHistory[0]!.setByDisplayName).toBe("K. Morales");
  });

  it("builds a record for every athlete in the golden roster without throwing", () => {
    for (const a of buildTrainerDemoRoster(120)) {
      const record = buildRecord(a);
      expect(record.signals).toHaveLength(5);
      expect(record.trend).toHaveLength(14);
      expect(record.isSimulated).toBe(true);
    }
  });

  it("uses no diagnostic or predictive language in any signal detail", () => {
    const banned = ["diagnos", "dehydrated", "heat stroke", "injury", "predict", "cleared to play"];
    for (const a of buildTrainerDemoRoster(120)) {
      for (const signal of buildRecord(a).signals) {
        const text = `${signal.label} ${signal.detail}`.toLowerCase();
        for (const word of banned) expect(text).not.toContain(word);
      }
    }
  });
});
