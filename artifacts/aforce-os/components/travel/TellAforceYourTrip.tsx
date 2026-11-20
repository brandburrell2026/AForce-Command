/**
 * TellAforceYourTrip — the primary way to add a trip: say or type it in one
 * sentence, answer at most one question at a time, review one card, confirm.
 *
 * It owns no trip data and saves nothing. Words go through the trip turn
 * logic (`utils/travel/tripTurn`), which reuses One Breath's rules; speech
 * comes from the same on-device capture One Breath uses and is optional, so
 * typing works on every phone. The screen decides what Confirm and Edit
 * details do. Nothing is checked with an airline here, and the card says so.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useOneBreathVoice } from '@/hooks/useOneBreathVoice';
import { af } from '@/theme';
import { SAY_YOUR_TRIP_EXAMPLE } from '@/utils/travel/spokenTrip';
import { confirmLabel, TRIP_CARD_MISSING, TRIP_CARD_SOURCE, tripCardLegs } from '@/utils/travel/tripCard';
import { tripComplete, tripTitle, tripTurn, type TripDraft } from '@/utils/travel/tripTurn';
import { travelVoiceError } from './SayYourTrip';

export const TRIP_NOT_UNDERSTOOD = 'I didn’t catch a trip detail in that. Say it another way, or use Edit details.';
export const TRIP_NOTHING_HEARD = 'I didn’t catch a trip in that. Try the example, or use Edit details.';
export const TRIP_PRIVACY = 'Speech is heard on this phone only and no audio is kept. Nothing is saved until you confirm.';

export interface TellAforceYourTripProps {
  onConfirm: (draft: TripDraft) => void;
  /** Opens the full form with whatever the draft holds. */
  onEditDetails: (draft: TripDraft | null) => void;
  onCancel: () => void;
  busy?: boolean;
  now?: () => Date;
  /** A sentence handed over from One Breath. It is read once, as if the member had just said it here. */
  initialWords?: string;
}

