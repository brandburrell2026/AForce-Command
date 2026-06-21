import { describe, it, expect } from 'vitest';

import {
  EMPTY_REVENUE,
  UNSPECIFIED_PLAN,
  combineRevenue,
  hasRevenue,
  revenueFromPayload,
  subscriptionEventPayload,
  type ActivationRevenue,
} from '../revenue';
import {
  aggregateRevenue,
  activationRevenueOf,
  deriveActivationFunnel,
  revenueBySegment,
  type ActivationFunnelState,
  type MilestoneTimestamps,
} from '../funnel';
import { parseActivationLink } from '../attribution';

const T = (h: number) => new Date(Date.UTC(2026, 0, 1, h)).toISOString();

const rev = (r: Partial<ActivationRevenue>): ActivationRevenue => ({
  ...EMPTY_REVENUE,
  ...r,
});

describe('revenueFromPayload (server inverse, re-validated)', () => {
  it('parses a well-formed payload', () => {
    expect(
      revenueFromPayload({
        planTier: 'Pro',
        amountCents: 1299,
        currency: 'usd',
        billingInterval: 'monthly',
      }),
    ).toEqual({
      planTier: 'pro',
      amountCents: 1299,
      currency: 'USD',
      billingInterval: 'month',
    });
  });

  it('coerces a numeric-string amount and maps interval aliases', () => {
    expect(revenueFromPayload({ amountCents: '4990', billingInterval: 'yr' })).toEqual({
      planTier: null,
      amountCents: 4990,
      currency: null,
      billingInterval: 'year',
    });
  });

  it('drops malformed / unsafe values rather than throwing', () => {
    expect(
      revenueFromPayload({
        planTier: 'has space', // illegal token
        amountCents: 12.5, // non-integer cents
        currency: 'dollars', // not ISO-3
        billingInterval: 'fortnight', // unknown
      }),
    ).toEqual(EMPTY_REVENUE);
  });

  it('drops negative and absurdly large amounts', () => {
    expect(revenueFromPayload({ amountCents: -100 }).amountCents).toBeNull();
    expect(revenueFromPayload({ amountCents: 99_999_999_99 }).amountCents).toBeNull();
  });

  it('ignores non-string / non-numeric junk', () => {
    expect(
      revenueFromPayload({ planTier: 42, currency: {}, amountCents: null }),
    ).toEqual(EMPTY_REVENUE);
  });
});

describe('subscriptionEventPayload (client emit, nulls dropped)', () => {
  it('round-trips through revenueFromPayload', () => {
    const r = rev({
      planTier: 'elite',
      amountCents: 9999,
      currency: 'EUR',
      billingInterval: 'year',
    });
    expect(revenueFromPayload(subscriptionEventPayload(r))).toEqual(r);
  });

  it('omits null fields entirely', () => {
    expect(subscriptionEventPayload(rev({ amountCents: 500, currency: 'USD' }))).toEqual({
      amountCents: 500,
      currency: 'USD',
    });
  });

  it('carries no PII / Stripe-id keys', () => {
    const payload = subscriptionEventPayload(
      rev({ planTier: 'pro', amountCents: 1299, currency: 'USD', billingInterval: 'month' }),
    );
    const keys = Object.keys(payload);
    expect(keys.sort()).toEqual(
      ['amountCents', 'billingInterval', 'currency', 'planTier'].sort(),
    );
  });
});

describe('hasRevenue', () => {
  it('requires both amount and currency', () => {
    expect(hasRevenue(rev({ amountCents: 100, currency: 'USD' }))).toBe(true);
    expect(hasRevenue(rev({ amountCents: 100 }))).toBe(false);
    expect(hasRevenue(rev({ currency: 'USD' }))).toBe(false);
    expect(hasRevenue(EMPTY_REVENUE)).toBe(false);
  });

  it('counts a valid $0 (e.g. converted trial) as revenue', () => {
    expect(hasRevenue(rev({ amountCents: 0, currency: 'USD' }))).toBe(true);
  });
});

