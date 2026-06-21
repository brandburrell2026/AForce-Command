/**
 * Command Center — LOCAL typed client for the founder Activation Funnel.
 *
 * Same isolation rules as commandCenter.ts / retentionGates.ts: founder
 * analytics must never ship in the consumer bundles, so this talks to the
 * hand-written, OpenAPI-excluded
 * `GET /api/admin/command-center/activation-funnel` route with cookie-based
 * auth. The DTO mirrors the server `ActivationFunnelDTO` 1:1.
 *
 * Honesty / Score-Protection: a conversion with `status: "awaiting"` has no
 * cohort yet — render an awaiting note, never a fabricated 0%. A funnel
 * stage with `instrumented: false` has no Phase-1 event behind it — render
 * "Not instrumented yet", never a real "0 reached".
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CommandCenterApiError } from "./commandCenter";

export type ConversionStatus = "awaiting" | "measured";

export interface FunnelConversion {
  id: string;
  from: string;
  to: string;
  /** Funnels that reached `from`. */
  entered: number;
  /** Funnels that reached both `from` and `to` (chronologically). */
  converted: number;
  /** converted / entered, or null when none entered. */
  rate: number | null;
  status: ConversionStatus;
}

export interface FunnelStage {
  stage: string;
  /** False for owner stages with no Phase-1 event behind them yet. */
  instrumented: boolean;
  count: number;
}

export interface FunnelSegmentRow {
  segment: string;
  /** Funnels in this attribution bucket. */
  cohort: number;
  conversions: FunnelConversion[];
}

export interface FunnelSegment {
  dimension: string;
  rows: FunnelSegmentRow[];
}

export interface ActivationFunnelDTO {
  generatedAt: string;
  totalFunnels: number;
  stages: FunnelStage[];
  conversions: FunnelConversion[];
  segments: FunnelSegment[];
}

const ACTIVATION_FUNNEL_URL = "/api/admin/command-center/activation-funnel";

export async function fetchActivationFunnel(): Promise<ActivationFunnelDTO> {
  const res = await fetch(ACTIVATION_FUNNEL_URL, {
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
  return (await res.json()) as ActivationFunnelDTO;
}

export const activationFunnelQueryKey = [
  "command-center",
  "activation-funnel",
] as const;

export function useActivationFunnel(
  options?: { enabled?: boolean },
): UseQueryResult<ActivationFunnelDTO, CommandCenterApiError> {
  return useQuery({
    queryKey: activationFunnelQueryKey,
    queryFn: fetchActivationFunnel,
    enabled: options?.enabled ?? true,
  });
}

/** The three headline conversions, in funnel order. */
export const HEADLINE_CONVERSIONS = [
  "scanToInstall",
  "installToActivation",
  "activationToSubscription",
] as const;

/** Human label for each owner funnel stage. */
export const STAGE_LABELS: Record<string, string> = {
  can_purchased: "Can Purchased",
  qr_scanned: "QR Scanned",
  app_opened: "App Opened",
  profile_completed: "Profile Completed",
  performance_age_baseline: "Performance Age Baseline",
  first_command_issued: "First Command Issued",
  first_command_completed: "First Command Completed",
  first_win_confirmed: "First Win Confirmed",
  day7_subscription_offer: "Day-7 Subscription Offer",
};

/** Human label for each headline conversion. */
export const CONVERSION_LABELS: Record<string, string> = {
  scanToInstall: "Scan → Install",
  installToActivation: "Install → Activation",
  activationToSubscription: "Activation → Subscription",
};

/** Human label for each attribution dimension. */
export const DIMENSION_LABELS: Record<string, string> = {
  sku: "By SKU",
  retailLocationId: "By Retail Location",
  geo: "By Geography",
  campaign: "By Campaign",
};

/** Find a conversion by id within a segment row (or the top-level list). */
export function findConversion(
  conversions: readonly FunnelConversion[],
  id: string,
): FunnelConversion | undefined {
  return conversions.find((c) => c.id === id);
}
