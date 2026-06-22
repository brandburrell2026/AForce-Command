import { describe, it, expect } from "vitest";
import {
  buildPerformanceAgeTrends,
  PerformanceAgeTrendsSchema,
  PERF_AGE_MIN_COHORT_MEMBERS,
  PERF_AGE_TREND_WINDOW_DAYS,
  type PerformanceAgeTrendsInput,
} from "../performanceAgeTrends";

const AT = "2026-06-22T00:00:00.000Z";

function build(input: PerformanceAgeTrendsInput) {
  return buildPerformanceAgeTrends(input, AT);
}

describe("buildPerformanceAgeTrends", () => {
  it("reports awaiting (null avg) for an empty window and an awaiting change", () => {
    const dto = build({
      current: { avgDeltaYears: null, snapshotCount: 0, distinctMembers: 0 },
      previous: { avgDeltaYears: null, snapshotCount: 0, distinctMembers: 0 },
    });
    expect(dto.current.status).toBe("awaiting");
    expect(dto.current.avgDeltaYears).toBeNull();
    expect(dto.previous.status).toBe("awaiting");
    expect(dto.change.status).toBe("awaiting");
    expect(dto.change.deltaYears).toBeNull();
    expect(dto.change.direction).toBeNull();
    expect(dto.windowDays).toBe(PERF_AGE_TREND_WINDOW_DAYS);
    expect(dto.minCohort).toBe(PERF_AGE_MIN_COHORT_MEMBERS);
    expect(dto.generatedAt).toBe(AT);
  });

  it("k-anonymity: withholds the average for a sub-cohort window even when SQL computed one", () => {
    const dto = build({
      current: { avgDeltaYears: -2.4, snapshotCount: 9, distinctMembers: 3 },
      previous: { avgDeltaYears: null, snapshotCount: 0, distinctMembers: 0 },
    });
    expect(dto.current.status).toBe("collecting");
    expect(dto.current.avgDeltaYears).toBeNull();
    // counts still pass through for the founder's situational awareness
    expect(dto.current.snapshotCount).toBe(9);
    expect(dto.current.distinctMembers).toBe(3);
    // one window has members but isn't measured → change is collecting, not awaiting
    expect(dto.change.status).toBe("collecting");
    expect(dto.change.deltaYears).toBeNull();
  });

  it("surfaces a measured (rounded) average once the cohort hits the k-anon floor", () => {
    const dto = build({
      current: {
        avgDeltaYears: -2.36,
        snapshotCount: 40,
        distinctMembers: PERF_AGE_MIN_COHORT_MEMBERS,
      },
      previous: { avgDeltaYears: null, snapshotCount: 0, distinctMembers: 0 },
    });
    expect(dto.current.status).toBe("measured");
    expect(dto.current.avgDeltaYears).toBe(-2.4);
  });

  it("computes a younger change only when BOTH windows are measured", () => {
    const dto = build({
      current: { avgDeltaYears: -3.0, snapshotCount: 60, distinctMembers: 12 },
      previous: { avgDeltaYears: -1.0, snapshotCount: 50, distinctMembers: 10 },
    });
    expect(dto.change.status).toBe("measured");
    expect(dto.change.deltaYears).toBe(-2);
    expect(dto.change.direction).toBe("younger");
  });

  it("reads an increasing delta as older and an equal delta as steady", () => {
    const older = build({
      current: { avgDeltaYears: 1.5, snapshotCount: 60, distinctMembers: 12 },
      previous: { avgDeltaYears: -0.5, snapshotCount: 50, distinctMembers: 10 },
    });
    expect(older.change.direction).toBe("older");
    expect(older.change.deltaYears).toBe(2);

    const steady = build({
      current: { avgDeltaYears: -1.2, snapshotCount: 60, distinctMembers: 12 },
      previous: { avgDeltaYears: -1.2, snapshotCount: 50, distinctMembers: 10 },
    });
    expect(steady.change.direction).toBe("steady");
    expect(steady.change.deltaYears).toBe(0);
  });

  it("withholds the change when only one window is measured", () => {
    const dto = build({
      current: { avgDeltaYears: -2.0, snapshotCount: 60, distinctMembers: 12 },
      previous: { avgDeltaYears: -1.0, snapshotCount: 6, distinctMembers: 3 },
    });
    expect(dto.current.status).toBe("measured");
    expect(dto.previous.status).toBe("collecting");
    expect(dto.previous.avgDeltaYears).toBeNull();
    expect(dto.change.status).toBe("collecting");
    expect(dto.change.deltaYears).toBeNull();
    expect(dto.change.direction).toBeNull();
  });

  it("degrades a floor-sized cohort with no finite average to collecting (defensive)", () => {
    const dto = build({
      current: {
        avgDeltaYears: null,
        snapshotCount: 8,
        distinctMembers: PERF_AGE_MIN_COHORT_MEMBERS + 2,
      },
      previous: { avgDeltaYears: null, snapshotCount: 0, distinctMembers: 0 },
    });
    expect(dto.current.status).toBe("collecting");
    expect(dto.current.avgDeltaYears).toBeNull();
  });

  it("truncates fractional counts and never emits a negative count", () => {
    const dto = build({
      current: { avgDeltaYears: -2, snapshotCount: 12.9, distinctMembers: 7.6 },
      previous: { avgDeltaYears: null, snapshotCount: -3, distinctMembers: -1 },
    });
    expect(dto.current.snapshotCount).toBe(12);
    expect(dto.current.distinctMembers).toBe(7);
    expect(dto.previous.snapshotCount).toBe(0);
    expect(dto.previous.distinctMembers).toBe(0);
  });

  it("always produces a schema-valid DTO", () => {
    const dto = build({
      current: { avgDeltaYears: -2.5, snapshotCount: 30, distinctMembers: 9 },
      previous: { avgDeltaYears: -1.0, snapshotCount: 20, distinctMembers: 6 },
    });
    expect(() => PerformanceAgeTrendsSchema.parse(dto)).not.toThrow();
  });
});
