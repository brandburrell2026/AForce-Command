/**
 * Editorial Home (The Cover) — E2 law lock (founder ruling 2026-08-29).
 *
 * Planted BEFORE the implementation, per the E2 charter. Enforces the locked
 * rulings structurally so they cannot regress:
 *
 *  R1  — no issue-number fabrication: date/day furniture only.
 *  R2  — no invented Lock-In state (no standing lock-in surface in E2).
 *  R3  — unknown identity renders nothing; no fabricated greeting/name.
 *  LAW — pressure field: pure, monotone presentation of the canonical score;
 *        null in → nothing out; computes/infers nothing.
 *  LAW — И vocabulary: the state word is the canonical PerformanceLevel token
 *        only; PEAK/DEPLETED (no N) render unmirrored — never forced.
 *  LAW — command verbatim: the editorial home source authors no dose, clock,
 *        imperative-with-amount, or product push; the command is the guarded
 *        engine string through the SAME parse Home V2 uses.
 *  LAW — no fabrication: absent readings stay em-dash/silent (the V3
 *        formatters and silence rules are consumed, not reimplemented).
 *  FLAG — editorial_home_enabled OFF in production, ON in the demo profile;
 *        HomeScreenV2 is the flag-OFF rollback branch at the route seam.
 *  PARITY — no member action is stranded: the three Home routes, the water
 *        picker wiring, and both WHY disclosures exist in the editorial tree.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../../featureFlags/flags';
import { splitMirrorWord } from '../editorial/editorialLogic';
import {
  mastheadDateLabel,
  memberFurniture,
  pressureIntensity,
} from '../editorial/home/editorialHomePresentation';

const AOS = join(__dirname, '..', '..');
const ED_HOME = join(AOS, 'components', 'editorial', 'home');
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
const homeFiles = () => walk(ED_HOME);
const homeSources = () =>
  homeFiles().map((f) => ({ file: relative(AOS, f), src: stripComments(read(f)) }));

describe('FLAG — posture and rollback seam', () => {
  it('editorial_home_enabled is OFF in production and ON in the demo profile', () => {
    expect(DEFAULT_FLAGS.editorial_home_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.editorial_home_enabled).toBe(true);
  });

  it('the route seam keeps HomeScreenV2 as the flag-OFF branch', () => {
    const route = read(join(AOS, 'app', '(tabs)', 'index.tsx'));
    expect(route).toMatch(
      /flags\.editorial_home_enabled\s*\?\s*<EditorialHomeScreen\s*\/>\s*:\s*<HomeScreenV2\s*\/>/,
    );
  });
});

describe('LAW — pressure field is pure presentation of the canonical score', () => {
  it('null / undefined / NaN in → null out (no field for an unknown state)', () => {
    expect(pressureIntensity(null)).toBeNull();
    expect(pressureIntensity(undefined)).toBeNull();
    expect(pressureIntensity(Number.NaN)).toBeNull();
  });

  it('is monotone: pressure rises exactly as the state falls', () => {
    let prev = -1;
    for (let s = 100; s >= 0; s -= 5) {
      const v = pressureIntensity(s)!;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('clamps out-of-range scores instead of extrapolating', () => {
    expect(pressureIntensity(140)).toBe(0);
    expect(pressureIntensity(-20)).toBe(1);
  });

  it('the field never gains a second input: the source consumes score alone', () => {
    const src = stripComments(read(join(ED_HOME, 'editorialHomePresentation.ts')));
    const fn = src.slice(src.indexOf('function pressureIntensity'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    for (const banned of ['trend', 'Date.now', 'hrv', 'sleep', 'heat', 'random', 'history']) {
      expect(body, `pressureIntensity must not read ${banned}`).not.toContain(banned);
    }
  });
});

describe('LAW — И vocabulary is the canonical band union only', () => {
  it('PEAK and DEPLETED have no N and render unmirrored — the mark is never forced', () => {
    expect(splitMirrorWord('PEAK')).toBeNull();
    expect(splitMirrorWord('DEPLETED')).toBeNull();
    expect(splitMirrorWord('BALANCED')?.glyph).toBe('И');
    expect(splitMirrorWord('RECOVERING')?.glyph).toBe('И');
  });

  it('the state word surface renders the engine band token, not an authored word', () => {
    const screen = stripComments(read(join(ED_HOME, 'EditorialHomeScreen.tsx')));
    expect(screen).toMatch(/EdStateWord\s+word=\{engine\.performanceState\.level\}/);
    // No invented state labels anywhere in the editorial home tree.
    for (const { file, src } of homeSources()) {
      for (const invented of ['OPTIMIZED', 'LOCKED-IN', 'CHARGED', 'PRIMED', 'DIALED']) {
        expect(src, `${file} invents a state word`).not.toContain(invented);
      }
    }
  });

  it('R2 — no standing Lock-In surface exists in E2', () => {
    for (const { file, src } of homeSources()) {
      expect(src, file).not.toMatch(/lockIn|Lock[- ]?[Ii]n/);
    }
  });
});

describe('LAW — command verbatim; no authored second command', () => {
  it('the screen consumes the guarded engine command through the same parse as Home V2', () => {
    const screen = stripComments(read(join(ED_HOME, 'EditorialHomeScreen.tsx')));
    expect(screen).toMatch(/parseEngineActionCopy\(engine\.command\.action\)/);
    expect(screen).toMatch(/engine\.command\.explanation/);
  });

  it('no editorial home source authors a dose, clock, amount-imperative, or product push', () => {
    const DOSE = /\d+\s*(oz|ounce|stick|serving)/i;
    const CLOCK = /recheck in \d/i;
    const IMPERATIVE = /\b(take|drink|sip|grab|down)\s+(\d|one|two|a\s|another)/i;
    const PRODUCT = /\bsticks?\b/i;
    for (const { file, src } of homeSources()) {
      expect(src, `${file} — dose`).not.toMatch(DOSE);
      expect(src, `${file} — clock`).not.toMatch(CLOCK);
      expect(src, `${file} — imperative`).not.toMatch(IMPERATIVE);
      expect(src, `${file} — product`).not.toMatch(PRODUCT);
    }
  });
});

describe('R1 / R3 — truthful furniture only', () => {
  it('R1 — no issue number anywhere in the editorial home tree', () => {
    for (const { file, src } of homeSources()) {
      expect(src, file).not.toMatch(/issue\s*(no\b|number|#)|ISSUE\s+\d|issueIndex|issueCount/i);
    }
  });

  it('R1 — the masthead date is a pure function of the provided date', () => {
    const a = mastheadDateLabel(new Date('2026-08-29T12:00:00Z'), 'en-US');
    const b = mastheadDateLabel(new Date('2026-08-29T12:00:00Z'), 'en-US');
    expect(a).toBe(b);
    expect(a).toMatch(/AUG/);
    expect(a).not.toMatch(/\bISSUE\b|№/);
  });

  it('R3 — unknown identity renders nothing; a name is passed through untouched', () => {
    expect(memberFurniture(null)).toBeNull();
    expect(memberFurniture(undefined)).toBeNull();
    expect(memberFurniture('   ')).toBeNull();
    expect(memberFurniture('Brandon')).toBe('Brandon');
  });

  it('R3 — no fabricated greeting fallback exists in the tree', () => {
    for (const { file, src } of homeSources()) {
      expect(src, file).not.toMatch(/welcome,\s*there|greeting_default|'there'/i);
    }
  });
});

describe('NO-FABRICATION — absent data stays silent or em-dashed', () => {
  it('the footer consumes the V3 honest formatters instead of reimplementing them', () => {
    const src = read(join(ED_HOME, 'EditorialHomeScreen.tsx'));
    for (const fn of ['formatSleepHours', 'formatHrvMs', 'formatHydrationPct', 'resolveHealthChip']) {
      expect(src, `must consume ${fn}`).toContain(fn);
    }
  });

  it('the evidence gate, confidence, and freshness resolvers are the production ones', () => {
    const src = read(join(ED_HOME, 'EditorialHomeScreen.tsx'));
    for (const fn of [
      'resolveHomeEvidence',
      'resolveHomeConfidence',
      'freshestBiometricsFetchedAt',
      'hasAnyProviderArtifact',
      'countRealHistoryEntries',
    ]) {
      expect(src, `must consume ${fn}`).toContain(fn);
    }
  });
});

describe('PARITY — no member action is stranded', () => {
  it('all three Home routes survive', () => {
    const all = homeFiles().map(read).join('\n');
    expect(all).toContain("'/weekly-report'");
    expect(all).toContain("'/moments'");
    expect(all).toContain('/moment/');
  });

  it('the water picker wiring, cycle guards, and both overlays survive', () => {
    const screen = read(join(ED_HOME, 'EditorialHomeScreen.tsx'));
    for (const needle of [
      'WaterAmountModal',
      'CycleSuccessOverlay',
      'logIntake',
      'confirmInFlightRef',
      'isCompletingCycle',
      'showCycleSuccess',
      "fireMoment('command_completed')",
    ]) {
      expect(screen, `missing ${needle}`).toContain(needle);
    }
  });

  it('both WHY disclosures survive (command rationale + moment evidence)', () => {
    const all = homeFiles().map(read).join('\n');
    expect(all).toContain('commandReasonLine');
    expect(all).toContain('WhyThisSheet');
  });

  it('interactive targets meet the 44pt floor via the editorial rhythm token', () => {
    const all = homeFiles().map((f) => stripComments(read(f))).join('\n');
    expect(all).toContain('edRhythm.minTarget');
    for (const { file, src } of homeSources()) {
      expect(src, `${file} must not shrink targets`).not.toMatch(/minHeight:\s*(?:[1-3]?\d)\b/);
    }
  });
});
