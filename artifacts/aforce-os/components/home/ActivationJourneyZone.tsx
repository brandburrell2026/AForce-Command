/**
 * ActivationJourneyZone — the single feature-flag seam for the consumer
 * Activation Journey card on Home.
 *
 * Responsibilities (and only these):
 *   • Feature-flag gate — renders nothing unless `spec_activation` is on, so
 *     the card is purely additive / hideable (no new tab or route).
 *   • Wiring — `useActivationJourney()` (read-only milestones + Day-7 offer)
 *     and routing the offer CTA to the subscription plans.
 *
 * All rendering lives in the pure ActivationJourneyCard. Score-Protection:
 * this surface never awards or mutates score.
 */
import React from 'react';
import { useRouter } from 'expo-router';

import { useFlagsSlice, useEngineSlice } from '@/store/slices';
import { useActivationJourney } from '@/hooks/useActivationJourney';
import { useDisplayedAccent } from '@/hooks/useDisplayedAccent';
import { accentForScore } from '@/utils/scoreBand';

import { ActivationJourneyCard } from './ActivationJourneyCard';

function ActivationJourneyZoneInner() {
  const router = useRouter();
  const vm = useActivationJourney();
  // Track the live hydration/readiness band exactly like the orb: prefer the
  // tweened displayed accent (so the card recolours in lock-step with the orb
  // digit), and fall back to the engine's instantaneous accent when this card
  // renders outside a DisplayedAccentProvider. Display-only — never moves score.
  const engine = useEngineSlice();
  const displayed = useDisplayedAccent();
  const accent = displayed ?? accentForScore(engine.score);
  return (
    <ActivationJourneyCard
      {...vm}
      accentPrimary={accent.primary}
      accentGlow={accent.glow}
      onSeePlans={() => router.push({ pathname: '/subscription' })}
    />
  );
}

export function ActivationJourneyZone() {
  const flags = useFlagsSlice();
  if (!flags.spec_activation) return null;
  return <ActivationJourneyZoneInner />;
}
