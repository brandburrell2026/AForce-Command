import { af } from '@/theme/afTokens';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { travelRuntime } from '@/services/travel/runtime';
import type { ReminderOwner, ReminderState } from '@/services/travel/reminders';

const COPY: Record<ReminderState, string> = {
  off: 'AForce preparation reminders are off.',
  external: 'AForce preparation reminders are off. Manage reminders in your other app.',
  scheduled: 'One AForce preparation reminder is scheduled.',
  quiet_hours: 'No reminder scheduled: the preparation time falls within quiet hours.',
  too_late: 'No reminder scheduled: the preparation time has already passed.',
  no_journey: 'AForce reminders selected. Add an upcoming flight to schedule one.',
  permission_required: 'Notification permission is needed. Allow notifications in device settings, then try Enable AForce reminder.',
  unsupported: 'Preparation reminders are available in the native app. This browser preview does not schedule notifications.',
  error: 'We couldn’t verify or update the reminder. Retry a reminder choice or clear travel data.',
};
export function TravelReminderCard({ owner, onClear, disabled = false }: { owner: string; onClear: () => void; disabled?: boolean }) {
  const snapshot = React.useSyncExternalStore(travelRuntime.subscribe, travelRuntime.snapshot, travelRuntime.snapshot);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState(false);
  const busy = React.useRef(false);
  const choose = async (choice: ReminderOwner) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(false);
    try { await travelRuntime.choose(owner, choice); }
    catch { setError(true); }
    finally { busy.current = false; setPending(false); }
  };
  const unavailable = disabled || pending;
  return <View style={styles.panel} testID="travel-reminder-card">
    <Text style={styles.title}>Preparation reminders</Text>
    <Text style={styles.copy}>Optional: one reminder two hours before the departure you entered. Quiet hours are 10pm–7am at the departure airport. No flight-status or gate alerts are sent.</Text>
    <Text accessibilityLiveRegion="polite" style={styles.copy}>{snapshot.owner === owner ? COPY[snapshot.state] : 'Checking reminder settings…'}</Text>
    {snapshot.owner === owner && snapshot.state === 'scheduled' && snapshot.fireAt ? <Text style={styles.copy}>Scheduled for {new Date(snapshot.fireAt).toLocaleString()} (device local time).</Text> : null}
    {Platform.OS !== 'web' ? <>
      {([['aforce', 'Enable AForce reminder'], ['external', 'Use reminders from another app'], ['off', 'Turn off AForce reminders']] as const).map(([choice, label]) =>
        <Pressable key={choice} accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable}
          onPress={() => { void choose(choice); }} style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>)}
      <Text style={styles.copy}>Choose one app for preparation reminders to avoid duplicates. This control does not change settings in TravelGate or your airline app.</Text>
    </> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>We couldn’t change the reminder setting. Try again.</Text> : null}
    <Text style={styles.title}>Travel data on this device</Text>
    <Text style={styles.copy}>Clear this account’s saved journey, preparation preference and cached flight status, and cancel its AForce preparation reminder. Your AForce and TravelGate accounts stay active.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={onClear} style={styles.button}>
      <Text style={styles.buttonText}>Clear travel data from this device</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  panel: { borderTopWidth: 1, borderColor: af.divider, paddingVertical: 22, marginTop: 22, gap: 14 },
  title: { color: af.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 19 },
  copy: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },
  button: { borderWidth: 1, borderColor: af.textTertiary, minHeight: 48, padding: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  buttonText: { color: af.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  error: { color: af.redText, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },
});
