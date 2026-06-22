import { describe, it, expect } from "vitest";
import {
  buildVoiceCheckInUsage,
  VoiceCheckInUsageSchema,
  type VoiceCheckInUsageRow,
} from "../voiceCheckInUsage";

const AT = "2026-06-22T12:00:00.000Z";

describe("buildVoiceCheckInUsage", () => {
  it("reports awaiting (null rates) for an empty cohort — no fabricated 0%", () => {
    const dto = buildVoiceCheckInUsage([], AT);
    expect(dto).toEqual({
      generatedAt: AT,
      activeUsers: 0,
      checkInUsers: 0,
      repeatUsers: 0,
      totalCheckIns: 0,
      adoptionRate: null,
      repeatRate: null,
      avgPerUser: null,
      adoptionStatus: "awaiting",
      repeatStatus: "awaiting",
    });
    expect(VoiceCheckInUsageSchema.safeParse(dto).success).toBe(true);
  });

  it("computes adoption, repeat, total and cadence over a mixed cohort", () => {
    const rows: VoiceCheckInUsageRow[] = [
      { appOpened: true, checkInCount: 0 }, // active, never checked in
      { appOpened: true, checkInCount: 0 }, // active, never checked in
      { appOpened: true, checkInCount: 1 }, // adopter, single use
      { appOpened: true, checkInCount: 3 }, // adopter, repeat
      { appOpened: true, checkInCount: 2 }, // adopter, repeat
    ];
    const dto = buildVoiceCheckInUsage(rows, AT);

    expect(dto.activeUsers).toBe(5);
    expect(dto.checkInUsers).toBe(3);
    expect(dto.repeatUsers).toBe(2);
    expect(dto.totalCheckIns).toBe(6);
    expect(dto.adoptionRate).toBeCloseTo(3 / 5);
    expect(dto.repeatRate).toBeCloseTo(2 / 3);
    expect(dto.avgPerUser).toBeCloseTo(6 / 3);
    expect(dto.adoptionStatus).toBe("measured");
    expect(dto.repeatStatus).toBe("measured");
    expect(VoiceCheckInUsageSchema.safeParse(dto).success).toBe(true);
  });

  it("counts a check-in-only identity (missing app_opened) as active so the rate never exceeds 1", () => {
    const rows: VoiceCheckInUsageRow[] = [
      { appOpened: false, checkInCount: 2 }, // checked in but no app_opened event
    ];
    const dto = buildVoiceCheckInUsage(rows, AT);

    expect(dto.activeUsers).toBe(1);
    expect(dto.checkInUsers).toBe(1);
    expect(dto.repeatUsers).toBe(1);
    expect(dto.adoptionRate).toBe(1);
    expect(dto.adoptionRate).toBeLessThanOrEqual(1);
  });

  it("reports repeat as awaiting when there are adopters-base but no repeat is impossible (single-use only)", () => {
    const rows: VoiceCheckInUsageRow[] = [
      { appOpened: true, checkInCount: 1 },
      { appOpened: true, checkInCount: 1 },
    ];
    const dto = buildVoiceCheckInUsage(rows, AT);

    expect(dto.checkInUsers).toBe(2);
    expect(dto.repeatUsers).toBe(0);
    expect(dto.repeatRate).toBe(0); // measured, genuinely 0% repeat
    expect(dto.repeatStatus).toBe("measured");
    expect(dto.avgPerUser).toBe(1);
  });

  it("reports adoption measured but repeat awaiting when active users exist but none checked in", () => {
    const rows: VoiceCheckInUsageRow[] = [
      { appOpened: true, checkInCount: 0 },
      { appOpened: true, checkInCount: 0 },
    ];
    const dto = buildVoiceCheckInUsage(rows, AT);

    expect(dto.activeUsers).toBe(2);
    expect(dto.checkInUsers).toBe(0);
    expect(dto.adoptionRate).toBe(0); // measured, genuinely 0% adoption
    expect(dto.adoptionStatus).toBe("measured");
    expect(dto.repeatRate).toBeNull();
    expect(dto.repeatStatus).toBe("awaiting");
    expect(dto.avgPerUser).toBeNull();
  });

  it("truncates fractional / negative counts defensively", () => {
    const rows: VoiceCheckInUsageRow[] = [
      { appOpened: true, checkInCount: 2.9 },
      { appOpened: true, checkInCount: -3 },
    ];
    const dto = buildVoiceCheckInUsage(rows, AT);

    expect(dto.totalCheckIns).toBe(2);
    expect(dto.checkInUsers).toBe(1);
    expect(dto.repeatUsers).toBe(1);
  });
});
