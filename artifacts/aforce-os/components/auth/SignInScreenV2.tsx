/**
 * Custom sign-in screen.
 *
 * Uses Clerk's `useSignIn` hook to drive an email + password flow with
 * the canonical create() + setActive() pattern. We do NOT use the
 * @clerk/clerk-react `<SignIn>` component because it isn't available
 * in @clerk/expo and would require a hosted redirect that doesn't
 * play well with Expo Go.
 *
 * Note on log-out -> log-back-in: every submit calls `signIn.create()`,
 * which starts a fresh sign-in attempt. This avoids the stale-resource
 * trap where a previous "complete" sign-in would block re-login.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSSO } from '@clerk/expo';
import { useSignIn } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';
import { extractClerkError } from '@/utils/clerkErrors';

// Required by Clerk's OAuth/SSO flow on native to dismiss the in-app
// browser once the redirect lands.
WebBrowser.maybeCompleteAuthSession();

export function SignInScreenV2() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [oauthBusy, setOauthBusy] = React.useState(false);

  const handleGoogle = async () => {
    setSubmitError(null);
    setOauthBusy(true);
    try {
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && ssoSetActive) {
        // The `navigate` callback shape from earlier @clerk/expo
        // versions is no longer reliably invoked; activate the
        // session, then route ourselves.
        await ssoSetActive({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('auth.v2.signin_err_google'));
    } finally {
      setOauthBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!isLoaded || !signIn || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const attempt = await signIn.create({
        identifier: emailAddress,
        password,
      });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/(tabs)');
      } else {
        // Multi-factor or other intermediate states; surface a clear
        // message rather than silently stalling.
        setSubmitError(t('auth.v2.signin_err_mfa', { status: attempt.status }));
      }
    } catch (err: unknown) {
      // Clerk throws a structured error with a `errors[]` array; pull
      // the first user-facing message when available.
      const message = extractClerkError(err) ?? t('auth.v2.signin_err_fallback');
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !isLoaded || !emailAddress || !password || submitting;

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* Laid out as the approved prototype's sign-in: the title, the
            sign-in-with button, the two fields, "Forgot password?", and
            Sign in at the foot. */}
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text accessibilityRole="header" style={styles.title}>{t('auth.v2.signin_title')}</Text>

          <Pressable
            onPress={handleGoogle}
            disabled={oauthBusy || !isLoaded}
            style={({ pressed }) => [
              styles.oauthButton,
              (oauthBusy || !isLoaded) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.v2.signin_google')}
          >
            <View style={styles.oauthRow}>
              <Text style={styles.oauthGlyph} accessibilityElementsHidden importantForAccessibility="no">G</Text>
              <Text style={styles.oauthButtonText}>
                {oauthBusy ? t('auth.v2.connecting') : t('auth.v2.signin_google')}
              </Text>
            </View>
          </Pressable>

          <Text style={styles.label}>{t('auth.v2.label_email')}</Text>
          <TextInput
            style={styles.input}
            value={emailAddress}
            onChangeText={setEmailAddress}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={t('auth.v2.placeholder_email')}
            placeholderTextColor={af.textTertiary}
            accessibilityLabel={t('auth.v2.a11y_email')}
          />

          <Text style={styles.label}>{t('auth.v2.label_password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={af.textTertiary}
            accessibilityLabel={t('auth.v2.a11y_password')}
          />
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
            onPress={() => router.push('/(auth)/reset-password')}
            style={styles.forgotLink}
            accessibilityRole="button"
            accessibilityLabel={t('auth.v2.forgot_password')}
            testID="signin-forgot-password"
          >
            <Text style={styles.forgotLinkText}>{t('auth.v2.forgot_password')}</Text>
          </Pressable>

          <View style={styles.spacer} />

          <Pressable
            onPress={handleSubmit}
            disabled={disabled}
            style={({ pressed }) => [
              styles.button,
              disabled && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.v2.signin_a11y')}
          >
            <Text style={styles.buttonText}>
              {submitting ? t('auth.v2.signin_submitting') : t('auth.v2.signin_submit')}
            </Text>
          </Pressable>

          {/* Not in the prototype's sign-in. "Create account" now lives on the
              promise screen, but sign-out and expired sessions land here
              directly, so the way to sign up stays as quiet text.
              The legal line is a compliance requirement. */}
          <View style={styles.linkRow}>
            <Link href="/(auth)/sign-up" replace>
              <Text style={styles.link}>{t('auth.v2.signin_create')}</Text>
            </Link>
          </View>

          <Text style={styles.acknowledgment}>
            {t('auth.v2.ack_prefix_signin')}
            <Link href="/legal/terms"><Text style={styles.acknowledgmentLink}>{t('auth.v2.ack_terms')}</Text></Link>
            {t('auth.v2.ack_sep_comma')}
            <Link href="/legal/privacy"><Text style={styles.acknowledgmentLink}>{t('auth.v2.ack_privacy')}</Text></Link>
            {t('auth.v2.ack_sep_and')}
            <Link href="/legal/health-disclaimer"><Text style={styles.acknowledgmentLink}>{t('auth.v2.ack_health')}</Text></Link>
            {t('auth.v2.ack_suffix_signin')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 22 },
  title: {
    fontFamily: 'Inter_600SemiBold', fontSize: 32, lineHeight: 34, letterSpacing: -0.96,
    color: af.textPrimary, marginTop: 62, marginBottom: 22,
  },
  oauthButton: {
    minHeight: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: af.border, marginBottom: 18, paddingHorizontal: 20,
  },
  oauthButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  oauthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oauthGlyph: { fontFamily: 'Inter_700Bold', fontSize: 15, color: af.textPrimary },
  label: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary, marginBottom: 6 },
  input: {
    minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.canvas, paddingHorizontal: 14,
    color: af.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 16, marginBottom: 14,
  },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, color: af.redText, marginBottom: 6 },
  forgotLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  forgotLinkText: {
    color: af.textPrimary, fontSize: 14, fontFamily: 'Inter_400Regular', textDecorationLine: 'underline',
  },
  spacer: { flexGrow: 1, minHeight: 24 },
  button: {
    minHeight: 52, borderRadius: 999, backgroundColor: af.primaryFill,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.85 },
  // Warm-white fill with black text, the same pair as AFPrimaryButton — 18:1.
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.onPrimaryFill },
  linkRow: { alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 6 },
  link: { fontFamily: 'Inter_500Medium', fontSize: 14, color: af.textSecondary },
  acknowledgment: {
    fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17,
    color: af.textSecondary, textAlign: 'center', marginTop: 8,
  },
  acknowledgmentLink: { color: af.textSecondary, textDecorationLine: 'underline' },
});
