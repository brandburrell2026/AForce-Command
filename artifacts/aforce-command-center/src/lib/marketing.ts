/**
 * Command Center — LOCAL typed client for the founder Marketing Attribution.
 *
 * Same isolation rules as commandCenter.ts / activationFunnel.ts: founder
 * analytics must never ship in the consumer bundles, so this talks to the
 * hand-written, OpenAPI-excluded `GET /api/admin/command-center/marketing`
 * route with cookie-based auth. The DTO mirrors the server
 * `MarketingAttributionDTO` 1:1.
 *
 * Honesty / Score-Protection: a source nobody scanned has
 * `subscribeRate: null` — render an awaiting note, never a fabricated 0%.
 * The rate's numerator is `converted` (scanners who then subscribed), a
 * subset of `scanned`, so it never exceeds 100%; `subscribers` is the raw
 * paid count and may include identities that never scanned.
 * Revenue is counted ONLY from `subscription_started` events that actually
 * carry a valid amount + currency, so a source can have subscribers while
 * `revenue.byCurrency` is empty — render "Awaiting revenue", never a
 * fabricated $0.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CommandCenterApiError } from "./commandCenter";

/** Aggregated revenue for one currency (never summed across currencies). */
export interface RevenueRollup {
  currency: string;
  subscribers: number;
  grossCents: number;
  arpuCents: number;
}

export interface PlanMixRow {
  planTier: string;
  subscribers: number;
}

export interface RevenueTotals {
  /** Subscribers with a valid (amount + currency) revenue payload. */
  subscribers: number;
  byCurrency: RevenueRollup[];
  planMix: PlanMixRow[];
}

export interface MarketingSourceRow {
  segment: string;
  /** Identities that scanned an acquisition QR attributed to this source. */
  scanned: number;
  /** Identities in this source that started a paid subscription (raw count). */
  subscribers: number;
  /** Scanners who then subscribed (chronologically) — a subset of scanned. */
  converted: number;
  /** converted / scanned, or null when nobody scanned (awaiting). */
  subscribeRate: number | null;
  revenue: RevenueTotals;
}

export interface MarketingSource {
  dimension: string;
  rows: MarketingSourceRow[];
}

export interface MarketingOverview {
  scanned: number;
  subscribers: number;
  /** Scanners who then subscribed (chronologically) — a subset of scanned. */
  converted: number;
  subscribeRate: number | null;
  revenue: RevenueTotals;
}

export interface MarketingAttributionDTO {
  generatedAt: string;
  totalFunnels: number;
  overall: MarketingOverview;
  sources: MarketingSource[];
}

const MARKETING_URL = "/api/admin/command-center/marketing";

export async function fetchMarketingAttribution(): Promise<MarketingAttributionDTO> {
  const res = await fetch(MARKETING_URL, {
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
  return (await res.json()) as MarketingAttributionDTO;
}

export const marketingQueryKey = ["command-center", "marketing"] as const;

export function useMarketingAttribution(
  options?: { enabled?: boolean },
): UseQueryResult<MarketingAttributionDTO, CommandCenterApiError> {
  return useQuery({
    queryKey: marketingQueryKey,
    queryFn: fetchMarketingAttribution,
    enabled: options?.enabled ?? true,
  });
}

/** Human label for each attribution dimension. */
export const DIMENSION_LABELS: Record<string, string> = {
  sku: "By SKU",
  retailLocationId: "By Retail Location",
  geo: "By Geography",
  campaign: "By Campaign",
};

/** Format minor units (cents) in a currency, with a graceful fallback. */
export function formatMoneyCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * Gross revenue across currencies as a compact string, or null when there
 * is no attributed revenue yet (so the UI shows "Awaiting revenue", never $0).
 * Revenue is shown PER currency and never summed across currencies.
 */
export function formatGross(totals: RevenueTotals): string | null {
  if (totals.byCurrency.length === 0) return null;
  return totals.byCurrency
    .map((c) => formatMoneyCents(c.grossCents, c.currency))
    .join(" · ");
}

/** ARPU across currencies as a compact string, or null when no revenue yet. */
export function formatArpu(totals: RevenueTotals): string | null {
  if (totals.byCurrency.length === 0) return null;
  return totals.byCurrency
    .map((c) => formatMoneyCents(c.arpuCents, c.currency))
    .join(" · ");
}
