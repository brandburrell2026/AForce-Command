/**
 * Gentle Hydration Mode — private, opt-in support for members who prefer a
 * lower-pressure hydration rhythm, including people using GLP-1 medicines.
 *
 * This is a planning preference only. It never changes a hydration target,
 * records medication, changes the score, sends a notification, or enters a
 * Circle payload. Personal comfort notes stay in account-scoped secure storage.
 */
import { scopedSecureKV } from "./scopedStorage";

const STORAGE_KEY = "aforce.gentleHydrationMode.v1";

export type GentleHydrationCadence = "gentle" | "steady" | "minimal";
export type GentleHydrationComfort =
  | "fine"
  | "low_appetite"
  | "mild_nausea"
  | "stomach_upset"
  | "prefer_not_to_say";

export interface GentleHydrationModeState {
  enabled: boolean;
  cadence: GentleHydrationCadence;
  comfort?: GentleHydrationComfort;
  updatedAt: string;
  pausedOnDayKey?: string;
  deferredUntil?: string;
}

export const DEFAULT_GENTLE_HYDRATION_MODE: GentleHydrationModeState = {
  enabled: false,
  cadence: "gentle",
  updatedAt: "",
};

const CADENCE_CHECK_INS: Record<GentleHydrationCadence, number> = {
  gentle: 5,
  steady: 4,
  minimal: 3,
};

export function gentleHydrationCheckInCount(
  cadence: GentleHydrationCadence,
): number {
  return CADENCE_CHECK_INS[cadence];
}

export function normalizeGentleHydrationMode(
  raw: unknown,
): GentleHydrationModeState {
  if (!raw || typeof raw !== "object") return DEFAULT_GENTLE_HYDRATION_MODE;
  const candidate = raw as Partial<GentleHydrationModeState>;
  const cadence: GentleHydrationCadence =
    candidate.cadence === "steady" ||
    candidate.cadence === "minimal" ||
    candidate.cadence === "gentle"
      ? candidate.cadence
      : "gentle";
  const comfort: GentleHydrationComfort | undefined =
    candidate.comfort === "fine" ||
    candidate.comfort === "low_appetite" ||
    candidate.comfort === "mild_nausea" ||
    candidate.comfort === "stomach_upset" ||
    candidate.comfort === "prefer_not_to_say"
      ? candidate.comfort
      : undefined;
  return {
    enabled: candidate.enabled === true,
    cadence,
    ...(comfort ? { comfort } : {}),
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
    ...(typeof candidate.pausedOnDayKey === "string"
      ? { pausedOnDayKey: candidate.pausedOnDayKey }
      : {}),
    ...(typeof candidate.deferredUntil === "string"
      ? { deferredUntil: candidate.deferredUntil }
      : {}),
  };
}

export async function loadGentleHydrationMode(): Promise<GentleHydrationModeState> {
  try {
    const raw = await scopedSecureKV.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GENTLE_HYDRATION_MODE;
    return normalizeGentleHydrationMode(JSON.parse(raw));
  } catch {
    return DEFAULT_GENTLE_HYDRATION_MODE;
  }
}

export async function saveGentleHydrationMode(
  next: Omit<GentleHydrationModeState, "updatedAt">,
): Promise<GentleHydrationModeState> {
  const normalized = normalizeGentleHydrationMode({
    ...next,
    updatedAt: new Date().toISOString(),
  });
  try {
    await scopedSecureKV.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The UI remains usable for this session; a storage failure must not change
    // the hydration engine or imply that a sensitive preference was saved.
  }
  return normalized;
}

/** Remove all locally stored Gentle Hydration preferences and comfort context. */
export async function clearGentleHydrationMode(): Promise<void> {
  try {
    await scopedSecureKV.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort. A failed delete must not change the hydration engine.
  }
}

/** Explicit contract for every future social or analytics integration. */
export function gentleHydrationIsShareable(): false {
  return false;
}
