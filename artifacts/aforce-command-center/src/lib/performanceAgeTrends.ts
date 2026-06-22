/**
 * Command Center — LOCAL typed client for the founder Performance Age™ trends
 * panel.
 *
 * Same isolation rules as commandCenter.ts / territoryEngagement.ts: founder
 * analytics must never ship in the consumer bundles, so this talks to the
 * hand-written, OpenAPI-excluded
 * `GET /api/admin/command-center/performance-age-trends` route with
 * cookie-based auth. The DTO mirrors the server `PerformanceAgeTrendsDTO` 1:1.
 *
 * Honesty / Score-Protection: a window with `status: "awaiting"` has no
 * snapshots and a window with `status: "collecting"` is below the k-anonymity
 * floor — both report a null average (render the awaiting/collecting note,
 * never a fabricated number). A `change` is only `measured` when BOTH windows
 * are measured; otherwise it is null.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CommandCenterApiError } from "./commandCenter";

export type PerformanceAgeWindowStatus = "awaiting" | "collecting" | "measured";
export type PerformanceAgeChangeDirection = "younger" | "older" | "steady";

export interface PerformanceAgeWindowDTO {
  /** Mean years-delta (performanceAge − actualAge; negative = younger), or null
   *  when awaiting/collecting (empty or below the k-anon floor). */
  avgDeltaYears: number | null;
  /** Total daily snapshots in the window (one per member per UTC day). */
  snapshotCount: number;
  /** Distinct pseudonymous members contributing to the window. */
  distinctMembers: number;
  status: PerformanceAgeWindowStatus;
}

export interface PerformanceAgeTrendsDTO {
  generatedAt: string;
  /** Length of each comparison window, in days. */
  windowDays: number;
  /** k-anonymity floor: distinct members required before an average surfaces. */
  minCohort: number;
  /** Most recent window. */
  current: PerformanceAgeWindowDTO;
  /** The window immediately before `current` (same length). */
  previous: PerformanceAgeWindowDTO;
  change: {
    /** current.avgDeltaYears − previous.avgDeltaYears, only when both measured. */
    deltaYears: number | null;
    direction: PerformanceAgeChangeDirection | null;
    status: PerformanceAgeWindowStatus;
  };
}

const PERFORMANCE_AGE_TRENDS_URL =
  "/api/admin/command-center/performance-age-trends";

export async function fetchPerformanceAgeTrends(): Promise<PerformanceAgeTrendsDTO> {
  const res = await fetch(PERFORMANCE_AGE_TRENDS_URL, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new CommandCenterApiError(res.status, message);
  }
  return (await res.json()) as PerformanceAgeTrendsDTO;
}

export const performanceAgeTrendsQueryKey = [
  "command-center",
  "performance-age-trends",
] as const;

export function usePerformanceAgeTrends(
  options?: { enabled?: boolean },
): UseQueryResult<PerformanceAgeTrendsDTO, CommandCenterApiError> {
  return useQuery({
    queryKey: performanceAgeTrendsQueryKey,
    queryFn: fetchPerformanceAgeTrends,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Format a signed years-delta as a human phrase. Negative = younger (the
 * outcome the product drives), positive = older, zero = on par.
 */
export function formatYearsDelta(years: number): {
  text: string;
  direction: PerformanceAgeChangeDirection;
} {
  const abs = Math.abs(years);
  const absText = abs.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  const unit = abs === 1 ? "yr" : "yrs";
  if (years < 0) return { text: `${absText} ${unit} younger`, direction: "younger" };
  if (years > 0) return { text: `${absText} ${unit} older`, direction: "older" };
  return { text: "On par with actual age", direction: "steady" };
}
