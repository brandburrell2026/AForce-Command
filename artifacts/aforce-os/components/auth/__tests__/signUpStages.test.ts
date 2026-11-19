/**
 * Sign-up laid out as the approved prototype's three account screens.
 * Source-level: the component pulls in react-native and Clerk, which do not
 * load in node. What is pinned here is that the restyle changed the layout
 * and nothing about how an account is created.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const SRC = read('components/auth/SignUpScreenV2.tsx');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const en = JSON.parse(read('locales/en.json')).auth.v2 as Record<string, string>;
const between = (a: string, b: string) => CODE.slice(CODE.indexOf(a), CODE.indexOf(b));

const CHOOSE = between("{stage === 'choose' ? (", "{stage === 'email' ? (");
const EMAIL = between("{stage === 'email' ? (", "{stage === 'code' ? (");
const VERIFY = CODE.slice(CODE.indexOf("{stage === 'code' ? ("));

describe('the prototype\'s copy', () => {
  it.each([
    ['signup_choose_title', 'Create your account'],
    ['signup_choose_sub', 'One account. Your data stays yours.'],
    ['signup_continue_email', 'Continue with email'],
    ['signup_have_account_cta', 'I already have an account'],
    ['signup_step_1', '1 of 2'],
    ['signup_step_2', '2 of 2'],
    ['signup_email_title', 'Your email'],
    ['signup_placeholder_password_v3', '8 characters or more'],
    ['signup_code_title', 'Check your email'],
    ['signup_code_sub_prefix', 'We sent a 6-digit code to '],
    ['signup_label_code_v3', 'Code'],
    ['signup_change_email', 'Use a different email'],
    ['signup_resend', 'Resend code'],
    ['signup_verify', 'Verify'],
    ['continue_google', 'Continue with Google'],
  ])('%s', (key, value) => {
    expect(en[key]).toBe(value);
    expect(CODE).toContain(`auth.v2.${key}`);
  });

  it('every key the screen reads exists in every locale file', () => {
    const keys = [...new Set([...CODE.matchAll(/auth\.v2\.([a-z0-9_]+)/g)].map((m) => m[1]))];
    expect(keys.length).toBeGreaterThan(20);
    for (const f of readdirSync(join(ROOT, 'locales')).filter((n) => n.endsWith('.json'))) {
      const v2 = JSON.parse(read(`locales/${f}`)).auth.v2 as Record<string, string>;
      for (const k of keys) expect(v2[k], `${f} ${k}`).toBeTypeOf('string');
    }
  });
});

describe('three screens, in the prototype\'s order', () => {
  it('the stage follows the existing verification state', () => {
    expect(CODE).toContain("pendingVerification ? 'code' : emailStep ? 'email' : 'choose'");
  });

  it('choose: Google, continue with email, the legal line, and the way to sign in', () => {
    expect(CHOOSE).toContain('onPress={handleGoogle}');
    expect(CHOOSE).toContain('setEmailStep(true)');
    for (const href of ['/legal/terms', '/legal/privacy', '/legal/health-disclaimer', '/(auth)/sign-in']) {
      expect(CHOOSE, href).toContain(`href="${href}"`);
    }
    // No fields until the member asks for the invite code.
    expect(CHOOSE.match(/<TextInput/g)).toHaveLength(1);
    expect(CHOOSE).toMatch(/\{inviteOpen \? \([\s\S]*<TextInput/);
  });

  it('email: email and password, Continue at the foot, the bot-protection node', () => {
    expect(EMAIL).toContain('onChangeText={setEmailAddress}');
    expect(EMAIL).toContain('onChangeText={setPassword}');
    expect(EMAIL).toContain('onPress={handleStart}');
    expect(EMAIL).toContain('nativeID="clerk-captcha"');
    expect(EMAIL.indexOf('styles.spacer')).toBeLessThan(EMAIL.indexOf('onPress={handleStart}'));
  });

  it('code: six digits only, Resend, Use a different email, Verify', () => {
    expect(VERIFY).toContain("v.replace(/\\D/g, '').slice(0, 6)");
    expect(VERIFY).toContain('maxLength={6}');
    expect(VERIFY).toContain('onPress={handleResend}');
    expect(VERIFY).toContain('onPress={handleVerify}');
    expect(VERIFY).toContain('testID="signup-change-email"');
    expect(VERIFY).toContain('{emailAddress}');
  });

  it('Back steps code → email → choose, then leaves the screen', () => {
    const back = between('const goBack = () => {', 'const errorLine');
    expect(back).toMatch(/stage === 'code'[\s\S]*setPendingVerification\(false\)[\s\S]*stage === 'email'[\s\S]*setEmailStep\(false\)[\s\S]*router\.back\(\)/);
  });

  it('does not offer Apple sign-in, which is not set up', () => {
    expect(CODE).not.toMatch(/oauth_apple|with Apple/i);
  });
});

describe('nothing about creating an account changed', () => {
  it('the Clerk calls are the same ones, in the same order', () => {
    const start = between('const handleStart', 'const handleVerify');
    expect(start).toContain('signUp.create({ emailAddress, password })');
    expect(start).toContain("signUp.prepareEmailAddressVerification({ strategy: 'email_code' })");
    const verify = between('const handleVerify', 'const handleResend');
    expect(verify).toContain('signUp.attemptEmailAddressVerification({ code })');
    expect(verify).toMatch(/setActive\(\{ session: attempt\.createdSessionId \}\);\s*await tryClaimReferral\(\);\s*router\.replace\('\/\(tabs\)'\)/);
    expect(CODE).toContain("strategy: 'oauth_google'");
  });

  it('nothing became unreachable: the referral code is still asked, and the name moved to first run', () => {
    expect(CODE).not.toContain('firstName');
    expect(read('components/onboarding/OnboardingScreenV2.tsx')).toContain("clerkUser.update({ firstName: next })");
    expect(CHOOSE).toContain('setReferralCode(v.toUpperCase())');
    // The referral field sits with the Google button, so it still applies to Google sign-up.
    expect(between('const handleGoogle', 'const handleStart')).toContain('await tryClaimReferral()');
  });

  it('uses theme tokens only', () => {
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CODE).not.toMatch(/rgba?\(/);
  });
});
