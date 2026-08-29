/**
 * Editorial Moments — The Day + The Performance Story — E3 law lock.
 *
 * Planted BEFORE the implementation, per the standing charter. Enforces the
 * founder's locked rulings on the two Moments surfaces:
 *
 *  R1   — no issue number; date/day furniture only.
 *  R2   — no invented Lock-In state. The Moments posture vocabulary is
 *         `completed | active | upcoming` (momentsPresentation.ts) — there is
 *         NO canonical "clear" state, so the spec prototype's CLEAR label and
 *         its lock-in blue are BANNED here.
 *  И    — the mark marks canonical single-token state words. Moments has no
 *         such vocabulary (its states are postures and multi-word phrases),
 *         so the editorial Moments surfaces carry NO И. One signature per
 *         surface: The Day gets the node spine.
 *  CMD  — the moment's action renders the guarded label VERBATIM; no dose,
 *         clock, imperative or product copy may be authored here.
 *  TRUTH— recommendations come from useMomentsData's guarded `recFor`, never
 *         from a direct buildRecommendation call; the four ritual stages come
 *         from `rec.ritual` and are never re-derived or reordered.
 *  WRITE— "I'm ready" writes exactly what production writes, and nothing else.
 *  NONE — absent data stays absent: skeleton before hydration, the existing
 *         empty state, redirect on unknown id. Nothing is manufactured.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../featureFlags/flags';
import {
  chapterNumber,
  returnLabel,
  spineStateFor,
} from '../editorial/moments/editorialMomentsPresentation';

const AOS = join(__dirname, '..', '..');
const ED_MOMENTS = join(AOS, 'components', 'editorial', 'moments');
const read = (p: string) => readFileSync(p, 'utf8');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}
const files = () => walk(ED_MOMENTS);
const sources = () => files().map((f) => ({ file: relative(AOS, f), src: stripComments(read(f)) }));
const day = () => stripComments(read(join(ED_MOMENTS, 'EditorialMomentsScreen.tsx')));
const story = () => stripComments(read(join(ED_MOMENTS, 'EditorialMomentDetailScreen.tsx')));

describe('FLAG — one flag, both seams, legacy screens are the OFF branch', () => {
  it('editorial_moments_enabled is OFF in production and ON in the demo profile', () => {
    expect(DEFAULT_FLAGS.editorial_moments_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.editorial_moments_enabled).toBe(true);
  });

  it('both routes keep the existing screen as the flag-OFF branch', () => {
    const overview = read(join(AOS, 'app', 'moments.tsx'));
    expect(overview).toMatch(
      /editorial_moments_enabled\s*\?\s*<EditorialMomentsScreen\s*\/>\s*:\s*<MomentsScreen\s*\/>/,
    );
    const detail = read(join(AOS, 'app', 'moment', '[id].tsx'));
    expect(detail).toMatch(/editorial_moments_enabled/);
    expect(detail).toMatch(/<MomentDetailScreen/); // legacy still reachable
  });

  it('neither route loses its moments_enabled gate', () => {
    for (const p of [join(AOS, 'app', 'moments.tsx'), join(AOS, 'app', 'moment', '[id].tsx')]) {
      expect(read(p)).toMatch(/moments_enabled/);
    }
  });
});

describe('R2 / И — no invented state vocabulary', () => {
  it('spineStateFor passes the canonical posture through, and knows no other state', () => {
    expect(spineStateFor('completed')).toBe('done');
    expect(spineStateFor('active')).toBe('live');
    expect(spineStateFor('upcoming')).toBe('next');
    // @ts-expect-error — an unknown posture is a programming error, not a state
    expect(() => spineStateFor('clear')).toThrow();
  });

  it('no "CLEAR" state word and no Lock-In treatment anywhere on these surfaces', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} renders a non-canonical CLEAR state`).not.toMatch(/\bCLEAR\b/);
      expect(src, `${file} reaches for Lock-In`).not.toMatch(/lockIn|Lock[- ]?[Ii]n\b/);
    }
  });

  it('carries no И: Moments has no canonical single-token state word', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} must not use the state-word mark`).not.toMatch(/EdStateWord|splitMirrorWord/);
    }
  });

  it('R1 — no issue number in the editorial Moments tree', () => {
    for (const { file, src } of sources()) {
      expect(src, file).not.toMatch(/issue\s*(no\b|number|#)|ISSUE\s+\d|issueIndex/i);
    }
  });

  it('the return idiom is truthful date furniture, not an issue reference', () => {
    const label = returnLabel(new Date('2026-08-29T12:00:00Z'), 'en-US');
    expect(label).toMatch(/AUG/);
    expect(label).not.toMatch(/ISSUE/i);
    // Pure: same input, same output.
    expect(returnLabel(new Date('2026-08-29T12:00:00Z'), 'en-US')).toBe(label);
  });
});

describe('TRUTH — guarded recommendations, charter-locked ritual', () => {
  it('both surfaces consume the guarded recFor, never a raw buildRecommendation', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} must not build recommendations itself`).not.toMatch(/buildRecommendation/);
    }
    expect(day()).toMatch(/recFor/);
  });

  it('the ritual is rendered from rec.ritual in order — never re-derived or reordered', () => {
    const s = story();
    expect(s).toMatch(/rec\.ritual\.map/);
    expect(s).not.toMatch(/\.sort\(|\.reverse\(|\.filter\(/);
    // Stage titles reuse the shipped opening.ritual_* identity.
    expect(s).toMatch(/opening\.ritual_/);
  });

  it('chapter numbers are presentation only — derived from index, not from state', () => {
    expect(chapterNumber(0)).toBe('01');
    expect(chapterNumber(3)).toBe('04');
    expect(chapterNumber(9)).toBe('10');
  });

  it('the evidence line stays fail-closed inline — the deleted WHY sheet is not resurrected on the story', () => {
    expect(story()).not.toMatch(/WhyThisSheet/);
    expect(story()).toMatch(/rec\.evidence\.summaryKey/);
  });
});

describe('CMD — the moment action renders verbatim', () => {
  it('the guarded label + params are passed straight to t()', () => {
    expect(day()).toMatch(/t\(\s*(?:rec|action)\.?\w*\.?primaryAction\.labelKey|t\(action\.labelKey/);
  });

  it('no editorial Moments source authors a dose, clock, imperative or product push', () => {
    const DOSE = /\d+\s*(oz|ounce|stick|serving)/i;
    const CLOCK = /recheck in \d/i;
    const IMPERATIVE = /\b(take|drink|sip|grab|down)\s+(\d|one|two|a\s|another)/i;
    const PRODUCT = /\bsticks?\b/i;
    for (const { file, src } of sources()) {
      expect(src, `${file} — dose`).not.toMatch(DOSE);
      expect(src, `${file} — clock`).not.toMatch(CLOCK);
      expect(src, `${file} — imperative`).not.toMatch(IMPERATIVE);
      expect(src, `${file} — product`).not.toMatch(PRODUCT);
    }
  });
});

describe('WRITE — "I\'m ready" does exactly what production does', () => {
  it('same three effects, same guards, readOnly respected', () => {
    const s = story();
    expect(s).toMatch(/markCalendarMomentPrepared/);
    expect(s).toMatch(/updateMoment\(/);
    expect(s).toMatch(/cancelMomentNotification/);
    expect(s).toMatch(/preparedAtIso: new Date\(\)\.toISOString\(\)/);
    expect(s).toMatch(/!prepared && !readOnly/);
  });

  it('adds no second write path and no un-prepare control', () => {
    for (const { file, src } of sources()) {
      expect(src, `${file} must not log intake or touch score`).not.toMatch(
        /logIntake|confirmCommand|dispatch\(/,
      );
      expect(src, `${file} must not clear prepared state`).not.toMatch(/preparedAtIso:\s*(null|undefined)/);
    }
  });
});

describe('NONE — absent data stays absent', () => {
  it('the day waits for hydration and reuses the existing skeleton + empty state', () => {
    const d = day();
    expect(d).toMatch(/data\.hydrated/);
    expect(d).toMatch(/MomentsOverviewSkeleton/);
    expect(d).toMatch(/moments\.empty_title/);
  });

  it('masking is applied to BOTH the visible title and the accessibility label', () => {
    for (const src of [day(), story()]) {
      const masked = src.match(/moment\.masked \? t\('moments\.private_event'\)/g) ?? [];
      expect(masked.length).toBeGreaterThanOrEqual(1);
      // No accessibility label may interpolate a raw title (the legacy
      // overview's latent leak must not be reproduced).
      expect(src).not.toMatch(/accessibilityLabel=\{[^}]*\bmoment\.title\b[^}]*\}/);
    }
  });
});

describe('A11Y — the E2 rules carry forward', () => {
  it('never disables font scaling, never manufactures caps', () => {
    for (const { file, src } of sources()) {
      expect(src, file).not.toMatch(/allowFontScaling/);
      expect(src, file).not.toMatch(/textTransform/);
    }
  });

  it('interactive rows meet the 44pt floor and rows wrap rather than clip', () => {
    const all = sources().map((s) => s.src).join('\n');
    expect(all).toContain('edRhythm.minTarget');
    for (const { file, src } of sources()) {
      expect(src, `${file} must not shrink targets`).not.toMatch(/minHeight:\s*(?:[1-3]?\d)\b/);
    }
  });

  it('the back control uses the repo\'s guarded idiom (deep-linkable routes)', () => {
    // Both surfaces share ONE return control, and that control guards:
    // /moments is deep-linkable AND is itself a redirect target, so a bare
    // router.back() can be inert with an empty history.
    const ret = stripComments(read(join(ED_MOMENTS, 'EdReturn.tsx')));
    expect(ret).toMatch(/router\.canGoBack\(\) \? router\.back\(\) : router\.replace\(/);
    for (const src of [day(), story()]) {
      expect(src).toMatch(/<EdReturn/);
    }
  });
});
