/**
 * Command Center — LOCAL typed client for the founder Territory engagement
 * panel.
 *
 * Same isolation rules as commandCenter.ts / voiceCheckInUsage.ts: founder
 * analytics must never ship in the consumer bundles, so this talks to the
 * hand-written, OpenAPI-excluded
 * `GET /api/admin/command-center/territory-engagement` route with
 * cookie-based auth. The DTO mirrors the server `TerritoryEngagementDTO` 1:1.
 *
 * Honesty / Score-Protection: a rate with `status: "awaiting"` has an empty
 * denominator (nobody reached / engaged yet) — render an awaiting note,
 * never a fabricated 0%. An action nobody performed is simply absent from
 * `actions`.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CommandCenterApiError } from "./commandCenter";

export type EngagementStatus = "awaiting" | "measured";

export interface TerritoryActionBreakdown {
  action: string;
  /** Distinct identities that performed this action at least once. */
  users: number;
  /** Total occurrences of this action across all identities. */
  events: number;
}

export interface TerritoryEngagementDTO {
  generatedAt: string;
  /** Identities that reached Territory (opened the map and/or engaged). */
  reachedUsers: number;
  /** Identities with >= 1 real engagement action. */
  engagedUsers: number;
  /** Total engagement actions across all identities. */
  totalEngagements: number;
  /** engagedUsers / reachedUsers, or null when nobody reached Territory. */
  engagementRate: number | null;
  /** totalEngagements / engagedUsers, or null when no engaged users. */
  avgPerUser: number | null;
  engagementStatus: EngagementStatus;
  avgStatus: EngagementStatus;
  /** Per-action composition, sorted by event count desc. Empty when none. */
  actions: TerritoryActionBreakdown[];
}

const TERRITORY_ENGAGEMENT_URL =
  "/api/admin/command-center/territory-engagement";

export async function fetchTerritoryEngagement(): Promise<TerritoryEngagementDTO> {
  const res = await fetch(TERRITORY_ENGAGEMENT_URL, {
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
  return (await res.json()) as TerritoryEngagementDTO;
}

export const territoryEngagementQueryKey = [
  "command-center",
  "territory-engagement",
] as const;

export function useTerritoryEngagement(
  options?: { enabled?: boolean },
): UseQueryResult<TerritoryEngagementDTO, CommandCenterApiError> {
  return useQuery({
    queryKey: territoryEngagementQueryKey,
    queryFn: fetchTerritoryEngagement,
    enabled: options?.enabled ?? true,
  });
}

/** Friendly labels for the instrumented Territory engagement actions. */
const ACTION_LABELS: Record<string, string> = {
  region_selected: "Region Explored",
  battle_supported: "Battle Supported",
};

export function territoryActionLabel(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
