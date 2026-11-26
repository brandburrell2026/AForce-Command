import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { af } from '@/theme';
import { MAX_CONFIRMATION_LENGTH, reviewConfirmation, type ConfirmationReview } from '@/utils/travel/confirmationImport';

export function ImportFlightConfirmation({ onReview, onCancel, busy = false }: {
  onReview: (review: ConfirmationReview) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState('');
  const review = () => {
    if (busy) return;
    try {
      const result = reviewConfirmation(text);
      setText('');
      setError('');
      onReview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read these details. Use Add a trip instead.');
    }
  };
  return <View style={s.root} testID="flight-confirmation-import">
    <Text accessibilityRole="header" style={s.heading}>Import a flight confirmation</Text>
    <Text style={s.copy}>Copy the itinerary text from your airline confirmation and paste it here. Include flight numbers, airports, full dates and departure times. You’ll review and edit the details before saving.</Text>
    <Text style={s.copy}>This first version reads plain text. Automatic inbox sync and airline-profile connections are not available yet.</Text>
    <TextInput
      accessibilityLabel="Flight confirmation text"
      multiline
      autoCorrect={false}
      autoCapitalize="none"
      editable={!busy}
      maxLength={MAX_CONFIRMATION_LENGTH + 1}
      value={text}
      onChangeText={value => { setText(value); setError(''); }}
      placeholder="Paste itinerary text"
      placeholderTextColor={af.textTertiary}
      style={s.input}
    />
    <Text style={s.copy}>{text.length.toLocaleString()} / {MAX_CONFIRMATION_LENGTH.toLocaleString()} characters</Text>
    {error ? <Text accessibilityRole="alert" style={s.copy}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Review imported flights" accessibilityState={{ disabled: busy || !text.trim() }} disabled={busy || !text.trim()} onPress={review} style={[s.button, (busy || !text.trim()) && s.disabled]}>
      <Text style={s.buttonText}>Review imported flights</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Cancel confirmation import" disabled={busy} onPress={() => { setText(''); setError(''); onCancel(); }} style={s.button}>
      <Text style={s.buttonText}>Not now</Text>
    </Pressable>
    <Text style={s.privacy}>The pasted text is read on this device and is not uploaded or kept in your saved trips. Only itinerary fields you confirm are saved. This does not connect to your inbox or airline account.</Text>
  </View>;
}
const s = StyleSheet.create({
  root: { gap: 14 },
  heading: { fontFamily: 'Inter_600SemiBold', fontSize: 24, lineHeight: 29, color: af.textPrimary },
  copy: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: af.textSecondary },
  input: { minHeight: 180, textAlignVertical: 'top', borderWidth: 1, borderColor: af.divider, borderRadius: 16, padding: 16, color: af.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  button: { minHeight: 48, borderWidth: 1, borderColor: af.divider, borderRadius: 24, padding: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  privacy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: af.textTertiary },
  disabled: { opacity: 0.4 },
});
