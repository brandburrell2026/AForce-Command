/**
 * First run opens on the approved prototype's "What should we call you?".
 * Source-level, like the sibling location test: the screen pulls in
 * react-native and Clerk, which do not load in node.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const CODE = read('components/onboarding/OnboardingScreenV2.tsx')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/.*$/gm, '');
const en = JSON.parse(read('locales/en.json')).onboarding.v2 as Record<string, string>;
const between = (a: string, b: string) => CODE.slice(CODE.indexOf(a), CODE.indexOf(b, CODE.indexOf(a)));

describe('the name step — the prototype\'s copy', () => {
  it.each([
    ['name_eyebrow', 'Almost there'],
    ['name_title', 'What should we call you?'],
    ['name_sub', 'Shown to you, and to people you invite later.'],
    ['name_label', 'First name'],
  ])('%s', (key, value) => {
    expect(en[key]).toBe(value);
    expect(CODE).toContain(`t('onboarding.v2.${key}')`);
  });

  it('every locale file carries the keys', () => {
    for (const f of readdirSync(join(ROOT, 'locales')).filter((n) => n.endsWith('.json'))) {
      const v2 = JSON.parse(read(`locales/${f}`)).onboarding.v2 as Record<string, string>;
      for (const k of ['name_eyebrow', 'name_title', 'name_sub', 'name_label', 'name_error']) {
        expect(v2[k], `${f} ${k}`).toBeTruthy();
      }
    }
  });
});

describe('the name step — where it sits', () => {
  it('first run opens on it, and the older promise slides are gone', () => {
    expect(CODE).toContain("React.useState<Step>('name')");
    expect(CODE).not.toMatch(/promise[123]|PROMISE_/);
  });

  it('it leads to the goal step, and Back from goal returns to it', () => {
    expect(CODE).toContain("if (s === 'goal') return 'name';");
    expect(between('const submitName', 'const goNext').match(/setStep\('goal'\)/g)).toHaveLength(2);
  });

  it('the body questions are all still there, in the same order', () => {
    expect(CODE).toContain("const INPUT_STEPS: Step[] = ['goal', 'activity', 'profile', 'lifestyle'];");
    for (const step of ['goal', 'activity', 'profile', 'lifestyle', 'ready']) {
      expect(CODE, step).toContain(`{step === '${step}' && (`);
    }
  });
});

describe('the name step — saving', () => {
  const submit = between('const submitName', 'const goNext');

  it('saves to the member\'s account, where the greeting already reads it', () => {
    expect(submit).toContain('await clerkUser.update({ firstName: next })');
    expect(CODE).toContain("const accountFirstName = clerkUser?.firstName ?? '';");
  });

  it('a blank or unchanged name saves nothing and still moves on', () => {
    expect(submit).toMatch(/if \(!next \|\| next === accountFirstName \|\| !clerkUser \|\| nameError\) \{[\s\S]*?setStep\('goal'\);\s*return;/);
  });

  it('a failed save tells the member, and the next press moves on rather than trapping them', () => {
    expect(submit).toMatch(/catch \{\s*setNameError\(true\);/);
    expect(submit).toContain('|| nameError)');
    expect(en.name_error).toContain('go on without it');
  });

  it('Continue is never gated on the name', () => {
    expect(CODE).toContain("(step === 'name' && !nameSaving) ||");
  });

  it('writes nothing else: no profile field, no storage key', () => {
    expect(submit).not.toMatch(/setProfileIdentity|AsyncStorage|saveProfileVersion/);
  });

  it('sign-up no longer asks the name, so it is asked once', () => {
    expect(read('components/auth/SignUpScreenV2.tsx')).not.toContain('firstName');
  });
});
