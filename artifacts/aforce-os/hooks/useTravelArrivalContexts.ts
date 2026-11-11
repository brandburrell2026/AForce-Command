/**
 * useTravelArrivalContexts — Travel 2.0 arrival context per trip.
 *
 * For each active trip whose final arrival is within the forecast horizon,
 * fetch destination weather (Open-Meteo, cached, no mock) and find the next
 * real commitment after landing. The result feeds the arrival Moment's plan.
 *
 * Inert unless `enabled` (the travel pilot gate): no network when off. Trips
 * whose destination is not a featured city get no weather — their plan uses
 * the standard steps with no weather factors.
 */
import { useQueries } from '@tanstack/react-query';
import React from 'react';
import type { TravelTrip } from '@workspace/api-zod';

import { TRAVEL_FORECAST_HORIZON_DAYS, TRAVEL_WEATHER_CACHE_MS } from '@/config/hydroStateModel';
import { nextCommitmentAfter, type ArrivalContext } from '@/services/travel/arrival';
import { getDestinationWeather } from '@/services/travel/destinationWeather';
import type { ArrivalContexts } from '@/services/travel/intelligence';
import type { Moment } from '@/types/moments';
import { placeForAirport } from '@/utils/travel/cityRegistry';

const DAY = 86_400_000;
const HOUR_MS = 3_600_000;

export function useTravelArrivalContexts(
  enabled: boolean,
  trips: readonly TravelTrip[],
  moments: readonly Moment[],
): ArrivalContexts {
  const targets = React.useMemo(() => {
    if (!enabled) return [];
    const now = Date.now();
    return trips.flatMap((trip) => {
      if (trip.completedAt) return [];
      const last = trip.legs[trip.legs.length - 1];
      const arrivalMs = Date.parse(last?.arrivalAt ?? '');
      if (!last || !Number.isFinite(arrivalMs)) return [];
      if (arrivalMs > now + TRAVEL_FORECAST_HORIZON_DAYS * DAY || arrivalMs < now - DAY) return [];
      const place = placeForAirport(last.flight.destination, last.destinationTimeZone);
      if (place.latitude == null) return [];
      // Hour-rounded so the query key is stable across renders.
      const atHour = Math.round(arrivalMs / HOUR_MS) * HOUR_MS;
      return [{ tripId: trip.id, place, arrivalMs, atHour }];
    });
  }, [enabled, trips]);

  const results = useQueries({
    queries: targets.map((t) => ({
      queryKey: ['travel-destination-weather', t.place.cityId, t.atHour],
      queryFn: ({ signal }: { signal: AbortSignal }) => getDestinationWeather(t.place, t.arrivalMs, { signal }),
      staleTime: TRAVEL_WEATHER_CACHE_MS,
      retry: false,
    })),
  });

  return React.useMemo(() => {
    if (!enabled) return {};
    const out: Record<string, ArrivalContext> = {};
    for (const trip of trips) {
      if (trip.completedAt) continue;
      const last = trip.legs[trip.legs.length - 1];
      const arrivalMs = Date.parse(last?.arrivalAt ?? '');
      if (!Number.isFinite(arrivalMs)) continue;
      const i = targets.findIndex((t) => t.tripId === trip.id);
      const weather = i >= 0 ? results[i]?.data : undefined;
      out[trip.id] = {
        conditions: weather?.conditions ?? { heat: null, humidity: null, uv: null },
        nextCommitmentMs: nextCommitmentAfter(moments, arrivalMs),
      };
    }
    return out;
    // `results` is a new array every render; depend on a stable data stamp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, trips, moments, targets, results.map((r) => r.dataUpdatedAt).join(',')]);
}
