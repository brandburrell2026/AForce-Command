/**
 * Command Center — LOCAL typed client for the founder Voice Check-In™
 * usage panel.
 *
 * Same isolation rules as commandCenter.ts / activationFunnel.ts: founder
 * analytics must never ship in the consumer bundles, so this talks to the
 * hand-written, OpenAPI-excluded
 * `GET /api/admin/command-center/voice-checkin-usage` route with
 * cookie-based auth. The DTO mirrors the server `VoiceCheckInUsageDTO` 1:1.
 *
 * Honesty / Score-Protection: a rate with `status: "awaiting"` has an empty
 * denominator (no active or check-in users yet) — render an awaiting note,
 * never a fabricated 0%.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CommandCenterApiError } from "./commandCenter";

export type UsageStatus = "awaiting" | "measured";

export interface VoiceCheckInUsageDTO {
  generatedAt: string;
  /** Active identities (opened the app and/or completed a check-in). */
  activeUsers: number;
  /** Identities with >= 1 voice check-in. */
  checkInUsers: number;
  /** Identities with >= 2 voice check-ins (returning users). */
  repeatUsers: number;
  /** Total distinct-day check-ins across all identities. */
  totalCheckIns: number;
  /** checkInUsers / activeUsers, or null when no active users. */
  adoptionRate: number | null;
  /** repeatUsers / checkInUsers, or null when no check-in users. */
  repeatRate: number | null;
  /** totalCheckIns / checkInUsers, or null when no check-in users. */
  avgPerUser: number | null;
  adoptionStatus: UsageStatus;
  repeatStatus: UsageStatus;
}

const VOICE_CHECKIN_USAGE_URL =
  "/api/admin/command-center/voice-checkin-usage";

export async function fetchVoiceCheckInUsage(): Promise<VoiceCheckInUsageDTO> {
  const res = await fetch(VOICE_CHECKIN_USAGE_URL, {
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
  return (await res.json()) as VoiceCheckInUsageDTO;
}

export const voiceCheckInUsageQueryKey = [
  "command-center",
  "voice-checkin-usage",
] as const;

export function useVoiceCheckInUsage(
  options?: { enabled?: boolean },
): UseQueryResult<VoiceCheckInUsageDTO, CommandCenterApiError> {
  return useQuery({
    queryKey: voiceCheckInUsageQueryKey,
    queryFn: fetchVoiceCheckInUsage,
    enabled: options?.enabled ?? true,
  });
}
