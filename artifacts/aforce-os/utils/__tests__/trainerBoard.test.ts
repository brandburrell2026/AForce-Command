/**
 * Morning Board — ordering, grouping, filters and the "why" line.
 *
 * These are the board's judgement calls, so they are tested as pure functions
 * rather than through a renderer. The acceptance criteria this file covers:
 *
 *   - "sorted by who needs me, never alphabetically"
 *   - "exception-first … everyone fine collapses into a single N clear row"
 *   - the per-row "why": one strongest signal, plain language
 *   - the golden-roster edge cases from §6.1 do not break any of it
 */
import { describe, expect, it } from "vitest";

import { buildTrainerDemoRoster } from "../../data/trainerDemoSeed";
import {
  FLAG_REASONS,
  applyFilters,
  commandFor,
  flagReasons,
  formatElapsed,
  isFlagged,
  partitionBoard,
  rosterCounts,
  sortByNeed,
  tierFor,
  urgencyRank,
  whyLine,
  type BoardAthlete,
} from "../trainerBoard";

function athlete(over: Partial<BoardAthlete> = {}): BoardAthlete {
  return {
    athleteUserId: "a1",
    displayName: "A. One",
    position: "WR",
    positionGroup: "Offense",
    consentGranted: true,
    hydrationScore: 82,
    availability: "available",
    questionnaireSubmitted: true,
    minutesSinceLastIntake: 40,
    sleepHoursLastNight: 7.5,
    minutesSinceSync: 20,
    isSimulated: true,
    ...over,
  };
}

describe("tiers come from the engine, and only when data exists", () => {
  it("maps a score through clutchTier", () => {
    expect(tierFor(athlete({ hydrationScore: 95 }))).toBe("PLATINUM");
    expect(tierFor(athlete({ hydrationScore: 75 }))).toBe("STABLE");
    expect(tierFor(athlete({ hydrationScore: 60 }))).toBe("RECOVERY");
    expect(tierFor(athlete({ hydrationScore: 41 }))).toBe("DEPLETED");
  });

  it("has no tier without consent or without a score", () => {
    expect(tierFor(athlete({ consentGranted: false }))).toBeNull();
    expect(tierFor(athlete({ hydrationScore: null }))).toBeNull();
    expect(commandFor(athlete({ consentGranted: false }))).toBeNull();
  });

  it("does not treat missing data as the worst band", () => {
    // An athlete who has not opted in must not outrank a genuinely depleted
    // one — that would put a paperwork state at the top of a triage list.
    const noData = athlete({ athleteUserId: "nd", consentGranted: false, hydrationScore: null });
    const depleted = athlete({ athleteUserId: "dp", hydrationScore: 30 });
    expect(urgencyRank(depleted)).toBeLessThan(urgencyRank(noData));
  });
});

describe("flagging", () => {
  it("flags out, depleted, limited, recovery, missing check-in, stale and no consent", () => {
    expect(flagReasons(athlete({ availability: "out" }))).toContain("out");
    expect(flagReasons(athlete({ hydrationScore: 22 }))).toContain("depleted");
    expect(flagReasons(athlete({ availability: "limited" }))).toContain("limited");
    expect(flagReasons(athlete({ hydrationScore: 55 }))).toContain("recovery");
    expect(flagReasons(athlete({ questionnaireSubmitted: false }))).toContain("no_check_in");
    expect(flagReasons(athlete({ minutesSinceSync: 5000 }))).toContain("stale");
    expect(flagReasons(athlete({ consentGranted: false }))).toContain("no_consent");
  });

  it("leaves a healthy, checked-in, freshly synced athlete clear", () => {
    expect(isFlagged(athlete())).toBe(false);
    expect(flagReasons(athlete())).toEqual([]);
  });

  it("ranks by the worst reason, in the declared order", () => {
    const out = athlete({ availability: "out", hydrationScore: 90 });
    const depleted = athlete({ hydrationScore: 20 });
    const stale = athlete({ minutesSinceSync: 6000 });
    expect(urgencyRank(out)).toBe(FLAG_REASONS.indexOf("out"));
    expect(urgencyRank(depleted)).toBe(FLAG_REASONS.indexOf("depleted"));
    expect(urgencyRank(stale)).toBe(FLAG_REASONS.indexOf("stale"));
    expect(urgencyRank(athlete())).toBe(FLAG_REASONS.length);
  });
});

