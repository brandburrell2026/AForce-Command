import { af } from '@/theme/afTokens';
import React from 'react';
import { resolveDepartureZone } from '@/services/travel/airportTimeZone';
import { TravelReminderCard } from './TravelReminderCard';
import { TravelClearError } from '@/services/travel/reminders';
import { TravelFlightStatus } from './TravelFlightStatus';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ZodError } from 'zod';
import { AFScreen } from '@/components/ui/AFScreen';
import { useTravelJourney } from '@/hooks/useTravelJourney';
import { useFeatureFlags } from '@/store/useAppStore';
import type { DepartureInput } from '@/services/travel/journey';

const EMPTY: DepartureInput = { flightNumber: '', origin: '', destination: '', departureDate: '', departureTime: '', utcOffset: '' };
const FIELDS: { key: keyof DepartureInput; label: string; placeholder: string; hint?: string }[] = [
  { key: 'flightNumber', label: 'Flight number', placeholder: 'AA123' },
  { key: 'origin', label: 'Departure airport', placeholder: 'JFK' },
  { key: 'destination', label: 'Arrival airport', placeholder: 'LAX' },
  { key: 'departureDate', label: 'Departure date', placeholder: 'YYYY-MM-DD', hint: 'Use the date at the departure airport.' },
  { key: 'departureTime', label: 'Departure time', placeholder: '14:30', hint: 'Use the 24-hour time on your itinerary.' },
  { key: 'utcOffset', label: 'Departure UTC offset', placeholder: '-04:00', hint: 'Use the departure airport offset on your travel date, including daylight saving time.' },
];

