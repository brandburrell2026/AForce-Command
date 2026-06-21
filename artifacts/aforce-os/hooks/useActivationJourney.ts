/**
 * useActivationJourney — the single store/storage seam for the consumer
 * Activation Journey card on Home.
 *
 * It reads two on-device milestones (onboarding complete + first command
 * followed) and derives the pure Day-7 subscription-offer state from the
 * activation anchor. The "now" instant is ticked locally so the countdown
 * stays live; the pure math lives in @workspace/activation-core.
 *
 * Score-Protection: this is a read-only projection. It never awards,
 * mutates, or fabricates score. The only side effect is emitting
 * `day7_subscription_offer` exactly once, the first time the offer is shown.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

import {
  countdownParts,
  deriveDay7Offer,
  type CountdownParts,
  type Day7OfferState,
} from '@workspace/activation-core';

import { getFirstCommandAt, recordDay7OfferShown } from '@/analytics/activation_anchor';

const ONBOARDING_DONE_KEY = 'aforce.hasCompletedOnboarding';
/** Re-derive the countdown about once a minute — days/hours precision. */
const TICK_MS = 60 * 1000;

export interface ActivationJourneyVM {
  /** True once the user has followed their first command (the anchor). */
  anchored: boolean;
  /** True once onboarding is complete. */
  onboarded: boolean;
  /** Day-7 offer state (display-only). */
  offer: Day7OfferState;
  /** Pre-split countdown parts for the active phase (open → close, else → open). */
  countdown: CountdownParts;
}

export function useActivationJourney(): ActivationJourneyVM {
  const [firstCommandAt, setFirstCommandAt] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());

  const refresh = useCallback(() => {
    let cancelled = false;
    void getFirstCommandAt().then((v) => {
      if (!cancelled) setFirstCommandAt(v);
    });
    AsyncStorage.getItem(ONBOARDING_DONE_KEY)
      .then((v) => {
        if (!cancelled) setOnboarded(v === 'true');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-read the persisted markers whenever Home regains focus.
  useFocusEffect(refresh);

  // Tick the clock + re-read the anchor so a first command followed while
  // the user is sitting on Home flips the milestone within a minute.
  useEffect(() => {
    const id = setInterval(() => {
      setNowIso(new Date().toISOString());
      void getFirstCommandAt().then(setFirstCommandAt);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const offer = deriveDay7Offer(firstCommandAt, nowIso);
  const countdown = countdownParts(
    offer.phase === 'open' ? offer.msUntilClose : offer.msUntilOpen,
  );

  // Emit `day7_subscription_offer` the first time the offer is shown (open).
  // recordDay7OfferShown is deduped + consent-gated, so this is safe to run
  // on every transition into the open phase.
  useEffect(() => {
    if (offer.phase === 'open') void recordDay7OfferShown();
  }, [offer.phase]);

  return { anchored: firstCommandAt != null, onboarded, offer, countdown };
}
