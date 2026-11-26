import { af } from '@/theme/afTokens';
import React from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { API_BASE } from '@/lib/apiBase';
import { fetchTravelFlightStatus, TravelStatusError } from '@/services/travel/flightStatus';
import { travelStatusPresentation } from '@/utils/travel/statusPresentation';
import type { TravelJourney } from '@/services/travel/journey';
import type { TravelFlightResponse, TravelFlightRequest } from '@workspace/api-zod';

type Props = { journey: TravelJourney; flight?: never; completed?: never } | { journey?: never; flight: TravelFlightRequest; completed: boolean };

export function TravelFlightStatus({ journey, flight: confirmedFlight, completed, cached, onReport }: Props & {
  cached?: TravelFlightResponse;
  onReport?: (report: TravelFlightResponse) => Promise<unknown>;
}) {
  const { userId, getToken } = useAuth();
  const request = confirmedFlight ?? {
    flightNumber: journey!.details.flightNumber.replace(/\s/g, ''),
    departureDate: journey!.details.departureDate,
    origin: journey!.details.origin, destination: journey!.details.destination,
  };
  const finished = journey ? !!journey.completedAt : completed;
  const [now, setNow] = React.useState(Date.now);
  const mounted = React.useRef(false);
  const checking = React.useRef(false);
  // No polling or background request: every upstream lookup is an explicit tap.
  // The local clock and foreground event still age a cached result honestly.
  React.useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => { if (AppState.currentState === 'active') setNow(Date.now()); }, 30_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setNow(Date.now()); });
    return () => { mounted.current = false; clearInterval(timer); subscription.remove(); };
  }, []);
  useFocusEffect(React.useCallback(() => { setNow(Date.now()); }, []));
  const query = useQuery({
    queryKey: ['travel-flight-status-v1', userId, request],
    queryFn: async ({ signal }) => {
      if (!userId || finished) throw new TravelStatusError('unauthorized');
      // The timer bounds the mobile network request; account changes consume
      // the query AbortSignal so React Query also cancels the outgoing request.
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) controller.abort();
      const timeout = setTimeout(abort, 12_000);
      try { return await fetchTravelFlightStatus({ request, apiBase: API_BASE, getToken, signal: controller.signal }); }
      finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); if (mounted.current) setNow(Date.now()); }
    },
    enabled: false, retry: false,
  });
  const stored = cached?.availability !== 'unavailable' ? cached : undefined;
  const data = query.data ?? stored;
  const [cacheError, setCacheError] = React.useState(false);
  const view = travelStatusPresentation({
    data, failed: query.isError || (!query.data && !!stored),
    reason: query.error instanceof TravelStatusError ? query.error.reason : undefined, now,
  });
  const flight = view.showObservation ? data?.flight : undefined;
  const check = async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const result = await query.refetch();
      if (!result.isError && result.data && onReport) {
        try { await onReport(result.data); setCacheError(false); }
        catch { setCacheError(true); }
      }
    } finally { checking.current = false; }
  };
  return <View style={styles.panel} testID="travel-flight-status">
    <Text style={styles.label}>Flight status</Text>
    <Text accessibilityLiveRegion="polite" style={styles.title}>{query.isFetching ? 'Checking your flight…' : view.title}</Text>
    <Text style={styles.copy}>{view.evidence}</Text>
    {view.stale ? <Text style={styles.warning}>Stale information · check your airline before acting.</Text> : null}
    {cacheError ? <Text style={styles.warning}>This report could not be saved for offline viewing. Your itinerary is still saved.</Text> : null}
    {query.isError && data ? <Text style={styles.warning}>The latest check failed. The result above has not been refreshed.</Text> : null}
    {flight ? <>
      <Text style={styles.copy}>{view.stale ? 'Last reported gate' : 'Reported gate'}: {flight.departureGate ?? 'Not reported'} · Terminal: {flight.departureTerminal ?? 'Not reported'}</Text>
      {flight.estimatedDeparture ? <Text style={styles.copy}>Provider estimated departure: {flight.estimatedDeparture}</Text> : null}
    </> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: query.isFetching || finished }} disabled={query.isFetching || finished}
      onPress={() => { void check(); }} style={styles.button}>
      <Text style={styles.buttonText}>{query.isFetching ? 'Checking…' : data || query.isError ? 'Check again' : 'Check flight status'}</Text>
    </Pressable>
    <Text style={styles.copy}>{confirmedFlight ? 'Your confirmed itinerary stays unchanged.' : 'Your manually entered itinerary stays unchanged.'} Flight status is not a boarding guarantee; use your airline’s current instructions.</Text>
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderTopWidth: 1, borderColor: af.divider, paddingVertical: 22, marginTop: 22, gap: 14 },
  label: { color: af.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 19 },
  title: { color: af.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 27 },
  copy: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },
  warning: { color: af.amber, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 22 },
  button: { borderWidth: 1, borderColor: af.textTertiary, minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  buttonText: { color: af.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
});
