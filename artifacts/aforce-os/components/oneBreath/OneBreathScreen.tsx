/**
 * One Breath — text-first containment surface for the approved editorial
 * concept. The current app has no microphone capture or speech-to-text
 * pipeline, so this screen never represents itself as listening. A member can
 * draft a moment locally and review it before any future authorized command
 * system is introduced. Nothing is persisted, transmitted, or executed here.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';

export function OneBreathScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [draft, setDraft] = React.useState('');
  const [reviewing, setReviewing] = React.useState(false);
  const canReview = draft.trim().length > 0;

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 30 }]}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="One Breath"
      >
        <View style={styles.topSignal} />
        <View style={styles.header}>
          <Text style={styles.wordmark}>AFORCE</Text>
          <Text style={styles.headerLabel}>ONE BREATH</Text>
        </View>

        <Text style={styles.eyebrow}>YOUR NEXT MOMENT</Text>
        <Text style={styles.title}>Say it in{`\n`}one breath.</Text>
        <Text style={styles.subtitle}>Write once. Review what AForce sees. Nothing is saved until a future approved command flow is available.</Text>

        <View style={styles.rule} />
        <View style={styles.modeRow}>
          <View style={styles.modeLeft}><View style={styles.modeMark} /><Text style={styles.modeLabel}>TYPE MODE</Text></View>
          <Text style={styles.modeTime}>LOCAL</Text>
        </View>
        <View style={styles.wave} accessibilityLabel="Voice capture is not enabled">
          {[10, 16, 24, 14, 30, 18, 26, 14, 34, 48, 30, 58, 40, 66, 34, 72, 44, 60, 28, 52, 38, 64, 26, 42, 20, 34, 14].map((height, index) => (
            <View key={index} style={[styles.waveBar, { height }, index > 7 && index < 21 && styles.waveBarActive]} />
          ))}
        </View>
        <View style={styles.rule} />

        <TextInput
          value={draft}
          onChangeText={(value) => { setDraft(value); setReviewing(false); }}
          placeholder="Describe the moment you want help preparing for."
          placeholderTextColor={af.textTertiary}
          multiline
          textAlignVertical="top"
          style={styles.input}
          accessibilityLabel="Draft your next moment"
        />
        <Text style={styles.localNote}>LOCAL DRAFT · NOT SAVED · NO VOICE CAPTURE</Text>

        {reviewing ? (
          <View style={styles.reviewCard} accessibilityRole="summary" accessibilityLabel="Draft review">
            <Text style={styles.reviewLabel}>REVIEW</Text>
            <Text style={styles.reviewText}>{draft.trim()}</Text>
            <Text style={styles.reviewNote}>Review only. No command, action, or data has been saved.</Text>
          </View>
        ) : null}

        <Pressable
          disabled={!canReview}
          onPress={() => setReviewing(true)}
          style={({ pressed }) => [styles.primary, !canReview && styles.primaryDisabled, pressed && canReview && styles.primaryPressed]}
          accessibilityRole="button"
          accessibilityLabel="Review draft"
        >
          <Text style={styles.primaryLabel}>Review draft</Text>
          <Text style={styles.primaryMark}>+</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Return to AForce">
          <Text style={styles.returnLink}>Return to AForce</Text>
        </Pressable>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 32, gap: 16, backgroundColor: af.canvas, minHeight: '100%' },
  topSignal: { position: 'absolute', top: 0, left: 32, width: 96, height: 3, backgroundColor: af.red },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  wordmark: { color: af.redText, fontFamily: 'Inter_800ExtraBold', fontSize: 16, letterSpacing: 0.8 },
  headerLabel: { color: af.textTertiary, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.8 },
  eyebrow: { color: af.redText, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.8, marginTop: 20 },
  title: { color: af.textPrimary, fontFamily: 'Inter_800ExtraBold', fontSize: 42, lineHeight: 46, letterSpacing: -0.7 },
  subtitle: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 21 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: af.divider, marginTop: 4 },
  modeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeLeft: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  modeMark: { width: 9, height: 9, backgroundColor: af.red },
  modeLabel: { color: af.redText, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.7 },
  modeTime: { color: af.textSecondary, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.7 },
  wave: { height: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 1 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: 'rgba(161,156,145,0.5)' },
  waveBarActive: { backgroundColor: af.red },
  input: { minHeight: 126, color: af.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 25, lineHeight: 34, padding: 0 },
  localNote: { color: af.textTertiary, fontFamily: 'Inter_500Medium', fontSize: 9, letterSpacing: 0.5 },
  reviewCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: af.divider, padding: 16, gap: 8, backgroundColor: af.surface },
  reviewLabel: { color: af.redText, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.8 },
  reviewText: { color: af.textPrimary, fontFamily: 'Inter_500Medium', fontSize: 17, lineHeight: 24 },
  reviewNote: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  primary: { height: 52, borderRadius: 6, backgroundColor: af.red, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  primaryDisabled: { opacity: 0.42 },
  primaryPressed: { opacity: 0.84 },
  primaryLabel: { color: af.onRed, fontFamily: 'Inter_600SemiBold', fontSize: 18 },
  primaryMark: { color: af.onRed, fontFamily: 'Inter_700Bold', fontSize: 24 },
  returnLink: { color: af.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center', paddingVertical: 8 },
});
