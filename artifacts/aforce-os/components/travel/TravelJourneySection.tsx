/**
 * Travel Intelligence 2.0 — journey section (T3 container).
 *
 * Wires the existing device-local travel document, the T1 engine, T2
 * destination weather and the member's confirmations into TravelJourneyView.
 * Renders nothing when no trip is surfaced. Ticks once a minute so states
 * advance without a reload; adds no notifications.
 */
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';

import { TRAVEL_WEATHER_CACHE_MS } from '@/config/hydroStateModel';
import type { useTravelIntelligence } from '@/hooks/useTravelIntelligence';
import { confirmArrival, confirmationsFor, legSnapshots, markReady, undoArrival } from '@/services/travel/arrival';
import { getDestinationWeather } from '@/services/travel/destinationWeather';
import { placeForAirport } from '@/utils/travel/cityRegistry';
import { arrivalSharePayload } from '@/utils/travel/arrivalShare';
import { focusTrip, journeyView } from '@/utils/travel/journeyPresentation';
import { ArrivalShareSheet } from './ArrivalShareCard';
import { TravelJourneyView } from './TravelJourneyView';

type Travel = ReturnType<typeof useTravelIntelligence>;

function useMinuteTick(): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function TravelJourneySection({
  travel,
  busy,
  run,
}: {
  travel: Travel;
  busy: boolean;
  run: (task: () => Promise<unknown>, success: string) => void;
}) {
  const router = useRouter();
  const now = useMinuteTick();
  const [shareOpen, setShareOpen] = React.useState(false);
  const doc = travel.query.data;

  const input = React.useMemo(() => {
    if (!doc) return null;
    return {
      trips: doc.trips,
      snapshots: legSnapshots(doc),
      confirmations: (tripId: string) => confirmationsFor(doc, tripId),
      nowMs: now,
    };
  }, [doc, now]);

  const focus = input ? focusTrip(input) : null;
  const last = focus?.trip.legs[focus.trip.legs.length - 1];
  const place = last ? placeForAirport(last.flight.destination, last.destinationTimeZone) : null;
  // Forecast at the planned arrival before landing; current conditions after.
  const weatherAt =
    focus && focus.state.state === 'preparing' && last?.arrivalAt ? Date.parse(last.arrivalAt) : now;
  const atHour = Math.round(weatherAt / 3_600_000);

  const weather = useQuery({
    queryKey: ['travel-destination-weather', place?.cityId ?? null, atHour * 3_600_000],
    queryFn: ({ signal }) => getDestinationWeather(place!, weatherAt, { signal }),
    enabled: !!place && place.latitude != null && focus?.state.state !== 'in_transit',
    staleTime: TRAVEL_WEATHER_CACHE_MS,
    retry: false,
  });

  if (!input || !focus) return null;
  const view = journeyView({ ...input, weather: weather.data ?? null });
  if (!view) return null;

  const tripId = view.tripId;
  // Identity, not data: only the city name and atmosphere reach the card.
  const sharePayload =
    view.kind === 'arrival' || view.kind === 'ready'
      ? arrivalSharePayload({ cityName: view.cityName, atmosphere: view.atmosphere })
      : null;

  return (
    <>
    <TravelJourneyView
      view={view}
      actions={{
        busy,
        onConfirmArrival: () =>
          run(
            () => travel.write(confirmArrival(travel.current(), tripId, new Date().toISOString())),
            'Arrival confirmed.',
          ),
        onUndoArrival: () => run(() => travel.write(undoArrival(travel.current(), tripId)), 'Arrival cleared.'),
        onReady: () =>
          run(() => travel.write(markReady(travel.current(), tripId, new Date().toISOString())), 'Marked ready.'),
        // Same route the Moments list uses; the seal flow lives there.
        onOpenPlan: (momentId) => router.push(`/moment/${momentId}` as never),
        onShare: sharePayload ? () => setShareOpen(true) : undefined,
      }}
    />
    {sharePayload ? (
      <ArrivalShareSheet payload={sharePayload} visible={shareOpen} onClose={() => setShareOpen(false)} />
    ) : null}
    </>
  );
}
