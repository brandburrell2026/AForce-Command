/**
 * Editorial OS E1 foundation lock (founder authorization 2026-08-29).
 *
 * Two rulings are enforced here, planted BEFORE any screen migration so
 * they gate every later E-step:
 *
 * 1. ACCESSIBILITY IS SUPERIOR TO VISUAL FIDELITY. The editorial layer
 *    may not weaken Dynamic Type, contrast, wrapping behavior, Reduce
 *    Motion, or screen-reader semantics: `allowFontScaling` is banned
 *    outright in components/editorial/, caps never arrive via
 *    `textTransform`, the И signature never splits a word into per-letter
 *    Text runs, every token pair used for text meets WCAG contrast on its
 *    stock, and the motion hooks collapse under Reduce Motion.
 *
 * 2. THE VISUAL LAYER CONSUMES EXISTING TRUTH — IT DOES NOT CREATE TRUTH.
 *    E1 is foundation-only: the isolation sweep proves no production file
 *    imports the editorial layer (sole consumer = the dev/demo reference
 *    sheet), so merging E1 cannot change any live behavior. Each later
 *    E-step consciously removes its screen from that expectation.
 *
 * Truthful neutral is pinned with the wrong-scale/fabricated-zero history
 * in mind: a measured 0 RENDERS AS 0 (zero is data); only absence renders
 * as the em-dash.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { Colors } from '../../theme/colors';
import {
  edAccent,
  edInk,
  edRule,
  edStock,
  edType,
} from '../../theme/editorialTokens';
import { edFolioIndex, edNumberDisplay, splitMirrorWord } from '../editorial/editorialLogic';

const AOS = join(__dirname, '..', '..');
const ED_DIR = join(AOS, 'components', 'editorial');
const read = (p: string) => readFileSync(p, 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/** Docblocks may NAME a banned construct while documenting the rule — the
 * scans below run on comment-stripped source so only real code trips them. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

const edFiles = walk(ED_DIR);
const edSources = edFiles.map((f) => ({ file: relative(AOS, f), src: stripComments(read(f)) }));

// ————————————————————————————————————————————————————— WCAG contrast math
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe('editorial tokens — brand fidelity and WCAG contrast on each stock', () => {
  it('stocks and accents single-source the frozen brand values', () => {
    expect(edStock.black).toBe('#0D0D0D'); // Cinematic Black, brand v2.2.0
    expect(edAccent.red).toBe(Colors.accent.primary); // Signal Red, by reference
    // The tokens file may not re-declare Signal Red as a literal — the
    // accent is single-sourced from the frozen brand palette.
    expect(read(join(AOS, 'theme', 'editorialTokens.ts'))).not.toMatch(/#C1281B/i);
  });

  it('primary inks meet AAA (7:1) on their stocks', () => {
    expect(contrast(edInk.ivory, edStock.black)).toBeGreaterThanOrEqual(7);
    expect(contrast(edInk.black, edStock.paper)).toBeGreaterThanOrEqual(7);
  });

  it('quiet inks (captions, evidence, furniture) meet AA (4.5:1)', () => {
    expect(contrast(edInk.quietOnBlack, edStock.black)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(edInk.quietOnPaper, edStock.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it('accents meet 3:1 (large text / graphical marks) on both stocks', () => {
    expect(contrast(edAccent.red, edStock.black)).toBeGreaterThanOrEqual(3);
    expect(contrast(edAccent.red, edStock.paper)).toBeGreaterThanOrEqual(3);
    expect(contrast(edAccent.lockIn, edStock.black)).toBeGreaterThanOrEqual(3);
  });

  it('hairline rules are visible but subordinate (below text contrast)', () => {
    expect(contrast(edRule.onBlack, edStock.black)).toBeGreaterThan(1.1);
    expect(contrast(edRule.onPaper, edStock.paper)).toBeGreaterThan(1.1);
    expect(contrast(edRule.onBlack, edStock.black)).toBeLessThan(4.5);
    expect(contrast(edRule.onPaper, edStock.paper)).toBeLessThan(4.5);
  });
});

describe('edType — the approved afType ruling, structurally', () => {
  const statements = ['display', 'statement', 'command', 'confirm'] as const;
  const furniture = ['caption', 'micro'] as const;

  it('statement roles are Inter with tight (≤0) tracking — sentence-case voice', () => {
    for (const role of statements) {
      expect(edType[role].fontFamily, role).toMatch(/^Inter_/);
      expect(edType[role].letterSpacing ?? 0, role).toBeLessThanOrEqual(0);
    }
  });

  it('furniture roles are mono with positive tracking, above hard size floors', () => {
    for (const role of furniture) {
      expect(edType[role].fontFamily, role).toMatch(/^IBMPlexMono_/);
      expect(edType[role].letterSpacing ?? 0, role).toBeGreaterThan(0);
    }
    expect(edType.micro.fontSize).toBeGreaterThanOrEqual(9);
    expect(edType.caption.fontSize).toBeGreaterThanOrEqual(11);
    expect(edType.body.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('no editorial role reaches for Archivo Black (retired to the wordmark) or a serif', () => {
    for (const [role, def] of Object.entries(edType)) {
      expect(def.fontFamily, role).not.toMatch(/Archivo|Serif|Playfair|Garamond|Didot/i);
    }
  });
});

describe('accessibility lock — source rules for components/editorial/', () => {
  it('the layer exists and is non-trivial', () => {
    expect(edFiles.length).toBeGreaterThanOrEqual(4);
  });

  it('never disables or caps-off font scaling (Dynamic Type is intact)', () => {
    for (const { file, src } of edSources) {
      expect(src, `${file} must not touch allowFontScaling`).not.toMatch(/allowFontScaling/);
    }
  });

  it('never manufactures caps via textTransform (caps are authored furniture only)', () => {
    for (const { file, src } of edSources) {
      expect(src, file).not.toMatch(/textTransform/);
    }
  });

  it('never splits words into per-letter runs (И uses one text run — no mid-word wrap)', () => {
    for (const { file, src } of edSources) {
      expect(src, file).not.toMatch(/\.split\(['"]{2}\)|\.split\(''\)/);
    }
    expect(read(join(ED_DIR, 'core.tsx'))).toMatch(/splitMirrorWord/);
  });

  it('declares no raw hex colors or font sizes outside the token modules', () => {
    for (const { file, src } of edSources) {
      if (file.endsWith('editorialLogic.ts')) continue;
      const component = /\.tsx$/.test(file);
      if (!component) continue;
      expect(src, `${file} — colors come from editorialTokens`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src, `${file} — sizes come from edType`).not.toMatch(/fontSize\s*:/);
    }
  });

  it('honors Reduce Motion: the shared motion hook listens and collapses to the final frame', () => {
    const src = read(join(ED_DIR, 'instruments.tsx'));
    expect(src).toMatch(/isReduceMotionEnabled/);
    expect(src).toMatch(/reduceMotionChanged/);
    expect(src).toMatch(/if \(reduce\)/);
    expect(src).toMatch(/useNativeDriver: true/);
  });

  it('ships no interactive primitives in E1 — target rules land with the first interactive step', () => {
    for (const { file, src } of edSources) {
      expect(src, file).not.toMatch(/Pressable|TouchableOpacity|TouchableHighlight|onPress/);
    }
  });

  it('the И state word and the empty number announce truthfully to screen readers', () => {
    const core = read(join(ED_DIR, 'core.tsx'));
    expect(core).toMatch(/accessibilityLabel=\{word\}/);
    expect(core).toMatch(/no reading/);
  });
});

describe('truthful neutral — measured zero is data, absence is the em-dash', () => {
  it('renders — only for null/undefined/NaN', () => {
    expect(edNumberDisplay(null)).toBe('—');
    expect(edNumberDisplay(undefined)).toBe('—');
    expect(edNumberDisplay(Number.NaN)).toBe('—');
  });

  it('renders a measured zero as 0 — never fabricated, never hidden', () => {
    expect(edNumberDisplay(0)).toBe('0');
    expect(edNumberDisplay(69)).toBe('69');
  });
});

describe('И state language — pure split logic', () => {
  it('mirrors the LAST n of a word, preserving case register', () => {
    expect(splitMirrorWord('RECOVERING')).toEqual({ before: 'RECOVERI', glyph: 'И', after: 'G' });
    expect(splitMirrorWord('IN COMMAND')).toEqual({ before: 'IN COMMA', glyph: 'И', after: 'D' });
    expect(splitMirrorWord('own')).toEqual({ before: 'ow', glyph: 'и', after: '' });
  });

  it('leaves N-less words untouched (the signature is never forced)', () => {
    expect(splitMirrorWord('READY')).toBeNull();
  });

  it('folio furniture pads to editorial two digits', () => {
    expect(edFolioIndex(2, 7)).toBe('02 / 07');
    expect(edFolioIndex(11, 12)).toBe('11 / 12');
  });
});

describe('E1 isolation — zero production consumers (zero-behavioral-diff proof)', () => {
  const ALLOWED = new Set([
    'app/(hidden)/editorial-sheet.tsx', // the dev/demo reference sheet
  ]);
  const PRODUCTION_ROOTS = [
    'app',
    'components',
    'screens',
    'services',
    'store',
    'hooks',
    'utils',
    'data',
    'demo',
    'featureFlags',
    'analytics',
    'lib',
    'theme',
    'config',
  ];

  it('no production file imports the editorial layer except the hidden reference sheet', () => {
    const offenders: string[] = [];
    for (const root of PRODUCTION_ROOTS) {
      let files: string[] = [];
      try {
        files = walk(join(AOS, root));
      } catch {
        continue;
      }
      for (const f of files) {
        const rel = relative(AOS, f);
        if (rel.startsWith(join('components', 'editorial'))) continue;
        if (rel === join('theme', 'editorialTokens.ts')) continue;
        if (ALLOWED.has(rel.split('\\').join('/'))) continue;
        const src = read(f);
        if (/components\/editorial|editorialTokens/.test(src)) offenders.push(rel);
      }
    }
    expect(offenders, 'editorial layer leaked into production before its E-step').toEqual([]);
  });

  it('the reference sheet keeps the gallery guard idiom and lazy module load', () => {
    const sheet = read(join(AOS, 'app', '(hidden)', 'editorial-sheet.tsx'));
    expect(sheet).toMatch(/if \(!__DEV__ && !DEMO_MODE\) return <Redirect href="\/" \/>;/);
    expect(sheet).toMatch(/React\.lazy/);
  });
});