describe("sorted by who needs me, never alphabetically", () => {
  it("puts the most urgent first regardless of name", () => {
    const zed = athlete({ athleteUserId: "z", displayName: "Z. Zephyr", availability: "out" });
    const abe = athlete({ athleteUserId: "a", displayName: "A. Abbott" });
    const mid = athlete({ athleteUserId: "m", displayName: "M. Mason", hydrationScore: 55 });
    const order = sortByNeed([abe, mid, zed]).map((a) => a.athleteUserId);
    expect(order).toEqual(["z", "m", "a"]);
  });

  it("breaks an urgency tie by the lower score, not the name", () => {
    const higher = athlete({ athleteUserId: "h", displayName: "A. First", hydrationScore: 45 });
    const lower = athlete({ athleteUserId: "l", displayName: "Z. Last", hydrationScore: 21 });
    expect(sortByNeed([higher, lower]).map((a) => a.athleteUserId)).toEqual(["l", "h"]);
  });

  it("falls back to the name only when urgency and score are identical", () => {
    const b = athlete({ athleteUserId: "b", displayName: "B. Same", hydrationScore: 30 });
    const a = athlete({ athleteUserId: "a", displayName: "A. Same", hydrationScore: 30 });
    expect(sortByNeed([b, a]).map((x) => x.athleteUserId)).toEqual(["a", "b"]);
  });

  it("is stable — sorting twice gives the same order", () => {
    const roster = buildTrainerDemoRoster(40);
    const once = sortByNeed(roster).map((a) => a.athleteUserId);
    const twice = sortByNeed(sortByNeed(roster)).map((a) => a.athleteUserId);
    expect(twice).toEqual(once);
  });

  it("does not mutate its input", () => {
    const roster = buildTrainerDemoRoster(10);
    const before = roster.map((a) => a.athleteUserId);
    sortByNeed(roster);
    expect(roster.map((a) => a.athleteUserId)).toEqual(before);
  });
});

describe("exception-first partition", () => {
  it("separates flagged from clear and keeps urgency order inside flagged", () => {
    const roster = buildTrainerDemoRoster(120);
    const { flagged, clear } = partitionBoard(roster);

    expect(flagged.length + clear.length).toBe(roster.length);
    expect(flagged.every(isFlagged)).toBe(true);
    expect(clear.every((a) => !isFlagged(a))).toBe(true);

    const ranks = flagged.map(urgencyRank);
    expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
  });

  it("counts the roster by availability and by flag state", () => {
    const roster = buildTrainerDemoRoster(120);
    const counts = rosterCounts(roster);
    expect(counts.total).toBe(120);
    expect(counts.available + counts.limited + counts.out + counts.unset).toBe(120);
    expect(counts.flagged + counts.clear).toBe(120);
  });
});

describe("filters", () => {
  const roster = buildTrainerDemoRoster(120);

  it("filters by position group", () => {
    const only = applyFilters(roster, { positionGroup: "Defense" });
    expect(only.length).toBeGreaterThan(0);
    expect(only.every((a) => a.positionGroup === "Defense")).toBe(true);
  });

  it("filters by availability", () => {
    const only = applyFilters(roster, { availability: "out" });
    expect(only.every((a) => a.availability === "out")).toBe(true);
  });

  it("filters to flagged only", () => {
    const only = applyFilters(roster, { flaggedOnly: true });
    expect(only.every(isFlagged)).toBe(true);
  });

  it("filters to missing check-ins", () => {
    const only = applyFilters(roster, { missingCheckInOnly: true });
    expect(only.every((a) => !a.questionnaireSubmitted)).toBe(true);
  });

  it("combines filters", () => {
    const only = applyFilters(roster, { positionGroup: "Offense", flaggedOnly: true });
    expect(only.every((a) => a.positionGroup === "Offense" && isFlagged(a))).toBe(true);
  });
});

