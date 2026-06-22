/**
 * Referral & Ambassador Attribution — founder Command Center aggregate
 * (server lib).
 *
 * UNLIKE the Territory / Performance-Age panels (which aggregate the
 * pseudonymous mobile-analytics pipeline), this panel reports the REAL,
 * server-side referral attribution that already backs the consumer referral
 * loop: `aforce_users.referral_code` + the `aforce_referral_claims` ledger.
 * The founder needs to see WHO referred WHOM, so referrer/referee identity is
 * surfaced by design — this is a private founder cockpit, never a consumer view.
 *
 * Score-Protection / data minimisation: a referral claim row carries NOTHING
 * about a user's hydration points, readiness band, recovery, health signals, or
 * performance age — this lib never reads those tables and the DTO has no such
 * field. Identity is the Clerk user id + the (non-PII, generated) referral code
 * only; emails and any protected performance/health data are deliberately
 * excluded.
 *
 * Tiers are derived HERE (never in SQL) so `referralTiers.ts` stays the single
 * source of truth for the ladder. The builder is pure and `generatedAt` is
 * injected (no Date.now()) so results are deterministic and unit-testable.
 */

import { z } from "zod";
import {
  REFERRAL_TIERS,
  tierFor,
  handleForCode,
  type TierId,
} from "./referralTiers";

/** Max ambassadors returned in the ranked leaderboard (display cap only — the
 *  tier distribution + totals are computed over ALL referrers, never capped). */
export const REFERRAL_TOP_AMBASSADORS = 100;
/** Default + hard cap for the recent-claims detail page. */
export const REFERRAL_RECENT_CLAIMS_LIMIT = 100;

/**
 * Claim-status filter values. The ledger models ONLY successful claims (a row's
 * existence IS the completed claim — there is no pending/expired state), so both
 * values are honest no-ops on the result set; the filter exists for explicit,
 * validated founder intent (and future-proofing) rather than to hide rows.
 */
export const REFERRAL_CLAIM_STATUSES = ["all", "claimed"] as const;
export type ReferralStatusFilter = (typeof REFERRAL_CLAIM_STATUSES)[number];

export interface TierClaimBounds {
  /** Inclusive lower bound of lifetime claims for the tier. */
  lo: number;
  /** Exclusive upper bound, or null for the top (open-ended) tier. */
  hi: number | null;
}

/**
 * The [lo, hi) lifetime-claim range that maps to `tierId`, derived from the
 * single-source-of-truth ladder so a SQL tier filter never hard-codes
 * thresholds. The highest tier is open-ended (`hi === null`).
 */
export function tierClaimBounds(tierId: TierId): TierClaimBounds {
  const sorted = [...REFERRAL_TIERS].sort(
    (a, b) => a.claimsRequired - b.claimsRequired,
  );
  const idx = sorted.findIndex((t) => t.id === tierId);
  const lo = sorted[idx]?.claimsRequired ?? 0;
  const next = sorted[idx + 1];
  return { lo, hi: next ? next.claimsRequired : null };
}

/* ─── Raw input rows (already aggregated / filtered in SQL) ─────────────────── */

/**
 * One distinct referrer with their LIFETIME successful-claim count. Drives both
 * the tier distribution and the ranked ambassador leaderboard. `referralCode`
 * is null when the referrer's user row was deleted or never issued a code.
 */
export interface ReferrerCountRow {
  referrerUserId: string;
  referralCode: string | null;
  claims: number;
}

/**
 * One claim row for the recent-claims detail table (already filtered, ordered
 * newest-first, and limited by SQL). `referrerLifetimeClaims` is the referrer's
 * total claim count so the builder can derive their tier without a second
 * lookup. `claimedAt` is null only if a row somehow lacks a timestamp.
 */
export interface ReferralClaimRow {
  id: number;
  codeUsed: string;
  referrerUserId: string;
  referrerCode: string | null;
  referrerLifetimeClaims: number;
  refereeUserId: string;
  claimedAt: string | null;
}

/** Echo of the applied filters (ISO strings / uppercased code / null). */
export interface ReferralAttributionFilters {
  from: string | null;
  to: string | null;
  code: string | null;
  referrerUserId: string | null;
  /** Referrer lifetime tier the detail feed is scoped to, or null for all. */
  tier: TierId | null;
  /** Claim status the detail feed is scoped to, or null for all. */
  status: ReferralStatusFilter | null;
}

export interface ReferralAttributionInput {
  /** ALL distinct referrers (never capped) — drives totals + tier distribution. */
  referrers: readonly ReferrerCountRow[];
  /** Lifetime scalar totals from COUNT queries. */
  totals: { totalClaims: number; totalReferredUsers: number };
  /** Detail rows for the recent-claims table (already filtered + limited). */
  recentClaims: readonly ReferralClaimRow[];
  /** Count of claims matching the applied filters (== totalClaims when none). */
  claimsInRange: number;
  filters: ReferralAttributionFilters;
}

