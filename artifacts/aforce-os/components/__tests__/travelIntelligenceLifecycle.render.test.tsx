// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  owner: "A" as string | null,
  listener: null as null | ((r: any) => void),
  push: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  refetch: vi.fn(),
  reconcile: vi.fn(async () => {}),
  drop: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove() {} }),
  },
}));
vi.mock("@clerk/expo", () => ({
  useAuth: () => ({
    userId: m.owner,
    getToken: async () => "synthetic-session",
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ removeQueries: m.drop }),
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/hooks/useTravelIntelligence", () => ({
  useTravelIntelligence: () => ({
    owner: m.owner,
    query: {
      data: { trips: [], sync: false, reminders: false },
      refetch: m.refetch,
    },
    sync: async () => {},
  }),
}));
vi.mock("@/services/travel/intelligenceNotifications", () => ({
  travelDeviceId: async () => "phone",
  travelOwnerHash: async (owner: string) => `hash-${owner}`,
}));
vi.mock("@/services/travel/intelligenceReminders", () => ({
  reconcileIntelligenceReminders: m.reconcile,
}));
vi.mock("expo-notifications", () => ({
  clearLastNotificationResponseAsync: m.clear,
  getLastNotificationResponseAsync: async () => null,
  addNotificationResponseReceivedListener: (fn: any) => {
    m.listener = fn;
    return { remove: m.remove };
  },
}));
import { TravelIntelligenceLifecycle } from "../travel/TravelIntelligenceLifecycle";
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
  m.owner = "A";
  m.refetch.mockResolvedValue({
    data: { trips: [{ id: "trip", completedAt: null, legs: [{ id: "leg" }] }] },
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const response = (hash: string) => ({
  notification: {
    request: {
      content: {
        data: {
          kind: "travel.status.v2",
          ownerHash: hash,
          tripId: "trip",
          legId: "leg",
        },
      },
    },
  },
});
it("opens only a current owner’s active trip and retires the previous listener/device on account switch", async () => {
  await act(async () => root.render(<TravelIntelligenceLifecycle enabled />));
  await vi.waitFor(() => expect(m.listener).toBeTypeOf("function"));
  await m.listener!(response("hash-B"));
  expect(m.push).not.toHaveBeenCalled();
  await m.listener!(response("hash-A"));
  await vi.waitFor(() =>
    expect(m.push).toHaveBeenCalledWith("/travel-intelligence"),
  );
  const old = m.listener!;
  m.owner = "B";
  await act(async () => root.render(<TravelIntelligenceLifecycle enabled />));
  expect(m.remove).toHaveBeenCalled();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  m.push.mockClear();
  await old(response("hash-A"));
  expect(m.push).not.toHaveBeenCalled();
});
it("does not route a finished or removed journey from a stale notification", async () => {
  m.refetch.mockResolvedValue({
    data: {
      trips: [{ id: "trip", completedAt: "done", legs: [{ id: "leg" }] }],
    },
  });
  await act(async () => root.render(<TravelIntelligenceLifecycle enabled />));
  await vi.waitFor(() => expect(m.listener).toBeTypeOf("function"));
  await m.listener!(response("hash-A"));
  expect(m.push).not.toHaveBeenCalled();
});
