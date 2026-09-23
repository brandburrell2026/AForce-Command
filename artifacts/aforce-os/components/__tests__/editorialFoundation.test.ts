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
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import { Colors } from '../../theme/colors';
import {
  edAccent,
  edInk,
  edRule,
  edStock,
  edType,
  edPositive,
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

  // E5 gap closure (2026-08-30): edPositive shipped on three editorial screens
  // with NO contrast coverage on either stock. Measured, it clears the text
  // floor on black at ~5.96:1 but reaches only ~2.48:1 on paper — below the
  // 4.5:1 text floor AND below the 3:1 graphical floor. That is why founder
  // Decision D1 withholds positive hue from the paper register entirely; this
  // test is the lock that makes the gap visible instead of silent.
  it('the positive state token meets AA on the stock it actually ships on', () => {
    // edPositive shipped on three editorial screens with NO contrast coverage
    // on either stock. On black it clears the text floor comfortably.
    expect(contrast(edPositive, edStock.black)).toBeGreaterThanOrEqual(4.5);
    // It measures ~2.48:1 on paper — below the 4.5:1 text floor and below even
    // the 3:1 graphical floor — which is why founder Decision D1 withholds
    // positive hue from the paper register. The BAN lives in
    // editorialWeeklyLaw.test.ts (the layer may not reference edPositive at
    // all). Deliberately NOT asserted as `toBeLessThan(3)` here: that would
    // lock the defect in and fail the moment anyone darkens the token to fix
    // it, which is a remediation this lock must never forbid.
    expect(contrast(edPositive, edStock.paper)).toBeGreaterThan(1);
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
    // Strengthened in E2 after the adversarial review caught a race: the
    // preference is async, so "not answered yet" is a third state. The
    // settle holds the FINAL frame until the OS answers, and an unknown
    // answer resolves to reduce=true for anything else that asks.
    expect(src).toMatch(/if \(reduce === null\) return;/);
    expect(src).toMatch(/if \(reduce \|\| playedRef\.current\)/);
    expect(src).toMatch(/useReduceMotionState\(\) \?\? true/);
    expect(src).toMatch(/useNativeDriver: true/);
  });

  it('foundation primitives stay non-interactive; the E2 home layer meets the target floor instead', () => {
    // E1 shipped no interactive primitives. E2 (founder ruling 2026-08-29)
    // consciously introduces interactivity in components/editorial/home/ —
    // that layer is governed by editorialHomeLaw.test.ts (44pt floor,
    // hitSlop, parity pins). The FOUNDATION files stay non-interactive.
    for (const { file, src } of edSources) {
      if (file.includes(join('editorial', 'home'))) continue;
      // E3: the Moments layer is likewise interactive and governed by
      // editorialMomentsLaw.test.ts.
      if (file.includes(join('editorial', 'moments'))) continue;
      // E4 (founder decisions 2026-08-30): the Protocol layer is interactive
      // too (the WHY disclosure) and is governed by
      // editorialProtocolLaw.test.ts.
      if (file.includes(join('editorial', 'protocol'))) continue;
      // E5 (founder decisions 2026-08-30): the Weekly layer carries the
      // degraded-source retry control and is governed by
      // editorialWeeklyLaw.test.ts (44pt floor, labelled target).
      if (file.includes(join('editorial', 'weekly'))) continue;
      // E6-B (founder authorization 2026-08-30): the Scan layer is interactive
      // (the reader target, retry and audio stop) and is governed by
      // editorialScanLaw.test.ts.
      if (file.includes(join('editorial', 'scan'))) continue;
      expect(src, file).not.toMatch(/Pressable|TouchableOpacity|TouchableHighlight|onPress/);
    }
  });

  it('display-voice roles cap at the existing house boundary (no mid-word breaks at AX) — body/caption stay unlimited', () => {
    const core = stripComments(read(join(ED_DIR, 'core.tsx')));
    // The only multiplier value the layer may use is the accepted af-layer
    // boundary; statements + command + numbers reference it, and no
    // hand-rolled numeric cap may appear anywhere in the directory.
    expect(core.match(/maxFontSizeMultiplier=\{AF_MAX_DISPLAY_FONT_SCALE\}/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    for (const { file, src } of edSources) {
      expect(src, `${file} — only the house boundary may cap scaling`).not.toMatch(
        /maxFontSizeMultiplier=\{[0-9]/,
      );
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

/** Appended to a DR-017 presentation-only file that reaches past the tokens
 * module into components/editorial — the one thing that record does NOT permit. */
export const DR017_TOKENS_ONLY_SUFFIX =
  ' (imports components/editorial; DR-017 permits editorialTokens only)';

/**
 * The E1 isolation sweep as a pure function of a root directory, so the SAME
 * code that guards the real tree can be proven against a fixture tree.
 *
 * - The editorial layer itself (components/editorial/**, theme/editorialTokens.ts)
 *   is never a consumer and is always skipped.
 * - `allowed` (the E-step route seams, each citing its founder ruling) is
 *   skipped entirely.
 * - `presentationOnly` (DR-017) may reference editorialTokens, but is reported
 *   the moment its source mentions components/editorial.
 * - Everything else is reported on ANY reference to either — exactly the
 *   original lock. Sources are read raw (not comment-stripped), as before.
 *
 * Exported for the fixture tests below only; it is not application code.
 */
export function findEditorialOffenders(
  rootDir: string,
  {
    roots,
    allowed,
    presentationOnly,
  }: {
    roots: readonly string[];
    allowed: ReadonlySet<string>;
    presentationOnly: ReadonlySet<string>;
  },
): string[] {
  const offenders: string[] = [];
  for (const root of roots) {
    let files: string[] = [];
    try {
      files = walk(join(rootDir, root));
    } catch {
      continue;
    }
    for (const f of files) {
      const rel = relative(rootDir, f);
      if (rel.startsWith(join('components', 'editorial'))) continue;
      if (rel === join('theme', 'editorialTokens.ts')) continue;
      const key = rel.split('\\').join('/');
      if (allowed.has(key)) continue;
      const src = read(f);
      if (presentationOnly.has(key)) {
        if (/components\/editorial/.test(src)) offenders.push(rel + DR017_TOKENS_ONLY_SUFFIX);
        continue;
      }
      if (/components\/editorial|editorialTokens/.test(src)) offenders.push(rel);
    }
  }
  return offenders.sort();
}

describe('E1 isolation — zero production consumers (zero-behavioral-diff proof)', () => {
  const ALLOWED = new Set([
    'app/(hidden)/editorial-sheet.tsx', // the dev/demo reference sheet
    // E2 (founder ruling 2026-08-29): the Home route's flag seam is the
    // first authorized production consumer — HomeScreenV2 remains the
    // flag-OFF branch, locked by editorialHomeLaw.test.ts.
    'app/(tabs)/index.tsx',
    // E2 acceptance stage: the dev/demo screen gallery hosts the Cover
    // fixtures (lazy-loaded behind the (hidden)/gallery guard).
    'demo/AForceScreenGallery.tsx',
    // E3 (founder ruling 2026-08-29): the two Moments route seams. The
    // legacy screens remain the flag-OFF branches, locked by
    // editorialMomentsLaw.test.ts.
    'app/moments.tsx',
    join('app', 'moment', '[id].tsx'),
    // E4 (founder decisions 2026-08-30): the Protocol route's three-way seam.
    // ProtocolScreenV2 and ProtocolScreenLegacy both remain rollback branches.
    join('app', '(tabs)', 'protocol.tsx'),
    // E5 (founder decisions 2026-08-30): the Weekly Report route's four-way
    // seam. WeeklyReportV3, ReadinessInsightsV2 and WeeklyReportLegacy all
    // remain rollback branches, locked by editorialWeeklyLaw.test.ts.
    'app/weekly-report.tsx',
    // E6-B (founder authorization 2026-08-30): BOTH Scan route seams.
    // HydrationScanScreenV2 remains the flag-OFF rollback on each.
    'app/scan.tsx',
    join('app', '(tabs)', 'scan.tsx'),
  ]);
  // DR-017 (founder Decision A3, 2026-09-23): a NARROW presentation-layer
  // exception for SkinIA — governance/decisions/DR-017-skinia-editorial-
  // presentation-reuse.md. These five files, exactly these, may import
  // '@/theme/editorialTokens' ONLY. No wildcard, no directory-wide exemption;
  // a sixth entry requires amending DR-017. They may NOT reach into
  // components/editorial (the sweep reports that with DR017_TOKENS_ONLY_SUFFIX).
  // Flag-and-cohort gating is untouched by this record:
  // advanced_visual_intelligence_enabled is false in DEFAULT_FLAGS and true only
  // via the internal-TestFlight overlay (featureFlags/internalTestflightOverlay.ts)
  // plus a server-resolved cohort grant (services/skiniaCohortAccess.ts,
  // services/skiniaCohortGate.ts). This permission is NOT derived from DR-015
  // or AF-SI-001A — neither mentions the editorial layer; DR-017 is the record
  // that grants it. Kept SEPARATE from ALLOWED: these are not E-step route seams.
  const DR017_SKINIA_PRESENTATION_ALLOWED = new Set([
    'app/skinia.tsx',
    'components/advancedVisual/AdvancedVisualIntelligenceScreen.tsx',
    'components/advancedVisual/SkinIACameraCaptureScreen.tsx',
    'components/advancedVisual/SkinIAObservationResultsFixture.tsx',
    'components/skinIntelligence/SkinIntelligenceEditorialSuite.tsx',
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

  const SWEEP = {
    roots: PRODUCTION_ROOTS,
    allowed: ALLOWED,
    presentationOnly: DR017_SKINIA_PRESENTATION_ALLOWED,
  };

  it('no production file imports the editorial layer except the hidden reference sheet', () => {
    const offenders = findEditorialOffenders(AOS, SWEEP);
    expect(offenders, 'editorial layer leaked into production before its E-step').toEqual([]);
  });

  it('DR-017 allowlist names exact files, no wildcard, and every file exists', () => {
    // Five, exactly. A sixth requires amending DR-017 (the record says so) AND
    // this pin — the two must move together.
    expect(DR017_SKINIA_PRESENTATION_ALLOWED.size).toBe(5);
    for (const entry of DR017_SKINIA_PRESENTATION_ALLOWED) {
      expect(entry, `${entry} — no wildcard`).not.toMatch(/\*/);
      expect(entry, `${entry} — no directory suffix`).not.toMatch(/\/$/);
      expect(entry, `${entry} — a file, not a directory`).toMatch(/\.tsx?$/);
      expect(
        existsSync(join(AOS, entry)),
        `${entry} must exist — a stale entry is a dormant exemption`,
      ).toBe(true);
    }
  });

  it('DR-017 files reference editorialTokens only, never components/editorial', () => {
    for (const entry of DR017_SKINIA_PRESENTATION_ALLOWED) {
      const src = read(join(AOS, entry));
      expect(src, `${entry} — DR-017 grants the tokens module only`).not.toMatch(
        /components\/editorial/,
      );
      // The exemption must be LIVE: an entry that no longer touches the tokens
      // module is a dormant exemption and must leave the allowlist.
      expect(src, `${entry} — dormant DR-017 entry; remove it`).toMatch(
        /@\/theme\/editorialTokens/,
      );
    }
  });

  // ————————————————————————————————— negative coverage on a fixture tree
  // The fixture mirrors ONE real DR-017 entry so the fixture sweep runs with
  // the SAME three sets as the real sweep (no fixture-only configuration that
  // could drift from what actually guards the tree). Every path is built with
  // path.join so the Windows-safe key normalization in the helper still applies.
  const DR017_FIXTURE_ENTRY = 'components/advancedVisual/AdvancedVisualIntelligenceScreen.tsx';

  function writeFixtureTree(root: string, presentationOnlyImport: string): void {
    const files: Array<[string[], string]> = [
      // The layer itself — never a consumer, always skipped.
      [
        ['components', 'editorial', 'core.tsx'],
        "import { edInk } from '../../theme/editorialTokens';\nexport const core = edInk;\n",
      ],
      [['theme', 'editorialTokens.ts'], 'export const edInk = {};\n'],
      // An E-step seam (ALLOWED) — skipped entirely.
      [
        ['app', '(tabs)', 'index.tsx'],
        "import { EditorialHomeScreen } from '@/components/editorial/home/EditorialHomeScreen';\nexport default EditorialHomeScreen;\n",
      ],
      // A DR-017 presentation-only consumer — what it imports is the variable.
      [
        DR017_FIXTURE_ENTRY.split('/'),
        `import { edInk } from '${presentationOnlyImport}';\nexport const screen = edInk;\n`,
      ],
      // An UNLISTED consumer — must always be caught.
      [
        ['components', 'rogue', 'Leak.tsx'],
        "import { edInk } from '@/theme/editorialTokens';\nexport const leak = edInk;\n",
      ],
    ];
    for (const [segments, src] of files) {
      mkdirSync(join(root, ...segments.slice(0, -1)), { recursive: true });
      writeFileSync(join(root, ...segments), src, 'utf8');
    }
  }

  it('an unapproved consumer still fails the lock', () => {
    expect(DR017_SKINIA_PRESENTATION_ALLOWED.has(DR017_FIXTURE_ENTRY)).toBe(true);
    const tmp = mkdtempSync(join(tmpdir(), 'e1-lock-'));
    try {
      writeFixtureTree(tmp, '@/theme/editorialTokens');
      expect(findEditorialOffenders(tmp, SWEEP)).toEqual([join('components', 'rogue', 'Leak.tsx')]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('a DR-017 file that reaches past tokens into components/editorial fails the lock', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'e1-lock-'));
    try {
      writeFixtureTree(tmp, '@/components/editorial/core');
      expect(findEditorialOffenders(tmp, SWEEP)).toEqual([
        join(...DR017_FIXTURE_ENTRY.split('/')) + DR017_TOKENS_ONLY_SUFFIX,
        join('components', 'rogue', 'Leak.tsx'),
      ]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('the reference sheet keeps the gallery guard idiom and lazy module load', () => {
    const sheet = read(join(AOS, 'app', '(hidden)', 'editorial-sheet.tsx'));
    expect(sheet).toMatch(/if \(!__DEV__ && !DEMO_MODE\) return <Redirect href="\/" \/>;/);
    expect(sheet).toMatch(/React\.lazy/);
  });
});
