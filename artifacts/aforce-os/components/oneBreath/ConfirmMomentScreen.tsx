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
import type { MomentType } from '@/types/moments';

const TYPES: MomentType[] = ['work', 'training', 'travel', 'recovery', 'personal', 'performance'];

export function ConfirmMomentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useMomentsStore();
  const [scope] = React.useState(captureScope);
  const [text, setText] = React.useState('');
  const [draft, setDraft] = React.useState<MomentDraft | null>(null);
  const [error, setError] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const confirming = React.useRef(false);
  React.useEffect(() => { if (!store.hydrated) void hydrateMoments(); }, [store.hydrated]);

  const update = <K extends keyof MomentDraft>(key: K, value: MomentDraft[K]) => {
    setDraft((previous) => previous ? { ...previous, [key]: value } : previous);
    setError('');
  };
  const confirm = () => {
    if (!draft || confirming.current) return;
    if (!isScopeCurrent(scope) || getScopeState().status !== 'AUTHENTICATED') {
      setError('Your account changed. Return to Home and start a new plan.');
      return;
    }
    if (!store.hydrated) { setError('Your saved moments are still loading. Try again shortly.'); return; }
    const result = validateMomentDraft(draft);
    if (!result.ok) { setError(result.error); return; }
    confirming.current = true;
    addMoment(createConfirmedMoment(draft, result.startAtIso));
    setSaved(true);
  };
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 36 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.brand}>AFORCE</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.touch}><Text style={styles.quiet}>Close</Text></Pressable>
      </View>
      <Text style={styles.eyebrow}>ONE BREATH / TYPE MODE</Text>
      <Text accessibilityRole="header" style={styles.title}>{saved ? 'Your moment.\nIn your plan.' : draft ? 'Make it yours.' : 'One moment.\nOne clear plan.'}</Text>
      {saved ? (
        <>
          <Text style={styles.body}>{draft?.title} is now in Moments on this device. Preparation appears when AForce has an eligible action.</Text>
          <AFPrimaryButton label="Open Moments" onPress={() => router.replace('/moments-tab')} testID="confirmed-open-moments" />
          <AFSecondaryButton label="Return Home" onPress={() => router.replace('/')} />
        </>
      ) : draft ? (
        <>
          <Text style={styles.body}>Review every field. Nothing is saved until you confirm.</Text>
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
          <View style={styles.delta}>
            <Text style={styles.eyebrow}>BEFORE YOU CONFIRM</Text>
            <Text style={styles.body}>Adds one Moment to your plan on this device. AForce uses your existing signals to show an eligible preparation action.</Text>
            <Text style={styles.quiet}>Does not log water, change HydroState, book travel, share with Circle, or write to your calendar. Existing reminder preferences still apply.</Text>
          </View>
          {draft.type === 'travel' ? <AFSecondaryButton label="Add or manage a flight instead" onPress={() => router.push('/travel')} /> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <AFPrimaryButton label="Confirm plan" onPress={confirm} disabled={!store.hydrated} testID="confirm-moment-plan" />
          <AFSecondaryButton label="Back to draft" onPress={() => { setDraft(null); setError(''); }} />
        </>
      ) : (
        <>
          <Text style={styles.body}>Write what’s coming up. Then choose its date and time, review, and confirm.</Text>
          <TextInput accessibilityLabel="Describe your moment" placeholder="Dinner with the team. I want to arrive relaxed." placeholderTextColor={af.textTertiary} multiline value={text} onChangeText={setText} maxLength={160} style={[styles.input, styles.draft]} />
          <Text style={styles.quiet}>Local draft · No microphone recording</Text>
          <AFPrimaryButton label="Review my moment" disabled={!text.trim()} onPress={() => setDraft({ title: text.trim(), date: '', time: '', type: 'personal', prepGoal: '' })} testID="review-moment-draft" />
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
  error: { ...afType.body, color: af.redText },
});