/* ─── Output DTO (Zod) — NO score / health / performance field anywhere ─────── */

const TIER_ID_VALUES = REFERRAL_TIERS.map((t) => t.id) as [TierId, ...TierId[]];
const TierIdSchema = z.enum(TIER_ID_VALUES);

const FiltersSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
  code: z.string().nullable(),
  referrerUserId: z.string().nullable(),
  tier: TierIdSchema.nullable(),
  status: z.enum(REFERRAL_CLAIM_STATUSES).nullable(),
});

const AmbassadorSchema = z.object({
  rank: z.number().int().positive(),
  referrerUserId: z.string(),
  handle: z.string(),
  referralCode: z.string().nullable(),
  claims: z.number().int().nonnegative(),
  tierId: TierIdSchema,
  tierLabel: z.string(),
});

const TierBucketSchema = z.object({
  tierId: TierIdSchema,
  label: z.string(),
  ambassadors: z.number().int().nonnegative(),
});

const ClaimSchema = z.object({
  id: z.number().int(),
  codeUsed: z.string(),
  referrerUserId: z.string(),
  referrerHandle: z.string(),
  referrerCode: z.string().nullable(),
  referrerTierId: TierIdSchema,
  referrerTierLabel: z.string(),
  refereeUserId: z.string(),
  claimedAt: z.string().nullable(),
});

const OverviewSchema = z.object({
  totalClaims: z.number().int().nonnegative(),
  totalAmbassadors: z.number().int().nonnegative(),
  totalReferredUsers: z.number().int().nonnegative(),
  claimsInRange: z.number().int().nonnegative(),
});

export const ReferralAttributionSchema = z.object({
  generatedAt: z.string(),
  topLimit: z.number().int().positive(),
  recentLimit: z.number().int().positive(),
  overview: OverviewSchema,
  topAmbassadors: z.array(AmbassadorSchema),
  tierDistribution: z.array(TierBucketSchema),
  recentClaims: z.array(ClaimSchema),
  filters: FiltersSchema,
});

export type ReferralAttributionDTO = z.infer<typeof ReferralAttributionSchema>;
export type AmbassadorDTO = z.infer<typeof AmbassadorSchema>;
export type ReferralClaimDTO = z.infer<typeof ClaimSchema>;
export type TierBucketDTO = z.infer<typeof TierBucketSchema>;

/* ─── Filter normalisation (pure, route-shared, unit-testable) ──────────────── */

export interface RawReferralQuery {
  from?: unknown;
  to?: unknown;
  code?: unknown;
  referrerUserId?: unknown;
  tier?: unknown;
  status?: unknown;
  limit?: unknown;
}

export interface NormalizedReferralFilters {
  filters: ReferralAttributionFilters;
  recentLimit: number;
}

export type NormalizeReferralResult =
  | { ok: true; value: NormalizedReferralFilters }
  | { ok: false; error: "invalid_date" | "invalid_tier" | "invalid_status" };

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

/**
 * Normalise raw `req.query` into safe, ISO-stamped filters. Dates that fail to
 * parse are rejected (so a bad string can't reach the SQL cast and 500). An
 * out-of-range / non-numeric `limit` silently falls back to the default cap.
 */
export function normalizeReferralFilters(
  raw: RawReferralQuery,
): NormalizeReferralResult {
  let fromIso: string | null = null;
  let toIso: string | null = null;

  const fromStr = asTrimmedString(raw.from);
  if (fromStr) {
    const d = new Date(fromStr);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "invalid_date" };
    fromIso = d.toISOString();
  }
  const toStr = asTrimmedString(raw.to);
  if (toStr) {
    const d = new Date(toStr);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "invalid_date" };
    toIso = d.toISOString();
  }

  const codeStr = asTrimmedString(raw.code);
  const code = codeStr ? codeStr.toUpperCase() : null;
  const referrerUserId = asTrimmedString(raw.referrerUserId);

  let tier: TierId | null = null;
  const tierStr = asTrimmedString(raw.tier);
  if (tierStr) {
    const match = REFERRAL_TIERS.find((t) => t.id === tierStr.toLowerCase());
    if (!match) return { ok: false, error: "invalid_tier" };
    tier = match.id;
  }

  let status: ReferralStatusFilter | null = null;
  const statusStr = asTrimmedString(raw.status);
  if (statusStr) {
    const lower = statusStr.toLowerCase();
    if (!REFERRAL_CLAIM_STATUSES.includes(lower as ReferralStatusFilter)) {
      return { ok: false, error: "invalid_status" };
    }
    status = lower as ReferralStatusFilter;
  }

  let recentLimit = REFERRAL_RECENT_CLAIMS_LIMIT;
  if (raw.limit != null && raw.limit !== "") {
    const n = typeof raw.limit === "number" ? raw.limit : Number(raw.limit);
    if (Number.isFinite(n) && n >= 1) {
      recentLimit = Math.min(REFERRAL_RECENT_CLAIMS_LIMIT, Math.trunc(n));
    }
  }

  return {
    ok: true,
    value: {
      filters: { from: fromIso, to: toIso, code, referrerUserId, tier, status },
      recentLimit,
    },
  };
}

