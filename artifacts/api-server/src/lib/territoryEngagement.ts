/**
 * Territory Engagement — founder Command Center aggregate (server lib).
 *
 * Turns per-pseudonymous-identity event roll-ups into an aggregate-only DTO
 * for the Territory engagement panel: how many identities reached the
 * competition map, how many went deeper and took a real engagement action
 * (inspecting a region, supporting a battle side), the engagement rate, the
 * average actions per engaged user, and a per-action breakdown.
 *
 * Privacy: input rows are PSEUDONYMOUS (analytics_id only, NEVER joined to
 * users / subscriptions) and never leave this process — only aggregate
 * counts / rates do.
 *
 * Score-Protection & no-fabrication: Territory is gamified social and never
 * touches a hydration score, so this is pure engagement telemetry. A rate
 * with an empty denominator reports `null` + `awaiting`, never a fabricated
 * 0%; an action nobody performed is simply absent from the breakdown rather
 * than reported as a "0" row.
 */
import { z } from "zod";

/**
 * One pseudonymous identity's Territory engagement roll-up. `opened` is true
 * when the identity has at least one `territory_opened` event (the mobile
 * client emits that at most once per local day). `actionCounts` maps each
 * `territory_engaged` action to this identity's count of that action.
 */
export interface TerritoryEngagementRow {
  opened: boolean;
  actionCounts: Record<string, number>;
}

const ActionBreakdownSchema = z.object({
  action: z.string(),
  /** Distinct identities that performed this action at least once. */
  users: z.number().int().nonnegative(),
  /** Total occurrences of this action across all identities. */
  events: z.number().int().nonnegative(),
});

export const TerritoryEngagementSchema = z.object({
  generatedAt: z.string(),
  /** Identities that reached Territory (opened the map and/or engaged). */
  reachedUsers: z.number().int().nonnegative(),
  /** Identities with >= 1 real engagement action. */
  engagedUsers: z.number().int().nonnegative(),
  /** Total engagement actions across all identities. */
  totalEngagements: z.number().int().nonnegative(),
  /** engagedUsers / reachedUsers, or null when nobody reached Territory. */
  engagementRate: z.number().min(0).max(1).nullable(),
  /** totalEngagements / engagedUsers, or null when no engaged users. */
  avgPerUser: z.number().nonnegative().nullable(),
  engagementStatus: z.enum(["awaiting", "measured"]),
  avgStatus: z.enum(["awaiting", "measured"]),
  /** Per-action composition, sorted by event count desc. Empty when none. */
  actions: z.array(ActionBreakdownSchema),
});

export type TerritoryEngagementDTO = z.infer<typeof TerritoryEngagementSchema>;

/**
 * Pure builder: per-identity rows → aggregate engagement DTO. `generatedAt`
 * is injected (no Date.now()) so the result is deterministic + testable.
 *
 * `reachedUsers` (the engagement denominator) counts any identity that
 * opened the map OR took an engagement action, so the engaged set is always
 * a subset of the reached base and `engagementRate` can never exceed 1 even
 * if an identity's `territory_opened` event was dropped (it is gated once
 * per local day on the client, so a same-day re-entry never re-emits).
 */
export function buildTerritoryEngagement(
  rows: readonly TerritoryEngagementRow[],
  generatedAt: string,
): TerritoryEngagementDTO {
  let reachedUsers = 0;
  let engagedUsers = 0;
  let totalEngagements = 0;
  const actionUsers = new Map<string, number>();
  const actionEvents = new Map<string, number>();

  for (const r of rows) {
    let engagedTotal = 0;
    for (const [action, rawCount] of Object.entries(r.actionCounts)) {
      const count = Math.max(0, Math.trunc(rawCount));
      if (count > 0) {
        engagedTotal += count;
        actionUsers.set(action, (actionUsers.get(action) ?? 0) + 1);
        actionEvents.set(action, (actionEvents.get(action) ?? 0) + count);
      }
    }
    const reached = r.opened || engagedTotal > 0;
    if (reached) reachedUsers += 1;
    if (engagedTotal > 0) {
      engagedUsers += 1;
      totalEngagements += engagedTotal;
    }
  }

  // Only actions that actually happened appear — never a fabricated 0 row.
  const actions = [...actionEvents.entries()]
    .map(([action, events]) => ({
      action,
      users: actionUsers.get(action) ?? 0,
      events,
    }))
    .sort(
      (a, b) =>
        b.events - a.events ||
        (a.action < b.action ? -1 : a.action > b.action ? 1 : 0),
    );

  const engagementRate = reachedUsers > 0 ? engagedUsers / reachedUsers : null;
  const avgPerUser = engagedUsers > 0 ? totalEngagements / engagedUsers : null;

  return {
    generatedAt,
    reachedUsers,
    engagedUsers,
    totalEngagements,
    engagementRate,
    avgPerUser,
    // Honest status: a rate with an empty denominator is "awaiting", never 0%.
    engagementStatus: reachedUsers > 0 ? "measured" : "awaiting",
    avgStatus: engagedUsers > 0 ? "measured" : "awaiting",
    actions,
  };
}