describe("the why line", () => {
  it("leads with the reason the row is flagged, strongest first", () => {
    expect(whyLine(athlete({ consentGranted: false }))).toBe("Not sharing with staff yet.");
    expect(whyLine(athlete({ minutesSinceSync: 5760 }))).toBe("Last sync 4d ago.");
    expect(whyLine(athlete({ availability: "out" }))).toBe("Out. Set by staff.");
    expect(whyLine(athlete({ availability: "limited" }))).toBe("Limited. Set by staff.");
    expect(whyLine(athlete({ questionnaireSubmitted: false }))).toBe("No check-in this morning.");
    expect(whyLine(athlete({ sleepHoursLastNight: 4.83 }))).toBe("Slept 4h 50m.");
    expect(whyLine(athlete({ minutesSinceLastIntake: 200 }))).toBe("3h 20m since last intake.");
    expect(whyLine(athlete({ hydrationScore: 64, minutesSinceLastIntake: 30 }))).toBe(
      "Hydration 64.",
    );
    expect(
      whyLine(
        athlete({ hydrationScore: null, minutesSinceLastIntake: null, sleepHoursLastNight: null }),
      ),
    ).toBe("No signal today.");
  });

  it("is one sentence, never a breakdown", () => {
    for (const a of buildTrainerDemoRoster(120)) {
      const line = whyLine(a);
      expect(line.length).toBeLessThanOrEqual(46);
      expect(line.split(". ").length).toBeLessThanOrEqual(2);
    }
  });

  it("never uses diagnostic or predictive language", () => {
    const banned = [
      "diagnos", "dehydrated", "heat stroke", "injury", "risk of", "predict",
      "cleared to play", "medical eval",
    ];
    for (const a of buildTrainerDemoRoster(120)) {
      const line = whyLine(a).toLowerCase();
      for (const word of banned) expect(line).not.toContain(word);
    }
  });

  it("formats elapsed time the way a person says it", () => {
    expect(formatElapsed(45)).toBe("45m");
    expect(formatElapsed(60)).toBe("1h");
    expect(formatElapsed(200)).toBe("3h 20m");
    expect(formatElapsed(5760)).toBe("4d");
  });
});

describe("the golden roster edge cases (brief §6.1)", () => {
  const roster = buildTrainerDemoRoster(120);
  const byId = (id: string) => roster.find((a) => a.athleteUserId === id)!;

  it("is exactly 120 athletes with unique ids", () => {
    expect(roster).toHaveLength(120);
    expect(new Set(roster.map((a) => a.athleteUserId)).size).toBe(120);
  });

  it("is deterministic across builds", () => {
    expect(buildTrainerDemoRoster(120).map((a) => a.athleteUserId)).toEqual(
      roster.map((a) => a.athleteUserId),
    );
  });

  it("marks every seeded row as simulated", () => {
    expect(roster.every((a) => a.isSimulated)).toBe(true);
  });

  it("carries no device data, stale data, a transfer, duplicates and name extremes", () => {
    expect(byId("demo_athlete_nodata").hydrationScore).toBeNull();
    expect(flagReasons(byId("demo_athlete_stale"))).toContain("stale");
    expect(flagReasons(byId("demo_athlete_transfer"))).toContain("no_consent");
    expect(roster.filter((a) => a.displayName === "C. Boozer")).toHaveLength(2);
    expect(byId("demo_athlete_mononym").displayName).toBe("Kaladin");
    expect(byId("demo_athlete_short").displayName).toHaveLength(3);
    expect(byId("demo_athlete_long").displayName.length).toBeGreaterThanOrEqual(37);
  });

  it("sorts and partitions the full 120 without throwing on any edge row", () => {
    const { flagged, clear } = partitionBoard(roster);
    expect(flagged.length + clear.length).toBe(120);
    for (const a of roster) {
      expect(typeof whyLine(a)).toBe("string");
      expect(() => tierFor(a)).not.toThrow();
    }
  });
});
