/**
 * BRAND-TOKEN-LITERAL LOCK (RC-2 Ruling E, 2026-08-05).
 *
 * Founder Ruling E ratified `#8B5CF6` as the named `af.guardian` token and
 * retired `#F4B23F` in favor of the already-existing `af.amber` (`#FFA01E`).
 * Every previously-raw occurrence of both hex values in app source was
 * migrated to the corresponding `af.*` token (see `theme/afTokens.ts` and the
 * PR body's per-file mapping table). This test is the regression lock: it
 * fails the moment either hex literal reappears anywhere in app source
 * OUTSIDE `theme/`, where they legitimately live as the tokens' own
 * definitions (`af.guardian` binds to `Colors.guardian.primary` = `#8B5CF6`;
 * `af.amber` binds to `Colors.states.RECOVERING.primary` = `#FFA01E` — the
 * amber value itself never contained `#F4B23F`).
 *
 * Modeled on `services/health/__tests__/hardcodedHealthCopy.test.ts`'s
 * scan-the-source-tree pattern: comments are stripped first (so this file's
 * own explanatory comments, and each migrated call site's
 * `// RC-2 Ruling E: #F4B23F retired to ...` breadcrumb, don't self-trigger),
 * then every string/template literal is checked for either hex value,
 * case-insensitively (catches lowercase authoring and any future
 * `${'#8b5cf6'}NN` alpha-suffix hack).
 *
 * SCOPE: every `.ts` / `.tsx` file under `artifacts/aforce-os`, excluding:
 *   - `node_modules/`
 *   - `theme/` (the tokens' own home — `af.guardian` / `Colors.guardian.*`
 *     and `af.amber` / `Colors.states.RECOVERING.*` definitions live here)
 *   - `__tests__/` directories and `*.test.ts(x)` files (tests routinely
 *     assert literal expected hex values on purpose, e.g. this file and
 *     `afTokens.test.ts` itself)
 *   - `*Fixtures.ts` files (hand-built mock data, not runtime/consumer code)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..'); // artifacts/aforce-os
const EXCLUDED_TOP_LEVEL_DIRS = new Set(['node_modules', 'theme']);

const BANNED: { name: string; pattern: RegExp }[] = [
  { name: '#8B5CF6 (raw Guardian purple — use af.guardian / af.guardianDim / af.guardianTint / af.guardianHairline)', pattern: /#8B5CF6/i },
  { name: '#F4B23F (retired amber — use af.amber)', pattern: /#F4B23F/i },
];

function stripComments(src: string): string {
  // Block comments are blanked (not deleted) char-for-char so line numbers
  // stay aligned with the original file, matching the established pattern in
  // hardcodedHealthCopy.test.ts.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__') continue;
      if (dir === ROOT && EXCLUDED_TOP_LEVEL_DIRS.has(entry)) continue;
      out.push(...walk(full));
    } else if (st.isFile() && (extname(entry) === '.ts' || extname(entry) === '.tsx')) {
      if (/Fixtures\.ts$/.test(entry)) continue;
      if (/\.test\.tsx?$/.test(entry)) continue;
      out.push(full);
    }
  }
  return out;
}

interface Finding {
  file: string;
  line: number;
  bannedName: string;
}

function scanFile(absPath: string): Finding[] {
  const relPath = relative(ROOT, absPath).split('\\').join('/');
  const src = stripComments(readFileSync(absPath, 'utf8'));
  const findings: Finding[] = [];
  for (const { name, pattern } of BANNED) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      findings.push({ file: relPath, line: src.slice(0, m.index).split('\n').length, bannedName: name });
    }
  }
  return findings;
}

function allScannedFiles(): string[] {
  return walk(ROOT);
}

describe('RC-2 Ruling E: #8B5CF6 and #F4B23F are retired outside theme/', () => {
  const files = allScannedFiles();

  it('scans a non-trivial number of source files (scope sanity check)', () => {
    expect(files.length).toBeGreaterThanOrEqual(100);
  });

  it('theme/ itself is excluded from the walk (sanity check on the exclusion, not a false-negative)', () => {
    const scannedRel = new Set(files.map((f) => relative(ROOT, f).split('\\').join('/')));
    expect(scannedRel.has('theme/afTokens.ts')).toBe(false);
    expect(scannedRel.has('theme/colors.ts')).toBe(false);
  });

  for (const file of files) {
    const relPath = relative(ROOT, file).split('\\').join('/');
    it(`${relPath} contains no raw #8B5CF6 or #F4B23F literal`, () => {
      const findings = scanFile(file);
      if (findings.length > 0) {
        const detail = findings.map((f) => `  L${f.line}: ${f.bannedName}`).join('\n');
        throw new Error(
          `${relPath} contains a retired raw brand-color literal. Use the af.* token instead ` +
            `(af.guardian/af.guardianDim/af.guardianTint/af.guardianHairline for #8B5CF6, ` +
            `af.amber for #F4B23F) — see theme/afTokens.ts and RC-2 Ruling E.\n${detail}`,
        );
      }
      expect(findings).toEqual([]);
    });
  }

  it('self-test: the scanner actually flags both banned literals when present', () => {
    const src = "const a = '#8B5CF6'; const b = '#f4b23f';\n";
    const findings = BANNED.flatMap(({ name, pattern }) => (pattern.test(src) ? [name] : []));
    expect(findings).toHaveLength(2);
  });

  it('self-test: comments referencing the retired literals do not trip the scan', () => {
    const src = "// RC-2 Ruling E: #F4B23F retired to the approved af.amber (#FFA01E)\nconst AMBER = af.amber;\n";
    const stripped = stripComments(src);
    expect(/#F4B23F/i.test(stripped)).toBe(false);
  });

  it('self-test: the af.amber value itself (#FFA01E) never matches the banned #F4B23F pattern', () => {
    expect(BANNED[1].pattern.test('#FFA01E')).toBe(false);
  });
});

/**
 * VS 3.0 FOUNDATION — RAW-COLOR DRIFT RATCHET.
 *
 * Beyond the two retired literals above, this freezes the CURRENT per-file count
 * of raw color literals (`#rgb` / `#rrggbb` / `#rrggbbaa` and `rgb()`/`rgba()`)
 * and stops the tree drifting further from the af.* token layer. It is a BASELINE
 * ratchet, NOT a global ban — the codebase still carries known color debt,
 * recorded in `rawColorBaseline.json`. The suite fails when:
 *   1. a file EXCEEDS its baseline count            → a regression / increase
 *   2. a NEW file introduces raw color (baseline 0)  → new raw-color file
 *   3. a baseline entry is STALE — its file was deleted OR its count dropped
 *      below the recorded number → the baseline must ratchet DOWN to reality so
 *      it can never silently re-absorb a regression.
 * Raising a baseline number is only possible by editing `rawColorBaseline.json`,
 * which appears in the PR diff = explicit review authorization. After an
 * authorized change, regenerate deterministically with:
 *   UPDATE_RAW_COLOR_BASELINE=1 npx vitest run theme/__tests__/brandTokenLiterals.lock.test.ts
 * Exclusions are IDENTICAL to the literal lock above (node_modules, theme/,
 * __tests__/, *.test.*, *Fixtures.ts) — reusing walk()/stripComments(). Narrow
 * and documented; not broadened.
 */
