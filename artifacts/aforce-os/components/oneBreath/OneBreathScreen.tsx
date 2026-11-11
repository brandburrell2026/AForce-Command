/**
 * One Breath — the native version of the AFORCE OS ask → heard → seal flow.
 *
 * This surface deliberately remains text-first. The website's microphone is a
 * product preview; AFORCE OS does not yet have an authorised voice-capture or
 * transcription pipeline. A member's words therefore remain local to this
 * mounted screen and are never persisted, transmitted, scheduled, or shared.
 */
import React from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GradientBackground } from '@/components/GradientBackground';
import { af, withAlpha } from '@/theme';

type OneBreathStep = 'ask' | 'heard' | 'seal' | 'sealed';

const EXAMPLES = [
  'Morning lift tomorrow at 6:30. I want to start on time.',
  'Big presentation Thursday at 10. I want to be sharp, not rushed.',
  'Flight to LA Saturday at 9:05. I want to arrive rested.',
] as const;

const STEP_LABEL: Record<OneBreathStep, string> = {
  ask: '01 · ONE BREATH',
  heard: '02 · WHAT I HEARD',
  seal: '03 · SEAL',
  sealed: 'REVIEWED',
};

export function OneBreathScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const draftRef = React.useRef<TextInput>(null);
  const holdProgress = React.useRef(new Animated.Value(0)).current;
  const [step, setStep] = React.useState<OneBreathStep>('ask');
  const [draft, setDraft] = React.useState('');
  const [holding, setHolding] = React.useState(false);
  const canContinue = draft.trim().length > 0;

  React.useEffect(() => () => holdProgress.stopAnimation(), [holdProgress]);

  const showHeard = React.useCallback(() => {
    if (!canContinue) {
      draftRef.current?.focus();
      return;
    }
    setStep('heard');
  }, [canContinue]);

  const completeReview = React.useCallback(() => {
    setHolding(false);
    holdProgress.setValue(1);
    setStep('sealed');
  }, [holdProgress]);

  const beginHold = React.useCallback(() => {
    if (holding) return;
    setHolding(true);
    holdProgress.setValue(0);
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) completeReview();
    });
  }, [completeReview, holdProgress, holding]);

  const cancelHold = React.useCallback(() => {
    if (!holding) return;
    holdProgress.stopAnimation();
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 140,
      useNativeDriver: false,
    }).start();
    setHolding(false);
  }, [holdProgress, holding]);

  const chooseExample = React.useCallback((value: string) => {
    setDraft(value);
    setStep('ask');
  }, []);

  const renderAsk = () => (
    <>
      <Text style={styles.kicker}>YOUR NEXT MOMENT</Text>
      <Text accessibilityRole="header" style={styles.title}>What&apos;s{'\n'}coming?</Text>
      <Text style={styles.subtitle}>Write it in one breath. You will review every word before anything else happens.</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Write your moment"
        onPress={() => draftRef.current?.focus()}
        style={styles.orbArea}
      >
        <View style={styles.orbOuter}>
          <View style={styles.orbInner}>
            <Text style={styles.orbMark}>N–И</Text>
          </View>
        </View>
        <Text style={styles.orbLabel}>TAP TO TYPE</Text>
      </Pressable>

      <View style={styles.draftSection}>
        <Text style={styles.inputLabel}>SAY IT YOUR WAY</Text>
        <TextInput
          ref={draftRef}
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            setStep('ask');
          }}
          placeholder="Dinner tonight at 8. I want to be present."
          placeholderTextColor={af.textTertiary}
          multiline
          maxLength={180}
          textAlignVertical="top"
          style={styles.input}
          accessibilityLabel="Draft your next moment"
        />
        <Text style={styles.localNote}>LOCAL DRAFT · NOT SAVED · NO VOICE CAPTURE</Text>
      </View>

      <View style={styles.exampleSection}>
        <Text style={styles.exampleLabel}>TRY AN EXAMPLE</Text>
        {EXAMPLES.map((example) => (
          <Pressable
            key={example}
            accessibilityRole="button"
            accessibilityLabel={`Use example: ${example}`}
            onPress={() => chooseExample(example)}
            style={({ pressed }) => [styles.example, pressed && styles.pressed]}
          >
            <Text style={styles.exampleText}>{example}</Text>
            <Text style={styles.exampleArrow}>↗</Text>
          </Pressable>
        ))}
      </View>

      <PrimaryAction label="See what AFORCE heard" onPress={showHeard} disabled={!canContinue} />
    </>
  );

  const renderHeard = () => (
    <>
      <Text style={styles.kicker}>YOUR WORDS, WORD FOR WORD</Text>
      <Text accessibilityRole="header" style={styles.title}>What I{'\n'}heard.</Text>
      <Text style={styles.transcript}>{draft.trim()}</Text>
      <Text style={styles.adjustNote}>Adjust anything before you continue.</Text>

      <View style={styles.understoodCard}>
        <Text style={styles.cardEyebrow}>AFORCE UNDERSTOOD</Text>
        <FactRow label="Moment" value="Your next moment" />
        <FactRow label="Details" value="Kept exactly as you wrote them" last />
      </View>

      <PrimaryAction label="Looks right" onPress={() => setStep('seal')} />
      <Pressable onPress={() => setStep('ask')} accessibilityRole="button" style={styles.secondaryAction}>
        <Text style={styles.secondaryLabel}>Adjust</Text>
      </Pressable>
    </>
  );

  const renderSeal = () => (
    <>
      <Text style={styles.kicker}>NOTHING CHANGES UNTIL YOU SEAL</Text>
      <Text accessibilityRole="header" style={styles.title}>Review{'\n'}your moment.</Text>
      <View style={styles.sealStatement}>
        <Text style={styles.sealDraft}>{draft.trim()}</Text>
      </View>

      <View style={styles.understoodCard}>
        <Text style={styles.cardEyebrow}>REVIEWING WILL</Text>
        <Text style={styles.listLine}>Keep this draft visible for this session.</Text>
        <Text style={styles.listLine}>Create no reminder, health entry, or Circle post.</Text>
        <Text style={styles.listLine}>Send nothing to AFORCE or anyone else.</Text>
        <Text style={styles.reviewTruth}>Review only. No command, action, or data has been saved.</Text>
      </View>

      <Pressable
        onPressIn={beginHold}
        onPressOut={cancelHold}
        accessibilityRole="button"
        accessibilityLabel="Hold to review your local draft"
        style={({ pressed }) => [styles.holdButton, (pressed || holding) && styles.holdButtonPressed]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.holdFill,
            { width: holdProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
        <View pointerEvents="none" style={styles.holdContent}>
          <Text style={styles.holdLabel}>{holding ? 'Keep holding…' : 'Hold to review'}</Text>
          <Text style={styles.holdMeta}>PRESS AND HOLD</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => completeReview()}
        accessibilityRole="button"
        style={styles.secondaryAction}
      >
        <Text style={styles.secondaryLabel}>Review with one tap instead</Text>
      </Pressable>
    </>
  );

  const renderSealed = () => (
    <View style={styles.complete}>
      <View style={styles.completeMark}><Text style={styles.completeMarkText}>N–И</Text></View>
      <Text style={styles.kicker}>REVIEWED</Text>
      <Text accessibilityRole="header" style={[styles.title, styles.completeTitle]}>You&apos;re{'\n'}ready.</Text>
      <Text style={[styles.subtitle, styles.completeCopy]}>Your words stayed on this device. Nothing was saved, scheduled, or shared.</Text>
      <View style={styles.completeRule} />
      <Text style={styles.completeDraft}>{draft.trim()}</Text>
      <PrimaryAction label="Return to AFORCE" onPress={() => router.back()} />
      <Pressable onPress={() => { setDraft(''); setStep('ask'); }} accessibilityRole="button" style={styles.secondaryAction}>
        <Text style={styles.secondaryLabel}>Try another moment</Text>
      </Pressable>
    </View>
  );

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 34 }]}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="One Breath"
      >
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${step === 'ask' ? 25 : step === 'heard' ? 50 : step === 'seal' ? 75 : 100}%` }]} /></View>
        <View style={styles.header}>
          <View><Text style={styles.wordmark}>AFORCE</Text><Text style={styles.headerLabel}>{STEP_LABEL[step]}</Text></View>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close One Breath" hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        {step === 'ask' ? renderAsk() : null}
        {step === 'heard' ? renderHeard() : null}
        {step === 'seal' ? renderSeal() : null}
        {step === 'sealed' ? renderSealed() : null}
      </ScrollView>
    </GradientBackground>
  );
}

function FactRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.factRow, !last && styles.factRule]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function PrimaryAction({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.primary, disabled && styles.primaryDisabled, pressed && !disabled && styles.primaryPressed]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
      <Text style={styles.primaryArrow}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { minHeight: '100%', paddingHorizontal: 24, backgroundColor: af.canvas, gap: 18 },
  progressTrack: { height: 2, marginHorizontal: -24, backgroundColor: af.divider },
  progressFill: { height: 2, backgroundColor: af.red },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 },
  wordmark: { color: af.redText, fontFamily: 'Inter_800ExtraBold', fontSize: 16, letterSpacing: 0.8 },
  headerLabel: { color: af.textTertiary, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.2, marginTop: 5 },
  close: { color: af.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 14, paddingVertical: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: af.divider },
  kicker: { color: af.redText, fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.4, marginTop: 8 },
  title: { color: af.textPrimary, fontFamily: 'Inter_800ExtraBold', fontSize: 42, lineHeight: 45, letterSpacing: -1.1, marginTop: -4 },
  subtitle: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, maxWidth: 335 },
  orbArea: { alignItems: 'center', paddingVertical: 10, minHeight: 190, justifyContent: 'center' },
  orbOuter: { width: 136, height: 136, borderRadius: 68, padding: 8, backgroundColor: withAlpha(af.red, 0.14), borderColor: withAlpha(af.red, 0.58), borderWidth: 1 },
  orbInner: { flex: 1, borderRadius: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: af.red, shadowColor: af.red, shadowOpacity: 0.46, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  orbMark: { color: af.onRed, fontFamily: 'Inter_800ExtraBold', fontSize: 23, letterSpacing: -1 },
  orbLabel: { color: af.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.4, marginTop: 13 },
  draftSection: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: af.divider, paddingVertical: 14, gap: 8 },
  inputLabel: { color: af.textTertiary, fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.2 },
  input: { minHeight: 92, color: af.textPrimary, fontFamily: 'Inter_500Medium', fontSize: 20, lineHeight: 28, padding: 0 },
  localNote: { color: af.textTertiary, fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 0.7 },
  exampleSection: { gap: 8 },
  exampleLabel: { color: af.textTertiary, fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.2 },
  example: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: af.divider, gap: 14 },
  exampleText: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, flex: 1 },
  exampleArrow: { color: af.redText, fontFamily: 'Inter_600SemiBold', fontSize: 17 },
  pressed: { opacity: 0.72 },
  primary: { minHeight: 56, borderRadius: 6, backgroundColor: af.red, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  primaryDisabled: { opacity: 0.36 },
  primaryPressed: { opacity: 0.84 },
  primaryLabel: { color: af.onRed, fontFamily: 'Inter_700Bold', fontSize: 17 },
  primaryArrow: { color: af.onRed, fontFamily: 'Inter_700Bold', fontSize: 21 },
  transcript: { color: af.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 25, lineHeight: 34, letterSpacing: -0.35, marginTop: 4 },
  adjustNote: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginTop: -8 },
  understoodCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: af.borderStrong, backgroundColor: af.surface, padding: 16, gap: 8, marginTop: 6 },
  cardEyebrow: { color: af.redText, fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.2, marginBottom: 3 },
  factRow: { flexDirection: 'row', gap: 16, paddingVertical: 11, justifyContent: 'space-between' },
  factRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: af.divider },
  factLabel: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14, minWidth: 68 },
  factValue: { color: af.textPrimary, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, flex: 1, textAlign: 'right' },
  secondaryAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { color: af.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 14 },
  sealStatement: { borderLeftWidth: 2, borderLeftColor: af.red, paddingLeft: 15, marginTop: 2 },
  sealDraft: { color: af.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 21, lineHeight: 29, letterSpacing: -0.25 },
  listLine: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, paddingLeft: 14 },
  reviewTruth: { color: af.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 5 },
  holdButton: { height: 112, borderWidth: 1, borderColor: withAlpha(af.red, 0.8), borderRadius: 56, overflow: 'hidden', justifyContent: 'center', backgroundColor: withAlpha(af.red, 0.06), marginTop: 6 },
  holdButtonPressed: { borderColor: af.red },
  holdFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: af.red },
  holdContent: { alignItems: 'center', justifyContent: 'center', gap: 5 },
  holdLabel: { color: af.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 18 },
  holdMeta: { color: af.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.1 },
  complete: { alignItems: 'center', flex: 1, paddingTop: 45, gap: 18 },
  completeMark: { width: 72, height: 72, borderRadius: 36, backgroundColor: af.red, alignItems: 'center', justifyContent: 'center', shadowColor: af.red, shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  completeMarkText: { color: af.onRed, fontFamily: 'Inter_800ExtraBold', fontSize: 16 },
  completeTitle: { textAlign: 'center' },
  completeCopy: { textAlign: 'center' },
  completeRule: { width: 48, height: 2, backgroundColor: af.red, marginTop: 4 },
  completeDraft: { color: af.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 300 },
});
