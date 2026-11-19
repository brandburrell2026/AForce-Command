/**
 * The promise screen — the approved prototype's opening screen for a
 * signed-out member. Source-level: the component pulls in react-native, which
 * does not load in node.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const SCREEN = read('components/auth/PromiseScreen.tsx');
const CODE = SCREEN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const en = JSON.parse(read('locales/en.json')).auth.v2 as Record<string, string>;

describe('promise screen — the prototype\'s copy, word for word', () => {
  it.each([
    ['promise_eyebrow', 'The ritual before performance'],
    ['promise_title', 'Every moment has a moment before it.'],
    ['promise_body', 'Take the pause. Plan what comes next. Then go perform.'],
    ['promise_create', 'Create account'],
    ['promise_signin', 'I have an account'],
    ['promise_privacy', 'No health data, mic, camera or location until you say yes.'],
  ])('%s', (key, value) => {
    expect(en[key]).toBe(value);
    expect(CODE).toContain(`t('auth.v2.${key}')`);
  });

  it('every locale file carries the six keys', () => {
    for (const f of readdirSync(join(ROOT, 'locales')).filter((n) => n.endsWith('.json'))) {
      const v2 = JSON.parse(read(`locales/${f}`)).auth.v2 as Record<string, string>;
      for (const k of ['promise_eyebrow', 'promise_title', 'promise_body', 'promise_create', 'promise_signin', 'promise_privacy']) {
        expect(v2[k], `${f} ${k}`).toBeTruthy();
      }
    }
  });

  it('carries the same mark as the cold-launch sequence', () => {
    expect(CODE).toContain("PROMISE_WORDMARK = 'AFORCE OS™'");
    expect(read('components/opening/OpeningSequence.tsx')).toContain("OS_WORDMARK = 'AFORCE OS™'");
    // The right-hand N is the mirrored one.
    expect(CODE).toMatch(/markMirrored: \{ transform: \[\{ scaleX: -1 \}\] \}/);
  });
});

describe('promise screen — two ways in, nothing else', () => {
  it('"Create account" opens sign-up and "I have an account" opens sign-in', () => {
    expect(CODE).toMatch(/router\.push\('\/\(auth\)\/sign-up'\)[\s\S]{0,400}testID="promise-create"/);
    expect(CODE).toMatch(/router\.push\('\/\(auth\)\/sign-in'\)[\s\S]{0,400}testID="promise-signin"/);
    expect(CODE.match(/router\.(push|replace)\(/g)).toHaveLength(2);
  });

  it('asks for nothing: no permission, sensor, storage or auth call', () => {
    for (const banned of [
      'expo-location', 'expo-camera', 'expo-notifications', 'expo-av', 'expo-audio',
      'AsyncStorage', 'useSignIn', 'useSignUp', 'useSSO', 'requestPermission', 'TextInput',
    ]) {
      expect(CODE, banned).not.toContain(banned);
    }
  });

  it('uses theme tokens only', () => {
    expect(CODE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CODE).not.toMatch(/rgba?\(/);
  });
});

describe('launch routing', () => {
  const INDEX = read('app/index.tsx');
  it('a signed-out cold launch lands on the promise screen', () => {
    expect(INDEX).toContain("<Redirect href={'/(auth)/welcome' as never} />");
    expect(INDEX).toMatch(/!isSignedIn && !DEMO_MODE && !CAPTURE_MODE/);
  });

  it('the route renders the screen and nothing else', () => {
    expect(read('app/(auth)/welcome.tsx')).toContain('return <PromiseScreen />;');
  });

  it('the auth group still bounces a signed-in member out', () => {
    expect(read('app/(auth)/_layout.tsx')).toContain("<Redirect href={'/(tabs)' as never} />");
  });

  it('sign-in keeps its own way to sign up, for members who land there directly', () => {
    expect(read('components/auth/SignInScreenV2.tsx')).toContain('href="/(auth)/sign-up"');
  });
});