/* ─── Pure builder ──────────────────────────────────────────────────────────── */

function intNonNeg(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

/**
 * Dense-rank ambassadors by lifetime claims desc (ties share a rank, the next
 * distinct value increments by exactly 1 — no gaps), tie-broken by referrer id
 * asc for determinism. Mirrors the consumer leaderboard's DENSE_RANK ordering.
 */
function rankAmbassadors(referrers: readonly ReferrerCountRow[]): AmbassadorDTO[] {
  const sorted = referrers
    .map((r) => ({
      referrerUserId: r.referrerUserId,
      referralCode: r.referralCode,
      claims: intNonNeg(r.claims),
    }))
    .sort(
      (a, b) =>
        b.claims - a.claims ||
        (a.referrerUserId < b.referrerUserId
          ? -1
          : a.referrerUserId > b.referrerUserId
            ? 1
            : 0),
    );

  let rank = 0;
  let prevClaims: number | null = null;
  return sorted.map((r) => {
    if (prevClaims === null || r.claims !== prevClaims) {
      rank += 1;
      prevClaims = r.claims;
    }
    const tier = tierFor(r.claims);
    return {
      rank,
      referrerUserId: r.referrerUserId,
      handle: handleForCode(r.referralCode),
      referralCode: r.referralCode,
      claims: r.claims,
      tierId: tier.id,
      tierLabel: tier.label,
    };
  });
}

/** Bucket every referrer into its tier, in ladder order (low → high). A tier
 *  nobody has reached reports a real 0 (never fabricated, never omitted). */
function tierDistribution(referrers: readonly ReferrerCountRow[]): TierBucketDTO[] {
  const counts = new Map<TierId, number>();
  for (const t of REFERRAL_TIERS) counts.set(t.id, 0);
  for (const r of referrers) {
    const tier = tierFor(intNonNeg(r.claims));
    counts.set(tier.id, (counts.get(tier.id) ?? 0) + 1);
  }
  return REFERRAL_TIERS.map((t) => ({
    tierId: t.id,
    label: t.label,
    ambassadors: counts.get(t.id) ?? 0,
  }));
}

function mapClaims(rows: readonly ReferralClaimRow[]): ReferralClaimDTO[] {
  return rows.map((c) => {
    const tier = tierFor(intNonNeg(c.referrerLifetimeClaims));
    return {
      id: Math.trunc(c.id),
      codeUsed: c.codeUsed,
      referrerUserId: c.referrerUserId,
      referrerHandle: handleForCode(c.referrerCode),
      referrerCode: c.referrerCode,
      referrerTierId: tier.id,
      referrerTierLabel: tier.label,
      refereeUserId: c.refereeUserId,
      claimedAt: c.claimedAt,
    };
  });
}

/**
 * Pure builder: real referral-ledger rows → founder attribution DTO.
 * `generatedAt` is injected so the result is deterministic and testable.
 */
export function buildReferralAttribution(
  input: ReferralAttributionInput,
  generatedAt: string,
  opts?: { topLimit?: number; recentLimit?: number },
): ReferralAttributionDTO {
  const topLimit = opts?.topLimit ?? REFERRAL_TOP_AMBASSADORS;
  const recentLimit = opts?.recentLimit ?? REFERRAL_RECENT_CLAIMS_LIMIT;

  const topAmbassadors = rankAmbassadors(input.referrers).slice(0, topLimit);
  const recentClaims = mapClaims(input.recentClaims).slice(0, recentLimit);

  return {
    generatedAt,
    topLimit,
    recentLimit,
    overview: {
      totalClaims: intNonNeg(input.totals.totalClaims),
      totalAmbassadors: input.referrers.length,
      totalReferredUsers: intNonNeg(input.totals.totalReferredUsers),
      claimsInRange: intNonNeg(input.claimsInRange),
    },
    topAmbassadors,
    tierDistribution: tierDistribution(input.referrers),
    recentClaims,
    filters: { ...input.filters },
  };
}
