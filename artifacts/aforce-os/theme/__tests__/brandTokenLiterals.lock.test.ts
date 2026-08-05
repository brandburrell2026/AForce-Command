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
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
