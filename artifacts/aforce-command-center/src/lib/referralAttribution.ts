/**
 * Command Center — LOCAL typed client for the founder Referral & Ambassador
 * Attribution panel.
 *
 * Same isolation rules as commandCenter.ts: founder analytics must never ship in
 * the consumer bundles, so this talks to the hand-written, OpenAPI-excluded
 * `GET /api/admin/command-center/referral-attribution` route with cookie-based
 * auth. The DTO mirrors the server `ReferralAttributionDTO` 1:1.
 *
 * UNLIKE the pseudonymous-analytics panels, this is the REAL referral ledger
 * (who referred whom), surfaced for the founder by design. It carries NO score /
 * health / performance data — identity is the Clerk user id + the generated,
 * non-PII referral code only.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CommandCenterApiError } from "./commandCenter";

export type ReferralTierId =
  | "recruit"
  | "operator"
  | "captain"
  | "commander"
  | "general";

/** Claim-status filter values (mirrors the server). The ledger models only
 *  completed claims, so both select the same rows — `claimed` is an explicit,
 *  validated no-op rather than a hidden-row filter. */
export type ReferralStatusFilter = "all" | "claimed";

export interface ReferralAmbassadorDTO {
  rank: number;
  referrerUserId: string;
  handle: string;
  referralCode: string | null;
  claims: number;
  tierId: ReferralTierId;
  tierLabel: string;
}

export interface ReferralTierBucketDTO {
  tierId: ReferralTierId;
  label: string;
  ambassadors: number;
}

export interface ReferralClaimDTO {
  id: number;
  codeUsed: string;
  referrerUserId: string;
  referrerHandle: string;
  referrerCode: string | null;
  referrerTierId: ReferralTierId;
  referrerTierLabel: string;
  refereeUserId: string;
  claimedAt: string | null;
}

export interface ReferralAttributionFiltersDTO {
  from: string | null;
  to: string | null;
  code: string | null;
  referrerUserId: string | null;
  tier: ReferralTierId | null;
  status: ReferralStatusFilter | null;
}

export interface ReferralAttributionDTO {
  generatedAt: string;
  topLimit: number;
  recentLimit: number;
  overview: {
    totalClaims: number;
    totalAmbassadors: number;
    totalReferredUsers: number;
    claimsInRange: number;
  };
  topAmbassadors: ReferralAmbassadorDTO[];
  tierDistribution: ReferralTierBucketDTO[];
  recentClaims: ReferralClaimDTO[];
  filters: ReferralAttributionFiltersDTO;
}

/** UI-side filter inputs (all optional). */
export interface ReferralAttributionFilters {
  from?: string;
  to?: string;
  code?: string;
  referrerUserId?: string;
  tier?: ReferralTierId;
  status?: ReferralStatusFilter;
}

/** Tier options for the filter dropdown, in ladder order (low → high). */
export const TIER_OPTIONS: { id: ReferralTierId; label: string }[] = [
  { id: "recruit", label: "Recruit" },
  { id: "operator", label: "Operator" },
  { id: "captain", label: "Captain" },
  { id: "commander", label: "Commander" },
  { id: "general", label: "General" },
];

/**
 * Absolute, root-relative path — the shared Replit proxy routes `/api` to the
 * api-server regardless of which artifact made the request.
 */
const BASE_URL = "/api/admin/command-center/referral-attribution";

function buildUrl(f: ReferralAttributionFilters): string {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.code) p.set("code", f.code);
  if (f.referrerUserId) p.set("referrerUserId", f.referrerUserId);
  if (f.tier) p.set("tier", f.tier);
  if (f.status) p.set("status", f.status);
  const qs = p.toString();
  return qs ? `${BASE_URL}?${qs}` : BASE_URL;
}

export async function fetchReferralAttribution(
  filters: ReferralAttributionFilters = {},
): Promise<ReferralAttributionDTO> {
  const res = await fetch(buildUrl(filters), {
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
  return (await res.json()) as ReferralAttributionDTO;
}

export const referralAttributionQueryKey = (
  filters: ReferralAttributionFilters = {},
) =>
  [
    "command-center",
    "referral-attribution",
    filters.from ?? null,
    filters.to ?? null,
    filters.code ?? null,
    filters.referrerUserId ?? null,
    filters.tier ?? null,
    filters.status ?? null,
  ] as const;

export function useReferralAttribution(
  filters: ReferralAttributionFilters = {},
  options?: { enabled?: boolean },
): UseQueryResult<ReferralAttributionDTO, CommandCenterApiError> {
  return useQuery({
    queryKey: referralAttributionQueryKey(filters),
    queryFn: () => fetchReferralAttribution(filters),
    enabled: options?.enabled ?? true,
  });
}

/** Tailwind text-accent per tier so the ladder reads at a glance. */
export const TIER_ACCENT: Record<ReferralTierId, string> = {
  recruit: "text-muted-foreground",
  operator: "text-foreground",
  captain: "text-blue-400",
  commander: "text-amber-400",
  general: "text-primary",
};
