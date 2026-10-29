import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  scheduled: [] as any[],
  cancelled: [] as string[],
  permission: true,
  request: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("../intelligenceNotifications", () => ({
  travelOwnerHash: async (owner: string) => `hash-${owner}`,
}));
vi.mock("expo-notifications", () => ({
  getAllScheduledNotificationsAsync: async () => state.scheduled,
  cancelScheduledNotificationAsync: async (id: string) => {
    state.cancelled.push(id);
    state.scheduled = state.scheduled.filter((n) => n.identifier !== id);
  },
  getPermissionsAsync: async () => ({ granted: state.permission }),
  requestPermissionsAsync: state.request,
  scheduleNotificationAsync: async (value: any) => {
    state.scheduled.push(value);
  },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));
import { reconcileIntelligenceReminders } from "../intelligenceReminders";
import type { TravelTrip } from "@workspace/api-zod";
const trip: TravelTrip = {
  id: "trip",
  title: "Trip",
  createdAt: "2026-10-28T12:00:00Z",
  completedAt: null,
  legs: [
    {
      id: "leg",
      flight: {
        flightNumber: "DL1181",
        origin: "LGA",
        destination: "FLL",
        departureDate: "2026-10-29",
      },
      departureAt: "2026-10-29T14:45:00Z",
      arrivalAt: null,
      originTimeZone: "America/New_York",
      destinationTimeZone: "America/New_York",
    },
  ],
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
  state.scheduled = [];
  state.cancelled = [];
  state.permission = true;
  state.request.mockClear();
});
afterEach(() => vi.useRealTimers());
describe("optional native preparation scheduling", () => {
  it("uses the existing prep window, generic content and a hashed owner without requesting permission on reconciliation", async () => {
    await reconcileIntelligenceReminders("A", [trip], true);
    expect(state.request).not.toHaveBeenCalled();
    expect(state.scheduled[0].trigger.date.toISOString()).toBe(
      "2026-10-29T12:45:00.000Z",
    );
    expect(state.scheduled[0].content.data.ownerHash).toBe("hash-A");
    expect(JSON.stringify(state.scheduled)).not.toContain("LGA");
    expect(JSON.stringify(state.scheduled)).not.toContain("DL1181");
  });
  it("skips quiet hours, past departures, completed journeys and already-prepared legs", async () => {
    await reconcileIntelligenceReminders(
      "A",
      [
        {
          ...trip,
          legs: [{ ...trip.legs[0], departureAt: "2026-10-29T11:05:00Z" }],
        },
      ],
      true,
    );
    expect(state.scheduled).toEqual([]);
    await reconcileIntelligenceReminders(
      "A",
      [{ ...trip, completedAt: "2026-10-28T12:00:00Z" }],
      true,
    );
    expect(state.scheduled).toEqual([]);
    await reconcileIntelligenceReminders(
      "A",
      [
        {
          ...trip,
          legs: [
            { ...trip.legs[0], departurePreparedAt: "2026-10-28T12:00:00Z" },
          ],
        },
      ],
      true,
    );
    expect(state.scheduled).toEqual([]);
  });
  it("cancels only owned notifications on sign-out or disable and rejects revoked permission", async () => {
    state.scheduled = [
      { identifier: "unrelated", content: { data: { kind: "hydration" } } },
    ];
    await reconcileIntelligenceReminders("A", [trip], true);
    await reconcileIntelligenceReminders(null, [], false);
    expect(state.scheduled.map((n) => n.identifier)).toEqual(["unrelated"]);
    state.permission = false;
    await expect(
      reconcileIntelligenceReminders("A", [trip], true),
    ).rejects.toThrow("permission");
  });
});
