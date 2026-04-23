/**
 * Custom sign-in screen.
 *
 * Uses Clerk's `useSignIn` hook to drive an email + password flow. We
 * do NOT use the @clerk/clerk-react `<SignIn>` component because it
 * isn't available in @clerk/expo and would require a hosted redirect
 * that doesn't play well with Expo Go.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSignIn, useSSO } from '@clerk/expo';
import { Link, useRouter } from 'expo-router';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';

// Required by Clerk's OAuth/SSO flow on native to dismiss the in-app
// browser once the redirect lands.
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [oauthBusy, setOauthBusy] = React.useState(false);

  const handleGoogle = async () => {
    setSubmitError(null);
    setOauthBusy(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace('/(tabs)');
          },
        });
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setOauthBusy(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    try {
      await signIn.password({ emailAddress, password });
      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: ({ session }) => {
            if (session?.currentTask) return;
            router.replace('/(tabs)');
          },
        });
      } else {
        setSubmitError('Sign-in incomplete. Please try again.');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  };

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
          {errors?.fields?.identifier && (
            <Text style={styles.error}>{errors.fields.identifier.message}</Text>
          )}

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
          {errors?.fields?.password && (
            <Text style={styles.error}>{errors.fields.password.message}</Text>
          )}
          {submitError && <Text style={styles.error}>{submitError}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={!emailAddress || !password || fetchStatus === 'fetching'}
            style={({ pressed }) => [
              styles.button,
              (!emailAddress || !password || fetchStatus === 'fetching') && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text style={styles.buttonText}>
              {fetchStatus === 'fetching' ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={handleGoogle}
            disabled={oauthBusy}
            style={({ pressed }) => [
              styles.oauthButton,
              oauthBusy && styles.buttonDisabled,
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
});
