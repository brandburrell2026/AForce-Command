import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { useFeatureFlags } from '@/store/useAppStore';
import { travelPilotAvailable } from '@/featureFlags/flags';
import { useTravelJourney } from '@/hooks/useTravelJourney';

export function TravelHomeCard() {
  const flags = useFeatureFlags();
  const { userId, isSignedIn } = useAuth();
  if (flags.moments_enabled || !travelPilotAvailable(flags) || !isSignedIn || !userId) return null;
  return <AccountTravelHomeCard key={userId} />;
}

function AccountTravelHomeCard() {
  const { query } = useTravelJourney();
  const router = useRouter();
  if (query.isPending) return null;
  const journey = query.data;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={query.isError ? 'Open Travel to retry loading your journey' : 'Open your travel journey'}
      testID="travel-home-card" onPress={() => router.push('/travel' as never)} style={styles.card}>
      <Text style={styles.eyebrow}>TRAVEL · POWERED BY TRAVELGATE</Text>
      <Text style={styles.title}>{query.isError ? 'Your journey needs a retry' : journey ? `${journey.details.origin} → ${journey.details.destination}` : 'Arrive ready.'}</Text>
      <Text style={styles.body}>{query.isError ? 'We couldn’t read your saved journey. Open Travel to try again.' : journey
        ? `${journey.details.flightNumber} · ${journey.details.departureDate} · ${journey.details.departureTime} (UTC${journey.details.utcOffset})`
        : 'Add a flight and keep your AForce rituals close.'}</Text>
      <Text style={styles.body}>{journey?.completedAt ? 'Journey finished · open to add another flight' : journey ? 'Manually entered itinerary · open to check status' : 'Plan your journey →'}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#44413B', paddingVertical: 22, gap: 8, marginVertical: 20, minHeight: 48 },
  eyebrow: { fontFamily: 'Inter_600SemiBold', color: '#B7B1A5', fontSize: 10, letterSpacing: 1.4 },
  title: { fontFamily: 'Inter_700Bold', color: '#EDEAE3', fontSize: 25 },
  body: { fontFamily: 'Inter_400Regular', color: '#B7B1A5', fontSize: 13, lineHeight: 20 },
});

/** Moments remains the entry for adding/editing flights even with no upcoming trip. */
export function TravelMomentsEntry() {
  const flags = useFeatureFlags();
  const { isSignedIn, userId } = useAuth();
  const router = useRouter();
  if (!flags.moments_enabled || !travelPilotAvailable(flags) || !isSignedIn || !userId) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel="Add or manage a flight"
    testID="travel-moments-entry" onPress={() => router.push('/travel' as never)} style={styles.card}>
    <Text style={styles.body}>Add or manage a flight →</Text>
  </Pressable>;
}
