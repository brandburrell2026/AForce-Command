/**
 * SayYourTrip — fill the trip form by speaking instead of typing.
 *
 * Uses the same bounded, on-device capture as One Breath
 * (hooks/useOneBreathVoice): the phone turns speech into text itself, no
 * audio is kept, and nothing goes over the network. The text is read with
 * fixed patterns (utils/travel/spokenTrip) and only the fields it clearly
 * states are filled. Nothing is saved from here: the member checks the form
 * and saves it as before.
 *
 * Where on-device speech is not available (Android, web, older phones) this
 * renders nothing and typing stays exactly as it was.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useOneBreathVoice } from '@/hooks/useOneBreathVoice';
import { af } from '@/theme';
import {
  SAY_YOUR_TRIP_EXAMPLE,
  parseSpokenTrip,
  spokenTripSummary,
  tripForForm,
  type SpokenTrip,
  type SpokenTripFields,
} from '@/utils/travel/spokenTrip';

export interface SayYourTripProps {
  /** Which leg the words fill, 1-based, for the label. */
  legNumber: number;
  /** Called once per finished capture with the fields that were clearly stated. */
  onFields: (fields: SpokenTripFields) => void;
  /** Injectable for tests. */
  now?: () => Date;
}

export function SayYourTrip({ legNumber, onFields, now = () => new Date() }: SayYourTripProps) {
  const [heard, setHeard] = React.useState('');
  const [result, setResult] = React.useState<SpokenTrip | null>(null);
  const apply = React.useRef(onFields);
  apply.current = onFields;
  const clock = React.useRef(now);
  clock.current = now;

  const voice = useOneBreathVoice((text, info) => {
    setHeard(text);
    // Interim words are shown but fill nothing; only the finished sentence does.
    if (!info.final) return;
    // Only what this form can save is applied; anything held back is said in a note.
    const trip = tripForForm(parseSpokenTrip(text, clock.current()));
    setResult(trip);
    if (Object.keys(trip.fields).length > 0) apply.current(trip.fields);
  });

  if (!voice.available) return null;

  const listening = voice.listening || voice.busy;
  return (
    <View style={styles.wrap} testID="say-your-trip">
      <Pressable
        onPress={() => {
          if (listening) { voice.stop(); return; }
          setHeard('');
          setResult(null);
          void voice.start();
        }}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop listening' : `Say your trip. Fills leg ${legNumber}.`}
        accessibilityState={{ busy: listening }}
        style={({ pressed }) => [styles.button, listening && styles.buttonOn, pressed && styles.pressed]}
        testID="say-your-trip-button"
      >
        <Text style={[styles.buttonText, listening && styles.buttonTextOn]}>
          {voice.listening ? 'Listening… tap to stop' : voice.busy ? 'Starting…' : 'Say your trip'}
        </Text>
      </Pressable>

      {!heard && !result && !voice.error ? (
        <Text style={styles.note}>Try: {SAY_YOUR_TRIP_EXAMPLE}</Text>
      ) : null}

      {heard ? (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.eyebrow}>WHAT I HEARD</Text>
          <Text style={styles.heard}>{heard}</Text>
        </View>
      ) : null}

      {result ? (
        <View accessibilityLiveRegion="polite" testID="say-your-trip-result">
          <Text style={styles.summary}>{spokenTripSummary(result)}</Text>
          {result.notes.map((n) => (
            <Text key={n} style={styles.note}>{n}</Text>
          ))}
        </View>
      ) : null}

      {voice.error ? (
        <Text style={styles.note} accessibilityRole="alert">{travelVoiceError(voice.error)}</Text>
      ) : null}

      <Text style={styles.note}>
        Heard on this phone only. No audio is kept, and nothing is saved until you save the trip.
      </Text>
    </View>
  );
}

/** The capture hook words its errors for One Breath ("your moment"); say "the details" here. */
export function travelVoiceError(message: string): string {
  return message.replace(/type your moment( instead)?/gi, 'type the details$1').replace(/your moment/gi, 'the details');
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 14 },
  button: {
    minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: af.border,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  buttonOn: { backgroundColor: af.primaryFill, borderColor: af.primaryFill },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  buttonTextOn: { color: af.onPrimaryFill },
  pressed: { opacity: 0.85 },
  eyebrow: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, lineHeight: 14, letterSpacing: 2,
    color: af.textSecondary, marginBottom: 4,
  },
  heard: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21, color: af.textPrimary },
  summary: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, color: af.textPrimary },
  note: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary },
});
