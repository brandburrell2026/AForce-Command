/**
 * Private presentation preferences only. These values are device-local,
 * never emitted to analytics, never sent over the network, and never shared.
 */
import { gentleHydrationStorage } from "./gentleHydrationStorage";

export interface GentleHydrationModeState {
  enabled: boolean;
  pauseStreakDisplay: boolean;
  promptsEnabled: boolean;
  updatedAt: string;
}

export const DEFAULT_GENTLE_HYDRATION_MODE: GentleHydrationModeState = {
  enabled: false,
  pauseStreakDisplay: false,
  promptsEnabled: false,
  updatedAt: "",
};

export function normalizeGentleHydrationMode(
  raw: unknown,
): GentleHydrationModeState {
  if (!raw || typeof raw !== "object") return DEFAULT_GENTLE_HYDRATION_MODE;
  const value = raw as Partial<GentleHydrationModeState>;
  return {
    enabled: value.enabled === true,
    pauseStreakDisplay: value.pauseStreakDisplay === true,
    promptsEnabled: value.promptsEnabled === true,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

export async function loadGentleHydrationMode(): Promise<GentleHydrationModeState> {
  try {
    const raw = await gentleHydrationStorage.getItem();
    return raw
      ? normalizeGentleHydrationMode(JSON.parse(raw))
      : DEFAULT_GENTLE_HYDRATION_MODE;
  } catch {
    return DEFAULT_GENTLE_HYDRATION_MODE;
  }
}

/** Disabling is deletion, never a persisted false value. */
export async function saveGentleHydrationMode(
  next: Omit<GentleHydrationModeState, "updatedAt">,
): Promise<GentleHydrationModeState> {
  if (!next.enabled) {
    await clearGentleHydrationMode();
    return DEFAULT_GENTLE_HYDRATION_MODE;
  }
  const saved = { ...next, updatedAt: new Date().toISOString() };
  try {
    await gentleHydrationStorage.setItem(JSON.stringify(saved));
  } catch {
    // Fail closed: never mirror this preference to a less private store.
  }
  return saved;
}

export async function clearGentleHydrationMode(): Promise<void> {
  try {
    await gentleHydrationStorage.removeItem();
  } catch {
    /* deletion is best effort */
  }
}

export function gentleHydrationIsShareable(): false {
  return false;
}
