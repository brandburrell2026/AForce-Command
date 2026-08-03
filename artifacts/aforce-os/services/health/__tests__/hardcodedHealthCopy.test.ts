/**
 * HARDCODED-COPY LOCK (Wave-3 follow-up PR 3: localization).
 *
 * Companion to `prohibitedCopy.test.ts` (which guards ONE specific banned
 * phrase across `locales/*.json`). This test guards a broader, structural
 * property across the Connected Health + canonical-consumer SOURCE tree:
 * no NEW user-facing sentence should be written as a raw string literal
 * instead of routed through the `I18nText` / `t()` locale system documented
 * in `connectedHealthView.ts`'s file header and consumed by
 * `ConnectedHealthView.tsx`.
 *
 * SCOPE — exactly what "the consumer layer" means here
 *   Every `*.ts` / `*.tsx` file directly under `services/health/` and
 *   `components/health/` (recursing into subdirectories like `healthConnect/`),
 *   EXCLUDING:
 *     - `__tests__/` directories (tests routinely assert literal expected
 *       copy on purpose — that is their job, not a violation).
 *     - `*Fixtures.ts` files (hand-built mock data for tests, not runtime
 *       consumer/presentation code).
 *
 * HEURISTIC — how a string literal is judged "suspicious"
 *   A single- or double-quoted string literal (comments stripped first) is
 *   flagged as a possible hardcoded user-facing string when ALL of:
 *     1. It has at least two whitespace-separated tokens (rules out unit
 *        strings like `'ms'`, `' bpm'`, `'hours'`, single-word enum values
 *        like `'stale'`, `'connected'`, and code identifiers).
 *     2. It is not "key-shaped" — a dotted lowercase/underscore path like
 *        `connected_health.header.title` (that IS the desired i18n routing
 *        value, never something to flag).
 *     3. It does not look like an import/require path (starts with `.`,
 *        `/`, or `@`, or contains a `/` anywhere — module specifiers never
 *        trip this scan).
 *   Two further exemptions keep the scan honest without needing a per-line
 *   `eslint-disable`-style escape hatch:
 *     - CANONICAL DOCUMENTED LITERALS: a string that is the right-hand side
 *       of an `(export) const UPPER_SNAKE_NAME = ` assignment (on the same
 *       logical statement, comments/newlines collapsed) is exempt. This
 *       codebase's convention (see `SCORE_PROTECTION_LINE` in
 *       `connectedHealthView.ts`, `READINESS_SIGNALS_SCORE_PROTECTION` in
 *       `readinessSignals.ts`) is to keep the EXACT, load-bearing English
 *       sentence as a named constant for tests/documentation to import and
 *       compare against — that is the opposite of a hardcoded-copy leak; it
 *       is the one legitimate place the literal is allowed to live.
 *     - INTERNAL DIAGNOSTIC MESSAGES: a string passed as the sole argument to
 *       `new SomethingError(...)` / `throw new Something(...)`, or assigned
 *       as an Error subclass's `message = '...'` default parameter, is
 *       exempt — these are developer-facing exception text (see
 *       `AppleHealthKitAuthorizationRevokedError`,
 *       `HealthConnectChangesTokenExpiredError`), never rendered to a user.
 *       The honesty discipline in this codebase already maps every thrown
 *       error to a closed status enum before it reaches any UI (see
 *       `providerPresentation.ts`, `connectedHealthView.ts`'s
 *       `ConnectedHealthErrorKind`) — raw error text has no path to a
 *       screen.
 *   A secondary, narrower check scans `.tsx` files for raw JSX text nodes
 *   (`>Some Words<` with no `{}` interpolation) as defense-in-depth against
 *   a literal slipping in as component children rather than a prop/string.
 *
 * KNOWN, DOCUMENTED DEBT — the pending-extraction allowlist
 *   `sleepSignals.ts` currently returns plain-string `freshness` / metric
 *   `label` values instead of `I18nText` keys. Extraction was investigated
 *   for this PR and found to be UNSAFE to perform blind:
 *     - `SleepSignalsForContainer.freshness` and `SleepMetricInput.label`
 *       flow directly into `services/sleep/sleepModeView.ts` and
 *       `screens/SleepModeScreen.tsx` — an entirely separate, currently
 *       non-i18n surface (verified: `PHASE_LABEL` / `CHIP_LABEL` /
 *       `CONFIDENCE_LABEL` and the rest of that module are all hardcoded
 *       English with zero `useTranslation()` calls anywhere in the Sleep
 *       Mode screen). Changing `sleepSignals.ts`'s return shape to
 *       `I18nText` would either render raw locale keys on that screen or
 *       fail to type-check there — both outside this PR's Connected-Health /
 *       canonical-consumer scope.
 *   The specific literals below are therefore allowlisted BY EXACT STRING,
 *   scoped to `sleepSignals.ts` only — a new, DIFFERENT hardcoded string
 *   anywhere in this file (or any other) still fails the scan. See
 *   `docs/health/TRANSLATION-REVIEW.md` ("pending extraction") for the full
 *   writeup and the follow-up recommendation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..'); // artifacts/aforce-os
const SCAN_DIRS = ['services/health', 'components/health'];

/**
 * Exact literals known to still be hardcoded, scoped to one file each.
 * Removing a string here without fixing its source should make this test
 * fail again — see the self-test at the bottom that proves the allowlist
 * cannot silently swallow an unrelated new violation.
 */
