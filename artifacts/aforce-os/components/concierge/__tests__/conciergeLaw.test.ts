/**
 * AForce Concierge — law lock (Section 64 surface, internal preview).
 *
 *  FLAG   — ai_concierge_enabled is OFF in production defaults, ON in the demo
 *           profile, granted to the internal TestFlight build (PR-003 D-05).
 *  NAV    — no new tab: the (tabs) manifest is untouched; the concierge is a
 *           pushed stack route guarded at the route seam (Redirect when off).
 *  WIRING — both Home surfaces mount the entry card; the three contextual
 *           Ask actions exist; the Profile privacy group has the memory row;
 *           the developer tab exposes the flag toggle.
 *  TRUTH  — no concierge source authors a dose, clock or product push (the
 *           server mirror-exact rule applies to generated text; the client
 *           must not author any either); no raw AsyncStorage; no hex literals
 *           (covered app-wide by brandTokenLiterals.lock); speech input is not
 *           offered (recognition is a stub).
 *  COPY   — every concierge locale key passes the §42 runtime scan (covered by
 *           consumerCopyClaimsLint across all locales; asserted here for the
 *           disclosure and urgent-adjacent strings explicitly).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../../featureFlags/flags';
import {
  CONCIERGE_INTERNAL_PREVIEW_OVERLAY_FLAGS,
  INTERNAL_TESTFLIGHT_OVERLAY_FLAGS,
} from '../../../featureFlags/internalTestflightOverlay';
import { consumerCopyBlocked } from '../../../utils/intelligence/languageGate/runtimeClaimScan';

const AOS = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(AOS, p), 'utf8');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const sources = () =>
  [...walk(join(AOS, 'components', 'concierge')), ...walk(join(AOS, 'services', 'concierge')), join(AOS, 'hooks', 'useConciergeConversation.ts'), join(AOS, 'hooks', 'useConciergeContext.ts')]
    .map((f) => ({ file: relative(AOS, f), src: stripComments(readFileSync(f, 'utf8')) }));

describe('FLAG — internal preview posture', () => {
  it('OFF in production defaults, ON in the demo profile', () => {
    expect(DEFAULT_FLAGS.ai_concierge_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.ai_concierge_enabled).toBe(true);
  });
  it('is granted to the internal TestFlight build through its own overlay group (PR-003 D-05, founder ruling 2026-10-05)', () => {
    expect([...CONCIERGE_INTERNAL_PREVIEW_OVERLAY_FLAGS]).toEqual(['ai_concierge_enabled']);
    expect([...INTERNAL_TESTFLIGHT_OVERLAY_FLAGS]).toContain('ai_concierge_enabled');
  });
});

describe('NAV — no new tab, guarded stack routes', () => {
  it('the tabs manifest gained no concierge file', () => {
    const tabs = readdirSync(join(AOS, 'app', '(tabs)'));
    expect(tabs.some((f) => /concierge/i.test(f))).toBe(false);
  });
  it('both routes redirect Home when the flag is off', () => {
    expect(read('app/concierge.tsx')).toMatch(/if \(!flags\.ai_concierge_enabled\) return <Redirect href="\/" \/>;/);
    expect(read('app/concierge/memory.tsx')).toMatch(/if \(!flags\.ai_concierge_enabled\) return <Redirect href="\/" \/>;/);
  });
  it('both routes are registered on the root stack as cards', () => {
    const layout = read('app/_layout.tsx');
    expect(layout).toMatch(/<Stack\.Screen name="concierge" options=\{\{ headerShown: false, presentation: 'card' \}\} \/>/);
    expect(layout).toMatch(/<Stack\.Screen name="concierge\/memory" options=\{\{ headerShown: false, presentation: 'card' \}\} \/>/);
  });
});

describe('WIRING — entry points exist and are flag-gated', () => {
  it('all three Home surfaces mount the entry card (editorial, V2 fallback, and the internal-TestFlight SkinIA Home)', () => {
    expect(read('components/editorial/home/EditorialHomeScreen.tsx')).toContain('<ConciergeEntryCard tone="editorial"');
    expect(read('components/home/HomeScreenV2.tsx')).toContain('<ConciergeEntryCard testID="home-concierge-entry"');
    // app/(tabs)/index.tsx renders SkinIntelligenceHomeScreen when EXPO_PUBLIC_INTERNAL_TESTFLIGHT
    // is true and advanced_visual_intelligence_enabled is on — which the overlay grants — so the
    // internal build's Home is THIS one. Build 103 shipped without it (2026-10-05).
    expect(read('components/skinIntelligence/SkinIntelligenceEditorialSuite.tsx')).toContain('<ConciergeEntryCard tone="editorial" testID="skinia-concierge-entry"');
    expect(read('components/concierge/ConciergeEntryCard.tsx')).toMatch(/if \(!flags\.ai_concierge_enabled\) return null;/);
  });
  it('the three contextual Ask actions are wired to AFTopBar', () => {
    expect(read('components/hydration/HydrationScreenV2.tsx')).toMatch(/useAskConciergeActions\('hydration'\)/);
    // Performance Signal is router-free by contract; its route builds the action.
    expect(read('app/performance-signal.tsx')).toMatch(/useAskConciergeActions\('signal'\)/);
    expect(read('components/hydration/PerformanceSignalV3.tsx')).toMatch(/actions=\{topBarActions\}/);
    expect(read('components/hydration/PerformanceSignalV3.tsx')).not.toMatch(/expo-router/);
    expect(read('components/insights/WeeklyReportV3.tsx')).toMatch(/useAskConciergeActions\('weekly'\)/);
    expect(read('components/concierge/AskConciergeAction.ts')).toMatch(/if \(!enabled\) return \[\];/);
  });
  it('Profile privacy group has the memory row and the developer tab has the toggle', () => {
    const pane = read('components/profile/panes/AccountPane.tsx');
    expect(pane).toMatch(/flags\.ai_concierge_enabled \? \(/);
    expect(pane).toContain("router.push('/concierge/memory')");
    expect(read('components/profile/panes/DeveloperPane.tsx')).toMatch(/flag="ai_concierge_enabled"/);
  });
  it('the intake source vocabulary gained exactly one concierge value on both sides', () => {
    expect(read('services/intakeSource.ts')).toMatch(/'concierge',/);
    expect(readFileSync(join(AOS, '..', 'api-server', 'src', 'routes', 'aforce', 'intakeSchema.ts'), 'utf8')).toMatch(/"concierge",/);
  });
});

describe('TRUTH — the client authors no dose, clock, product push, speech input, or raw storage', () => {
  const DOSE = /['"`][^'"`\n]*\b\d+\s*(oz|ounce|stick|serving)s?\b[^'"`\n]*['"`]/i;
  const CLOCK = /recheck in \d/i;
  const PRODUCT = /\bsticks?\b/i;
  it('no literal dose / clock / product string in any concierge source', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} — dose`).not.toMatch(DOSE);
      expect(src, `${file} — clock`).not.toMatch(CLOCK);
      expect(src, `${file} — product`).not.toMatch(PRODUCT);
    }
  });
  it('speech recognition is never offered (the service is a stub)', () => {
    for (const { file, src } of sources()) {
      expect(src, file).not.toMatch(/speechRecognitionService|startListening|expo-speech-recognition/);
    }
  });
  it('no raw AsyncStorage — account-scoped storage only', () => {
    for (const { file, src } of sources()) {
      expect(src, file).not.toMatch(/@react-native-async-storage\/async-storage/);
    }
  });
  it('the only write paths are the store intake action, navigation, and local reminders', () => {
    const actions = read('services/concierge/conciergeActions.ts');
    expect(actions).toMatch(/deps\.logIntake\('water'/);
    expect(actions).not.toMatch(/dispatch\(|setScore|scoreAfter|postIntakeLog/);
  });
});

describe('OPENING — one canonical move, same string the server sees (design review 2026-10-05)', () => {
  it('the opening renders the engine command through the same parse Home uses, from the SAME context object a turn sends', () => {
    const opening = read('components/concierge/ConciergeOpening.tsx');
    expect(opening).toMatch(/parseEngineActionCopy\(command\.action\)/);
    expect(opening).toMatch(/firstSentence\(command\?\.explanation\)/);
    const screen = read('components/concierge/ConciergeScreen.tsx');
    expect(screen).toMatch(/const openingContext = React\.useMemo\(\(\) => buildContext\(\)/);
    expect(screen).toMatch(/<ConciergeOpening[\s\S]*context=\{openingContext\}/);
    const ctx = read('services/concierge/conciergeContext.ts');
    expect(ctx).toMatch(/guardEngineOutput\(input\.engine\)/);
    expect(ctx).toMatch(/recheckInMinutes/);
    expect(ctx).toMatch(/loggedToday: u\.unitsConsumedToday > 0/);
  });
  it('the generated briefing card and the six-chip grid are gone; Why this? opens the production data sheet', () => {
    expect(existsSync(join(AOS, 'components', 'concierge', 'ConciergeBriefingCard.tsx'))).toBe(false);
    expect(existsSync(join(AOS, 'components', 'concierge', 'ConciergeSuggestedQuestions.tsx'))).toBe(false);
    const opening = read('components/concierge/ConciergeOpening.tsx');
    expect(opening).toMatch(/DataBehindThisSheet/);
    expect(opening).toMatch(/gatherDataBehindSignals\(biometrics\)/);
    expect(opening).toMatch(/pickSuggestedQuestion\(context\)/);
  });
  it('the opening uses af tokens only (editorialTokens are allow-listed elsewhere)', () => {
    expect(read('components/concierge/ConciergeOpening.tsx')).not.toMatch(/editorialTokens/);
  });
});

describe('COPY — concierge strings pass the §42 runtime scan', () => {
  const EN = JSON.parse(read('locales/en.json')) as { concierge: Record<string, unknown> };
  function* leaves(obj: unknown, path = ''): Generator<[string, string]> {
    if (typeof obj === 'string') yield [path, obj];
    else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) yield* leaves(v, path ? `${path}.${k}` : k);
  }
  it('every concierge.* key is clean', () => {
    for (const [key, value] of leaves(EN.concierge, 'concierge')) {
      expect(consumerCopyBlocked(value), `${key}: ${value}`).toBe(false);
    }
  });
  it('the AI disclosure is present and says AI + not medical advice', () => {
    const d = (EN.concierge as { ai_disclosure: string }).ai_disclosure;
    expect(d).toMatch(/is AI/);
    expect(d).toMatch(/not medical advice/);
  });
});
