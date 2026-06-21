/**
 * QR Activation — subscription revenue outcome (PURE).
 *
 * The activation funnel ends at the Day-7 subscription OFFER; the paid
 * outcome is the `subscription_started` milestone. To answer the owner's
 * "which acquisition source actually drives revenue?" question WITHOUT
 * breaking the pseudonymity lock, revenue is modelled as descriptive,
 * NON-PII metadata carried ON the `subscription_started` event itself
 * (emitted client-side, keyed only by the pseudonymous analytics id):
 * `{ planTier, amountCents, currency, billingInterval }`. There is no
 * Stripe id, customer id, email, or any field that could re-identify a
 * person — and the server NEVER joins the analytics id to users /
 * subscriptions / Stripe to obtain it.
 *
 * Like the rest of activation-core this module is the *underneath*: no
 * React, no react-native, no storage, no `Date.now()`. Every output is a
 * deterministic function of its input, so it is fully unit-testable and
 * shared by the mobile emitter and the server aggregator.
 *
 * Score-Protection: revenue is measured-after-the-fact metadata. It never
 * awards, mutates, or fabricates score; an absent/invalid revenue payload
 * simply contributes NOTHING (never a fabricated $0 subscriber).
 */

/** Billing cadence of the subscription that started. */
export type BillingInterval = 'month' | 'year';

export interface ActivationRevenue {
  /** Normalized, non-PII plan tier token (e.g. "pro", "elite") or null. */
  planTier: string | null;
  /** Subscription amount in MINOR units (cents), integer >= 0, or null. */
  amountCents: number | null;
  /** ISO-4217 currency code, upper-cased (e.g. "USD"), or null. */
  currency: string | null;
  /** Billing cadence, or null when unknown. */
  billingInterval: BillingInterval | null;
}

export const EMPTY_REVENUE: ActivationRevenue = {
  planTier: null,
  amountCents: null,
  currency: null,
  billingInterval: null,
};

/** Bucket key used for revenue with no resolved plan tier. */
export const UNSPECIFIED_PLAN = '(unspecified)';

/** Max accepted length for a plan-tier token; longer → dropped. */
const MAX_PLAN_LENGTH = 64;
/**
 * Upper sanity bound for a single subscription amount ($100k in cents). A
 * value beyond this is treated as malformed and dropped rather than
 * inflating an aggregate.
 */
const MAX_AMOUNT_CENTS = 100_000_00;

const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const CURRENCY_RE = /^[A-Za-z]{3}$/;

/** Canonical billing interval → accepted (lower-cased) aliases. */
const INTERVAL_ALIASES: Record<BillingInterval, readonly string[]> = {
  month: ['month', 'monthly', 'mo', 'm'],
  year: ['year', 'yearly', 'annual', 'annually', 'yr', 'y'],
};

function sanitizePlanTier(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v.length === 0 || v.length > MAX_PLAN_LENGTH) return null;
  return TOKEN_RE.test(v) ? v : null;
}

function sanitizeAmountCents(raw: unknown): number | null {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim().length > 0
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null; // cents are whole numbers
  if (n < 0 || n > MAX_AMOUNT_CENTS) return null;
  return n;
}

function sanitizeCurrency(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  return CURRENCY_RE.test(v) ? v.toUpperCase() : null;
}

function sanitizeInterval(raw: unknown): BillingInterval | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  for (const key of Object.keys(INTERVAL_ALIASES) as BillingInterval[]) {
    if (INTERVAL_ALIASES[key].includes(v)) return key;
  }
  return null;
}

/**
 * True only when this revenue carries enough to count toward an aggregate:
 * a valid amount AND a currency. plan tier / interval are optional context.
 * A subscriber whose event lacked amount+currency is honestly NOT counted
 * (no fabricated $0), though it still counts as `subscription_started` for
 * the conversion rate.
 */
export function hasRevenue(r: ActivationRevenue): boolean {
  return r.amountCents != null && r.currency != null;
}

/**
 * The canonical `subscription_started` revenue payload the mobile client
 * emits: only the fields that are present, with nulls dropped so the
 * payload stays compact. Descriptive metadata only — never PII, never a
 * Stripe/customer identifier, never score (Score-Protection).
 */
