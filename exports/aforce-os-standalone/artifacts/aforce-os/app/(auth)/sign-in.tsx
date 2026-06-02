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
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { extractClerkError } from '@/utils/clerkErrors';

// Required by Clerk's OAuth/SSO flow on native to dismiss the in-app
// browser once the redirect lands.
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
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
      setSubmitError(err instanceof Error ? err.message : 'Google sign-in failed.');
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
        setSubmitError(`Additional verification required (${attempt.status}).`);
      }
    } catch (err: unknown) {
      // Clerk throws a structured error with a `errors[]` array; pull
      // the first user-facing message when available.
      const message = extractClerkError(err) ?? 'Sign-in failed. Please check your credentials.';
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
          <Text style={styles.eyebrow}>AFORCE OS</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your performance OS.</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={emailAddress}
            onChangeText={setEmailAddress}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={Colors.text.muted}
            accessibilityLabel="Email address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={Colors.text.muted}
            accessibilityLabel="Password"
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
            accessibilityLabel="Sign in"
          >
            <Text style={styles.buttonText}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
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
            accessibilityLabel="Continue with Google"
          >
            <Text style={styles.oauthButtonText}>
              {oauthBusy ? 'Connecting…' : 'Continue with Google'}
            </Text>
          </Pressable>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>New here? </Text>
            <Link href="/(auth)/sign-up" replace>
              <Text style={styles.link}>Create an account</Text>
            </Link>
          </View>

          <Text style={styles.acknowledgment}>
            By signing in you agree to our{' '}
            <Link href="/legal/terms"><Text style={styles.acknowledgmentLink}>Terms</Text></Link>
            ,{' '}
            <Link href="/legal/privacy"><Text style={styles.acknowledgmentLink}>Privacy Policy</Text></Link>
            , and{' '}
            <Link href="/legal/health-disclaimer"><Text style={styles.acknowledgmentLink}>Health Disclaimer</Text></Link>
            .
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
    color: Colors.text.muted, marginBottom: 8,
  },
  title: {
    fontFamily: 'Inter_700Bold', fontSize: 32, color: Colors.text.primary, marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 14, color: Colors.text.muted, marginBottom: 32,
  },
  label: {
    fontFamily: 'Inter_500Medium', fontSize: 12, color: Colors.text.muted,
    marginTop: 16, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    color: Colors.text.primary, fontFamily: 'Inter_500Medium', fontSize: 16,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  button: {
    marginTop: 28, paddingVertical: 16, borderRadius: 14,
    backgroundColor: Colors.text.primary, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    fontFamily: 'Inter_700Bold', fontSize: 15, color: '#0A0A0F', letterSpacing: 0.5,
  },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.text.muted },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: Colors.text.primary },
  error: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: '#FF6B6B', marginTop: 6,
  },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 14,
  },
  dividerLine: {
    flex: 1, height: 1, backgroundColor: Colors.border.subtle,
  },
  dividerText: {
    fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.text.muted,
    marginHorizontal: 12, letterSpacing: 1, textTransform: 'uppercase',
  },
  oauthButton: {
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  oauthButtonText: {
    fontFamily: 'Inter_600SemiBold', fontSize: 14, color: Colors.text.primary,
    letterSpacing: 0.3,
  },
  acknowledgment: {
    fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16,
    color: Colors.text.muted, textAlign: 'center',
    marginTop: 22, paddingHorizontal: 12,
  },
  acknowledgmentLink: {
    fontFamily: 'Inter_600SemiBold', color: Colors.text.secondary,
  },
});