function Action({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function TravelScreen() {
  const router = useRouter();
  const flags = useFeatureFlags();
  const { owner, query, mutation } = useTravelJourney();
  const [form, setForm] = React.useState<DepartureInput>(EMPTY);
  const zone = React.useMemo(() => resolveDepartureZone(form.origin, form.departureDate, form.departureTime), [form.origin, form.departureDate, form.departureTime]);
  const [adding, setAdding] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);
  // Ref stops same-frame double taps before the mutation observer re-renders.
  const busy = React.useRef(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const journey = query.data;
  const edit = async (action: Parameters<typeof mutation.mutateAsync>[0]) => {
    if (busy.current) return;
    if ((action.kind === 'save' || action.kind === 'update') && zone.invalidLocalTime) { setActionError(zone.error); return; }
    busy.current = true;
    setActionError(null);
    try {
      await mutation.mutateAsync(action);
      setAdding(false); setConfirmRemove(false); setConfirmClear(false); setForm(EMPTY);
    } catch (error) {
      setActionError(error instanceof ZodError ? error.issues[0]?.message ?? 'Check your flight details.'
        : error instanceof TravelClearError ? error.message : 'We couldn’t save this change. Your saved journey has not been replaced. Please try again.');
    } finally { busy.current = false; }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AFScreen scroll edges={['top', 'bottom']} contentContainerStyle={{ paddingBottom: 40 }} testID="travel-screen">
        <Action label="Back" secondary onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
        <Text style={styles.eyebrow}>TRAVEL · POWERED BY TRAVELGATE</Text>
        <Text style={styles.heading}>Arrive ready.</Text>
        <Action label="Travel Intelligence · trips, connections and arrival" onPress={() => router.push('/travel-intelligence' as never)} />
        <Text style={styles.copy}>Your journey. Your AForce rituals. One place to prepare.</Text>
        <View style={styles.panel}>
          <Text style={styles.label}>Internal preview</Text>
          <Text style={styles.copy}>Trips are manually entered and saved for your account on this device only. Flight status requires a connected internal pilot. Preparation reminders are optional. Saving a flight also adds it to Moments on this device. Finishing or removing it removes that upcoming Moment. Open Travel Intelligence to manage connected trips, cloud sync, account linking and optional alerts.</Text>
          {Platform.OS === 'web' ? <Text style={styles.copy}>Browser preview: this tab’s session storage is used; it is not encrypted device storage.</Text> : null}
        </View>
        {!owner ? <Text style={styles.copy}>Sign in to manage your journey.</Text> : query.isPending ? <Text style={styles.copy}>Loading your journey…</Text>
          : query.isError ? <View style={styles.panel}>
            <Text accessibilityRole="alert" style={styles.copy}>We couldn’t read your saved journey. Retry before making changes.</Text>
            <Action label="Retry" onPress={() => { void query.refetch(); }} />
            <Action label="Remove saved journey" secondary onPress={() => setConfirmRemove(true)} />
          </View> : (
            <>
              {journey && !adding ? <View style={styles.panel}>
                <Text style={styles.label}>{journey.completedAt ? 'Journey finished' : 'Your journey'}</Text>
                <Text style={styles.route}>{journey.details.origin} → {journey.details.destination}</Text>
                <Text style={styles.copy}>{journey.details.flightNumber}</Text>
                <Text style={styles.copy}>{journey.details.departureDate} at {journey.details.departureTime} (UTC{journey.details.utcOffset})</Text>
                <Text style={styles.copy}>Manually entered itinerary · check your airline for current departure and gate information.</Text>
                {journey.completedAt ? <Action label="Add another flight" onPress={() => { setAdding(true); setActionError(null); }} /> : (
                  <Action label={mutation.isPending ? 'Saving…' : 'Finish journey'} disabled={mutation.isPending} onPress={() => { void edit({ kind: 'finish' }); }} />
                )}
                {!journey.completedAt ? <Action label="Edit flight" secondary disabled={mutation.isPending}
                  onPress={() => { setForm(journey.details); setAdding(true); setActionError(null); }} /> : null}
                <Action label="Remove journey" secondary disabled={mutation.isPending} onPress={() => setConfirmRemove(true)} />
              </View> : null}
              {!journey || adding ? <View style={styles.panel}>
                <Text style={styles.label}>{journey && !journey.completedAt ? 'Edit flight' : 'Add a flight'}</Text>
                {FIELDS.filter(field => field.key !== 'utcOffset' || !zone.utcOffset).map(field => <View key={field.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput accessibilityLabel={field.label} accessibilityHint={field.hint} placeholder={field.placeholder}
                    placeholderTextColor={af.textTertiary} autoCorrect={false} autoCapitalize="characters"
                    maxLength={field.key === 'origin' || field.key === 'destination' ? 3 : field.key === 'departureDate' ? 10 : 12}
                    editable={!mutation.isPending} value={form[field.key]} onChangeText={value => setForm(previous => ({ ...previous, [field.key]: value }))}
                    style={styles.input} testID={`travel-input-${field.key}`} />
                  {field.hint ? <Text style={styles.hint}>{field.hint}</Text> : null}
                </View>)}
                {zone.utcOffset ? <Text style={styles.hint}>Departure time zone: {zone.timeZone} · UTC{zone.utcOffset} (set automatically)</Text> : form.origin.length === 3 && zone.error ? <Text accessibilityRole="alert" style={styles.hint}>{zone.error}</Text> : null}
                <Action label={mutation.isPending ? 'Saving…' : 'Save flight'} disabled={mutation.isPending}
                  onPress={() => { void edit({ kind: journey && !journey.completedAt ? 'update' : 'save', input: { ...form, utcOffset: zone.utcOffset ?? form.utcOffset } }); }} />
                {actionError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{actionError}</Text> : null}
                {adding ? <Action label="Cancel" secondary disabled={mutation.isPending} onPress={() => { setAdding(false); setActionError(null); }} /> : null}
              </View> : null}
              {journey && !journey.completedAt ? <TravelFlightStatus key={journey.createdAt} journey={journey} /> : null}
              {journey && !journey.completedAt ? <View style={styles.panel}>
                <Text style={styles.label}>Keep your ritual close.</Text>
                <Text style={styles.copy}>Use your usual hydration and preparation tools while you travel.</Text>
                <Action label="Open hydration" secondary onPress={() => router.push('/(tabs)/journal' as never)} />
                {flags.moments_enabled ? <Action label="Open Moments" secondary onPress={() => router.push('/moments' as never)} /> : null}
              </View> : null}
            </>
          )}
        {owner ? <TravelReminderCard owner={owner} disabled={mutation.isPending} onClear={() => setConfirmClear(true)} /> : null}
        {confirmClear ? <View style={styles.panel}>
          <Text style={styles.copy}>Clear travel data for this account on this device? This removes the saved trip, preparation preference and cached status, and cancels its AForce preparation reminder. It does not delete either account or data in other apps.</Text>
          <Action label="Confirm clear travel data" disabled={mutation.isPending} onPress={() => { void edit({ kind: 'clear' }); }} />
          <Action label="Keep travel data" secondary disabled={mutation.isPending} onPress={() => setConfirmClear(false)} />
        </View> : null}
        {confirmRemove ? <View style={styles.panel}>
          <Text style={styles.copy}>Remove this device’s saved journey? This cannot be undone.</Text>
          <Action label="Confirm removal" disabled={mutation.isPending} onPress={() => { void edit({ kind: 'remove' }); }} />
          <Action label="Keep journey" secondary disabled={mutation.isPending} onPress={() => setConfirmRemove(false)} />
        </View> : null}
        {actionError && journey && !adding ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{actionError}</Text> : null}
      </AFScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: af.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5, marginTop: 32 },
  heading: { color: af.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 44, letterSpacing: -1.7, marginTop: 12, marginBottom: 16 },
  copy: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23 },
  panel: { borderTopWidth: 1, borderColor: af.divider, paddingVertical: 22, marginTop: 22, gap: 14 },
  label: { color: af.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 19 },
  route: { color: af.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 34 },
  field: { gap: 8 },
  fieldLabel: { color: af.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  hint: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  input: { color: af.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 17, minHeight: 52, padding: 14, borderColor: af.textTertiary, borderWidth: 1, borderRadius: 4, backgroundColor: af.surface },
  button: { minHeight: 48, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: af.textPrimary, borderWidth: 1, borderColor: af.textPrimary, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  secondary: { backgroundColor: 'transparent', borderColor: af.textTertiary },
  buttonText: { color: af.canvas, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  secondaryText: { color: af.textPrimary },
  disabled: { opacity: 0.5 },
  error: { color: af.redText, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22, marginTop: 16 },
});
