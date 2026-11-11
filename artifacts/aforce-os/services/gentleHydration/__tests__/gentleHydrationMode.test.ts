import { beforeEach, describe, expect, it, vi } from "vitest";
const { storage } = vi.hoisted(() => ({
  storage: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}));
vi.mock("../../gentleHydrationStorage", () => ({
  gentleHydrationStorage: storage,
}));
import {
  DEFAULT_GENTLE_HYDRATION_MODE,
  clearGentleHydrationMode,
  loadGentleHydrationMode,
  saveGentleHydrationMode,
} from "../../gentleHydrationMode";

describe("Gentle Hydration Mode", () => {
  beforeEach(() => vi.clearAllMocks());
  it("persists an enabled preference through relaunch", async () => {
    storage.getItem.mockResolvedValue(
      JSON.stringify({
        enabled: true,
        pauseStreakDisplay: true,
        promptsEnabled: false,
      }),
    );
    await expect(loadGentleHydrationMode()).resolves.toMatchObject({
      enabled: true,
      pauseStreakDisplay: true,
    });
  });
  it("deletes stored preference when disabled", async () => {
    await saveGentleHydrationMode({
      enabled: false,
      pauseStreakDisplay: false,
      promptsEnabled: false,
    });
    expect(storage.removeItem).toHaveBeenCalledOnce();
  });
  it("fails closed for malformed data and exposes no shareable state", async () => {
    storage.getItem.mockResolvedValue("{bad");
    await expect(loadGentleHydrationMode()).resolves.toEqual(
      DEFAULT_GENTLE_HYDRATION_MODE,
    );
    await clearGentleHydrationMode();
    expect(storage.removeItem).toHaveBeenCalled();
  });
});
