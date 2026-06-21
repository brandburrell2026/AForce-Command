/**
 * Marketing Attribution — founder Command Center aggregate (server lib).
 *
 * Answers the owner's "which acquisition source actually drives revenue?"
 * question. Where the Activation Funnel lib is the FUNNEL/conversion lens,
 * this is the ACQUISITION→REVENUE lens: for each attribution dimension
 * (SKU / retail / geo / campaign) it reports acquisition volume (scans),
 * paid conversions (subscribers), and the attributed revenue rollup
 * (per-currency gross + ARPU, plan mix) carried as NON-PII metadata on the
 * `subscription_started` event.
 *
 * It runs the same PURE, unit-tested `@workspace/activation-core` engine
 * over per-identity rows, so the math is shared and never forks.
 *
 * Privacy: input rows are PSEUDONYMOUS (analytics_id only, NEVER joined to
 * users / subscriptions / Stripe) and never leave this process — only
 * aggregate counts / amounts / rates do. Score-Protection & no-fabrication:
 * a source nobody scanned reports `subscribeRate: null` (awaiting), never a
 * fabricated 0%; revenue is counted ONLY from events that actually carry a
 * valid (amount + currency) payload, so a subscriber whose event lacked
 * revenue contributes to the subscriber count but NOT to gross — surfaced
 * as "awaiting revenue", never a fabricated $0.
 */
import { z } from "zod";
import {
  aggregateRevenue,
  attributionFromPayload,
  deriveActivationFunnel,
  elapsedMsBetween,
  revenueFromPayload,
  segmentByAttribution,
  type ActivationFunnelState,
  type AttributionDimension,
  type RevenueTotals,
} from "@workspace/activation-core";

/** Attribution dimensions surfaced, in display order (mirrors the funnel). */
const SEGMENT_DIMENSIONS: readonly AttributionDimension[] = [
  "sku",
  "retailLocationId",
  "geo",
  "campaign",
];

/** Cap rows per dimension so a high-cardinality dimension can't bloat the
 *  founder payload; rows are sorted by scans desc so the top sources survive. */
const MAX_SOURCE_ROWS = 100;

/**
 * One pseudonymous identity's marketing-relevant milestones: the first
 * `qr_scanned` (acquisition + its attribution payload) and the first
 * `subscription_started` (paid outcome + its non-PII revenue payload).
 */
export interface MarketingRow {
  qrScanned: string | null;
  subscriptionStarted: string | null;
  qrPayload: Record<string, unknown> | null;
  subscriptionPayload: Record<string, unknown> | null;
}

const RevenueRollupSchema = z.object({
  currency: z.string(),
  subscribers: z.number().int().nonnegative(),
  grossCents: z.number().int().nonnegative(),
  arpuCents: z.number().int().nonnegative(),
});

const PlanMixRowSchema = z.object({
  planTier: z.string(),
  subscribers: z.number().int().nonnegative(),
});

const RevenueTotalsSchema = z.object({
  subscribers: z.number().int().nonnegative(),
  byCurrency: z.array(RevenueRollupSchema),
  planMix: z.array(PlanMixRowSchema),
});

const MarketingSourceRowSchema = z.object({
  segment: z.string(),
  /** Identities that scanned an acquisition QR attributed to this source. */
  scanned: z.number().int().nonnegative(),
  /** Identities in this source that started a paid subscription (raw count). */
  subscribers: z.number().int().nonnegative(),
  /** Scanners who then subscribed (chronologically) — a SUBSET of scanned. */
  converted: z.number().int().nonnegative(),
  /** converted / scanned, or null when nobody scanned (awaiting). */
  subscribeRate: z.number().min(0).max(1).nullable(),
  revenue: RevenueTotalsSchema,
});

const MarketingSourceSchema = z.object({
  dimension: z.string(),
  rows: z.array(MarketingSourceRowSchema),
});

const MarketingOverviewSchema = z.object({
  scanned: z.number().int().nonnegative(),
  subscribers: z.number().int().nonnegative(),
  converted: z.number().int().nonnegative(),
  subscribeRate: z.number().min(0).max(1).nullable(),
  revenue: RevenueTotalsSchema,
});

export const MarketingAttributionSchema = z.object({
  generatedAt: z.string(),
  totalFunnels: z.number().int().nonnegative(),
  overall: MarketingOverviewSchema,
  sources: z.array(MarketingSourceSchema),
});

export type MarketingAttributionDTO = z.infer<typeof MarketingAttributionSchema>;

function toFunnel(row: MarketingRow): ActivationFunnelState {
  return deriveActivationFunnel({
    milestones: {
      qr_scanned: row.qrScanned,
      subscription_started: row.subscriptionStarted,
    },
    attribution: row.qrPayload ? attributionFromPayload(row.qrPayload) : null,
    revenue: row.subscriptionPayload
      ? revenueFromPayload(row.subscriptionPayload)
      : null,
  });
}

/** Honest rate: null (awaiting) when the denominator is zero, never 0%. */
function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * A scan→subscribe conversion counts only when ONE identity reached BOTH
 * qr_scanned and subscription_started chronologically (subscribe at/after
 * scan) — mirroring the activation engine's chronological conversion rule
 * via `elapsedMsBetween`, so the math never forks. This keeps the rate
 * numerator a SUBSET of `scanned`: paid subscribers who never scanned (or
 * subscribed before scanning) still show in the raw `subscribers` count but
 * can never push `subscribeRate` above 100% (which would also fail the
 * `max(1)` schema and 500 the route).
 */
function scanToSubscribe(f: ActivationFunnelState): boolean {
  return (
    f.reached.qr_scanned &&
    f.reached.subscription_started &&
    elapsedMsBetween(f, "qr_scanned", "subscription_started") !== null
  );
}

function overviewOf(funnels: readonly ActivationFunnelState[]) {
  let scanned = 0;
  let subscribers = 0;
  let converted = 0;
  for (const f of funnels) {
    if (f.reached.qr_scanned) scanned += 1;
    if (f.reached.subscription_started) subscribers += 1;
    if (scanToSubscribe(f)) converted += 1;
  }
  return {
    scanned,
    subscribers,
    converted,
    subscribeRate: rate(converted, scanned),
    revenue: aggregateRevenue(funnels) satisfies RevenueTotals,
  };
}

function buildSource(
  funnels: readonly ActivationFunnelState[],
  dimension: AttributionDimension,
) {
  const groups = segmentByAttribution(funnels, dimension);
  const rows = [...groups.entries()].map(([segment, group]) => {
    const o = overviewOf(group);
    return {
      segment,
      scanned: o.scanned,
      subscribers: o.subscribers,
      converted: o.converted,
      subscribeRate: o.subscribeRate,
      revenue: o.revenue,
    };
  });
  rows.sort(
    (a, b) =>
      b.scanned - a.scanned ||
      b.subscribers - a.subscribers ||
      (a.segment < b.segment ? -1 : a.segment > b.segment ? 1 : 0),
  );
  return { dimension, rows: rows.slice(0, MAX_SOURCE_ROWS) };
}

/**
 * Pure builder: per-identity rows → aggregate marketing-attribution DTO.
 * `generatedAt` is injected (no Date.now()) so the result is deterministic
 * and testable.
 */
export function buildMarketingAttribution(
  rows: readonly MarketingRow[],
  generatedAt: string,
): MarketingAttributionDTO {
  const funnels = rows.map(toFunnel);
  return {
    generatedAt,
    totalFunnels: funnels.length,
    overall: overviewOf(funnels),
    sources: SEGMENT_DIMENSIONS.map((d) => buildSource(funnels, d)),
  };
}
