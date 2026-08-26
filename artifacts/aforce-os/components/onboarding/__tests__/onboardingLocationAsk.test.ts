/**
 * Wave-5 — where the location ask moved to, and what it says first.
 *
 * Companion to `store/__tests__/noPermissionRequestOnProviderMount.test.ts`:
 * that one proves nothing asks at launch, this one proves the ask still
 * exists, lives beside its explanation, and costs no extra onboarding step
 * (the founder measures TIME TO FIRST TRUSTED ACTION — the fix must not buy
 * trust with a longer wizard).
 *
 * Source-text guard rather than a mounted screen, same convention as the
 * other `*Wiring` tests in this repo: `OnboardingScreenV2` pulls in
 * `expo-router`, `expo-haptics`, AsyncStorage and `useAppStore`, none of
 * which load under this repo's vitest runtime (`__DEV__ is not defined`,
 * `governance/TEST-BASELINE.md`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import en from '../../../locales/en.json';
import ar from '../../../locales/ar.json';
import de from '../../../locales/de.json';
import es from '../../../locales/es.json';
import fr from '../../../locales/fr.json';
import hi from '../../../locales/hi.json';
import itLocale from '../../../locales/it.json'; // "it" would shadow vitest's it()
import ja from '../../../locales/ja.json';
import ko from '../../../locales/ko.json';
import pt from '../../../locales/pt.json';
import zh from '../../../locales/zh.json';

const SCREEN = resolve(__dirname, '..', 'OnboardingScreenV2.tsx');
const SOURCE = readFileSync(SCREEN, 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

const LOCALES: Record<string, { onboarding: { v2: Record<string, string> } }> = {
  en, ar, de, es, fr, hi, it: itLocale, ja, ko, pt, zh,
} as never;

const LOCATION_KEYS = [
  'location_title',
  'location_sub',
  'location_connected',
  'location_denied',
  'location_a11y',
] as const;

describe('onboarding owns the location ask', () => {
  it('requests foreground location from the screen the member is looking at', () => {
    expect(CODE).toMatch(/Location\.requestForegroundPermissionsAsync\(\)/);
  });

  it('only ever asks from the switch handler — never from a mount effect', () => {
    // The mount effect exists, but it QUERIES. If the request ever appears
    // inside a `useEffect`, the member meets a dialog they did not ask for.
    const effects = [...CODE.matchAll(/React\.useEffect\(\(\) => \{[\s\S]*?\n  \}, \[/g)];
    expect(effects.length).toBeGreaterThan(0);
    for (const effect of effects) {
      expect(effect[0]).not.toContain('requestForegroundPermissionsAsync');
    }
    expect(CODE).toMatch(/getForegroundPermissionsAsync\(\)/);
  });

  it('turning the switch OFF never fires a request', () => {
    expect(CODE).toMatch(/onValueChange=\{\(v\) => \{\s*if \(!v\) return;\s*void askForLocation\(\);/);
  });

  it('locks the switch when the OS will not ask again — no dead control', () => {
    expect(CODE).toMatch(
      /disabled=\{locationPermission === 'granted' \|\| !locationCanAskAgain\}/,
    );
    expect(CODE).toMatch(/const \{ status, canAskAgain \} = await Location\.requestForegroundPermissionsAsync\(\)/);
  });

  it('renders the explanation copy in the same row as the switch', () => {
    const row = CODE.slice(
      CODE.indexOf("t('onboarding.v2.location_title')"),
      CODE.indexOf('testID="onboarding-location-switch"'),
    );
    expect(row).toContain("t('onboarding.v2.location_sub')");
    expect(row.length).toBeGreaterThan(0);
  });

  it('carries an honest denied state — and never claims a reading it does not have', () => {
    expect(CODE).toContain("t('onboarding.v2.location_denied')");
    expect(CODE).toContain("t('onboarding.v2.location_connected')");
    // 'unknown' is not a denial: before the member answers, we say nothing.
    expect(CODE).toMatch(/locationPermission !== 'unknown' \?/);
  });

  it('adds NO onboarding step — the ask rides the existing LIFESTYLE step', () => {
    const steps = CODE.slice(CODE.indexOf('type Step ='), CODE.indexOf('const PROMISE_STEPS'));
    expect(steps).not.toMatch(/'location'/);
    expect(CODE).toMatch(
      /const INPUT_STEPS: Step\[\] = \['goal', 'activity', 'profile', 'lifestyle'\];/,
    );
    // The row is inside the lifestyle branch, before the 'ready' branch.
    const lifestyleStart = CODE.indexOf("{step === 'lifestyle' && (");
    const readyStart = CODE.indexOf("{step === 'ready' && (");
    const rowAt = CODE.indexOf("t('onboarding.v2.location_title')");
    expect(lifestyleStart).toBeGreaterThan(-1);
    expect(rowAt).toBeGreaterThan(lifestyleStart);
    expect(rowAt).toBeLessThan(readyStart);
  });

  it('does not gate Continue on the answer — declining costs no taps', () => {
    expect(CODE).toMatch(/step === 'lifestyle';/);
    expect(CODE).not.toMatch(/canContinue[\s\S]{0,200}locationPermission/);
  });

  it('every locale carries the copy (English placeholders, per this repo)', () => {
    for (const [name, bundle] of Object.entries(LOCALES)) {
      for (const key of LOCATION_KEYS) {
        expect(bundle.onboarding.v2[key], `${name}.onboarding.v2.${key}`).toBeTruthy();
      }
    }
  });

  it('mutation-verify: moving the request into the mount effect is caught', () => {
    const regressed = CODE.replace(
      'const { status } = await Location.getForegroundPermissionsAsync();',
      'const { status } = await Location.requestForegroundPermissionsAsync();',
    );
    const effects = [...regressed.matchAll(/React\.useEffect\(\(\) => \{[\s\S]*?\n  \}, \[/g)];
    expect(
      effects.some((e) => e[0].includes('requestForegroundPermissionsAsync')),
    ).toBe(true);
  });
});
