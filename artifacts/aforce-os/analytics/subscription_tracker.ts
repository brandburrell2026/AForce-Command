/**
 * Subscription tracker — the client edge that records a PAID conversion
 * as the `subscription_started` analytics event.
 *
 * Ownership flip (Phase 3): `subscription_started` used to be emitted by
 * the Stripe webhook ({ planId } only). The marketing/attribution route
 * reads the FIRST `subscription_started` payload per pseudonymous identity
 * by `occurred_at`, so a payload-less server emit racing a revenue-bearing
 * client emit could win the slot and lose the revenue. The client is now
 * the SOLE emitter: it stamps descriptive non-PII revenue metadata
 * ({ planTier, amountCents, currency, billingInterval }) sourced from the
 * local plan catalog. Reliability tradeoff: the event only fires once the
 * app regains control after checkout (it does, via openAuthSessionAsync) —
 * an app killed mid-browser misses it, acceptable for INTERNAL analytics.
 *
 * Privacy / Score-Protection: consent-gated (emit() no-ops pre-consent);
 * carries no Stripe id, customer id, email, or any re-identifying field;
 * never awards, mutates, or fabricates score.
 */
import { scopedStorage } from '@/services/scopedStorage';

import {
  subscriptionEventPayload,
  type ActivationRevenue,
} from '@workspace/activation-core';

import { SUBSCRIPTION_PLANS } from '../data/subscriptionPlans';
import type { SubscriptionPlanId } from '../types/subscription';

import { emit } from './event_dispatcher';
import { isConsentGranted } from './privacy_manager';

const EMITTED_KEY = '@aforce/subscription-emitted';
/** Bound the dedupe list so it can't grow without limit. */
const MAX_EMITTED = 50;

async function readList(key: string): Promise<string[]> {
  try {
    const raw = await scopedStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, list: string[]): Promise<void> {
  try {
    await scopedStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* non-fatal — best-effort dedupe */
  }
}

/**
 * Descriptive, non-PII revenue for a plan, sourced from the local plan
 * catalog. Every self-serve consumer plan's Stripe checkout is created as
 * USD / monthly (see api-server checkout.ts), so currency and interval are
 * fixed; the amount is the plan's list price in cents. This is attribution
 * metadata, not a billing record — an unknown / non-positive price yields a
 * null amount (and null currency/interval) so the subscriber is honestly
 * NOT counted toward revenue rather than fabricated as $0.
 */
export function revenueForPlan(planId: SubscriptionPlanId): ActivationRevenue {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
  const price = plan?.priceMonthly;
  const amountCents =
    typeof price === 'number' && Number.isFinite(price) && price > 0
      ? Math.round(price * 100)
      : null;
  return {
    planTier: planId,
    amountCents,
    currency: amountCents != null ? 'USD' : null,
    billingInterval: amountCents != null ? 'month' : null,
  };
}

/**
 * Record a confirmed paid subscription exactly once per checkout session.
 * Deduped on `dedupeKey` (the Stripe checkout session id) so a re-mount,
 * retry, or relaunch never double-emits. Consent-gated: when consent is
 * absent the dedupe key is NOT burned, so the event can still fire if the
 * user later grants consent and reaches a fresh checkout. Best-effort and
 * fire-and-forget — callers should not await the network.
 */
export async function recordSubscriptionStarted(
  dedupeKey: string,
  revenue: ActivationRevenue,
): Promise<void> {
  if (!dedupeKey) return;
  // emit() no-ops without consent; skip recording so we don't burn the key.
  if (!(await isConsentGranted())) return;

  const emitted = await readList(EMITTED_KEY);
  if (emitted.includes(dedupeKey)) return;

  await emit('subscription_started', subscriptionEventPayload(revenue));

  emitted.push(dedupeKey);
  await writeList(EMITTED_KEY, emitted.slice(-MAX_EMITTED));
}
