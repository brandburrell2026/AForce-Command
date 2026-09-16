/**
 * Training load — arithmetic, and the honesty rules around it.
 *
 * The Phase 5 criterion is that "every derived metric displays its input
 * window and data completeness, and the heat module cites its source inline."
 * These tests hold both halves: the ratio is correct when it exists, and it
 * does not exist when the data cannot support it.
 */
import { describe, expect, it } from "vitest";

import {
  ACUTE_DAYS,
  CHRONIC_DAYS,
  ENGINE_SOURCE,
  EXTERNAL_GUIDANCE_UNSET,
  FULL_COVERAGE_DAYS,
  MIN_COVERED_DAYS,
  acwr,
  buildEnvironmentReference,
  dayWindow,
  dailyLoads,
  ewma,
  formatRatio,
  sessionLoad,
  type SessionEntry,
} from "../trainerLoad";

const END = "2026-09-16";

/** Sessions on the last `days` days ending at END, all the same load. */
function steady(days: number, rpe = 6, durationMin = 60): SessionEntry[] {
  return dayWindow(END, days).map((sessionDate) => ({ sessionDate, rpe, durationMin }));
}

describe("session load", () => {
  it("is RPE times minutes", () => {
    expect(sessionLoad({ sessionDate: END, rpe: 7, durationMin: 90 })).toBe(630);
  });

  it("sums multiple sessions on one day", () => {
    const loads = dailyLoads([
      { sessionDate: END, rpe: 5, durationMin: 60 },
      { sessionDate: END, rpe: 8, durationMin: 30 },
    ]);
    expect(loads.get(END)).toBe(300 + 240);
  });
});

describe("day windows", () => {
  it("returns N days ending at the given date, oldest first", () => {
    const window = dayWindow(END, 5);
    expect(window).toHaveLength(5);
    expect(window[window.length - 1]).toBe(END);
    expect(window[0]).toBe("2026-09-12");
  });
});

describe("EWMA", () => {
  it("converges toward the constant of a flat series as the window fills", () => {
    // Zero-seeded, so a short series is still warming up. What matters for
    // ACWR is that both windows warm up identically, which the steady-load
    // case below proves by landing on a ratio of about 1.
    const short = ewma(new Array(4).fill(100), 7);
    const long = ewma(new Array(28).fill(100), 7);
    expect(short).toBeLessThan(long);
    expect(long).toBeGreaterThan(98);
    expect(long).toBeLessThanOrEqual(100);
  });

  it("weights recent days more heavily than old ones", () => {
    const rising = ewma([0, 0, 0, 100], 7);
    const falling = ewma([100, 0, 0, 0], 7);
    expect(rising).toBeGreaterThan(falling);
  });

  it("is zero for an empty series", () => {
    expect(ewma([], 7)).toBe(0);
  });
});

describe("acute:chronic ratio", () => {
  it("is about 1 when load has been steady for the whole window", () => {
    const result = acwr(steady(CHRONIC_DAYS), END);
    expect(result.ratio).not.toBeNull();
    expect(result.ratio!).toBeGreaterThan(0.95);
    expect(result.ratio!).toBeLessThan(1.05);
    expect(result.completeness).toBe("observed");
  });

  it("rises above 1 when the recent week is heavier", () => {
    const base = steady(CHRONIC_DAYS, 4, 60);
    const spikeDays = new Set(dayWindow(END, ACUTE_DAYS));
    const spiked = base.map((s) =>
      spikeDays.has(s.sessionDate) ? { ...s, rpe: 9, durationMin: 110 } : s,
    );
    const result = acwr(spiked, END);
    expect(result.ratio!).toBeGreaterThan(1.5);
  });

  it("falls below 1 after a quiet week", () => {
    const sessions = steady(CHRONIC_DAYS).filter(
      (s) => !new Set(dayWindow(END, ACUTE_DAYS)).has(s.sessionDate),
    );
    const result = acwr(sessions, END);
    expect(result.ratio!).toBeLessThan(1);
  });

  it("reports its windows and coverage on every result", () => {
    const result = acwr(steady(CHRONIC_DAYS), END);
    expect(result.windowDays).toBe(CHRONIC_DAYS);
    expect(result.acuteDays).toBe(ACUTE_DAYS);
    expect(result.coveredDays).toBe(CHRONIC_DAYS);
    expect(result.note).toContain(`${CHRONIC_DAYS}`);
  });
});

