/** Type-first input → editable truth mirror → explicit confirmation → existing Moments store. */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { af, afType } from '@/theme';
import { AFPrimaryButton, AFSecondaryButton } from '@/components/ui';
import { addMoment, hydrateMoments, useMomentsStore } from '@/services/momentsStore';
import { captureScope, isScopeCurrent } from '@/services/scopedWriteQueue';
import { getScopeState } from '@/services/userScope';
import { createConfirmedMoment, validateMomentDraft, type MomentDraft } from '@/services/momentDraft';
import { useOneBreathVoice } from '@/hooks/useOneBreathVoice';
import { suggestMomentDraft } from '@/services/oneBreathDraft';
import type { MomentType } from '@/types/moments';
import { MOMENT_NOTIFY_QUIET_START_HOUR, MOMENT_NOTIFY_QUIET_END_HOUR, MOMENT_NOTIFY_MAX_PER_DAY, MOMENT_NOTIFY_MIN_GAP_MIN } from '@/config/hydroStateModel';

const TYPES: MomentType[] = ['work', 'training', 'travel', 'recovery', 'personal', 'performance'];

export function ConfirmMomentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useMomentsStore();
  const [scope] = React.useState(captureScope);
  const [text, setText] = React.useState('');
  const [draft, setDraft] = React.useState<MomentDraft | null>(null);
  const [error, setError] = React.useState('');
  const voice = useOneBreathVoice(setText);
  const [saved, setSaved] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [confirmationState, setConfirmationState] = React.useState<'reading' | 'open' | 'closed'>('closed');
  const [windowNumber, setWindowNumber] = React.useState(0);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [confirmationNote, setConfirmationNote] = React.useState('');
  const [spokenPhrase, setSpokenPhrase] = React.useState('');
  const [wasCorrected, setWasCorrected] = React.useState(false);
  const confirming = React.useRef(false);
  React.useEffect(() => { if (!store.hydrated) void hydrateMoments(); }, [store.hydrated]);

  // A proposal is read before the seven-second sealing window exists. Changes
  // deliberately restart this sequence so an old approval can never seal a
  // changed plan. Text is the dependable fallback while streaming voice is
  // configured; no audio failure can imply confirmation.
  React.useEffect(() => {
    if (!draft || saved) return;
    const nextWindow = windowNumber + 1;
    setConfirmationState('reading');
    setSecondsLeft(0);
    setConfirmationNote('Listening opens after the read-back.');
    const readback = setTimeout(() => {
      setWindowNumber(nextWindow);
      setConfirmationState('open');
      setSecondsLeft(7);
      setConfirmationNote(`Confirmation window ${nextWindow} · open.`);
    }, 800);
    return () => clearTimeout(readback);
  }, [draft, saved]);

  React.useEffect(() => {
    if (confirmationState !== 'open') return;
    if (secondsLeft <= 0) {
      setConfirmationState('closed');
      setConfirmationNote('Closed after 7 seconds · nothing heard.');
      return;
    }
    const tick = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(tick);
  }, [confirmationState, secondsLeft]);

  const update = <K extends keyof MomentDraft>(key: K, value: MomentDraft[K]) => {
    setDraft((previous) => {
      if (!previous || previous[key] === value) return previous;
      setWasCorrected(true);
      setConfirmationState('closed');
      setConfirmationNote('Closed · you corrected the plan. Reading it back again.');
      return { ...previous, [key]: value };
    });
    setError('');
  };
  const confirm = (source: 'window' | 'hold') => {
    if (!draft || confirming.current) return;
    if (source === 'window' && confirmationState !== 'open') {
      setConfirmationNote("Heard 'seal it' outside the window · nothing happened.");
      return;
    }
    if (!isScopeCurrent(scope) || getScopeState().status !== 'AUTHENTICATED') {
      setError('Your account changed. Return to Home and start a new plan.');
      return;
    }
    if (!store.hydrated) { setError('Your saved moments are still loading. Try again shortly.'); return; }
    const result = validateMomentDraft(draft);
    if (!result.ok) { setError(result.error); return; }
    confirming.current = true;
    addMoment(createConfirmedMoment(draft, result.startAtIso));
    setConfirmationState('closed');
    setConfirmationNote(source === 'hold' ? 'Closed · sealed by hold.' : "Heard 'seal it' inside the window · sealed.");
    setSaved(true);
  };
  const handlePhrase = () => {
    const phrase = spokenPhrase.trim().toLowerCase();
    if (!phrase) return;
    if (/^seal it[.!]?$/.test(phrase)) {
      setSpokenPhrase('');
      confirm('window');
      return;
    }
    const hour = phrase.match(/(?:make it|at)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (hour && draft) {
      const numeric = Number(hour[1]);
      const minute = hour[2] ?? '00';
      const adjusted = hour[3] === 'pm' ? (numeric % 12) + 12 : hour[3] === 'am' ? numeric % 12 : numeric;
      if (adjusted >= 0 && adjusted <= 23) update('time', `${String(adjusted).padStart(2, '0')}:${minute}`);
      setSpokenPhrase('');
      return;
    }
    setConfirmationState('closed');
    setConfirmationNote('Closed · you asked something else. Update the plan, then hear it again.');
    setSpokenPhrase('');
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.brand}>AFORCE</Text>
        <Pressable accessibilityRole="button" onPress={() => { voice.cancel(); router.back(); }} style={styles.touch}><Text style={styles.quiet}>Close</Text></Pressable>
      </View>
      <Text style={styles.eyebrow}>ONE BREATH / {voice.listening ? 'LISTENING' : 'YOUR NEXT MOMENT'}</Text>
      <Text accessibilityRole="header" style={styles.title}>{saved ? 'Your moment.\nIn your plan.' : draft ? 'Make it yours.' : 'One moment.\nOne clear plan.'}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: helpOpen }} aria-expanded={helpOpen} onPress={() => setHelpOpen((open) => !open)} style={styles.touch}>
        <Text style={styles.quiet}>{helpOpen ? 'Hide One Breath help' : 'Help with One Breath'}</Text>
      </Pressable>
      {helpOpen ? <View style={styles.delta}>
        <Text accessibilityRole="header" style={styles.body}>Speak or type</Text>
        <Text style={styles.quiet}>Voice requires supported on-device English recognition on iPhone. You can always type. AForce does not save or receive the audio.</Text>
        <Text accessibilityRole="header" style={styles.body}>Review before saving</Text>
        <Text style={styles.quiet}>Correct the suggested name, date, time, kind and goal. Dates and times use this device’s time zone. Ambiguous details stay blank. Only a deliberate Seal saves a Moment on this device. Closing a draft saves nothing.</Text>
        <Text accessibilityRole="header" style={styles.body}>Preparation reminders</Text>
        <Text style={styles.quiet}>Your reminder preferences and notification permission apply. Quiet hours run from {MOMENT_NOTIFY_QUIET_START_HOUR}:00 to {String(MOMENT_NOTIFY_QUIET_END_HOUR).padStart(2, '0')}:00 local time. Reminders during quiet hours are skipped. Moments reminders are limited to {MOMENT_NOTIFY_MAX_PER_DAY} per day, at least {MOMENT_NOTIFY_MIN_GAP_MIN} minutes apart.</Text>
        <Text accessibilityRole="header" style={styles.body}>Marking preparation ready</Text>
        <Text style={styles.quiet}>Completion records that your preparation is ready. The Moment stays in your plan as Done and Home moves to the next unfinished Moment. Completion does not log water or change HydroState.</Text>
      </View> : null}
      {saved ? (
        <>
          <Text style={styles.body}>{draft?.title} is now in Moments on this device. Preparation appears when AForce has an eligible action.</Text>
          <AFPrimaryButton label="Open Moments" onPress={() => router.replace('/moments-tab')} testID="confirmed-open-moments" />
          <AFSecondaryButton label="Return Home" onPress={() => router.replace('/')} />
        </>
      ) : draft ? (
        <>
          <Text style={styles.body}>Review every field. Suggested dates and times use this device’s time zone. Missing or ambiguous details stay blank. Nothing is saved until you seal it.</Text>
          <Text style={styles.quiet}>Your words: {text}</Text>
          <View style={styles.understood}>
            <Text style={styles.eyebrow}>AFORCE UNDERSTOOD</Text>
            <Text style={styles.body}>{draft.title}</Text>
            <Text style={styles.quiet}>{draft.title || draft.type} · {draft.date || 'Date needed'} · {draft.time || 'Time needed'}</Text>
            {draft.prepGoal ? <Text style={styles.quiet}>Goal: {draft.prepGoal}</Text> : null}
            {wasCorrected ? <Text style={styles.quiet}>Updated from your correction</Text> : null}
          </View>
          <Field label="Moment name" value={draft.title} onChangeText={(v) => update('title', v)} maxLength={160} />
          <View style={styles.pills}>{[0, 1, 2].map((offset) => {
            const date = new Date(); date.setDate(date.getDate() + offset);
            const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return <Pressable key={offset} accessibilityRole="button" accessibilityState={{ selected: draft.date === value }} onPress={() => update('date', value)} style={[styles.pill, draft.date === value && styles.selected]}><Text style={[styles.quiet, draft.date === value && styles.selectedText]}>{['Today', 'Tomorrow', 'Next day'][offset]}</Text></Pressable>;
          })}</View>
          <View style={styles.row}>
            <View style={styles.flex}><Field label="Date · YYYY-MM-DD" value={draft.date} onChangeText={(v) => update('date', v)} placeholder="2026-10-30" maxLength={10} /></View>
            <View style={styles.flex}><Field label="Time · HH:mm" value={draft.time} onChangeText={(v) => update('time', v)} placeholder="15:00" maxLength={5} /></View>
          </View>
          <Text style={styles.quiet}>Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone} (this device). Use Travel for airport departure times.</Text>
          <Text style={styles.eyebrow}>KIND OF MOMENT</Text>
          <View style={styles.pills}>{TYPES.map((type) => <Pressable key={type} onPress={() => update('type', type)} accessibilityRole="button" accessibilityState={{ selected: draft.type === type }} style={[styles.pill, draft.type === type && styles.selected]}><Text style={[styles.quiet, draft.type === type && styles.selectedText]}>{type}</Text></Pressable>)}</View>
          <Field label="How do you want to arrive? · Optional" value={draft.prepGoal} onChangeText={(v) => update('prepGoal', v)} maxLength={500} placeholder="Focused, rested, ready." />
          {draft.type === 'training' && /upper[ -]?body/i.test(`${text} ${draft.title}`) ? <View style={styles.boundary}>
            <Text style={styles.eyebrow}>EXERCISES</Text>
            <Text style={styles.body}>Not offered yet</Text>
            <Text style={styles.quiet}>The upper-body playbook is not reviewed yet, so AFORCE will not suggest exercises.</Text>
          </View> : null}
          <View style={styles.delta}>
            <Text style={styles.eyebrow}>BEFORE YOU CONFIRM</Text>
            <Text style={styles.body}>Adds one Moment to your plan on this device. AForce uses your existing signals to show an eligible preparation action.</Text>
            <Text style={styles.quiet}>Does not log water, change HydroState, book travel, share with Circle, or write to your calendar. Existing reminder preferences still apply.</Text>
          </View>
          {draft.type === 'travel' ? <AFSecondaryButton label="Add or manage a flight instead" onPress={() => router.push('/travel')} /> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <View style={styles.confirmation}>
            <Text style={styles.eyebrow}>READ-BACK & SEAL</Text>
            <Text style={styles.body}>“{draft.title}, {draft.date || 'date needed'} at {draft.time || 'time needed'}{draft.prepGoal ? `. Goal: ${draft.prepGoal}.` : '.'}”</Text>
            <Text accessibilityLiveRegion="polite" style={[styles.quiet, confirmationState === 'open' && styles.openText]}>{confirmationState === 'open' ? `Listening for “Seal it” · ${secondsLeft}s` : confirmationNote}</Text>
            <TextInput accessibilityLabel="Say or type a confirmation" placeholder="Type “Seal it”" placeholderTextColor={af.textTertiary} value={spokenPhrase} onChangeText={setSpokenPhrase} onSubmitEditing={handlePhrase} style={styles.input} returnKeyType="send" />
            <AFSecondaryButton label={confirmationState === 'closed' ? 'Hear it again' : 'Send phrase'} onPress={confirmationState === 'closed' ? () => setDraft((value) => value ? { ...value } : value) : handlePhrase} />
            <Pressable accessibilityRole="button" accessibilityLabel="Hold to seal" delayLongPress={700} onLongPress={() => confirm('hold')} onPress={() => setConfirmationNote('Press and hold to seal this plan.')} style={styles.holdButton} testID="hold-to-seal">
              <Text style={styles.holdText}>Hold to seal</Text>
            </Pressable>
          </View>
          <AFSecondaryButton label="Back to draft" onPress={() => { setDraft(null); setError(''); }} />
        </>
      ) : (
        <>
          <Text style={styles.body}>Speak or type what’s coming up. Review the words, date, and time before you confirm.</Text>
          {voice.available ? <>
            <Text style={styles.quiet}>Voice uses on-device English transcription. Audio is not saved or sent to AForce. Tap to start; tap again to stop.</Text>
            <AFSecondaryButton label={voice.busy ? (voice.listening ? 'Stop listening' : 'Finish voice capture') : 'Speak a moment'} onPress={voice.busy ? voice.stop : () => { void voice.start(); }} />
            {voice.busy ? <AFSecondaryButton label="Cancel voice capture" onPress={voice.cancel} /> : null}
          </> : <Text style={styles.quiet}>Type mode is ready. Voice requires supported on-device recognition on iPhone.</Text>}
          {voice.error ? <Text accessibilityRole="alert" style={styles.error}>{voice.error}</Text> : null}
          <TextInput editable={!voice.busy} accessibilityLabel="Describe your moment" placeholder="Dinner with the team. I want to arrive relaxed." placeholderTextColor={af.textTertiary} multiline value={text} onChangeText={setText} maxLength={160} style={[styles.input, styles.draft]} />
          <Text style={styles.quiet}>Local draft · Nothing saved until you confirm</Text>
          <AFPrimaryButton label="Review my moment" disabled={!text.trim() || voice.busy} onPress={() => { voice.cancel(); setDraft(suggestMomentDraft(text)); }} testID="review-moment-draft" />
          <AFSecondaryButton label="Add a flight" onPress={() => router.push('/travel')} />
        </>
      )}
    </ScrollView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={af.textTertiary} style={styles.input} autoCapitalize="sentences" /></View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: af.canvas },
  content: { paddingHorizontal: 24, gap: 20, width: '100%', maxWidth: 620, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { ...afType.bodyStrong, color: af.redText, letterSpacing: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 36, lineHeight: 42, letterSpacing: -0.8, color: af.textPrimary },
  eyebrow: { ...afType.eyebrow, color: af.redText, fontSize: 10 },
  body: { ...afType.body, color: af.textPrimary, lineHeight: 23 },
  quiet: { ...afType.caption, color: af.textSecondary, lineHeight: 20 },
  touch: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  label: { ...afType.caption, color: af.textSecondary },
  field: { gap: 8 },
  input: { ...afType.body, color: af.textPrimary, backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 8, padding: 14, minHeight: 50 },
  draft: { minHeight: 150, textAlignVertical: 'top', fontSize: 22, lineHeight: 30 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  flex: { flexGrow: 1, flexBasis: 145 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: af.border, borderRadius: 24 },
  selected: { backgroundColor: af.red, borderColor: af.red },
  selectedText: { color: af.onRed },
  delta: { gap: 12, padding: 18, backgroundColor: af.surface, borderRadius: 12, borderWidth: 1, borderColor: af.border },
  understood: { gap: 6, padding: 18, backgroundColor: af.surface, borderRadius: 12, borderWidth: 1, borderColor: af.border },
  boundary: { gap: 6, padding: 18, backgroundColor: af.surface, borderRadius: 12, borderWidth: 1, borderColor: af.border },
  confirmation: { gap: 12, padding: 18, backgroundColor: af.surface, borderRadius: 12, borderWidth: 1, borderColor: af.border },
  openText: { color: af.redText, fontFamily: 'Inter_600SemiBold' },
  holdButton: { minHeight: 52, borderRadius: 10, backgroundColor: af.textPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  holdText: { ...afType.bodyStrong, color: af.canvas },
  error: { ...afType.body, color: af.redText },
});
