import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FIRST_MOMENT_OPTIONS, firstMomentCard, parseFirstMomentChoice } from '../firstMoment';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
const loaded = { hydrated: true, count: 0 };

describe('"Your first Moment" card', () => {
  it('no answer: the general card, with the quiet button', () => {
    expect(firstMomentCard(null, loaded)).toEqual({
      eyebrow: 'Your first Moment',
      title: 'Plan your first Moment',
      note: 'Something coming up? Say it or type it. You get a short plan to seal.',
      action: 'Plan it',
      lead: false,
    });
  });

  it.each([
    ['train', 'Plan your next training or game'],
    ['work', 'Plan your next big work moment'],
    ['night', 'Plan your next night out'],
    ['travel', 'Plan your next trip'],
  ] as const)('%s: its own title, and the filled button', (choice, title) => {
    const card = firstMomentCard(choice, loaded)!;
    expect(card.title).toBe(title);
    expect(card.lead).toBe(true);
    expect(card.action).toBe('Plan it');
  });

  it('gone once the member has any Moment', () => {
    expect(firstMomentCard('train', { hydrated: true, count: 1 })).toBeNull();
  });

  it('never shown before the member\'s Moments have loaded', () => {
    expect(firstMomentCard('train', { hydrated: false, count: 0 })).toBeNull();
  });

  it('the trip card promises only what One Breath does', () => {
    expect(firstMomentCard('travel', loaded)!.note).toBe('Say where and when. You get a short plan to seal.');
  });
});

describe('the answers', () => {
  it('four of the prototype\'s five: no bedtime plan exists to open', () => {
    expect(FIRST_MOMENT_OPTIONS.map((o) => o.value)).toEqual(['train', 'work', 'night', 'travel']);
  });

  it('anything else read back from storage is treated as no answer', () => {
    expect(parseFirstMomentChoice('work')).toBe('work');
    for (const bad of ['sleep', '', 'TRAIN', null, undefined]) expect(parseFirstMomentChoice(bad)).toBeNull();
  });

  it('every locale has the question\'s copy, word for word in English', () => {
    const en = JSON.parse(read('locales/en.json')).onboarding.v2 as Record<string, string>;
    expect(en.prep_eyebrow).toBe('Optional');
    expect(en.prep_title).toBe("What's coming up first?");
    expect(en.prep_later).toBe('Decide later');
    // "Change it anytime." is not claimed: there is nowhere to change it.
    expect(en.prep_sub).toBe('Pick one. It becomes your first plan on Home.');
    for (const o of FIRST_MOMENT_OPTIONS) expect(en[`prep_${o.value}`]).toBe(o.label);
    for (const f of readdirSync(join(ROOT, 'locales')).filter((n) => n.endsWith('.json'))) {
      const v2 = JSON.parse(read(`locales/${f}`)).onboarding.v2 as Record<string, string>;
      for (const k of ['prep_eyebrow', 'prep_title', 'prep_sub', 'prep_later', ...FIRST_MOMENT_OPTIONS.map((o) => `prep_${o.value}`)]) {
        expect(v2[k], `${f} ${k}`).toBeTruthy();
      }
    }
  });
});

describe('wiring', () => {
  const ONBOARDING = strip(read('components/onboarding/OnboardingScreenV2.tsx'));
  const HOME = strip(read('components/home/cinematic/HomeCinematicContainer.tsx'));
  const SERVICE = strip(read('services/firstMomentChoice.ts'));
  const GATE = strip(read('hooks/useFirstMomentAvailable.ts'));

  it('question and card share one gate: the two that make One Breath end in a plan', () => {
    expect(GATE).toContain('return momentsFirst && preparationPreviewEnabled();');
    expect(ONBOARDING).toContain('const prepAvailable = useFirstMomentAvailable();');
    expect(HOME).toContain('const firstMomentAvailable = useFirstMomentAvailable();');
    expect(HOME).toMatch(/firstMomentAvailable && !props\.fixtureMoments\s*\? firstMomentCard\(/);
    // The route checks the same two.
    const route = read('app/one-breath.tsx');
    expect(route).toContain('useMomentsFirstExperience()');
    expect(route).toContain('preparationPreviewEnabled()');
  });

  it('the question is optional and skipped entirely where the gate is off', () => {
    expect(ONBOARDING).toContain("const afterName: Step = prepAvailable ? 'prep' : 'goal';");
    expect(ONBOARDING).toContain("step === 'prep' ||");
    expect(ONBOARDING).toContain("setPrep(selected ? null : opt.value)");
    expect(ONBOARDING).toMatch(/step === 'prep' && prep == null\s*\? t\('onboarding\.v2\.prep_later'\)/);
  });

  it('the answer is kept under the member\'s own scope, never raw storage', () => {
    expect(SERVICE).toContain("from './scopedStorage'");
    expect(SERVICE).not.toContain('async-storage');
    expect(ONBOARDING).toContain('void writeFirstMomentChoice(prep);');
  });

  it('the card\'s one button opens One Breath and nothing else', () => {
    expect(HOME).toContain("<HomeFirstMomentCard card={firstCard} onPlan={() => router.push('/one-breath')} />");
    const card = strip(read('components/home/cinematic/HomeFirstMomentCard.tsx'));
    expect(card.match(/onPress=/g)).toHaveLength(1);
    expect(card).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it('the answer feeds no score, target or profile field', () => {
    expect(ONBOARDING.slice(ONBOARDING.indexOf('const finish'), ONBOARDING.indexOf('const submitName'))).not.toMatch(/prep\b/);
  });
});
