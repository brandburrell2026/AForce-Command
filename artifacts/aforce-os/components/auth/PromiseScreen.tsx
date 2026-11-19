/**
 * PromiseScreen — the first thing a signed-out member sees, as in the
 * approved prototype: the mark, one promise, and two ways in.
 *
 * Presentation only. It asks for nothing and requests no permission; the two
 * buttons open the existing Clerk sign-up and sign-in screens unchanged.
 *
 * Differences from the prototype, on purpose:
 *   - No photograph behind it. Which photographs internal builds may use is
 *     an open founder decision, so the screen sits on the app's own canvas.
 *   - No word-by-word entrance. The copy is simply there.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';

/** Same mark as the cold-launch sequence (spec v1.8.2 Part 8.6, decision C5). */
export const PROMISE_WORDMARK = 'AFORCE OS™';

export function PromiseScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <GradientBackground>
      <View
        style={[styles.container, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 18 }]}
        testID="promise-screen"
      >
        <View style={styles.brand} accessible accessibilityLabel="AFORCE OS">
          <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.markGlyph}>N</Text>
            <View style={styles.markBar} />
            <Text style={[styles.markGlyph, styles.markMirrored]}>N</Text>
          </View>
          <Text style={styles.wordmark} accessibilityElementsHidden importantForAccessibility="no">
            {PROMISE_WORDMARK}
          </Text>
        </View>

        <View style={styles.spacer} />

        <Text style={styles.eyebrow}>{t('auth.v2.promise_eyebrow').toUpperCase()}</Text>
        <Text accessibilityRole="header" style={styles.headline}>
          {t('auth.v2.promise_title')}
        </Text>
        <Text style={styles.sub}>{t('auth.v2.promise_body')}</Text>

        <Pressable
          onPress={() => router.push('/(auth)/sign-up')}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('auth.v2.promise_create')}
          testID="promise-create"
        >
          <Text style={styles.buttonText}>{t('auth.v2.promise_create')}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(auth)/sign-in')}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('auth.v2.promise_signin')}
          testID="promise-signin"
        >
          <Text style={styles.textButtonText}>{t('auth.v2.promise_signin')}</Text>
        </Pressable>

        <Text style={styles.note}>{t('auth.v2.promise_privacy')}</Text>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 22 },
  brand: { alignItems: 'center', gap: 8, paddingTop: 6 },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markGlyph: { fontFamily: 'Inter_600SemiBold', fontSize: 22, lineHeight: 26, color: af.redText },
  markMirrored: { transform: [{ scaleX: -1 }] },
  markBar: { width: 2, height: 20, backgroundColor: af.red },
  wordmark: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, lineHeight: 14, letterSpacing: 2.6,
    color: af.textPrimary,
  },
  spacer: { flex: 1, minHeight: 24 },
  eyebrow: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, lineHeight: 14, letterSpacing: 2,
    color: af.textSecondary, marginBottom: 10,
  },
  headline: {
    fontFamily: 'Inter_600SemiBold', fontSize: 36, lineHeight: 39, letterSpacing: -0.72,
    color: af.textPrimary,
  },
  sub: {
    fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22,
    color: af.textSecondary, marginTop: 12, marginBottom: 26,
  },
  button: {
    minHeight: 52, borderRadius: 999, backgroundColor: af.primaryFill,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.onPrimaryFill },
  textButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  pressed: { opacity: 0.85 },
  note: {
    fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19,
    color: af.textSecondary, textAlign: 'center',
  },
});