describe("thin data never renders as a confident number", () => {
  it("returns no ratio at all on nine days — the brief's own example", () => {
    const result = acwr(steady(9), END);
    expect(result.ratio).toBeNull();
    expect(result.completeness).toBe("unavailable");
    expect(result.note).toContain("9 of 28");
    expect(result.note).toContain("Too thin");
  });

  it("returns no ratio when nothing has been recorded", () => {
    const result = acwr([], END);
    expect(result.ratio).toBeNull();
    expect(result.completeness).toBe("unavailable");
    expect(result.note).toContain("No sessions recorded");
  });

  it("calls a partly covered window provisional rather than observed", () => {
    const result = acwr(steady(MIN_COVERED_DAYS + 2), END);
    expect(result.ratio).not.toBeNull();
    expect(result.completeness).toBe("partial");
    expect(result.note).toContain("provisional");
  });

  it("switches to observed at the coverage threshold", () => {
    expect(acwr(steady(FULL_COVERAGE_DAYS), END).completeness).toBe("observed");
    expect(acwr(steady(FULL_COVERAGE_DAYS - 1), END).completeness).toBe("partial");
  });

  it("formats a missing ratio as a dash, never as zero", () => {
    expect(formatRatio(acwr([], END))).toBe("--");
    expect(formatRatio(acwr(steady(CHRONIC_DAYS), END))).toMatch(/^\d\.\d\d$/);
  });

  it("always carries a plain-language note, whatever the outcome", () => {
    for (const days of [0, 3, 9, 14, 20, 28]) {
      const result = acwr(steady(days), END);
      expect(result.note.length).toBeGreaterThan(10);
    }
  });

  it("uses no predictive or diagnostic language in any note", () => {
    const banned = ["injury", "risk of", "predict", "likely to", "diagnos", "safe to"];
    for (const days of [0, 9, 20, 28]) {
      const note = acwr(steady(days), END).note.toLowerCase();
      for (const word of banned) expect(note).not.toContain(word);
    }
  });
});

describe("environment reference", () => {
  it("cites its source inline on every result", () => {
    const measured = buildEnvironmentReference({
      heatIndexF: 101,
      measured: true,
      band: "WARNING",
      directive: "Stop. Hydrate. Cool.",
    });
    expect(measured.source).toBe(ENGINE_SOURCE);
    expect(measured.band).toBe("WARNING");

    const unmeasured = buildEnvironmentReference({ heatIndexF: null, measured: false });
    expect(unmeasured.source).toBe(ENGINE_SOURCE);
  });

  it("refuses to present an unmeasured reading as a reading", () => {
    const claimed = buildEnvironmentReference({ heatIndexF: 96, measured: false });
    expect(claimed.heatIndexF).toBeNull();
    expect(claimed.band).toBeNull();
    expect(claimed.directive).toBeNull();
  });

  it("says plainly when no program guidance table is configured", () => {
    const none = buildEnvironmentReference({ heatIndexF: 101, measured: true });
    expect(none.externalGuidanceNote).toBe(EXTERNAL_GUIDANCE_UNSET);
  });

  it("defers to the program's own table when one is configured", () => {
    const withTable = buildEnvironmentReference({
      heatIndexF: 101,
      measured: true,
      band: "WARNING",
      directive: "Stop. Hydrate. Cool.",
      programGuidance: { label: "Program heat policy", source: "Program policy, revised 2026-08" },
    });
    expect(withTable.source).toBe("Program policy, revised 2026-08");
    expect(withTable.externalGuidanceNote).toBeNull();
  });
});
