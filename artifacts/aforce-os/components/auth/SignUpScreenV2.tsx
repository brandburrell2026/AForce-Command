/**
 * Custom sign-up screen with email-code verification, laid out as the
 * approved prototype's three account screens:
 *
 *   choose — "Create your account": Google, or continue with email.
 *   email  — "Your email" (1 of 2): email and password.
 *   code   — "Check your email" (2 of 2): the 6-digit code.
 *
 * Kept from the older screen, because the prototype has no place for them
 * and nothing may become unreachable: the optional first name (on the email
 * step; the prototype asks it after the code) and the optional referral code
 * (behind "Have an invite code?" on the first step, so it still applies to
 * Google sign-up). Apple sign-in is not set up, so it is not offered.
 *
 * Uses @clerk/expo's `useSignUp` with the canonical create() →
 * sendEmailCode() → attemptEmailAddressVerification() → setActive()
 * flow. Stale-resource safe across log-out / log-back-in cycles
 * because each `handleStart` issues a fresh `signUp.create()` call.
 */

import React from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSSO, useAuth } from '@clerk/expo';
import { useSignUp } from '@clerk/expo/legacy';
import { Link, useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { useTranslation } from 'react-i18next';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { GradientBackground } from '@/components/GradientBackground';
import { af } from '@/theme';
import { extractClerkError } from '@/utils/clerkErrors';
import { claimReferral, setAuthTokenGetter } from '@workspace/api-client-react';

// Required by Clerk's OAuth/SSO flow on native to dismiss the in-app
// browser once the redirect lands.
WebBrowser.maybeCompleteAuthSession();

export function SignUpScreenV2() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
  // Presentation only: which of the two pre-verification screens is showing.
  const [emailStep, setEmailStep] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
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
      setSubmitError(err instanceof Error ? err.message : t('auth.v2.signup_err_google'));
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
      setSubmitError(extractClerkError(err) ?? t('auth.v2.signup_err_start'));
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
        setSubmitError(t('auth.v2.signup_err_verify_incomplete', { status: attempt.status }));
      }
    } catch (err: unknown) {
      setSubmitError(extractClerkError(err) ?? t('auth.v2.signup_err_verify_fallback'));
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
      setSubmitError(extractClerkError(err) ?? t('auth.v2.signup_err_resend'));
    }
  };

  const startDisabled = !isLoaded || !emailAddress || !password || submitting;
  const verifyDisabled = !isLoaded || !code || submitting;
  const stage: SignUpStage = pendingVerification ? 'code' : emailStep ? 'email' : 'choose';

  const goBack = () => {
    setSubmitError(null);
    if (stage === 'code') {
      // "Use a different email": the next Continue starts a fresh sign-up.
      setCode('');
      setPendingVerification(false);
    } else if (stage === 'email') {
      setEmailStep(false);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/welcome' as never);
    }
  };

  const errorLine = submitError ? (
    <Text style={styles.error} accessibilityLiveRegion="assertive" accessibilityRole="alert">
      {submitError}
    </Text>
  ) : null;

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          testID={`signup-${stage}`}
        >
          <View style={styles.topRow}>
            <Pressable
              onPress={goBack}
              style={({ pressed }) => [styles.back, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('auth.v2.back')}
              hitSlop={8}
              testID="signup-back"
            >
              <Icon name="chevron-left" size={18} color={af.textPrimary} />
              <Text style={styles.backText}>{t('auth.v2.back')}</Text>
            </Pressable>
            {stage !== 'choose' ? (
              <Text style={styles.stepLabel}>
                {t(stage === 'email' ? 'auth.v2.signup_step_1' : 'auth.v2.signup_step_2').toUpperCase()}
              </Text>
            ) : null}
          </View>

          {stage === 'choose' ? (
            <>
              <Text accessibilityRole="header" style={styles.title}>{t('auth.v2.signup_choose_title')}</Text>
              <Text style={styles.subtitle}>{t('auth.v2.signup_choose_sub')}</Text>

              <Pressable
                onPress={handleGoogle}
                disabled={oauthBusy || !isLoaded}
                style={({ pressed }) => [
                  styles.button,
                  (oauthBusy || !isLoaded) && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('auth.v2.continue_google')}
                testID="signup-google"
              >
                <View style={styles.oauthRow}>
                  <Text style={styles.oauthGlyph} accessibilityElementsHidden importantForAccessibility="no">G</Text>
                  <Text style={styles.buttonText}>
                    {oauthBusy ? t('auth.v2.connecting') : t('auth.v2.continue_google')}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => { setSubmitError(null); setEmailStep(true); }}
                style={({ pressed }) => [styles.ghostButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('auth.v2.signup_continue_email')}
                testID="signup-email"
              >
                <Text style={styles.ghostButtonText}>{t('auth.v2.signup_continue_email')}</Text>
              </Pressable>

              {errorLine}

              {inviteOpen ? (
                <>
                  <Text style={[styles.label, styles.inviteLabel]}>{t('auth.v2.signup_label_referral')}</Text>
                  <TextInput
                    style={styles.input}
                    value={referralCode}
                    onChangeText={(v) => setReferralCode(v.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder={t('auth.v2.signup_placeholder_referral')}
                    placeholderTextColor={af.textTertiary}
                    accessibilityLabel={t('auth.v2.signup_a11y_referral')}
                    maxLength={16}
                  />
                </>
              ) : (
                <Pressable
                  onPress={() => setInviteOpen(true)}
                  style={styles.quietLink}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.v2.signup_invite_toggle')}
                  testID="signup-invite-toggle"
                >
                  <Text style={styles.quietLinkText}>{t('auth.v2.signup_invite_toggle')}</Text>
                </Pressable>
              )}

              <View style={styles.spacer} />

              <Text style={styles.acknowledgment}>
                {t('auth.v2.ack_prefix_signup')}
                <Link href="/legal/terms"><Text style={styles.acknowledgmentLink}>{t('auth.v2.ack_terms')}</Text></Link>
                {t('auth.v2.ack_sep_comma')}
                <Link href="/legal/privacy"><Text style={styles.acknowledgmentLink}>{t('auth.v2.ack_privacy')}</Text></Link>
                {t('auth.v2.ack_sep_and')}
                <Link href="/legal/health-disclaimer"><Text style={styles.acknowledgmentLink}>{t('auth.v2.ack_health')}</Text></Link>
                {t('auth.v2.ack_suffix_signup')}
              </Text>

              <View style={styles.linkRow}>
                <Link href="/(auth)/sign-in" replace>
                  <Text style={styles.textButtonText}>{t('auth.v2.signup_have_account_cta')}</Text>
                </Link>
              </View>
            </>
          ) : null}

          {stage === 'email' ? (
            <>
              <Text accessibilityRole="header" style={[styles.title, styles.titleAlone]}>
                {t('auth.v2.signup_email_title')}
              </Text>

              <Text style={styles.label}>{t('auth.v2.label_email')}</Text>
              <TextInput
                style={styles.input}
                value={emailAddress}
                onChangeText={setEmailAddress}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
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
                autoComplete="new-password"
                placeholder={t('auth.v2.signup_placeholder_password_v3')}
                placeholderTextColor={af.textTertiary}
                accessibilityLabel={t('auth.v2.a11y_password')}
              />

              <Text style={styles.label}>{t('auth.v2.signup_label_firstname_optional')}</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
                placeholder={t('auth.v2.signup_label_firstname')}
                placeholderTextColor={af.textTertiary}
                accessibilityLabel={t('auth.v2.signup_a11y_firstname')}
              />
              {errorLine}

              <View style={styles.spacer} />

              <Pressable
                onPress={handleStart}
                disabled={startDisabled}
                style={({ pressed }) => [
                  styles.button,
                  startDisabled && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('auth.v2.signup_a11y_continue')}
                testID="signup-continue"
              >
                <Text style={styles.buttonText}>
                  {submitting ? t('auth.v2.signup_working') : t('auth.v2.signup_continue')}
                </Text>
              </Pressable>

              {/* Required for Clerk's bot sign-up protection */}
              <View nativeID="clerk-captcha" />
            </>
          ) : null}

          {stage === 'code' ? (
            <>
              <Text accessibilityRole="header" style={styles.title}>{t('auth.v2.signup_code_title')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.v2.signup_code_sub_prefix')}
                <Text style={styles.subtitleStrong}>{emailAddress}</Text>
                {t('auth.v2.signup_code_sub_suffix')}
              </Text>

              <Text style={styles.label}>{t('auth.v2.signup_label_code_v3')}</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor={af.textTertiary}
                accessibilityLabel={t('auth.v2.signup_a11y_code')}
              />
              {errorLine}

              <View style={styles.codeLinks}>
                <Pressable
                  onPress={handleResend}
                  style={({ pressed }) => [styles.quietLink, pressed && styles.buttonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.v2.signup_a11y_resend')}
                  testID="signup-resend"
                >
                  <Text style={styles.underlineLink}>{t('auth.v2.signup_resend')}</Text>
                </Pressable>
                <Pressable
                  onPress={goBack}
                  style={({ pressed }) => [styles.quietLink, pressed && styles.buttonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.v2.signup_change_email')}
                  testID="signup-change-email"
                >
                  <Text style={styles.quietLinkText}>{t('auth.v2.signup_change_email')}</Text>
                </Pressable>
              </View>

              <View style={styles.spacer} />

              <Pressable
                onPress={handleVerify}
                disabled={verifyDisabled}
                style={({ pressed }) => [
                  styles.button,
                  verifyDisabled && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('auth.v2.signup_a11y_verify')}
                testID="signup-verify"
              >
                <Text style={styles.buttonText}>
                  {submitting ? t('auth.v2.signup_verifying') : t('auth.v2.signup_verify')}
                </Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

export type SignUpStage = 'choose' | 'email' | 'code';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 8 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: af.textPrimary },
  stepLabel: {
    fontFamily: 'IBMPlexMono_400Regular', fontSize: 11, lineHeight: 14, letterSpacing: 2,
    color: af.textSecondary,
  },
  title: {
    fontFamily: 'Inter_600SemiBold', fontSize: 32, lineHeight: 34, letterSpacing: -0.96,
    color: af.textPrimary, marginTop: 18, marginBottom: 8,
  },
  titleAlone: { marginBottom: 22 },
  subtitle: {
    fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22,
    color: af.textSecondary, marginBottom: 24,
  },
  subtitleStrong: { color: af.textPrimary },
  label: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textSecondary, marginBottom: 6 },
  inviteLabel: { marginTop: 18 },
  input: {
    minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: af.border,
    backgroundColor: af.canvas, paddingHorizontal: 14,
    color: af.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 16, marginBottom: 14,
  },
  codeInput: { fontSize: 22, letterSpacing: 11, textAlign: 'center' },
  // Warm-white fill with black text, the same pair as AFPrimaryButton — 18:1.
  button: {
    minHeight: 52, borderRadius: 999, backgroundColor: af.primaryFill,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.onPrimaryFill },
  oauthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oauthGlyph: { fontFamily: 'Inter_700Bold', fontSize: 15, color: af.onPrimaryFill },
  ghostButton: {
    minHeight: 52, borderRadius: 999, borderWidth: 1, borderColor: af.border,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 10,
  },
  ghostButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  quietLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  quietLinkText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: af.textSecondary },
  underlineLink: {
    fontFamily: 'Inter_400Regular', fontSize: 14, color: af.textPrimary, textDecorationLine: 'underline',
  },
  codeLinks: { flexDirection: 'row', gap: 18 },
  spacer: { flexGrow: 1, minHeight: 24 },
  linkRow: { alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  textButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.textPrimary },
  error: { fontFamily: 'Inter_400Regular', fontSize: 13, color: af.redText, marginTop: 6, marginBottom: 6 },
  acknowledgment: {
    fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17,
    color: af.textSecondary, textAlign: 'center', marginTop: 14,
  },
  acknowledgmentLink: { color: af.textSecondary, textDecorationLine: 'underline' },
});
