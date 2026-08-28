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
import { API_BASE } from '@/lib/apiBase';
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

// Wave-3 PR1: canonical resolver (lib/apiBase) — was one of five copies.
const ENTITLEMENT_URL = `${API_BASE}/entitlement`;
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

// Module-level handle so non-hook callers (e.g. the Recovery+ paywall
// after a Stripe Checkout browser session closes) can request an
// immediate entitlement refresh without waiting for the next 60s tick.
//
// RESTORE-ERROR TRUTHFULNESS (founder-authorized): this used to resolve
// void unconditionally — a failed fetch, a rejected response, and even
// "no hook mounted at all" were indistinguishable from success, so the
// Restore Purchases control's error branch was DEAD CODE and an offline
// member was told "Plan re-synced from your account" when nothing was
// fetched. The promise now reports the outcome: `true` only when the
// server's entitlement was actually fetched and applied/confirmed
// current by this call; `false` when nothing was re-synced (signed out,
// HTTP failure, network failure, or no mounted hook to refresh through).
// Background callers (interval / foreground / initial) ignore the value.
let activeRefresh: (() => Promise<boolean>) | null = null;
export function refreshEntitlement(): Promise<boolean> {
  // No mounted hook = nothing was re-synced. Never report success here.
  return activeRefresh ? activeRefresh() : Promise.resolve(false);
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

  // Returns whether this call actually re-synced against the server:
  // `true` = the entitlement was fetched and applied (or confirmed
  // already-current, or superseded by a newer request that landed
  // first — the state is fresh either way); `false` = nothing was
  // fetched (signed out / HTTP failure / network failure). Background
  // callers ignore the value; the Restore Purchases control must not.
  const refresh = React.useCallback(async (): Promise<boolean> => {
    if (!isSignedIn) return false;
    const myId = ++requestIdRef.current;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(ENTITLEMENT_URL, { headers });
      if (!res.ok) return false;
      const data = (await res.json()) as EntitlementResponse;
      // Drop stale responses — a newer request finished first, so the
      // store already reflects fresher server truth than this response.
      if (myId !== requestIdRef.current) return true;
      const next = buildSubscription(subscriptionRef.current, data);
      // Avoid a needless dispatch if nothing actually changed. Compare
      // currentPeriodEnd too so renewal-date refreshes propagate.
      const prevPeriodEnd = subscriptionRef.current.billing?.nextRenewalAt ?? null;
      const nextPeriodEnd = (next.billing?.nextRenewalAt as string | undefined) ?? null;
      if (
        next.planId === subscriptionRef.current.planId &&
        next.status === subscriptionRef.current.status &&
        prevPeriodEnd === nextPeriodEnd
      ) return true; // fetched and confirmed current — a successful re-sync
      setSubscription(next);
      return true;
    } catch {
      // Network errors stay silent for background refreshes — the cached
      // subscription remains — but the outcome is reported truthfully.
      return false;
    }
  }, [isSignedIn, setSubscription]);

  // Publish the latest `refresh` to module scope so external callers
  // (RecoveryModePaywall, profile.tsx) can trigger an immediate refetch.
  React.useEffect(() => {
    activeRefresh = refresh;
    return () => {
      if (activeRefresh === refresh) activeRefresh = null;
    };
  }, [refresh]);

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
