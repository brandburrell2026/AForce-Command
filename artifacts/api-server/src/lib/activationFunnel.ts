/**
 * Activation Funnel — founder Command Center aggregate (server lib).
 *
 * Bridges the two contracts: it maps analytics-contract Phase-1 events to
 * the activation-core funnel milestones, then runs the PURE, unit-tested
 * `@workspace/activation-core` funnel engine over per-identity milestone
 * rows to produce an aggregate-only DTO — overall stage reach, the three
 * headline conversions, and those same conversions segmented by
 * attribution dimension (the "track every step by SKU / retail / geo"
 * view the owner asked for).
 *
 * Privacy: input rows are PSEUDONYMOUS (analytics_id only, NEVER joined to
 * users / subscriptions) and never leave this process — only aggregate
 * counts / rates do. Score-Protection & no-fabrication: a conversion with
 * an empty cohort reports `rate: null` + `awaiting`, never a fabricated
 * 0%; funnel stages that have no Phase-1 event behind them are flagged
 * `instrumented: false` rather than reported as "0 reached".
 */
import { z } from "zod";
import {
  ACTIVATION_STAGES,
  aggregateConversions,
  aggregateStageCounts,
  attributionFromPayload,
  deriveActivationFunnel,
  segmentByAttribution,
  type ActivationStage,
  type ActivationFunnelState,
  type AttributionDimension,
  type ConversionResult,
} from "@workspace/activation-core";

/**
 * Funnel stages with a real Phase-1 analytics event behind them. The rest
 * of the owner funnel (can_purchased, performance_age_baseline,
 * first_command_issued, day7_subscription_offer) is architected but not yet
 * instrumented, so it is reported as not-tracked rather than a fabricated
 * zero.
 */
const INSTRUMENTED_STAGES: ReadonlySet<ActivationStage> = new Set([
  "qr_scanned",
  "app_opened",
  "profile_completed",
  "first_command_completed",
  "first_win_confirmed",
]);

/** Attribution dimensions surfaced in the segmented view, in display order. */
const SEGMENT_DIMENSIONS: readonly AttributionDimension[] = [
  "sku",
  "retailLocationId",
  "geo",
  "campaign",
];

/** Cap rows per dimension so a high-cardinality dimension can't bloat the
 *  founder payload; rows are sorted by cohort desc so the top segments
 *  survive the cut. */
const MAX_SEGMENT_ROWS = 100;

/**
 * One pseudonymous identity's earliest funnel-milestone timestamps plus
 * the attribution payload carried by its FIRST qr_scanned event.
 */
export interface ActivationFunnelRow {
  qrScanned: string | null;
  appOpened: string | null;
  profileCompleted: string | null;
  firstCommandCompleted: string | null;
  firstWinConfirmed: string | null;
  subscriptionStarted: string | null;
  qrPayload: Record<string, unknown> | null;
}

const ConversionDTOSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  entered: z.number().int().nonnegative(),
  converted: z.number().int().nonnegative(),
  rate: z.number().min(0).max(1).nullable(),
  status: z.enum(["awaiting", "measured"]),
});

const StageDTOSchema = z.object({
  stage: z.string(),
  instrumented: z.boolean(),
  count: z.number().int().nonnegative(),
});

const SegmentRowSchema = z.object({
  segment: z.string(),
  cohort: z.number().int().nonnegative(),
  conversions: z.array(ConversionDTOSchema),
});

const SegmentSchema = z.object({
  dimension: z.string(),
  rows: z.array(SegmentRowSchema),
});

export const ActivationFunnelSchema = z.object({
  generatedAt: z.string(),
  totalFunnels: z.number().int().nonnegative(),
  stages: z.array(StageDTOSchema),
  conversions: z.array(ConversionDTOSchema),
  segments: z.array(SegmentSchema),
});

export type ActivationFunnelDTO = z.infer<typeof ActivationFunnelSchema>;

function toConversionDTO(r: ConversionResult) {
  return {
    id: r.id,
    from: r.from,
    to: r.to,
    entered: r.entered,
    converted: r.converted,
    rate: r.rate,
    // Honest status: a cohort nobody entered is "awaiting", never 0%.
    status: r.entered > 0 ? ("measured" as const) : ("awaiting" as const),
  };
}

function toFunnel(row: ActivationFunnelRow): ActivationFunnelState {
  return deriveActivationFunnel({
    milestones: {
      qr_scanned: row.qrScanned,
      app_opened: row.appOpened,
      profile_completed: row.profileCompleted,
      first_command_completed: row.firstCommandCompleted,
      first_win_confirmed: row.firstWinConfirmed,
      subscription_started: row.subscriptionStarted,
    },
    attribution: row.qrPayload ? attributionFromPayload(row.qrPayload) : null,
  });
}

function buildSegment(
  funnels: readonly ActivationFunnelState[],
  dimension: AttributionDimension,
) {
  const groups = segmentByAttribution(funnels, dimension);
  const rows = [...groups.entries()].map(([segment, group]) => ({
    segment,
    cohort: group.length,
    conversions: aggregateConversions(group).map(toConversionDTO),
  }));
  rows.sort(
    (a, b) =>
      b.cohort - a.cohort ||
      (a.segment < b.segment ? -1 : a.segment > b.segment ? 1 : 0),
  );
  return { dimension, rows: rows.slice(0, MAX_SEGMENT_ROWS) };
}

/**
 * Pure builder: per-identity rows → aggregate funnel DTO. `generatedAt`
 * is injected (no Date.now()) so the result is deterministic + testable.
 */
export function buildActivationFunnel(
  rows: readonly ActivationFunnelRow[],
  generatedAt: string,
): ActivationFunnelDTO {
  const funnels = rows.map(toFunnel);
  const stageCounts = aggregateStageCounts(funnels);
  const stages = ACTIVATION_STAGES.map((stage) => ({
    stage,
    instrumented: INSTRUMENTED_STAGES.has(stage),
    count: stageCounts[stage],
  }));
  const conversions = aggregateConversions(funnels).map(toConversionDTO);
  const segments = SEGMENT_DIMENSIONS.map((d) => buildSegment(funnels, d));
  return {
    generatedAt,
    totalFunnels: funnels.length,
    stages,
    conversions,
    segments,
  };
}