export function TellAforceYourTrip({ onConfirm, onEditDetails, onCancel, busy = false, now = () => new Date(), initialWords }: TellAforceYourTripProps) {
  const [words, setWords] = React.useState('');
  const [draft, setDraft] = React.useState<TripDraft | null>(null);
  const [missed, setMissed] = React.useState<string | null>(null);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  const clock = React.useRef(now);
  clock.current = now;

  const take = React.useCallback((said: string) => {
    const text = said.trim();
    if (!text) return;
    const step = tripTurn(draftRef.current, text, clock.current());
    if (!step.understood) {
      setMissed(draftRef.current ? TRIP_NOT_UNDERSTOOD : TRIP_NOTHING_HEARD);
      return;
    }
    setMissed(null);
    setDraft(step.draft);
    setWords('');
  }, []);

  // Words carried over from One Breath start the draft once. Nothing is saved by this.
  const handed = React.useRef(false);
  React.useEffect(() => {
    if (handed.current || !initialWords?.trim()) return;
    handed.current = true;
    take(initialWords);
  }, [initialWords, take]);

  const voice = useOneBreathVoice((text, info) => {
    setWords(text);
    // Interim words are shown in the box; only the finished sentence is used.
    if (info.final) take(text);
  });
  const listening = voice.listening || voice.busy;
  const complete = !!draft && tripComplete(draft);
  const legs = draft ? tripCardLegs(draft) : [];

  return (
    <View style={s.root} testID="tell-aforce-your-trip">
      <Text style={s.eyebrow}>TELL AFORCE YOUR TRIP</Text>
      <Text accessibilityRole="header" style={s.title}>
        {draft ? tripTitle(draft) || 'Your trip' : 'Say it or type it. One sentence.'}
      </Text>
      {draft ? null : <Text style={s.note}>Try: {SAY_YOUR_TRIP_EXAMPLE}</Text>}

      {draft ? (
        <View style={s.card} testID="trip-card" accessibilityLiveRegion="polite">
          {legs.map((leg) => (
            <View key={leg.heading} style={s.leg}>
              <Text style={s.eyebrow}>{leg.heading.toUpperCase()}</Text>
              {leg.rows.map((row) => (
                <View key={row.label} style={s.row} accessible accessibilityLabel={`${row.label}: ${row.value ?? TRIP_CARD_MISSING}`}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={[s.rowValue, !row.value && s.rowMissing]}>{row.value ?? TRIP_CARD_MISSING}</Text>
                </View>
              ))}
              {leg.note ? <Text style={s.note}>{leg.note}</Text> : null}
            </View>
          ))}
          <Text style={s.source}>{TRIP_CARD_SOURCE}</Text>
        </View>
      ) : null}

      {draft?.asking ? (
        <View style={s.question} accessibilityLiveRegion="polite" testID="trip-question">
          <Text style={s.questionText}>{draft.asking.text}</Text>
          {draft.asking.choices ? (
            <View style={s.choices}>
              {draft.asking.choices.map((c) => (
                <Pressable key={c.value} accessibilityRole="button" accessibilityLabel={c.label} disabled={busy} onPress={() => take(c.label)} style={({ pressed }) => [s.choice, pressed && s.pressed]}>
                  <Text style={s.choiceText}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {missed ? <Text accessibilityRole="alert" style={s.note}>{missed}</Text> : null}
      {voice.error ? <Text accessibilityRole="alert" style={s.note}>{travelVoiceError(voice.error)}</Text> : null}

      <View style={s.bar}>
        <TextInput
          accessibilityLabel={draft ? 'Answer or correct your trip' : 'Your trip'}
          value={words}
          onChangeText={(v) => { voice.cancel(); setWords(v); }}
          placeholder={draft ? (draft.asking ? 'Answer, or correct anything' : 'Correct anything') : voice.available ? 'Talk or type your trip' : 'Type your trip'}
          placeholderTextColor={af.textTertiary}
          maxLength={200}
          returnKeyType="send"
          onSubmitEditing={() => take(words)}
          editable={!busy}
          style={s.input}
        />
        {voice.available ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Speak'}
            accessibilityState={{ busy: listening }}
            disabled={busy}
            onPress={() => { if (listening) voice.stop(); else { setWords(''); void voice.start(); } }}
            style={[s.round, s.mic, listening && s.micOn]}
            testID="trip-mic"
          >
            <Icon name="mic" size={18} color={listening ? af.onPrimaryFill : af.textPrimary} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: busy || !words.trim() }}
          disabled={busy || !words.trim()}
          onPress={() => take(words)}
          style={[s.round, s.send, (busy || !words.trim()) && s.disabled]}
        >
          <Icon name="arrow-up" size={18} color={af.onPrimaryFill} />
        </Pressable>
      </View>

      {draft ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={confirmLabel(draft)}
          accessibilityState={{ disabled: !complete || busy }}
          disabled={!complete || busy}
          onPress={() => onConfirm(draft)}
          style={({ pressed }) => [s.primary, (!complete || busy) && s.disabled, pressed && s.pressed]}
          testID="trip-confirm"
        >
          <Text style={s.primaryText}>{confirmLabel(draft)}</Text>
        </Pressable>
      ) : null}
      <View style={s.secondaryRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit details" disabled={busy} onPress={() => onEditDetails(draft)} style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
          <Text style={s.secondaryText}>Edit details</Text>
        </Pressable>
        {draft ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Start over" disabled={busy} onPress={() => { voice.cancel(); setDraft(null); setMissed(null); setWords(''); }} style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
            <Text style={s.secondaryText}>Start over</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Not now" disabled={busy} onPress={() => { voice.cancel(); onCancel(); }} style={({ pressed }) => [s.secondary, pressed && s.pressed]}>
          <Text style={s.secondaryText}>Not now</Text>
        </Pressable>
      </View>
      <Text style={s.privacy}>{TRIP_PRIVACY}</Text>
    </View>
  );
}

const MONO = 'IBMPlexMono_500Medium';
const s = StyleSheet.create({
  root: { gap: 14 },
  eyebrow: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.8, color: af.textTertiary },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 24, lineHeight: 29, letterSpacing: -0.5, color: af.textPrimary },
  note: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: af.textSecondary },
  card: { backgroundColor: af.surface, borderColor: af.divider, borderWidth: 1, borderRadius: 20, padding: 18, gap: 16 },
  leg: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, minHeight: 28 },
  rowLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: af.textSecondary },
  rowValue: { flexShrink: 1, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 16, color: af.textPrimary },
  rowMissing: { fontFamily: 'Inter_400Regular', color: af.textTertiary },
  source: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, color: af.textTertiary },
  question: { gap: 10 },
  questionText: { fontFamily: 'Inter_500Medium', fontSize: 17, lineHeight: 23, color: af.textPrimary },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: af.divider, justifyContent: 'center' },
  choiceText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: af.textPrimary },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingRight: 6, paddingLeft: 16, borderRadius: 999, borderWidth: 1, borderColor: af.divider },
  input: { flex: 1, minWidth: 0, minHeight: 44, fontFamily: 'Inter_400Regular', fontSize: 16, color: af.textPrimary },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  mic: { borderWidth: 1, borderColor: af.divider },
  // Listening is shown with the app's warm-white active fill; red fills are reserved.
  micOn: { backgroundColor: af.primaryFill, borderColor: af.primaryFill },
  send: { backgroundColor: af.primaryFill },
  primary: { minHeight: 52, borderRadius: 26, backgroundColor: af.primaryFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: af.onPrimaryFill },
  secondaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondary: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: af.divider, justifyContent: 'center' },
  secondaryText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: af.textPrimary },
  privacy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, color: af.textTertiary },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.72 },
});