describe('combineRevenue', () => {
  it('returns empty totals for no revenue (never fabricates)', () => {
    expect(combineRevenue([])).toEqual({ subscribers: 0, byCurrency: [], planMix: [] });
  });

  it('sums gross + computes ARPU per currency', () => {
    const totals = combineRevenue([
      rev({ planTier: 'pro', amountCents: 1000, currency: 'USD' }),
      rev({ planTier: 'pro', amountCents: 2000, currency: 'USD' }),
    ]);
    expect(totals.subscribers).toBe(2);
    expect(totals.byCurrency).toEqual([
      { currency: 'USD', subscribers: 2, grossCents: 3000, arpuCents: 1500 },
    ]);
  });

  it('NEVER sums across currencies', () => {
    const totals = combineRevenue([
      rev({ amountCents: 1000, currency: 'USD' }),
      rev({ amountCents: 5000, currency: 'EUR' }),
      rev({ amountCents: 500, currency: 'USD' }),
    ]);
    // sorted by gross desc → EUR (5000) before USD (1500)
    expect(totals.byCurrency).toEqual([
      { currency: 'EUR', subscribers: 1, grossCents: 5000, arpuCents: 5000 },
      { currency: 'USD', subscribers: 2, grossCents: 1500, arpuCents: 750 },
    ]);
  });

  it('buckets unspecified plan tiers and sorts plan mix by subscribers desc', () => {
    const totals = combineRevenue([
      rev({ planTier: 'pro', amountCents: 100, currency: 'USD' }),
      rev({ planTier: 'pro', amountCents: 100, currency: 'USD' }),
      rev({ amountCents: 100, currency: 'USD' }),
    ]);
    expect(totals.planMix).toEqual([
      { planTier: 'pro', subscribers: 2 },
      { planTier: UNSPECIFIED_PLAN, subscribers: 1 },
    ]);
  });

  it('ignores entries lacking amount+currency', () => {
    const totals = combineRevenue([
      rev({ amountCents: 100, currency: 'USD' }),
      rev({ amountCents: 100 }), // no currency → ignored
      rev({ currency: 'USD' }), // no amount → ignored
    ]);
    expect(totals.subscribers).toBe(1);
  });

  it('rounds ARPU to whole cents', () => {
    const totals = combineRevenue([
      rev({ amountCents: 100, currency: 'USD' }),
      rev({ amountCents: 100, currency: 'USD' }),
      rev({ amountCents: 101, currency: 'USD' }),
    ]);
    expect(totals.byCurrency[0]?.arpuCents).toBe(100); // 301/3 = 100.33 → 100
  });
});

function funnel(
  milestones: MilestoneTimestamps,
  opts?: { link?: string; revenue?: ActivationRevenue },
): ActivationFunnelState {
  return deriveActivationFunnel({
    milestones,
    attribution: opts?.link ? parseActivationLink(opts.link) : undefined,
    revenue: opts?.revenue,
  });
}

describe('deriveActivationFunnel carries revenue', () => {
  it('defaults to EMPTY_REVENUE when none supplied', () => {
    expect(funnel({ qr_scanned: T(1) }).revenue).toEqual(EMPTY_REVENUE);
  });

  it('carries supplied revenue verbatim', () => {
    const r = rev({ planTier: 'pro', amountCents: 1299, currency: 'USD' });
    expect(funnel({ subscription_started: T(5) }, { revenue: r }).revenue).toEqual(r);
  });
});

describe('activationRevenueOf (gating)', () => {
  it('returns null unless subscription_started was actually reached', () => {
    const r = rev({ amountCents: 1299, currency: 'USD' });
    // revenue present but no subscription_started milestone → not counted
    expect(activationRevenueOf(funnel({ qr_scanned: T(1) }, { revenue: r }))).toBeNull();
  });

  it('returns null when subscription_started reached but revenue invalid', () => {
    expect(
      activationRevenueOf(funnel({ subscription_started: T(5) }, { revenue: rev({ amountCents: 1299 }) })),
    ).toBeNull();
  });

  it('returns the revenue when reached + valid', () => {
    const r = rev({ amountCents: 1299, currency: 'USD' });
    expect(activationRevenueOf(funnel({ subscription_started: T(5) }, { revenue: r }))).toEqual(r);
  });
});

describe('aggregateRevenue + revenueBySegment', () => {
  const sub = (link: string, amountCents: number, currency = 'USD', planTier = 'pro') =>
    funnel(
      { qr_scanned: T(1), subscription_started: T(5) },
      { link, revenue: rev({ amountCents, currency, planTier }) },
    );

  it('aggregates only genuinely-subscribed funnels with valid revenue', () => {
    const totals = aggregateRevenue([
      sub('aforce-os://activate?sku=alpha', 1000),
      sub('aforce-os://activate?sku=alpha', 2000),
      // subscribed but no revenue metadata → not counted in revenue
      funnel({ subscription_started: T(5) }),
      // revenue metadata but never subscribed → not counted
      funnel({ qr_scanned: T(1) }, { revenue: rev({ amountCents: 9999, currency: 'USD' }) }),
    ]);
    expect(totals.subscribers).toBe(2);
    expect(totals.byCurrency[0]?.grossCents).toBe(3000);
  });

  it('attributes revenue to the right SKU segment', () => {
    const segments = revenueBySegment(
      [
        sub('aforce-os://activate?sku=alpha', 1000),
        sub('aforce-os://activate?sku=alpha', 2000),
        sub('aforce-os://activate?sku=beta', 500),
      ],
      'sku',
    );
    const byKey = Object.fromEntries(segments.map((s) => [s.segment, s]));
    expect(byKey['alpha']?.totals.byCurrency[0]?.grossCents).toBe(3000);
    expect(byKey['alpha']?.cohort).toBe(2);
    expect(byKey['beta']?.totals.byCurrency[0]?.grossCents).toBe(500);
  });

  it('a segment cohort with no subscribers reports zero, never a fabricated amount', () => {
    const segments = revenueBySegment(
      [
        // scanned alpha, never subscribed
        funnel({ qr_scanned: T(1) }, { link: 'aforce-os://activate?sku=alpha' }),
      ],
      'sku',
    );
    expect(segments[0]?.cohort).toBe(1);
    expect(segments[0]?.totals).toEqual({ subscribers: 0, byCurrency: [], planMix: [] });
  });
});