const BASELINE_PATH = join(__dirname, 'rawColorBaseline.json');
const RAW_COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

function countRawColors(absPath: string): number {
  const src = stripComments(readFileSync(absPath, 'utf8'));
  const matches = src.match(RAW_COLOR_RE);
  return matches ? matches.length : 0;
}

function currentRawColorCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const abs of allScannedFiles()) {
    const rel = relative(ROOT, abs).split('\\').join('/');
    const n = countRawColors(abs);
    if (n > 0) out[rel] = n;
  }
  return out;
}

// Canonical serialization: keys sorted, repo-relative POSIX paths, 2-space
// indent, trailing newline — so the committed baseline is deterministic and any
// hand-edit produces a minimal, reviewable diff.
function serializeBaseline(counts: Record<string, number>): string {
  const keys = Object.keys(counts).sort();
  const body = keys.map((k) => `  ${JSON.stringify(k)}: ${counts[k]}`).join(',\n');
  return keys.length ? `{\n${body}\n}\n` : '{}\n';
}

describe('VS 3.0: raw-color drift ratchet (baseline)', () => {
  const current = currentRawColorCounts();

  if (process.env.UPDATE_RAW_COLOR_BASELINE) {
    writeFileSync(BASELINE_PATH, serializeBaseline(current), 'utf8');
  }

  it('rawColorBaseline.json exists (seed with UPDATE_RAW_COLOR_BASELINE=1)', () => {
    expect(existsSync(BASELINE_PATH)).toBe(true);
  });

  const baseline: Record<string, number> = existsSync(BASELINE_PATH)
    ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<string, number>)
    : {};

  it('baseline is canonically sorted + normalized (deterministic, reviewable diffs)', () => {
    if (!existsSync(BASELINE_PATH)) return;
    expect(readFileSync(BASELINE_PATH, 'utf8')).toBe(serializeBaseline(baseline));
  });

  it('no file exceeds its baseline (no regressions, no new raw-color files)', () => {
    const violations: string[] = [];
    for (const [file, n] of Object.entries(current)) {
      const cap = baseline[file] ?? 0;
      if (n > cap) {
        violations.push(
          `  ${file}: ${n} raw colors (baseline ${cap})` +
            (cap === 0
              ? ' — NEW raw-color file; use af.* tokens / withAlpha()'
              : ' — increased; migrate the added literals'),
        );
      }
    }
    if (violations.length) {
      throw new Error(
        'Raw-color drift increased — migrate to af.* / withAlpha(). Raising a ' +
          'baseline requires an explicit, reviewed edit to rawColorBaseline.json:\n' +
          violations.join('\n'),
      );
    }
    expect(violations).toEqual([]);
  });

  it('no stale baseline entries (deleted files, or counts that dropped below baseline)', () => {
    const stale: string[] = [];
    for (const [file, cap] of Object.entries(baseline)) {
      const n = current[file] ?? 0;
      if (n < cap) {
        stale.push(
          `  ${file}: baseline ${cap}, actual ${n}` +
            (n === 0
              ? ' — file deleted or fully migrated; remove the entry'
              : ` — improved; lower the entry to ${n}`),
        );
      }
    }
    if (stale.length) {
      throw new Error(
        'rawColorBaseline.json is stale — it must ratchet DOWN to reality so it ' +
          'can never hide a future regression. Regenerate with ' +
          'UPDATE_RAW_COLOR_BASELINE=1:\n' +
          stale.join('\n'),
      );
    }
    expect(stale).toEqual([]);
  });

  it('self-test: scanner counts hex + rgba, ignores comments', () => {
    const sample =
      "const a='#0D0D0D'; const b='rgba(0,0,0,0.5)';\n// #FFFFFF comment\n/* rgba(1,2,3,1) */";
    const matches = stripComments(sample).match(RAW_COLOR_RE) || [];
    expect(matches.length).toBe(2);
  });
});