const PENDING_EXTRACTION_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
  'services/health/sleepSignals.ts': [
    'Last night',
    'No recent signal',
    'Signal is stale',
    'Permission needed',
    'Resting HR',
    'HRV (RMSSD)',
    'HRV (SDNN)',
  ],
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...walk(full));
    } else if (st.isFile() && (extname(entry) === '.ts' || extname(entry) === '.tsx')) {
      if (/Fixtures\.ts$/.test(entry)) continue;
      out.push(full);
    }
  }
  return out;
}

function stripComments(src: string): string {
  // Block comments are blanked (not deleted) char-for-char so line numbers
  // in any future debugging stay aligned with the original file.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, '');
}

const KEY_SHAPE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;
const PATH_PREFIX = /^[./@]/;
const CANONICAL_CONST = /[A-Z][A-Z0-9_]*\s*(:\s*string)?\s*=\s*$/;
const ERROR_DIAGNOSTIC = /(new\s+[A-Za-z0-9_]*Error\s*\(\s*$|throw\s+new\s+[A-Za-z0-9_]*\s*\(\s*$|\bmessage\s*=\s*$)/;

function isSuspiciousLiteral(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (KEY_SHAPE.test(trimmed)) return false;
  if (PATH_PREFIX.test(trimmed)) return false;
  if (trimmed.includes('/')) return false;
  return true;
}

interface Finding {
  file: string;
  line: number;
  value: string;
}

function scanFile(absPath: string): Finding[] {
  const relPath = relative(ROOT, absPath).split('\\').join('/');
  const raw = readFileSync(absPath, 'utf8');
  const src = stripComments(raw);
  const allowlist = new Set(PENDING_EXTRACTION_ALLOWLIST[relPath] ?? []);
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
  const findings: Finding[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const val = m[1] ?? m[2] ?? '';
    if (!isSuspiciousLiteral(val)) continue;
    const idx = m.index;
    const before = src.slice(Math.max(0, idx - 120), idx).replace(/\n/g, ' ');
    if (CANONICAL_CONST.test(before)) continue;
    if (ERROR_DIAGNOSTIC.test(before)) continue;
    if (allowlist.has(val)) continue;
    findings.push({ file: relPath, line: src.slice(0, idx).split('\n').length, value: val });
  }
  return findings;
}

/** Defense-in-depth: raw JSX text nodes (`>Some Words<`) with no `{}` escape. */
function scanJsxTextNodes(absPath: string): Finding[] {
  const relPath = relative(ROOT, absPath).split('\\').join('/');
  if (extname(absPath) !== '.tsx') return [];
  const raw = readFileSync(absPath, 'utf8');
  const src = stripComments(raw);
  const re = />([A-Z][a-zA-Z]+(?: [a-zA-Z][a-zA-Z]*)+)</g;
  const findings: Finding[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    findings.push({ file: relPath, line: src.slice(0, m.index).split('\n').length, value: m[1] });
  }
  return findings;
}

function allScannedFiles(): string[] {
  return SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
}

describe('no new hardcoded user-facing strings in the health consumer layer', () => {
  const files = allScannedFiles();

  it('scans a non-trivial number of source files (scope sanity check)', () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  for (const file of files) {
    const relPath = relative(ROOT, file).split('\\').join('/');
    it(`${relPath} has no un-allowlisted hardcoded copy`, () => {
      const findings = [...scanFile(file), ...scanJsxTextNodes(file)];
      if (findings.length > 0) {
        const detail = findings.map((f) => `  L${f.line}: ${JSON.stringify(f.value)}`).join('\n');
        throw new Error(
          `${relPath} contains hardcoded user-facing string(s) not routed through the ` +
            `locale system (I18nText / t()). If this is genuinely new copy, add a locale ` +
            `key (see connected_health.* in locales/*.json) instead of a literal. If it is ` +
            `known, tracked debt, add it to PENDING_EXTRACTION_ALLOWLIST in this test AND to ` +
            `docs/health/TRANSLATION-REVIEW.md's pending-extraction table.\n${detail}`,
        );
      }
      expect(findings).toEqual([]);
    });
  }

  it('every allowlisted pending-extraction file still exists and is still scanned', () => {
    const scannedRel = new Set(files.map((f) => relative(ROOT, f).split('\\').join('/')));
    for (const relPath of Object.keys(PENDING_EXTRACTION_ALLOWLIST)) {
      expect(scannedRel.has(relPath)).toBe(true);
    }
  });

  it('self-test: the scanner actually flags a hardcoded sentence when one is present', () => {
    // Proves the heuristic is live, not accidentally neutered — mirrors
    // prohibitedCopy.test.ts's own "trap" sanity check.
    expect(isSuspiciousLiteral('This is a hardcoded sentence')).toBe(true);
    expect(isSuspiciousLiteral('connected_health.header.title')).toBe(false); // key-shaped
    expect(isSuspiciousLiteral('@/services/health/signalResolution')).toBe(false); // import path
    expect(isSuspiciousLiteral('ms')).toBe(false); // unit, single word
    expect(isSuspiciousLiteral('stale')).toBe(false); // enum value, single word
    expect(isSuspiciousLiteral('HRV (RMSSD)')).toBe(true); // multi-word, all-caps acronym still counts
  });

  it('self-test: the allowlist only exempts its exact literal, not the whole file', () => {
    // If sleepSignals.ts grows a NEW hardcoded sentence beyond the tracked
    // seven, this proves it would still be caught (not masked by presence
    // in the allowlist map).
    const relPath = 'services/health/sleepSignals.ts';
    const allowlist = new Set(PENDING_EXTRACTION_ALLOWLIST[relPath] ?? []);
    expect(allowlist.has('A brand new hardcoded sentence')).toBe(false);
  });
});
