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
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
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
        <View style={styles.container}>
          <Text style={styles.eyebrow}>{t('auth.v2.eyebrow')}</Text>
          <Text style={styles.title}>{t('auth.v2.signin_title')}</Text>
          <Text style={styles.subtitle}>{t('auth.v2.signin_subtitle')}</Text>

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
          {submitError && <Text style={styles.error}>{submitError}</Text>}

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

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.v2.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={handleGoogle}
            disabled={oauthBusy || !isLoaded}
            style={({ pressed }) => [
              styles.oauthButton,
              (oauthBusy || !isLoaded) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.v2.continue_google')}
          >
            <Text style={styles.oauthButtonText}>
              {oauthBusy ? t('auth.v2.connecting') : t('auth.v2.continue_google')}
            </Text>
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>{t('auth.v2.signin_new_here')}</Text>
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
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  eyebrow: {
    fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 2,
    color: af.textTertiary, marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold', fontSize: 32, color: af.textPrimary, marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 14, color: af.textTertiary, marginBottom: 32,
  },
  label: {
    fontFamily: 'Inter_500Medium', fontSize: 12, color: af.textTertiary,
    marginTop: 16, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    color: af.textPrimary, fontFamily: 'Inter_500Medium', fontSize: 16,
    borderWidth: 1, borderColor: af.divider,
  },
  button: {
    marginTop: 28, paddingVertical: 16, borderRadius: 14,
    backgroundColor: af.red, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    fontFamily: 'Inter_700Bold', fontSize: 15, color: '#0A0A0F', letterSpacing: 0.5,
  },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: af.textTertiary },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: af.textPrimary },
  error: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: '#FF6B6B', marginTop: 6,
  },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 14,
  },
  dividerLine: {
    flex: 1, height: 1, backgroundColor: af.divider,
  },
  dividerText: {
    fontFamily: 'Inter_500Medium', fontSize: 11, color: af.textTertiary,
    marginHorizontal: 12, letterSpacing: 1, textTransform: 'uppercase',
  },
  oauthButton: {
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: af.divider,
  },
  oauthButtonText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: af.textPrimary,
    letterSpacing: 0.3,
  },
  acknowledgment: {
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16,
    color: af.textTertiary, textAlign: 'center',
    marginTop: 22, paddingHorizontal: 12,
  },
  acknowledgmentLink: {
    fontFamily: 'Inter_600SemiBold', color: af.textSecondary,
  },
});
