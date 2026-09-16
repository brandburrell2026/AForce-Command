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

/**
 * A calendar day is a LABEL, and the same label everywhere.
 *
 * `sessionDate` is stored as text and means a day in the program's locale,
 * not an instant. The window helpers therefore have to be pure label
 * arithmetic — a 28-day window ending on the 16th must be the same 28 labels
 * whether the phone is in Honolulu or Auckland. The failure this prevents is
 * silent and awful: an ACWR computed over a window shifted by one day for
 * everyone west of Greenwich, which changes a training recommendation.
 */
describe("calendar days do not move with the host timezone", () => {
  const ZONES = ["UTC", "Pacific/Honolulu", "Pacific/Kiritimati", "Asia/Kathmandu", "America/New_York"];

  function underTimezone<T>(tz: string, fn: () => T): T {
    const prior = process.env["TZ"];
    process.env["TZ"] = tz;
    try {
      return fn();
    } finally {
      if (prior === undefined) delete process.env["TZ"];
      else process.env["TZ"] = prior;
    }
  }

  it("produces the same window in every timezone", () => {
    const reference = dayWindow("2026-09-16", 28);
    for (const tz of ZONES) {
      expect(underTimezone(tz, () => dayWindow("2026-09-16", 28)), tz).toEqual(reference);
    }
  });

  it("ends on the day it was asked for, never the day either side", () => {
    for (const tz of ZONES) {
      const window = underTimezone(tz, () => dayWindow("2026-09-16", 7));
      expect(window[window.length - 1], tz).toBe("2026-09-16");
      expect(window[0], tz).toBe("2026-09-10");
    }
  });

  it("crosses a month boundary correctly", () => {
    expect(dayWindow("2026-03-02", 4)).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("crosses a leap day", () => {
    expect(dayWindow("2028-03-01", 3)).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });

  it("crosses a year boundary", () => {
    expect(dayWindow("2027-01-01", 2)).toEqual(["2026-12-31", "2027-01-01"]);
  });

  /**
   * A DST transition is where a naive local-time implementation loses or
   * repeats a day. The labels must be unaffected, because they are labels.
   */
  it("is unaffected by a daylight-saving transition", () => {
    // US DST begins 2026-03-08; the UK's 2026-03-29.
    const usSpring = underTimezone("America/New_York", () => dayWindow("2026-03-09", 4));
    expect(usSpring).toEqual(["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09"]);
    expect(new Set(usSpring).size).toBe(4);

    const ukSpring = underTimezone("Europe/London", () => dayWindow("2026-03-30", 4));
    expect(ukSpring).toEqual(["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30"]);
  });

  it("no day is ever repeated or skipped in a long window", () => {
    const window = dayWindow("2026-09-16", 28);
    expect(new Set(window).size).toBe(28);
    for (let i = 1; i < window.length; i += 1) {
      const prev = Date.parse(`${window[i - 1]}T00:00:00.000Z`);
      const curr = Date.parse(`${window[i]}T00:00:00.000Z`);
      expect(curr - prev).toBe(86_400_000);
    }
  });
});
