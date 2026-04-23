/**
 * useEntitlement — pulls the server-authoritative plan id for the
 * signed-in user from `/api/entitlement` and reflects it onto the
 * client-side subscription store.
 *
 * The server (Stripe webhook) is the source of truth for `planId` /
 * `subscriptionStatus`; the client cache in AsyncStorage is kept around
 * for instant UI on cold-start but gets overwritten as soon as this
 * hook lands a response.
 *
 * Fetching is deferred until Clerk reports `isSignedIn === true` so we
 * don't waste a round-trip on the public auth screens. Refetch on
 * focus + every 60s keeps a recently-upgraded plan reflected in the
 * UI without forcing the user to restart the app.
 */

import React from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@clerk/expo';

import { useAppStore } from '@/store/useAppStore';
import { getAuthHeaders } from '@/services/authToken';
import type { SubscriptionPlanId, SubscriptionStatus, UserSubscription } from '@/types/subscription';
import { PLAN_BY_ID, getEffectiveFeatures } from '@/data/subscriptionPlans';

interface EntitlementResponse {
  planId: string;
  status: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

function resolveBase(): string {
  const explicit = process.env['EXPO_PUBLIC_API_BASE'];
  if (explicit) return explicit.replace(/\/$/, '');
  const domain = process.env['EXPO_PUBLIC_DOMAIN'];
  if (domain) return `https://${domain}/api`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return '/api';
}

const ENTITLEMENT_URL = `${resolveBase()}/entitlement`;
const REFETCH_INTERVAL_MS = 60_000;

const VALID_STATUSES: readonly SubscriptionStatus[] = [
  'active', 'trialing', 'past_due', 'canceled', 'paused',
];

function buildSubscription(
  current: UserSubscription,
  data: EntitlementResponse,
): UserSubscription {
  // Validate the planId against the local catalog. Stripe webhook can
  // theoretically write any string; a defensive whitelist keeps the
  // gate logic from being fed garbage.
  const planId = (PLAN_BY_ID[data.planId as SubscriptionPlanId]
    ? (data.planId as SubscriptionPlanId)
    : 'core') as SubscriptionPlanId;
  // Map server-side `none` / `incomplete` / `inactive` (no live Stripe
  // sub) to client-side `canceled` so paywalls trigger correctly
  // instead of optimistically rendering the unlocked UI. The local
  // SubscriptionStatus enum doesn't carry a separate "never had one"
  // value — `canceled` is the closest gate-blocking state.
  const status: SubscriptionStatus = VALID_STATUSES.includes(
    data.status as SubscriptionStatus,
  )
    ? (data.status as SubscriptionStatus)
    : 'canceled';
  return {
    ...current,
    planId,
    status,
    unlockedFlags: getEffectiveFeatures(planId).map((f) => f.id),
    // Always reflect the server's renewal date — including a clear on
     // downgrade/cancel — instead of preserving a stale value.
    billing: (() => {
      const { nextRenewalAt: _drop, ...restBilling } = current.billing;
      return data.currentPeriodEnd
        ? { ...restBilling, nextRenewalAt: data.currentPeriodEnd }
        : restBilling;
    })(),
  };
}

export function useEntitlement(): void {
  // Safe: this hook is only ever rendered inside <ClerkProvider> via
  // ClerkAuthBridge in app/_layout.tsx.
  const auth = useAuth();
  const { state, setSubscription } = useAppStore();
  const isSignedIn = auth?.isSignedIn ?? false;
  const subscriptionRef = React.useRef(state.subscription);
  React.useEffect(() => { subscriptionRef.current = state.subscription; }, [state.subscription]);

  // Monotonic request id guards against out-of-order responses: a
  // foreground wake can race a 60s interval tick and the older one
  // would otherwise overwrite the newer one.
  const requestIdRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    if (!isSignedIn) return;
    const myId = ++requestIdRef.current;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(ENTITLEMENT_URL, { headers });
      if (!res.ok) return;
      const data = (await res.json()) as EntitlementResponse;
      // Drop stale responses — a newer request finished first.
      if (myId !== requestIdRef.current) return;
      const next = buildSubscription(subscriptionRef.current, data);
      // Avoid a needless dispatch if nothing actually changed. Compare
      // currentPeriodEnd too so renewal-date refreshes propagate.
      const prevPeriodEnd = subscriptionRef.current.billing?.nextRenewalAt ?? null;
      const nextPeriodEnd = (next.billing?.nextRenewalAt as string | undefined) ?? null;
      if (
        next.planId === subscriptionRef.current.planId &&
        next.status === subscriptionRef.current.status &&
        prevPeriodEnd === nextPeriodEnd
      ) return;
      setSubscription(next);
    } catch {
      // Network errors are silent — the cached subscription remains.
    }
  }, [isSignedIn, setSubscription]);

  // Initial fetch + interval poll while the app is foregrounded.
  React.useEffect(() => {
    if (!isSignedIn) return;
    refresh();
    const id = setInterval(refresh, REFETCH_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [isSignedIn, refresh]);
}
