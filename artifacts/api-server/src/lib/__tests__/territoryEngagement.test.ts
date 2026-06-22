import { describe, it, expect } from "vitest";
import {
  buildTerritoryEngagement,
  TerritoryEngagementSchema,
  type TerritoryEngagementRow,
} from "../territoryEngagement";

const AT = "2026-06-22T12:00:00.000Z";

describe("buildTerritoryEngagement", () => {
  it("reports awaiting (null rates, no actions) for an empty cohort — no fabricated 0%", () => {
    const dto = buildTerritoryEngagement([], AT);
    expect(dto).toEqual({
      generatedAt: AT,
      reachedUsers: 0,
      engagedUsers: 0,
      totalEngagements: 0,
      engagementRate: null,
      avgPerUser: null,
      engagementStatus: "awaiting",
      avgStatus: "awaiting",
      actions: [],
    });
    expect(TerritoryEngagementSchema.safeParse(dto).success).toBe(true);
  });

  it("computes engagement rate, totals, cadence and a sorted action breakdown", () => {
    const rows: TerritoryEngagementRow[] = [
      { opened: true, actionCounts: { region_selected: 0, battle_supported: 0 } }, // reached, never engaged
      { opened: true, actionCounts: { region_selected: 0, battle_supported: 0 } }, // reached, never engaged
      { opened: true, actionCounts: { region_selected: 3, battle_supported: 1 } }, // engaged
      { opened: true, actionCounts: { region_selected: 2, battle_supported: 0 } }, // engaged
    ];
    const dto = buildTerritoryEngagement(rows, AT);

    expect(dto.reachedUsers).toBe(4);
    expect(dto.engagedUsers).toBe(2);
    expect(dto.totalEngagements).toBe(6); // 3+1 + 2
    expect(dto.engagementRate).toBeCloseTo(2 / 4);
    expect(dto.avgPerUser).toBeCloseTo(6 / 2);
    expect(dto.engagementStatus).toBe("measured");
    expect(dto.avgStatus).toBe("measured");
    // region_selected (5 events, 2 users) sorts above battle_supported (1, 1).
    expect(dto.actions).toEqual([
      { action: "region_selected", users: 2, events: 5 },
      { action: "battle_supported", users: 1, events: 1 },
    ]);
    expect(TerritoryEngagementSchema.safeParse(dto).success).toBe(true);
  });

  it("counts an engaged-only identity (missing territory_opened) as reached so the rate never exceeds 1", () => {
    const rows: TerritoryEngagementRow[] = [
      { opened: false, actionCounts: { battle_supported: 2 } },
    ];
    const dto = buildTerritoryEngagement(rows, AT);

    expect(dto.reachedUsers).toBe(1);
    expect(dto.engagedUsers).toBe(1);
    expect(dto.engagementRate).toBe(1);
    expect(dto.engagementRate).toBeLessThanOrEqual(1);
    expect(dto.actions).toEqual([
      { action: "battle_supported", users: 1, events: 2 },
    ]);
  });

  it("reports engagement measured-but-zero when reached users exist but none engaged", () => {
    const rows: TerritoryEngagementRow[] = [
      { opened: true, actionCounts: {} },
      { opened: true, actionCounts: { region_selected: 0 } },
    ];
    const dto = buildTerritoryEngagement(rows, AT);

    expect(dto.reachedUsers).toBe(2);
    expect(dto.engagedUsers).toBe(0);
    expect(dto.engagementRate).toBe(0); // measured, genuinely 0% engaged
    expect(dto.engagementStatus).toBe("measured");
    expect(dto.avgPerUser).toBeNull();
    expect(dto.avgStatus).toBe("awaiting");
    expect(dto.actions).toEqual([]); // no action ever happened → no rows
  });

  it("truncates fractional / negative counts defensively", () => {
    const rows: TerritoryEngagementRow[] = [
      { opened: true, actionCounts: { region_selected: 2.9, battle_supported: -3 } },
    ];
    const dto = buildTerritoryEngagement(rows, AT);

    expect(dto.totalEngagements).toBe(2);
    expect(dto.engagedUsers).toBe(1);
    // Negative count is floored to 0 → battle_supported never happened.
    expect(dto.actions).toEqual([
      { action: "region_selected", users: 1, events: 2 },
    ]);
  });
});
