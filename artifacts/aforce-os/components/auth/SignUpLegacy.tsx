/**
 * Custom sign-up screen with email-code verification.
 *
 * Uses @clerk/expo's `useSignUp` with the canonical create() →
 * sendEmailCode() → attemptEmailAddressVerification() → setActive()
 * flow. Stale-resource safe across log-out / log-back-in cycles
 * because each `handleStart` issues a fresh `signUp.create()` call.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSSO, useAuth } from '@clerk/expo';
import { useSignUp } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { GradientBackground } from '@/components/GradientBackground';
import { Colors } from '@/theme/colors';
import { extractClerkError } from '@/utils/clerkErrors';
import { claimReferral, setAuthTokenGetter } from '@workspace/api-client-react';

// Required by Clerk's OAuth/SSO flow on native to dismiss the in-app
// browser once the redirect lands.
WebBrowser.maybeCompleteAuthSession();

export function SignUpLegacy() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { getToken } = useAuth();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [referralCode, setReferralCode] = React.useState('');
  const [code, setCode] = React.useState('');
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [oauthBusy, setOauthBusy] = React.useState(false);

  /**
   * Best-effort referral attribution. Fires after a successful signup
   * (email-code or Google SSO). Failure is silent — referral is an
   * opt-in bonus, not a blocker for entering the app.
   *
   * We register the auth token getter preemptively because
   * ClerkAuthBridge's effect that does the same may not have fired by
   * the time this call ships. The bridge will overwrite our
   * registration on its next effect with an identical getter.
   */
  const tryClaimReferral = React.useCallback(async () => {
    const normalized = referralCode.trim().toUpperCase();
    if (normalized.length < 6) return;
    try {
      setAuthTokenGetter(() => getToken());
      await claimReferral({ code: normalized });
    } catch {
      // Intentional: unknown/duplicate/self codes are non-blocking.
    }
  }, [referralCode, getToken]);

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
        await tryClaimReferral();
        router.replace('/(tabs)');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Google sign-up failed.');
    } finally {
      setOauthBusy(false);
    }
  };

  const handleStart = async () => {
    if (!isLoaded || !signUp || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await signUp.create({
        emailAddress,
        password,
        ...(firstName ? { firstName } : {}),
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: unknown) {
      setSubmitError(extractClerkError(err) ?? 'Sign-up failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !signUp || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === 'complete') {
        await setActive({ session: attempt.createdSessionId });
        await tryClaimReferral();
        router.replace('/(tabs)');
      } else {
        setSubmitError(`Verification incomplete (${attempt.status}).`);
      }
    } catch (err: unknown) {
      setSubmitError(extractClerkError(err) ?? 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!isLoaded || !signUp) return;
    setSubmitError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err: unknown) {
      setSubmitError(extractClerkError(err) ?? 'Could not resend code.');
    }
  };

  const startDisabled = !isLoaded || !emailAddress || !password || submitting;
  const verifyDisabled = !isLoaded || !code || submitting;

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.eyebrow}>AFORCE OS</Text>
          <Text style={styles.title}>{pendingVerification ? 'Verify your email' : 'Create account'}</Text>
          <Text style={styles.subtitle}>
            {pendingVerification
              ? 'Enter the 6-digit code we just emailed you.'
              : 'Real-time human performance OS.'}
          </Text>

          {pendingVerification ? (
            <>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor={Colors.text.muted}
                accessibilityLabel="Verification code"
              />
              {submitError && <Text style={styles.error}>{submitError}</Text>}

              <Pressable
                onPress={handleVerify}
                disabled={verifyDisabled}
                style={({ pressed }) => [
                  styles.button,
                  verifyDisabled && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Verify code"
              >
                <Text style={styles.buttonText}>
                  {submitting ? 'Verifying…' : 'Verify'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleResend}
                style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Resend verification code"
              >
                <Text style={styles.link}>Resend code</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>First name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                placeholder="Brandon"
                placeholderTextColor={Colors.text.muted}
                accessibilityLabel="First name"
              />

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
                placeholder="At least 8 characters"
                placeholderTextColor={Colors.text.muted}
                accessibilityLabel="Password"
              />

              <Text style={styles.label}>Referral code (optional)</Text>
              <TextInput
                style={styles.input}
                value={referralCode}
                onChangeText={(v) => setReferralCode(v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="e.g. K7M2P4Q9"
                placeholderTextColor={Colors.text.muted}
                accessibilityLabel="Referral code"
                maxLength={16}
              />
              {submitError && <Text style={styles.error}>{submitError}</Text>}

              <Pressable
                onPress={handleStart}
                disabled={startDisabled}
                style={({ pressed }) => [
                  styles.button,
                  startDisabled && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue"
              >
                <Text style={styles.buttonText}>
                  {submitting ? 'Working…' : 'Continue'}
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
                <Text style={styles.linkText}>Already have an account? </Text>
                <Link href="/(auth)/sign-in" replace>
                  <Text style={styles.link}>Sign in</Text>
                </Link>
              </View>

              <Text style={styles.acknowledgment}>
                By creating an account you agree to our{' '}
                <Link href="/legal/terms"><Text style={styles.acknowledgmentLink}>Terms</Text></Link>
                ,{' '}
                <Link href="/legal/privacy"><Text style={styles.acknowledgmentLink}>Privacy Policy</Text></Link>
                , and{' '}
                <Link href="/legal/health-disclaimer"><Text style={styles.acknowledgmentLink}>Health Disclaimer</Text></Link>
                . AForce OS is a performance and wellness tool — not medical advice.
              </Text>

              {/* Required for Clerk's bot sign-up protection */}
              <View nativeID="clerk-captcha" />
            </>
          )}
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
  linkBtn: { alignItems: 'center', marginTop: 14 },
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