export function subscriptionEventPayload(
  r: ActivationRevenue,
): Record<string, string | number> {
  const payload: Record<string, string | number> = {};
  if (r.planTier != null) payload['planTier'] = r.planTier;
  if (r.amountCents != null) payload['amountCents'] = r.amountCents;
  if (r.currency != null) payload['currency'] = r.currency;
  if (r.billingInterval != null) payload['billingInterval'] = r.billingInterval;
  return payload;
}

/**
 * Rebuild revenue from a stored `subscription_started` payload (server
 * side). The inverse of `subscriptionEventPayload`. Every field is
 * RE-VALIDATED through the same sanitizers, so a tampered or malformed
 * stored payload can never inject an unsafe value (absurd amount, illegal
 * currency, etc.).
 */
export function revenueFromPayload(
  payload: Record<string, unknown>,
): ActivationRevenue {
  return {
    planTier: sanitizePlanTier(payload['planTier']),
    amountCents: sanitizeAmountCents(payload['amountCents']),
    currency: sanitizeCurrency(payload['currency']),
    billingInterval: sanitizeInterval(payload['billingInterval']),
  };
}

/** Aggregated revenue for one currency. */
export interface RevenueRollup {
  /** ISO-4217 currency code. */
  currency: string;
  /** Subscribers contributing revenue in this currency. */
  subscribers: number;
  /** Gross revenue in minor units (cents). */
  grossCents: number;
  /** Average revenue per subscriber (cents), rounded. */
  arpuCents: number;
}

/** One plan tier's share of subscribers. */
export interface PlanMixRow {
  planTier: string;
  subscribers: number;
}

export interface RevenueTotals {
  /** Subscribers with valid revenue (amount + currency present). */
  subscribers: number;
  /** Per-currency rollups (revenue is NEVER summed across currencies). */
  byCurrency: RevenueRollup[];
  /** Subscriber counts per plan tier (UNSPECIFIED_PLAN when none). */
  planMix: PlanMixRow[];
}

/**
 * Fold a list of revenue outcomes into per-currency + per-plan totals.
 * Defensive: any entry lacking amount+currency is ignored (never inflates
 * a total). Revenue is grouped by currency and NEVER summed across
 * currencies. Deterministic ordering: currencies by gross desc then code;
 * plans by subscribers desc then tier.
 */
export function combineRevenue(
  revenues: readonly ActivationRevenue[],
): RevenueTotals {
  const byCurrency = new Map<string, { subscribers: number; grossCents: number }>();
  const planMix = new Map<string, number>();
  let subscribers = 0;

  for (const r of revenues) {
    if (!hasRevenue(r)) continue;
    // hasRevenue guarantees both are non-null.
    const currency = r.currency as string;
    const amountCents = r.amountCents as number;
    subscribers += 1;

    const cur = byCurrency.get(currency) ?? { subscribers: 0, grossCents: 0 };
    cur.subscribers += 1;
    cur.grossCents += amountCents;
    byCurrency.set(currency, cur);

    const plan = r.planTier ?? UNSPECIFIED_PLAN;
    planMix.set(plan, (planMix.get(plan) ?? 0) + 1);
  }

  const currencyRows: RevenueRollup[] = [...byCurrency.entries()]
    .map(([currency, v]) => ({
      currency,
      subscribers: v.subscribers,
      grossCents: v.grossCents,
      arpuCents:
        v.subscribers > 0 ? Math.round(v.grossCents / v.subscribers) : 0,
    }))
    .sort(
      (a, b) =>
        b.grossCents - a.grossCents ||
        (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0),
    );

  const planRows: PlanMixRow[] = [...planMix.entries()]
    .map(([planTier, count]) => ({ planTier, subscribers: count }))
    .sort(
      (a, b) =>
        b.subscribers - a.subscribers ||
        (a.planTier < b.planTier ? -1 : a.planTier > b.planTier ? 1 : 0),
    );

  return { subscribers, byCurrency: currencyRows, planMix: planRows };
}
