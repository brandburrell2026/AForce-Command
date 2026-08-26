/**
 * Password reset — S2-3(B), kept-promises pack.
 *
 * Before this screen existed the app had NO recovery path: a member who
 * forgot their password was locked out permanently (Stage-2 audit,
 * promise B). This is Clerk's own supported recovery strategy —
 * `reset_password_email_code` through the same `useSignIn` hook the
 * sign-in screen drives — NOT custom credential recovery: the code is
 * issued, verified, and the password rewritten entirely by Clerk.
 *
 * Two steps, one screen:
 *   request → `signIn.create({ strategy: 'reset_password_email_code' })`
 *   verify  → `signIn.attemptFirstFactor({ strategy, code, password })`
 *             → status 'complete' → setActive → straight into the app.
 * Accounts with a second factor surface the same honest MFA message the
 * sign-in screen uses rather than pretending the reset finished.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSignIn } from '@clerk/expo/legacy';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';
import { extractClerkError } from '@/utils/clerkErrors';

type Step = 'request' | 'verify';

export function ResetPasswordScreenV2() {
  const { t } = useTranslation();
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [step, setStep] = React.useState<Step>('request');
  const [emailAddress, setEmailAddress] = React.useState('');
  const [code, setCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const requestCode = async () => {
    if (!isLoaded || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: emailAddress.trim(),
      });
      setStep('verify');
    } catch (err) {
      setSubmitError(extractClerkError(err) ?? t('auth.v2.reset_err_fallback'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitNewPassword = async () => {
    if (!isLoaded || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(tabs)');
        return;
      }
      // e.g. needs_second_factor — same honest posture as sign-in's MFA case.
      setSubmitError(t('auth.v2.signin_err_mfa'));
    } catch (err) {
      setSubmitError(extractClerkError(err) ?? t('auth.v2.reset_err_fallback'));
    } finally {
      setSubmitting(false);
    }
  };

  const onRequest = step === 'request';
  const disabled =
    !isLoaded || submitting || (onRequest ? emailAddress.trim().length === 0 : code.trim().length === 0 || password.length === 0);

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.eyebrow}>{t('auth.v2.eyebrow')}</Text>
          <Text style={styles.title}>{t('auth.v2.reset_title')}</Text>
          <Text style={styles.subtitle}>
            {onRequest ? t('auth.v2.reset_subtitle_request') : t('auth.v2.reset_subtitle_verify')}
          </Text>

          {onRequest ? (
            <>
              <Text style={styles.label}>{t('auth.v2.label_email')}</Text>
              <TextInput
                style={styles.input}
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                placeholder={t('auth.v2.placeholder_email')}
                placeholderTextColor={af.textTertiary}
                accessibilityLabel={t('auth.v2.a11y_email')}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>{t('auth.v2.reset_label_code')}</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                placeholder={t('auth.v2.reset_placeholder_code')}
                placeholderTextColor={af.textTertiary}
                accessibilityLabel={t('auth.v2.reset_a11y_code')}
              />
              <Text style={styles.label}>{t('auth.v2.reset_label_new_password')}</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                placeholderTextColor={af.textTertiary}
                accessibilityLabel={t('auth.v2.reset_a11y_new_password')}
              />
            </>
          )}

          {submitError && (
            <Text
              style={styles.error}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {submitError}
            </Text>
          )}

          <Pressable
            onPress={onRequest ? requestCode : submitNewPassword}
            disabled={disabled}
            style={({ pressed }) => [
              styles.button,
              disabled && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={onRequest ? t('auth.v2.reset_send_code') : t('auth.v2.reset_submit')}
            testID="reset-password-submit"
          >
            <Text style={styles.buttonText}>
              {submitting
                ? t('auth.v2.reset_submitting')
                : onRequest
                  ? t('auth.v2.reset_send_code')
                  : t('auth.v2.reset_submit')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => (onRequest ? router.back() : setStep('request'))}
            style={styles.backLink}
            accessibilityRole="button"
            accessibilityLabel={t('auth.v2.reset_back')}
          >
            <Text style={styles.backLinkText}>{t('auth.v2.reset_back')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  eyebrow: {
    color: af.red, fontSize: 12, letterSpacing: 3, fontFamily: 'IBMPlexMono_500Medium',
    marginBottom: 10, textTransform: 'uppercase',
  },
  title: { color: af.textPrimary, fontSize: 32, fontFamily: 'ArchivoBlack_400Regular', marginBottom: 8 },
  subtitle: { color: af.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 24, lineHeight: 20 },
  label: {
    color: af.textTertiary, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase',
    fontFamily: 'IBMPlexMono_500Medium', marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: af.textPrimary, fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  error: { color: af.redText, fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 12 },
  button: {
    backgroundColor: af.red, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: af.onRed, fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 0.4 },
  backLink: { alignItems: 'center', marginTop: 18, minHeight: 44, justifyContent: 'center' },
  backLinkText: { color: af.textSecondary, fontSize: 13, fontFamily: 'Inter_500Medium' },
});
